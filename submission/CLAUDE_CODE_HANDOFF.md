# Claude Code Handoff

This file is the handoff context for continuing Tensorium Wallet Chrome Web Store submission work in Claude Code.

## Current State

- Chrome Web Store copy has been drafted and consolidated in `submission/CHROME_WEB_STORE_SUBMISSION.md`
- Listing assets have been generated in `submission/cws-assets-crisp/`
- Asset archive exists at `submission/cws-assets-crisp-ready.zip`
- Extension upload ZIP exists at `submission/tensorium-wallet-extension-v0.1.0.zip`
- The likely remaining repo-side task is updating packaged extension icons so the store package preview matches the new listing icon

## Relevant Files

- `manifest.json`
- `public/icons/icon16.png`
- `public/icons/icon48.png`
- `public/icons/icon128.png`
- `submission/CHROME_WEB_STORE_SUBMISSION.md`
- `submission/cws-assets-crisp/icon-128x128.png`
- `scripts/package-cws.mjs`
- `package.json`

## Known Gap

The current packaged extension icon appears to be older than the newer crisp store icon.

Evidence:

- `public/icons/icon128.png` and `submission/cws-assets-crisp/icon-128x128.png` are different files
- If Chrome Web Store preview still shows the older blue placeholder icon, the extension package itself needs an icon refresh and rebuild

## Recommended Next Steps

1. Inspect the current `public/icons/` set and confirm whether they still use the old icon style.
2. Regenerate or replace `icon16.png`, `icon48.png`, and `icon128.png` so they match the crisp store icon branding.
3. Verify `manifest.json` points to the correct icon paths.
4. Run `npm run typecheck`.
5. Run `npm test`.
6. Run `npm run prepare:cws`.
7. Confirm the rebuilt ZIP and preview assets are consistent.
8. If needed, refine promo images or screenshots only after icon consistency is fixed.

## Prompt For Claude Code

Use this prompt as-is in Claude Code:

```text
Continue work in the repo /root/.openclaw/workspace/tensorium-wallet-extension.

Context:
- This is a Chrome extension called Tensorium Wallet.
- Submission docs and store copy were updated in submission/CHROME_WEB_STORE_SUBMISSION.md.
- Chrome Web Store listing assets exist in submission/cws-assets-crisp/.
- The current likely issue is that the packaged extension icons in public/icons/ do not match the newer crisp listing icon in submission/cws-assets-crisp/icon-128x128.png.
- The Chrome Web Store preview may still show the old blue placeholder-style icon because the extension package icon set has not been refreshed yet.

Your tasks:
1. Inspect manifest.json, public/icons/, and submission assets.
2. Update the packaged extension icon set so icon16, icon48, and icon128 match the new branding.
3. Rebuild the extension package with npm run prepare:cws.
4. Run npm run typecheck and npm test.
5. Update submission/CHROME_WEB_STORE_SUBMISSION.md if any paths or instructions need adjustment after the icon refresh.
6. Summarize exactly what changed, what was verified, and whether the final ZIP is ready for Chrome Web Store upload.

Constraints:
- Do not revert unrelated changes.
- Prefer minimal, targeted edits.
- If icon source conversion is needed, preserve sharpness and keep the output free of alpha issues that could break Chrome Web Store asset requirements.
```

## Operator Note

If Claude Code finishes the icon refresh successfully, the next non-code step is to upload the rebuilt ZIP plus the already prepared listing assets into Chrome Web Store Developer Dashboard and submit for review.
