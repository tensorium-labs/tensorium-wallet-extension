import React, { useEffect, useState } from 'react';
import { loadWallet, loadNetwork, saveNetwork, loadCustomRpc, saveCustomRpc, type Network } from '../../lib/storage';
import { decryptPrivateKey, type WalletFile } from '../../lib/crypto';
import { clearSession, getSession } from '../../lib/session';
import { ErrorBanner } from '../components/ErrorBanner';

interface Props { onBack: () => void; onLogout: () => void }

export function Settings({ onBack, onLogout }: Props) {
  const [network, setNetwork] = useState<Network>('mainnet');
  const [customRpc, setCustomRpc] = useState('');
  const [showPrivKey, setShowPrivKey] = useState(false);
  const [privKey, setPrivKey] = useState('');
  const [privKeyPassword, setPrivKeyPassword] = useState('');
  const [error, setError] = useState('');
  const [wallet, setWallet] = useState<WalletFile | null>(null);

  useEffect(() => {
    Promise.all([loadNetwork(), loadCustomRpc(), loadWallet()]).then(([net, rpc, w]) => {
      setNetwork(net); setCustomRpc(rpc); setWallet(w);
    });
  }, []);

  const saveNetworkSetting = async (net: Network) => { setNetwork(net); await saveNetwork(net); };
  const saveCustomRpcSetting = async () => { await saveCustomRpc(customRpc); await saveNetwork('custom'); setNetwork('custom'); };

  const revealPrivKey = async () => {
    setError('');
    try {
      if (!wallet) { setError('No wallet loaded.'); return; }
      const sessionKey = getSession();
      if (sessionKey && !privKeyPassword) { setPrivKey(sessionKey); setShowPrivKey(true); return; }
      const key = await decryptPrivateKey(wallet.encrypted_private_key, privKeyPassword);
      setPrivKey(key); setShowPrivKey(true);
    } catch { setError('Incorrect password.'); }
  };

  const exportWallet = () => {
    if (!wallet) return;
    const blob = new Blob([JSON.stringify(wallet, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'tensorium-wallet.json'; a.click();
    URL.revokeObjectURL(url);
  };

  const lock = () => { clearSession(); onLogout(); };

  return (
    <div className="wallet-page">
      <div className="wallet-topbar">
        <div className="wallet-brand">
          <button onClick={onBack} className="wallet-back">←</button>
          <div className="wallet-brand-copy">
            <div className="wallet-eyebrow">Control panel</div>
            <h2>Settings</h2>
          </div>
        </div>
      </div>
      {error && <ErrorBanner message={error} />}

      <section className="wallet-card">
        <div className="wallet-section-label">Network</div>
        {(['mainnet', 'custom'] as Network[]).map((net) => (
          <button key={net} onClick={() => saveNetworkSetting(net)}
            className="wallet-btn wallet-btn--secondary"
            style={{ borderColor: network === net ? 'rgba(255, 209, 102, 0.45)' : undefined, color: network === net ? '#ffd166' : undefined, width: '100%', marginBottom: 6, textAlign: 'left' }}>
            {net === 'mainnet' ? 'Mainnet (rpc.tensoriumlabs.com)' : 'Custom RPC'}
          </button>
        ))}
        {network === 'custom' && (
          <div className="wallet-row" style={{ marginTop: 8 }}>
            <input value={customRpc} onChange={(e) => setCustomRpc(e.target.value)}
              placeholder="https://..." className="wallet-input" />
            <button onClick={saveCustomRpcSetting} className="wallet-btn wallet-btn--primary">Save</button>
          </div>
        )}
      </section>

      <section className="wallet-card">
        <div className="wallet-section-label">Private Key</div>
        {!showPrivKey ? (
          <>
            <input type="password" placeholder="Verify password to reveal (optional if unlocked)"
              value={privKeyPassword} onChange={(e) => setPrivKeyPassword(e.target.value)} className="wallet-input" />
            <button onClick={revealPrivKey} className="wallet-btn wallet-btn--secondary" style={{ width: '100%', color: '#ffd166' }}>Show Private Key</button>
          </>
        ) : (
          <div>
            <p className="wallet-note" style={{ color: '#ffd3d3', marginBottom: 8 }}>Never share your private key.</p>
            <code className="wallet-code" style={{ color: '#ffd166', background: 'rgba(0,0,0,0.24)', padding: 10, borderRadius: 10, display: 'block' }}>{privKey}</code>
            <button onClick={() => navigator.clipboard.writeText(privKey)} className="wallet-btn wallet-btn--secondary" style={{ width: '100%', marginTop: 8 }}>Copy</button>
          </div>
        )}
      </section>

      <section className="wallet-card">
        <div className="wallet-section-label">Backup</div>
        <button onClick={exportWallet} className="wallet-btn wallet-btn--secondary" style={{ width: '100%' }}>Export Wallet JSON</button>
      </section>

      <button onClick={lock} className="wallet-btn wallet-btn--danger">Lock Wallet</button>
    </div>
  );
}
