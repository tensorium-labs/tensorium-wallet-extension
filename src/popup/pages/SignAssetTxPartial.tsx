import React, { useState } from 'react';
import { loadWallet } from '../../lib/storage';
import { getSession } from '../../lib/session';
import { hexToBytes, signAssetTxInputs, type WalletTx } from '../../lib/crypto';
import { summarizeSettlement } from '../../lib/settlement-summary';
import { BrandMark } from '../components/BrandMark';
import { ErrorBanner } from '../components/ErrorBanner';

export interface PartialReq {
  reqId: string;
  unsignedTx: WalletTx;
  inputIndices: number[];
  summary?: { description?: string; [k: string]: unknown };
  status: 'pending' | 'confirmed' | 'rejected';
  result?: unknown;
  error?: string;
}

const fmt = (a: number) => `${Math.floor(a / 1e8)}.${(a % 1e8).toString().padStart(8, '0')} TXM`;

export function SignAssetTxPartial({ req, onDone }: { req: PartialReq; onDone: () => void }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const recomputed = summarizeSettlement(req.unsignedTx);

  const confirm = async () => {
    setError(''); setBusy(true);
    try {
      const wallet = await loadWallet();
      const privKeyHex = getSession();
      if (!wallet || !privKeyHex) { setError('Wallet is locked. Re-unlock to retry.'); return; }
      const signed = await signAssetTxInputs(req.unsignedTx, hexToBytes(privKeyHex), req.inputIndices);
      await (chrome.storage.session as any).set({ txm_partial_req: { ...req, status: 'confirmed', result: signed } });
      await chrome.action.setBadgeText({ text: '' });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Signing failed.');
    } finally { setBusy(false); }
  };
  const reject = async () => {
    await (chrome.storage.session as any).set({ txm_partial_req: { ...req, status: 'rejected', error: 'User rejected' } });
    await chrome.action.setBadgeText({ text: '' });
    onDone();
  };

  return (
    <div className="wallet-page">
      <div className="wallet-topbar"><div className="wallet-brand"><BrandMark />
        <div className="wallet-brand-copy">
          <div className="wallet-eyebrow">marketplace.tensoriumlabs.com</div>
          <h2>Confirm Marketplace Trade</h2>
        </div></div></div>
      <div className="wallet-card" style={{ marginBottom: 10 }}>
        <div className="wallet-note">You are signing your part of an asset settlement. These are the exact payouts in the transaction:</div>
      </div>
      <div className="wallet-surface" style={{ padding: 16 }}>
        {recomputed.outputs.map((o, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span className="wallet-subtle" style={{ fontFamily: 'monospace', fontSize: 12 }}>
              {o.address.slice(0, 10)}…{o.address.slice(-6)}
            </span>
            <span>{fmt(o.atoms)}</span>
          </div>
        ))}
        <div className="wallet-divider"></div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span className="wallet-section-label">Total in tx</span><strong>{fmt(recomputed.total_spendable_atoms)}</strong>
        </div>
      </div>
      {error && <ErrorBanner message={error} />}
      <div className="wallet-stack">
        <button onClick={confirm} disabled={busy} className="wallet-btn wallet-btn--primary">
          {busy ? 'Signing…' : 'Approve & Sign'}
        </button>
        <button onClick={reject} disabled={busy} className="wallet-btn wallet-btn--secondary">Reject</button>
      </div>
    </div>
  );
}
