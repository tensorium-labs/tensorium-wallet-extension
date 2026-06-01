import React, { useEffect, useState } from 'react';
import { loadWallet, loadNetwork, saveNetwork, loadCustomRpc, saveCustomRpc, type Network } from '../../lib/storage';
import { decryptPrivateKey, type WalletFile } from '../../lib/crypto';
import { clearSession, getSession } from '../../lib/session';
import { ErrorBanner } from '../components/ErrorBanner';

interface Props { onBack: () => void; onLogout: () => void }

export function Settings({ onBack, onLogout }: Props) {
  const [network, setNetwork] = useState<Network>('testnet');
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
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={onBack} style={backBtn}>←</button>
        <h2 style={{ color: '#38bdf8', fontSize: 16 }}>Settings</h2>
      </div>
      {error && <ErrorBanner message={error} />}

      <section>
        <div style={sectionLabel}>Network</div>
        {(['testnet', 'mc', 'custom'] as Network[]).map((net) => (
          <button key={net} onClick={() => saveNetworkSetting(net)}
            style={{ ...optionBtn, borderColor: network === net ? '#0ea5e9' : '#334155', color: network === net ? '#38bdf8' : '#94a3b8' }}>
            {net === 'testnet' ? 'Testnet' : net === 'mc' ? 'Mainnet Candidate' : 'Custom RPC'}
          </button>
        ))}
        {network === 'custom' && (
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <input value={customRpc} onChange={(e) => setCustomRpc(e.target.value)}
              placeholder="https://..." style={{ ...inputStyle, flex: 1 }} />
            <button onClick={saveCustomRpcSetting} style={smallSaveBtn}>Save</button>
          </div>
        )}
      </section>

      <section>
        <div style={sectionLabel}>Private Key</div>
        {!showPrivKey ? (
          <>
            <input type="password" placeholder="Verify password to reveal (optional if unlocked)"
              value={privKeyPassword} onChange={(e) => setPrivKeyPassword(e.target.value)} style={inputStyle} />
            <button onClick={revealPrivKey} style={{ ...optionBtn, color: '#f59e0b', borderColor: '#78350f' }}>Show Private Key</button>
          </>
        ) : (
          <div>
            <p style={{ color: '#fca5a5', fontSize: 11, marginBottom: 6 }}>Never share your private key.</p>
            <code style={{ fontSize: 10, color: '#38bdf8', wordBreak: 'break-all', background: '#0f172a', padding: 8, borderRadius: 4, display: 'block' }}>{privKey}</code>
            <button onClick={() => navigator.clipboard.writeText(privKey)} style={{ ...optionBtn, marginTop: 6, fontSize: 11 }}>Copy</button>
          </div>
        )}
      </section>

      <section>
        <div style={sectionLabel}>Backup</div>
        <button onClick={exportWallet} style={optionBtn}>Export Wallet JSON</button>
      </section>

      <button onClick={lock} style={{ ...optionBtn, color: '#f87171', borderColor: '#7f1d1d', marginTop: 8 }}>Lock Wallet</button>
    </div>
  );
}

const sectionLabel: React.CSSProperties = { fontSize: 11, color: '#64748b', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 };
const optionBtn: React.CSSProperties = { width: '100%', background: '#0f172a', border: '1px solid #334155', color: '#e2e8f0', borderRadius: 6, padding: '9px 12px', fontSize: 13, cursor: 'pointer', textAlign: 'left', marginBottom: 4 };
const inputStyle: React.CSSProperties = { background: '#1e293b', border: '1px solid #334155', color: '#e2e8f0', borderRadius: 6, padding: '8px 12px', fontSize: 13, outline: 'none', width: '100%' };
const smallSaveBtn: React.CSSProperties = { background: '#0ea5e9', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 14px', fontSize: 12, cursor: 'pointer' };
const backBtn: React.CSSProperties = { background: 'none', border: '1px solid #334155', color: '#94a3b8', borderRadius: 4, padding: '4px 10px', cursor: 'pointer' };
