import React, { useState } from 'react';
import { loadWallets, loadSelectedIndex } from '../../lib/storage';
import { decryptPrivateKey } from '../../lib/crypto';
import { setSession, addSessionKey } from '../../lib/session';
import { BrandMark } from '../components/BrandMark';
import { ErrorBanner } from '../components/ErrorBanner';

interface Props { onUnlocked: () => void }

export function Locked({ onUnlocked }: Props) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const unlock = async () => {
    setError(''); setBusy(true);
    try {
      const wallets = await loadWallets();
      if (!wallets.length) { setError('No wallet found.'); return; }
      const sel = wallets[await loadSelectedIndex()] ?? wallets[0];
      // Decrypt the active account (this also verifies the password).
      const privKey = await decryptPrivateKey(sel.encrypted_private_key, password);
      setSession(privKey, sel.address);
      // Decrypt the rest with the same password so switching accounts is instant.
      for (const w of wallets) {
        if (w.address === sel.address) continue;
        try {
          const k = await decryptPrivateKey(w.encrypted_private_key, password);
          addSessionKey(k, w.address);
        } catch {
          /* account uses a different password — unlocked individually later */
        }
      }
      onUnlocked();
    } catch {
      setError('Incorrect password.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="wallet-page wallet-page--centered">
      <div className="wallet-surface" style={{ padding: 22 }}>
        <div className="wallet-brand" style={{ marginBottom: 14 }}>
          <BrandMark />
          <div className="wallet-brand-copy">
            <div className="wallet-eyebrow">Self-custody TXM wallet</div>
            <h2>Unlock Tensorium Wallet</h2>
          </div>
        </div>
        <p className="wallet-subtle" style={{ marginBottom: 14 }}>
          Enter your password to decrypt the local wallet and restore the active session.
        </p>
      {error && <ErrorBanner message={error} />}
        <div className="wallet-stack">
          <input type="password" placeholder="Password" value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !busy && unlock()}
            className="wallet-input" autoFocus />
          <button onClick={unlock} disabled={busy || !password} className="wallet-btn wallet-btn--primary">
            {busy ? 'Unlocking…' : 'Unlock'}
          </button>
          <div className="wallet-footer-note">
            Keys remain in local extension storage. Nothing is sent to Tensorium servers except RPC reads and signed transaction broadcast.
          </div>
        </div>
      </div>
    </div>
  );
}
