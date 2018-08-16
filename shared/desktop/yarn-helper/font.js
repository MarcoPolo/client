// @flow
/* eslint-disable sort-keys */
import fs from 'fs'
import path from 'path'
import {execSync} from 'child_process'
import prettier from 'prettier'
import webfontsGenerator from 'webfonts-generator'

const commands = {
  'updated-fonts': {
    code: updatedFonts,
    help: 'Update our font sizes automatically',
  },
  'update-icon-constants': {
    code: updateConstants,
    help: 'Update icon.constants.js with new/removed files',
  },
  'unused-assets': {
    code: unusedAssetes,
    help: 'Find unused assets',
  },
}

const paths = {
  iconfont: path.resolve(__dirname, '../../images/iconfont'),
  iconpng: path.resolve(__dirname, '../../images/icons'),
  fonts: path.resolve(__dirname, '../../fonts'),
  iconConstants: path.resolve(__dirname, '../../common-adapters/icon.constants.js'),
}

const fontHeight = 2048
const descentFraction = 16 // Source: https://icomoon.io/#docs/font-metrics
const ascent = fontHeight
const descent = fontHeight / descentFraction
const baseCharCode = 0xe900

const iconfontRegex = /^(\d+)-kb-iconfont-(.*)-(\d+).svg$/
const mapPaths = shouldPrintSkipped => path => {
  const match = path.match(iconfontRegex)
  if (!match || match.length !== 4) return console.error(`Filename did not match, skipping ${path}`)
  const [, counter, name, size] = match

  if (!counter) {
    throw new Error(`Invalid counter for filename ${path}`)
  }

  if (!(size === '8' || size === '16' || size === '24')) {
    throw new Error(`Invalid size for filename ${path} - valid sizes are 8, 16, 24`)
  }

  const score = Number(counter)
  return !isNaN(score) ? {filePath: path, counter: score, name, size} : null
}
const getSvgNames = shouldPrintSkipped =>
  fs
    .readdirSync(paths.iconfont)
    .map(mapPaths(shouldPrintSkipped))
    .filter(Boolean)
    .sort((x, y) => x.counter - y.counter)

const getSvgPaths = shouldPrintSkipped =>
  getSvgNames(shouldPrintSkipped).map(i => path.resolve(paths.iconfont, i.filePath))

/*
 * This function will read all of the SVG files specified above, and generate a
 * single ttf iconfont from the svgs. webfonts-generator will write the file to
 * `dest`.
 *
 * For config options: https://github.com/sunflowerdeath/webfonts-generator
 */
function updatedFonts() {
  console.log('Created new webfont')
  const svgFilePaths = getSvgPaths(true /* print skipped */)
  webfontsGenerator(
    {
      // An intermediate svgfont will be generated and then converted to TTF by webfonts-generator
      types: ['ttf'],
      files: svgFilePaths,
      dest: paths.fonts,
      startCodepoint: baseCharCode,
      fontName: 'kb',
      css: false,
      html: false,
      formatOptions: {
        ttf: {
          ts: Date.now(),
        },
        // Setting descent to zero on font generation will prevent the final
        // glyphs from being shifted down
        svg: {
          fontHeight,
          descent: 0,
        },
      },
    },
    error => (error ? fontsGeneratedError(error) : fontsGeneratedSuccess())
  )
}

const fontsGeneratedSuccess = () => {
  console.log('Webfont generated successfully... updating constants and flow types')
  // Webfonts generator seems always produce an svg fontfile regardless of the `type` option set above.
  const svgFont = path.resolve(paths.fonts, 'kb.svg')
  if (fs.existsSync(svgFont)) {
    fs.unlinkSync(svgFont)
  }
  setFontMetrics()
  updateConstants()
}

const fontsGeneratedError = error => {
  throw new Error(
    `webfonts-generator failed to generate ttf iconfont file. Check that all svgs exist and the destination directory exits. ${error}`
  )
}

