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
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h2 style={{ color: '#38bdf8', fontSize: 18 }}>Tensorium Wallet</h2>
      <p style={{ color: '#94a3b8', fontSize: 13 }}>Enter your password to unlock.</p>
      {error && <ErrorBanner message={error} />}
      <input type="password" placeholder="Password" value={password}
        onChange={(e) => setPassword(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && !busy && unlock()}
        style={inputStyle} autoFocus />
      <button onClick={unlock} disabled={busy || !password} style={btnStyle}>
        {busy ? 'Unlocking…' : 'Unlock'}
      </button>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: '#1e293b', border: '1px solid #334155', color: '#e2e8f0',
  borderRadius: 6, padding: '10px 12px', fontSize: 14, outline: 'none', width: '100%',
};
const btnStyle: React.CSSProperties = {
  background: '#0ea5e9', color: '#fff', border: 'none', borderRadius: 6,
  padding: '10px 0', fontSize: 14, cursor: 'pointer', width: '100%',
};
