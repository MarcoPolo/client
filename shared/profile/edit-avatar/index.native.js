// @flow
import * as React from 'react'
import {Box, ButtonBar, StandardScreen, WaitingButton} from '../../common-adapters'
import {NativeImage, ZoomableBox} from '../../common-adapters/mobile.native'
import {globalColors, globalStyles, globalMargins, platformStyles, styleSheetCreate} from '../../styles'
import {isIOS} from '../../constants/platform'
import type {Props} from '.'

const AVATAR_SIZE = 250

class EditAvatar extends React.Component<Props> {
  _h: number = 0
  _w: number = 0
  _x: number = 0
  _y: number = 0

  _onSave = (e: Object) => {
    const filename = isIOS ? this.props.image.uri.replace('file://', '') : this.props.image.path
    if (this._h && this._w && this._x && this._y) {
      const crop = isIOS ? this._getIOSCrop() : this._getAndroidCrop()
      this.props.onSave(filename, crop)
      return
    }
    this.props.onSave(filename)
  }

  _getAndroidCrop = () => {
    // Cropping coordinates will be part of the next phase. The backend does the right thing when
    // when you send it all 0s.
    return {
      x0: 0,
      x1: 0,
      y0: 0,
      y1: 0,
    }
  }

  _getIOSCrop = () => {
    const x = this._x
    const y = this._y
    const rH = this.props.image.height / this._h
    const rW = this.props.image.width / this._w
    const x0 = rW * x
    const y0 = rH * y
    return {
      x0: Math.round(x0),
      x1: Math.round((x + AVATAR_SIZE) * rW),
      y0: Math.round(y0),
      y1: Math.round((y + AVATAR_SIZE) * rH),
    }
  }

  _onZoom = (e: Object) => {
    this._h = e.nativeEvent.contentSize.height
    this._w = e.nativeEvent.contentSize.width
    this._x = e.nativeEvent.contentOffset.x
    this._y = e.nativeEvent.contentOffset.y
  }

  render() {
    return (
      <StandardScreen
        onCancel={this.props.onClose}
        scrollEnabled={false}
        style={container}
        title="Zoom and pan"
      >
        <Box
          style={{
            marginBottom: globalMargins.small,
            marginTop: globalMargins.small,
          }}
        >
          <Box style={isIOS ? null : styles.zoomContainer}>
            <ZoomableBox
              bounces={false}
              contentContainerStyle={{
                height: this.props.image.height,
                width: this.props.image.width,
              }}
              maxZoom={10}
              onZoom={isIOS ? this._onZoom : null}
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
              style={isIOS ? styles.zoomContainer : null}
            >
              <NativeImage
                resizeMode="contain"
                source={{uri: `data:image/jpeg;base64,${this.props.image.data}`}}
                style={{
                  height: this.props.image.height,
                  width: this.props.image.width,
                }}
              />
            </ZoomableBox>
          </Box>
          <ButtonBar direction="column">
            <WaitingButton
              fullWidth={true}
              label="Save"
              onClick={this._onSave}
              style={styles.button}
              type="Primary"
              waitingKey={null}
            />
          </ButtonBar>
        </Box>
      </StandardScreen>
    )
  }
}

const container = platformStyles({
  common: {
    ...globalStyles.flexBoxColumn,
    flex: 1,
  },
})

const styles = styleSheetCreate({
  button: {
    marginTop: globalMargins.tiny,
    width: '100%',
  },
  zoomContainer: {
    alignSelf: 'center',
    backgroundColor: globalColors.lightGrey2,
    borderRadius: AVATAR_SIZE,
    flexShrink: 1,
    height: AVATAR_SIZE,
    marginBottom: globalMargins.tiny,
    overflow: 'hidden',
    position: 'relative',
    width: AVATAR_SIZE,
  },
})

export default EditAvatar
