// @flow
import React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import WalletModal from '../../wallet-modal'

type Props = Kb.PropsWithTimer<{
  name: string,
  onCopyKey: () => void,
  onClose: () => void,
}>

type State = {
  showingToast: boolean,
}

class ReallyRemoveAccountPopup extends React.Component<Props, State> {
  state = {
    showingToast: false,
  }
  _attachmentRef = null

  copy = () => {
    this.setState({showingToast: true}, () =>
      this.props.setTimeout(() => this.setState({showingToast: false}), 2000)
    )
    this.props.onCopyKey()
  }

  render() {
    return (
      <WalletModal
        onClose={this.props.onClose}
        containerStyle={styles.container}
        bottomButtons={[
          <Kb.Button
            key={0}
            label="Copy secret key"
            onClick={this.copy}
            type="Wallet"
            ref={r => (this._attachmentRef = r)}
          />,
          <Kb.Button key={1} label="Cancel" onClick={this.props.onClose} type="Secondary" />,
        ]}
      >
        <Kb.Icon
          type={Styles.isMobile ? 'icon-wallet-secret-key-64' : 'icon-wallet-secret-key-48'}
          style={Kb.iconCastPlatformStyles(styles.icon)}
        />
        <Kb.Text style={Styles.collapseStyles([styles.warningText, styles.headerText])} type="Header">
          One last thing! Make sure you keep a copy of your secret key before removing{' '}
          <Kb.Text type="HeaderItalic" style={styles.warningText}>
            {this.props.name}
          </Kb.Text>.
        </Kb.Text>
        <Kb.Text type="BodySmall" style={styles.warningText}>
          Paste it in a 100% safe place.
        </Kb.Text>

        <Kb.Toast visible={this.state.showingToast} attachTo={this._attachmentRef} position={'top center'}>
          <Kb.Text type="BodySmall" style={styles.toastText}>
            Copied to clipboard
          </Kb.Text>
        </Kb.Toast>
      </WalletModal>
    )
  }
}

const styles = Styles.styleSheetCreate({
  container: {
    backgroundColor: Styles.globalColors.yellow,
  },
  icon: {
    marginTop: Styles.globalMargins.medium,
    marginBottom: Styles.globalMargins.large,
  },
  headerText: {
    paddingBottom: Styles.globalMargins.small,
  },
  warningText: {
    textAlign: 'center',
    color: Styles.globalColors.brown_60,
  },
  toastText: {
    color: Styles.globalColors.white,
  },
})

export default Kb.HOCTimers(ReallyRemoveAccountPopup)
