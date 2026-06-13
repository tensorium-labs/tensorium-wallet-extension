import React, { useState, useEffect } from 'react';
import { loadWallet } from '../../lib/storage';
import { getSession } from '../../lib/session';
import { hexToBytes, signMessage } from '../../lib/crypto';
import { BrandMark } from '../components/BrandMark';
import { ErrorBanner } from '../components/ErrorBanner';

export interface SignMsgReq {
  reqId: string; message: string;
  status: 'pending' | 'confirmed' | 'rejected';
  result?: { pubkey: string; sig: string }; error?: string;
}

export function SignMessage({ req, onDone }: { req: SignMsgReq; onDone: () => void }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [addr, setAddr] = useState('');
  useEffect(() => { loadWallet().then((w) => setAddr(w?.address ?? '')); }, []);

  const confirm = async () => {
    setError(''); setBusy(true);
    try {
      const privKeyHex = getSession();
      if (!privKeyHex) { setError('Wallet is locked. Re-unlock to retry.'); return; }
      const result = await signMessage(req.message, hexToBytes(privKeyHex));
      await (chrome.storage.session as any).set({ txm_signmsg_req: { ...req, status: 'confirmed', result } });
      await chrome.action.setBadgeText({ text: '' });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Signing failed.');
    } finally { setBusy(false); }
  };
  const reject = async () => {
    await (chrome.storage.session as any).set({ txm_signmsg_req: { ...req, status: 'rejected', error: 'User rejected' } });
    await chrome.action.setBadgeText({ text: '' });
    onDone();
  };

  return (
    <div className="wallet-page">
      <div className="wallet-topbar"><div className="wallet-brand"><BrandMark />
        <div className="wallet-brand-copy">
          <div className="wallet-eyebrow">marketplace.tensoriumlabs.com</div>
          <h2>Signature Request</h2>
        </div></div></div>
      <div className="wallet-card" style={{ marginBottom: 10 }}>
        <div className="wallet-note">A dapp is asking you to sign a message to authorize a marketplace action. No funds move.</div>
      </div>
      <div className="wallet-surface" style={{ padding: 16 }}>
        <div className="wallet-section-label">Message</div>
        <div style={{ fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all', marginTop: 6 }}>{req.message}</div>
        <div className="wallet-divider"></div>
        <div className="wallet-section-label">Signing address</div>
        <div className="wallet-subtle" style={{ fontFamily: 'monospace', fontSize: 12 }}>{addr}</div>
      </div>
      {error && <ErrorBanner message={error} />}
      <div className="wallet-stack">
        <button onClick={confirm} disabled={busy} className="wallet-btn wallet-btn--primary">
          {busy ? 'Signing…' : 'Sign'}
        </button>
        <button onClick={reject} disabled={busy} className="wallet-btn wallet-btn--secondary">Reject</button>
      </div>
    </div>
  );
}
