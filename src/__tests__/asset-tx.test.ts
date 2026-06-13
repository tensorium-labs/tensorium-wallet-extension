import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('inpage provider — asset tx methods', () => {
  it('exposes signAssetTx and getAssets on window.tensorium', () => {
    const src = fs.readFileSync(path.join(__dirname, '../inpage/index.ts'), 'utf-8');
    expect(src).toContain('signAssetTx:');
    expect(src).toContain('getAssets:');
  });

  it('exposes signAssetTxPartial and signMessage on window.tensorium', () => {
    const src = fs.readFileSync(path.join(__dirname, '../inpage/index.ts'), 'utf-8');
    expect(src).toContain('signAssetTxPartial:');
    expect(src).toContain('signMessage:');
  });
});

describe('background dispatcher — asset tx methods', () => {
  it('handles signAssetTx and getAssets methods', () => {
    const src = fs.readFileSync(path.join(__dirname, '../background/service_worker.ts'), 'utf-8');
    expect(src).toContain("method === 'signAssetTx'");
    expect(src).toContain("method === 'getAssets'");
  });

  it('attempts to open the wallet popup for pending approvals', () => {
    const src = fs.readFileSync(path.join(__dirname, '../background/service_worker.ts'), 'utf-8');
    expect(src).toContain('openApprovalPopup');
    expect(src).toContain('openPopup');
  });
});
