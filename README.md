# Tensorium Wallet

Self-custody Chrome extension for the [Tensorium (TXM)](https://tensoriumlabs.com) blockchain.

## Install

### Option A — Chrome Web Store *(pending review)*

Coming soon. Submission is under review.

### Option B — Manual install (available now)

1. Download **tensorium-wallet-extension-v0.1.1.zip** from the [latest release](https://github.com/tensorium-labs/tensorium-wallet-extension/releases/latest).
2. Unzip the file anywhere on your computer.
3. Open Chrome and go to `chrome://extensions`.
4. Enable **Developer mode** (top-right toggle).
5. Click **Load unpacked** and select the extracted folder.
6. The Tensorium Wallet icon will appear in your Chrome toolbar.

> **Note:** Chrome may show an "unverified extension" warning for manually loaded extensions. This is normal for extensions pending Web Store approval.

## Features

- Create a new Tensorium wallet (with forced backup)
- Import existing wallet from private key or encrypted JSON
- View address and spendable TXM balance
- Send TXM transactions with confirmation step
- Transaction history — last 200 blocks, shows sent and received
- Network selector: Mainnet / Custom RPC
- Export encrypted wallet JSON backup
- Show/copy private key (requires password or active session)
- Lock wallet

## Networks

| Network | RPC |
|---------|-----|
| Mainnet | `https://mc-rpc.tensoriumlabs.com` |
| Custom RPC | user-defined |

## Build from source

```bash
git clone https://github.com/tensorium-labs/tensorium-wallet-extension.git
cd tensorium-wallet-extension
npm install
npm run prepare:cws   # builds and packages to submission/tensorium-wallet-extension-v*.zip
```

Load the `dist/` folder as an unpacked extension, or use the ZIP from `submission/`.

## Links

- Website: [tensoriumlabs.com](https://tensoriumlabs.com)
- Docs: [docs.tensoriumlabs.com](https://docs.tensoriumlabs.com)
- Explorer: [explorer.tensoriumlabs.com](https://explorer.tensoriumlabs.com)
- Core node: [github.com/tensorium-labs/tensorium-core](https://github.com/tensorium-labs/tensorium-core)

## License

Apache-2.0 — see [LICENSE](LICENSE).
