import React, { useEffect, useState, useCallback } from 'react';
import { loadWallet, loadNetwork, type Network } from '../../lib/storage';
import { createRpcClient, RPC_URLS, type UtxoEntry } from '../../lib/rpc';
import { NetworkBadge } from '../components/NetworkBadge';
import { ErrorBanner } from '../components/ErrorBanner';
import type { Page } from '../App';

interface Props { onNav: (p: Page) => void }

export function Dashboard({ onNav }: Props) {
  const [address, setAddress] = useState('');
  const [balance, setBalance] = useState<number | null>(null);
  const [network, setNetwork] = useState<Network>('testnet');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const refresh = useCallback(async () => {
    setError('');
    try {
      const wallet = await loadWallet();
      if (!wallet) return;
      setAddress(wallet.address);
      const net = await loadNetwork();
      setNetwork(net);
      const rpcUrl = RPC_URLS[net] ?? net;
      const rpc = createRpcClient(rpcUrl);
      const { utxos } = await rpc.getUtxos(wallet.address);
      const mature = utxos.filter((u: UtxoEntry) => u.mature);
      setBalance(mature.reduce((sum: number, u: UtxoEntry) => sum + u.value_atoms, 0));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load balance.');
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const copy = () => {
    navigator.clipboard.writeText(address);
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  };

  const formatTxm = (atoms: number) => {
    const whole = Math.floor(atoms / 100_000_000);
    const frac = atoms % 100_000_000;
    return `${whole}.${frac.toString().padStart(8, '0')} TXM`;
  };

  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ color: '#38bdf8', fontSize: 16 }}>Tensorium Wallet</h2>
        <NetworkBadge network={network} />
      </div>
      {error && <ErrorBanner message={error} onRetry={refresh} />}
      <div style={{ background: '#1e293b', borderRadius: 8, padding: 14 }}>
        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>ADDRESS</div>
        <div style={{ fontSize: 12, color: '#e2e8f0', wordBreak: 'break-all' }}>{address}</div>
        <button onClick={copy} style={smallBtnStyle}>{copied ? 'Copied' : 'Copy'}</button>
      </div>
      <div style={{ background: '#1e293b', borderRadius: 8, padding: 14 }}>
        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>BALANCE</div>
        <div style={{ fontSize: 22, color: '#38bdf8', fontWeight: 700 }}>
          {balance === null ? '—' : formatTxm(balance)}
        </div>
        <button onClick={refresh} style={smallBtnStyle}>Refresh</button>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => onNav('send')} style={actionBtnStyle}>Send</button>
        <button onClick={() => onNav('history')} style={actionBtnStyle}>History</button>
        <button onClick={() => onNav('settings')} style={actionBtnStyle}>Settings</button>
      </div>
    </div>
  );
}

const smallBtnStyle: React.CSSProperties = {
  marginTop: 8, background: 'none', border: '1px solid #334155', color: '#94a3b8',
  borderRadius: 4, padding: '3px 10px', fontSize: 11, cursor: 'pointer',
};
const actionBtnStyle: React.CSSProperties = {
  flex: 1, background: '#0f172a', border: '1px solid #334155', color: '#e2e8f0',
  borderRadius: 6, padding: '10px 0', fontSize: 13, cursor: 'pointer',
};
