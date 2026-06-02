import React, { useEffect, useState } from 'react';
import { loadWallet, loadNetwork } from '../../lib/storage';
import { createRpcClient, RPC_URLS, type BlockResponse } from '../../lib/rpc';
import { ErrorBanner } from '../components/ErrorBanner';

interface TxEntry { height: number; amount_atoms: number }
interface Props { onBack: () => void }

export function History({ onBack }: Props) {
  const [entries, setEntries] = useState<TxEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [skipped, setSkipped] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const wallet = await loadWallet();
        if (!wallet) return;
        const net = await loadNetwork();
        const rpc = createRpcClient(RPC_URLS[net] ?? net);
        const { height } = await rpc.getBlockCount();
        const address = wallet.address;
        const found: TxEntry[] = [];
        let skip = 0;

        for (let h = height; h >= 0; h--) {
          try {
            const block: BlockResponse = await rpc.getBlock(h);
            for (const tx of block.transactions) {
              if (tx.inputs.length === 0) continue; // skip coinbase
              const received = tx.outputs
                .filter((o) => o.address === address)
                .reduce((sum, o) => sum + o.value_atoms, 0);
              if (received > 0) found.push({ height: h, amount_atoms: received });
            }
          } catch { skip++; }
        }

        setEntries(found);
        setSkipped(skip);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load history.');
      } finally { setLoading(false); }
    })();
  }, []);

  const fmt = (atoms: number) =>
    `${Math.floor(atoms / 100_000_000)}.${(atoms % 100_000_000).toString().padStart(8, '0')}`;

  return (
    <div className="wallet-page">
      <div className="wallet-topbar">
        <div className="wallet-brand">
          <button onClick={onBack} className="wallet-back">←</button>
          <div className="wallet-brand-copy">
            <div className="wallet-eyebrow">Received transfers</div>
            <h2>Transaction History</h2>
          </div>
        </div>
      </div>
      {error && <ErrorBanner message={error} />}
      {skipped > 0 && <p className="wallet-note" style={{ color: '#f7c76a' }}>{skipped} blocks unavailable</p>}
      {loading && <div className="wallet-card"><p className="wallet-subtle">Scanning blocks…</p></div>}
      {!loading && entries.length === 0 && <div className="wallet-card"><p className="wallet-subtle">No transactions found.</p></div>}
      <div className="wallet-list">
        {entries.map((e, i) => (
          <div key={i} className="wallet-history-item">
            <div className="wallet-history-head">
              <span style={{ color: '#87e887', fontWeight: 700 }}>+ Received</span>
              <span style={{ color: '#ffd166', fontWeight: 700 }}>{fmt(e.amount_atoms)} TXM</span>
            </div>
            <div className="wallet-note" style={{ marginTop: 6 }}>Block #{e.height}</div>
          </div>
        ))}
      </div>
      <p className="wallet-footer-note">
        Showing received transactions. Outgoing detection requires indexer (Phase 9B).
      </p>
    </div>
  );
}
