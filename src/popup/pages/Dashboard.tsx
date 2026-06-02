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
    <div className="wallet-page">
      <div className="wallet-topbar">
        <div className="wallet-brand">
          <div className="wallet-brand-mark">T</div>
          <div className="wallet-brand-copy">
            <div className="wallet-eyebrow">Wallet overview</div>
            <h2>Tensorium Wallet</h2>
          </div>
        </div>
        <NetworkBadge network={network} />
      </div>
      {error && <ErrorBanner message={error} onRetry={refresh} />}
      <div className="wallet-surface" style={{ padding: 16 }}>
        <div className="wallet-section-label">Current wallet</div>
        <div className="wallet-address wallet-code">{address}</div>
        <div className="wallet-row" style={{ marginTop: 12 }}>
          <button onClick={copy} className="wallet-btn wallet-btn--secondary">{copied ? 'Copied' : 'Copy address'}</button>
          <button onClick={refresh} className="wallet-btn wallet-btn--ghost">Refresh</button>
        </div>
      </div>
      <div className="wallet-surface" style={{ padding: 16 }}>
        <div className="wallet-section-label">Spendable balance</div>
        <div className="wallet-balance wallet-balance--accent">
          {balance === null ? '—' : formatTxm(balance)}
        </div>
        <div className="wallet-kpi-grid" style={{ marginTop: 14 }}>
          <div className="wallet-stat">
            <div className="wallet-stat__label">Network</div>
            <div className="wallet-stat__value">{network === 'mc' ? 'Mainnet Candidate' : network === 'testnet' ? 'Public Testnet' : 'Custom RPC'}</div>
          </div>
          <div className="wallet-stat">
            <div className="wallet-stat__label">Status</div>
            <div className="wallet-stat__value">Ready</div>
          </div>
        </div>
      </div>
      <div className="wallet-pill-nav">
        <button onClick={() => onNav('send')} className="wallet-btn wallet-btn--primary">Send</button>
        <button onClick={() => onNav('history')} className="wallet-btn wallet-btn--secondary">History</button>
        <button onClick={() => onNav('settings')} className="wallet-btn wallet-btn--secondary">Settings</button>
      </div>
      <div className="wallet-footer-note">
        Tensorium Wallet currently shows mature balance from RPC UTXOs. Advanced indexing and richer transaction history can come later without blocking UI polish now.
      </div>
    </div>
  );
}
