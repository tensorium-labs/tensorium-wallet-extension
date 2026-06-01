import React, { useEffect, useState } from 'react';
import { loadWallet, loadNetwork } from '../../lib/storage';
import { createRpcClient, RPC_URLS, type BlockResponse } from '../../lib/rpc';
import { ErrorBanner } from '../components/ErrorBanner';

interface TxEntry { height: number; direction: 'in' | 'out'; amount_atoms: number }
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
              if (received > 0) found.push({ height: h, direction: 'in', amount_atoms: received });
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
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={onBack} style={backBtn}>←</button>
        <h2 style={{ color: '#38bdf8', fontSize: 16 }}>Transaction History</h2>
      </div>
      {error && <ErrorBanner message={error} />}
      {skipped > 0 && <p style={{ color: '#f59e0b', fontSize: 11 }}>{skipped} blocks unavailable</p>}
      {loading && <p style={{ color: '#64748b', fontSize: 13 }}>Scanning blocks…</p>}
      {!loading && entries.length === 0 && <p style={{ color: '#64748b', fontSize: 13 }}>No transactions found.</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {entries.map((e, i) => (
          <div key={i} style={{ background: '#1e293b', borderRadius: 6, padding: '10px 14px', fontSize: 13 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#22c55e' }}>+ Received</span>
              <span style={{ color: '#38bdf8', fontWeight: 600 }}>{fmt(e.amount_atoms)} TXM</span>
            </div>
            <div style={{ color: '#475569', fontSize: 11, marginTop: 4 }}>Block #{e.height}</div>
          </div>
        ))}
      </div>
      <p style={{ color: '#334155', fontSize: 10, textAlign: 'center' }}>
        Showing received transactions. Outgoing detection requires indexer (Phase 9B).
      </p>
    </div>
  );
}

const backBtn: React.CSSProperties = {
  background: 'none', border: '1px solid #334155', color: '#94a3b8',
  borderRadius: 4, padding: '4px 10px', cursor: 'pointer',
};
