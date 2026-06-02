# Claude Code Handoff — Tensorium Wallet Extension

Handoff context for continuing work on `tensorium-wallet-extension` in a new Claude Code session.

## Current State (as of 2026-06-02)

- **Version:** `0.1.1`
- **Repo:** `https://github.com/tensorium-labs/tensorium-wallet-extension`
- **GitHub Release:** `v0.1.1` live with ZIP attached — users can install manually while CWS review is pending
- **Chrome Web Store:** Submitted (v0.1.0 package), currently under review. Review typically takes 1–7 days.
- **ZIP ready:** `submission/tensorium-wallet-extension-v0.1.1.zip` — this is the package to upload as an update once v0.1.0 is approved or if review is rejected and a re-submission is needed

## What Was Completed

- Icon refresh: all three packaged icons (`icon16`, `icon48`, `icon128`) regenerated from `submission/cws-assets-crisp/icon-128x128.png` (orange "T" logo)
- History page rewrite: bounded scan (last 200 blocks), detects both sent and received transactions, shows TXID and scan range, no more O(chain-height) hang
- Version bumped to `0.1.1` in `manifest.json` and `package.json`
- README with install instructions (Chrome Web Store + manual unpacked)
- All 20 tests passing, typecheck clean

## Stack

- TypeScript + React 18 + Vite + Manifest V3
- Crypto: `@noble/secp256k1`, `@noble/hashes`, `@noble/ciphers`, `@scure/base`, `hash-wasm` (Argon2id)
- Wallet file format: 100% compatible with `txmwallet` CLI (Argon2id + XChaCha20Poly1305)

## Networks

| Name | RPC URL |
|------|---------|
| Public Testnet | `https://rpc.tensoriumlabs.com` |
| Mainnet Candidate | `https://mc-rpc.tensoriumlabs.com` |

Both endpoints are HTTPS with CORS + rate-limit (nginx on VPS 157.230.44.162).

## Remaining Work (Phase 8B → 9)

| Item | Priority | Notes |
|------|----------|-------|
| CWS approval → publish v0.1.1 update | High | Upload `v0.1.1.zip` as update after v0.1.0 is approved |
| RPC SSL health check | Medium | Verify `rpc.tensoriumlabs.com` and `mc-rpc.tensoriumlabs.com` are stable; certbot auto-renew active |
| QR code on Dashboard for receive address | Low | Nice UX for mainnet |
| Phase 9C SDK integration | Later | `tensorium-sdk-js` ready; add to wallet once npm token issue is resolved |
| Mobile wallet | Phase 10 | React Native / Flutter — post-launch |

## Commands

```bash
npm run typecheck       # type check
npm test                # 20 unit tests (crypto, storage, session, rpc)
npm run prepare:cws     # build + package → submission/tensorium-wallet-extension-v0.1.1.zip
```
