import React, { useState } from 'react';
import { loadWallet } from '../../lib/storage';
import { decryptPrivateKey } from '../../lib/crypto';
import { setSession } from '../../lib/session';
import { ErrorBanner } from '../components/ErrorBanner';

interface Props { onUnlocked: () => void }

export function Locked({ onUnlocked }: Props) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const unlock = async () => {
    setError(''); setBusy(true);
    try {
      const wallet = await loadWallet();
      if (!wallet) { setError('No wallet found.'); return; }
      const privKey = await decryptPrivateKey(wallet.encrypted_private_key, password);
      setSession(privKey);
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
          <div className="wallet-brand-mark">T</div>
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
