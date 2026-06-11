# Chrome Web Store Submission Pack

This folder contains the current operator-facing materials needed to submit `Tensorium Wallet` to the Chrome Web Store.

## Current Submission Status

- Build ZIP is available at `submission/tensorium-wallet-extension-v0.1.1.zip`
- Store listing assets are available in `submission/cws-assets-crisp/`
- Packaged asset bundle is available at `submission/cws-assets-crisp-ready.zip`
- The store listing copy below is ready to paste into Chrome Web Store fields
- Extension package icons in `public/icons/` have been refreshed to match the crisp store icon and are included in the ZIP

## Build Artifact

Generate a fresh upload ZIP from the current repo state:

```bash
npm run prepare:cws
```

Expected output:

- `submission/tensorium-wallet-extension-v0.1.1.zip`

That ZIP is the extension package to upload in Chrome Web Store Developer Dashboard.

## Extension Summary

- **Name:** Tensorium Wallet
- **Version:** 0.1.1
- **Type:** Chrome Extension (Manifest V3)
- **Category:** Developer Tools
- **Language:** English
- **Single purpose:** self-custody wallet for the Tensorium (`TXM`) blockchain

## Store Fields

- **Package title:** `Tensorium Wallet`
- **Package summary:** `Tensorium (TXM) blockchain wallet`
- **Homepage URL:** `https://tensoriumlabs.com`
- **Support URL:** `https://docs.tensoriumlabs.com/wallet-support.html`
- **Privacy policy URL:** `https://docs.tensoriumlabs.com/privacy-policy.html`
- **Support email:** `dev@tensoriumlabs.com`

## Short Description

Tensorium (TXM) blockchain wallet

## Detailed Description

Tensorium Wallet is a self-custody Chrome extension for the Tensorium blockchain.

It is designed for users who want a straightforward way to create, import, unlock, and manage a TXM wallet directly from the browser.

Key capabilities:

- Create a new Tensorium wallet locally in the browser
- Import an existing wallet from private key or wallet backup JSON
- Unlock the wallet with a password before sensitive actions
- View wallet address and TXM balance
- Send TXM transactions from the extension popup
- Review wallet activity and transaction history
- Export an encrypted wallet backup for recovery
- Switch between Tensorium mainnet or a custom RPC endpoint

Why install Tensorium Wallet:

- Self-custody by default, without a custodial account
- Local encrypted wallet storage inside the extension
- Fast access to TXM send, receive, and backup flows
- Built for Tensorium network usage without requiring a separate desktop app
- Supports both testing and production-oriented network environments

Security posture:

- Private keys remain in browser extension storage
- Wallet data is encrypted before persistence
- Sensitive actions require wallet unlock
- No remote key escrow or custodial recovery flow

Official links:

- Website: `https://tensoriumlabs.com`
- Docs: `https://docs.tensoriumlabs.com`
- Explorer: `https://explorer.tensoriumlabs.com`
- Source: `https://github.com/tensorium-labs/tensorium-wallet-extension`

## Permission Justification

### `storage`

Used to store:

- encrypted wallet JSON
- selected network
- optional custom RPC URL

Without this permission, the extension cannot persist wallet state across browser restarts.

### Host permissions

- ``
- `https://rpc.tensoriumlabs.com/*`

Used to:

- read block height and UTXOs
- broadcast signed transactions
- check wallet balance against Tensorium RPC nodes

The extension does not request broad `<all_urls>` access.

## Visual Assets

### Chrome Web Store icon

- `submission/cws-assets-crisp/icon-128x128.png`
- Required size: `128x128`

### Screenshots

Use these five files:

1. `submission/cws-assets-crisp/screenshot-01-unlock-1280x800.png`
2. `submission/cws-assets-crisp/screenshot-02-dashboard-1280x800.png`
3. `submission/cws-assets-crisp/screenshot-03-settings-1280x800.png`
4. `submission/cws-assets-crisp/screenshot-04-send-1280x800.png`
5. `submission/cws-assets-crisp/screenshot-05-history-1280x800.png`

All screenshots are already rendered at `1280x800` and prepared without alpha.

### Promo assets

- Small promo tile: `submission/cws-assets-crisp/promo-small-440x280.png`
- Marquee promo image: `submission/cws-assets-crisp/promo-marquee-1400x560.png`

## Manual Submission Checklist

1. Ensure the Chrome Web Store developer account is active.
2. Run `npm run typecheck`.
3. Run `npm test`.
4. Run `npm run prepare:cws`.
5. Upload `submission/tensorium-wallet-extension-v0.1.1.zip`.
6. Paste the title, summary, and detailed description from this file.
7. Set category to `Developer Tools` and language to `English`.
8. Upload the icon, screenshots, and promo assets from `submission/cws-assets-crisp/`.
9. Set homepage, support, and privacy URLs exactly as listed above.
10. Review permissions, screenshots, and listing preview.
11. Submit for review.

## Known Follow-Up

None. The extension package icons (`icon16.png`, `icon48.png`, `icon128.png`) are now generated from `submission/cws-assets-crisp/icon-128x128.png` and the ZIP is ready for upload.