function updateConstants() {
  console.log('Generating icon constants')

  const icons = {}

  // Build constants for the png assests.
  fs
    .readdirSync(paths.iconpng)
    .filter(i => i.indexOf('@') === -1 && i.startsWith('icon-'))
    .forEach(i => {
      const shortName = i.slice(0, -4)
      icons[shortName] = {
        extension: i.slice(-3),
        isFont: false,
        require: `'../images/icons/${i}'`,
      }
    })

  // Build constants for iconfont svgs
  const svgFilenames = getSvgNames(false /* print skipped */)
  svgFilenames.reduce((acc, {counter, name, size}) => {
    return (icons[`iconfont-${name}`] = {
      isFont: true,
      gridSize: size,
      charCode: baseCharCode + counter - 1,
    })
  }, {})

  const iconConstants = `// @flow
  // This file is GENERATED by yarn run updated-fonts. DON'T hand edit
  /* eslint-disable prettier/prettier */

  type IconMeta = {
    isFont: boolean,
    gridSize?: number,
    extension?: string,
    charCode?: number,
    require?: any,
  }

  const iconMeta_ = {
  ${
    /* eslint-disable */
    Object.keys(icons)
      .map(name => {
        const icon = icons[name]
        const meta = [
          `isFont: ${icon.isFont}`,
          icon.gridSize ? [`gridSize: ${icons[name].gridSize}`] : [],
          icon.charCode ? [`charCode: 0x${icons[name].charCode.toString(16)}`] : [],
          icon.extension ? [`extension: '${icons[name].extension}'`] : [],
          icon.require ? [`require: require(${icons[name].require})`] : [],
        ]

        return `'${name}': {
            ${meta.filter(x => x.length).join(',\n')}
        }`
      })
      .join(',\n')
  }/* eslint-enable */
  }

  export type IconType = $Keys<typeof iconMeta_>
  export const iconMeta: {[key: IconType]: IconMeta} = iconMeta_
  `

  try {
    fs.writeFileSync(
      paths.iconConstants,
      //$FlowIssue
      prettier.format(iconConstants, prettier.resolveConfig.sync(paths.iconConstants)),
      'utf8'
    )
  } catch (e) {
    console.error(e)
  }
}

/*
 * The final ttf output from webfonts-generator will not set the GASP or OS2/Metrics table in TTF metadata correctly.
 * GASP will help with pixel alignment and antialiasing
 * OS2/Metrics will set the ascent and descent values in metadata (rather than on the glyphs)
 * To fix this, we need to force the following values using fontforge.
 *
 * ---
 * OS/2 Table
 * Documentation: https://docs.microsoft.com/en-us/typography/opentype/spec/os2ver1
 * ---
 * WinAscent: ${fontHeight}
 * WinDescent: ${descent}
 * TypoAscent: ${fontHeight}
 * TypoDescent: 0
 * HHeadAscent: ${fontHeight}
 * HHeadDescent: -${descent}
 *
 * ---
 * GASP Table
 * This is *super* important for anti-aliasing and grid snapping.
 * If this is not set successfully then the icons will be visually blurry.
 * Documentation: https://docs.microsoft.com/en-us/typography/opentype/spec/gasp#sample-gasp-table
 * ---
 * PixelSize: 65535
 * FlagValue:
 *  0 means neither grid-fit nor anti-alias
 *  1 means grid-fit but no anti-alias.
 *  2 means no grid-fit but anti-alias.
 *  3 means both grid-fit and anti-alias.
 *
 */
const setFontMetrics = () => {
  /*
   * Arguments:
   * $1: path to kb.ttf
   * $2: ascent value
   * $3: descent value
   */
  const kbTtf = path.resolve(paths.fonts, 'kb.ttf')
  let script = `
  Open('${kbTtf}');
  SetOS2Value('WinAscent', ${ascent});
  SetOS2Value('WinDescent', ${descent});
  SetOS2Value('TypoAscent', ${ascent});
  SetOS2Value('TypoDescent', ${0});
  SetOS2Value('HHeadAscent', ${ascent});
  SetOS2Value('HHeadDescent', ${-descent});
  SetGasp(65535, 3);
  Generate('${kbTtf}');
  `
  script = script
    .split('\n')
    .map(x => x.trim())
    .join(' ')
  const command = `fontforge -lang ff -c "${script}"`
  try {
    execSync(command, {encoding: 'utf8', env: process.env})
  } catch (e) {
    console.error(e)
  }
}

function unusedAssetes() {
  const allFiles = fs.readdirSync(paths.iconpng)

  // map of root name => [files]
  const images = {}
  allFiles.forEach(f => {
    const parsed = path.parse(f)
    if (!['.jpg', '.png'].includes(parsed.ext)) {
      return
    }

    let root = parsed.name
    const atFiles = root.match(/(.*)@[23]x$/)
    if (atFiles) {
      root = atFiles[1]
    }

    if (!images[root]) {
      images[root] = []
    }
    images[root].push(f)
  })

  Object.keys(images).forEach(image => {
    const command = `ag --ignore "./common-adapters/icon.constants.js" "${image}"`
    try {
      execSync(command, {encoding: 'utf8', env: process.env})
    } catch (e) {
      if (e.status === 1) {
        console.log(images[image].join('\n'))
      }
    }
  })
}

export default commands
