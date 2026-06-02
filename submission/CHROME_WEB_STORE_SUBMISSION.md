# Chrome Web Store Submission Pack

This folder contains the operator-facing materials needed to submit `Tensorium Wallet` to the Chrome Web Store.

## Build Artifact

Generate a fresh upload ZIP from the current repo state:

```bash
npm run prepare:cws
```

Expected output:

- `submission/tensorium-wallet-extension-v0.1.0.zip`

That ZIP should be uploaded directly to Chrome Web Store Developer Dashboard.

## Extension Summary

- **Name:** Tensorium Wallet
- **Version:** 0.1.0
- **Type:** Chrome Extension (Manifest V3)
- **Category suggestion:** Developer Tools or Productivity
- **Single purpose:** self-custody wallet for the Tensorium (`TXM`) blockchain

## Short Description

Self-custody wallet for Tensorium (TXM). Create or import a wallet, view balance, send TXM, and switch between testnet and mainnet-candidate RPC.

## Detailed Description

Tensorium Wallet is a Chrome extension for the Tensorium blockchain.

It allows users to:

- create a new TXM wallet locally inside the browser
- import an existing wallet from private key or wallet JSON backup
- unlock the wallet with a password
- view TXM address and mature balance
- send TXM transactions
- inspect basic receive history
- export wallet backup JSON
- switch between Tensorium testnet, mainnet-candidate, or a custom RPC endpoint

Security posture:

- private keys stay in extension storage
- wallet data is encrypted before storage
- unlocking is required before sensitive actions
- no custodial account, no remote key escrow

Current network scope:

- public Tensorium testnet
- Tensorium mainnet-candidate RPC

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

- `https://rpc.tensoriumlabs.com/*`
- `https://mc-rpc.tensoriumlabs.com/*`

Used to:

- read block height and UTXOs
- broadcast signed transactions
- check wallet balance against Tensorium RPC nodes

The extension does not request broad `<all_urls>` access.

## Suggested Store Listing Metadata

- **Language:** English
- **Developer name:** Tensorium Labs
- **Support email:** `dev@tensoriumlabs.com`
- **Homepage URL:** `https://tensoriumlabs.com`
- **Support URL:** `https://docs.tensoriumlabs.com`
- **Privacy policy:** prepare a simple hosted policy before submission if Chrome requires it

## Screenshot Shot List

Prepare 3-5 screenshots from the popup UI. Recommended shots:

1. **Onboarding**
   - “Welcome to Tensorium Wallet”
   - buttons for create/import wallet
2. **Backup step**
   - wallet address visible
   - “Download Wallet Backup (.json)” action visible
3. **Dashboard**
   - address card
   - balance card
   - network badge
   - send/history/settings buttons
4. **Send flow**
   - recipient + amount form or confirm screen
5. **Settings**
   - network selector
   - export wallet
   - custom RPC option

Recommended caption direction:

- self-custody TXM wallet
- local encrypted storage
- testnet and mainnet-candidate support
- simple send + backup workflow

## Manual Submission Checklist

1. Pay Chrome Web Store developer registration fee.
2. Run `npm run typecheck`.
3. Run `npm test`.
4. Run `npm run prepare:cws`.
5. Upload the generated ZIP.
6. Paste short and detailed descriptions from this file.
7. Upload 3-5 screenshots from the shot list above.
8. Verify icon, version, and requested permissions.
9. Submit for review.

## Known Gaps Before Final Submit

- Screenshots still need to be captured manually from a real Chrome extension session.
- Privacy policy URL may still need to be hosted if Chrome enforces it for the selected category.
- Store account creation is external and cannot be completed from this repo.
