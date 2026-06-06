import React, { useEffect, useState } from 'react';
import { loadWallet, loadSelectedRpcUrl } from '../../lib/storage';
import { createRpcClient, type BlockResponse, type TxOutput } from '../../lib/rpc';
import { extractAddressFromScriptPubKey } from '../../lib/crypto';
import { BrandMark } from '../components/BrandMark';
import { ErrorBanner } from '../components/ErrorBanner';

const SCAN_DEPTH = 200;

interface TxEntry {
  type: 'received' | 'sent' | 'mined';
  amount_atoms: number;
  height: number;
  txid: string;
}

interface Props { onBack: () => void }

function bytesToHex(bytes: number[]): string {
  return bytes.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function History({ onBack }: Props) {
  const [entries, setEntries] = useState<TxEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [skipped, setSkipped] = useState(0);
  const [scanRange, setScanRange] = useState<[number, number]>([0, 0]);

  useEffect(() => {
    (async () => {
      try {
        const wallet = await loadWallet();
        if (!wallet) return;
        const rpc = createRpcClient(await loadSelectedRpcUrl());
        const { height: tip } = await rpc.getBlockCount();
        const startHeight = Math.max(0, tip - SCAN_DEPTH + 1);
        setScanRange([startHeight, tip]);

        const address = wallet.address;
        const results: TxEntry[] = [];
        let skip = 0;

        // Scan oldest→newest so we can cross-reference spent inputs
        // txid_hex → outputs, for value lookup when we detect a spent input
        const txOutputCache = new Map<string, TxOutput[]>();
        // txids where our address appeared as an output
        const receivedTxids = new Set<string>();

        const total = tip - startHeight + 1;
        for (let h = startHeight; h <= tip; h++) {
          setProgress(`Scanning block ${h - startHeight + 1} / ${total}`);
          try {
            const block: BlockResponse = await rpc.getBlock(h);
            for (const tx of block.transactions) {
              const txid = bytesToHex(tx.id);
              txOutputCache.set(txid, tx.outputs);

              const isCoinbase = tx.inputs.length === 0;

              const receivedAtoms = tx.outputs
                .filter(o => extractAddressFromScriptPubKey(o.script_pubkey) === address)
                .reduce((s, o) => s + o.value_atoms, 0);
              if (receivedAtoms > 0) {
                if (isCoinbase) {
                  results.push({ type: 'mined', amount_atoms: receivedAtoms, height: h, txid });
                } else {
                  receivedTxids.add(txid);
                  results.push({ type: 'received', amount_atoms: receivedAtoms, height: h, txid });
                }
              }

              // Detect sent: any input spending an output we previously received
              if (!isCoinbase) {
                let sentAtoms = 0;
                for (const inp of tx.inputs) {
                    const prevTxid = bytesToHex(inp.previous_output.txid);
                    if (receivedTxids.has(prevTxid)) {
                      const prevOutputs = txOutputCache.get(prevTxid);
                      const prevOut = prevOutputs?.[inp.previous_output.output_index];
                    if (prevOut && extractAddressFromScriptPubKey(prevOut.script_pubkey) === address) {
                        sentAtoms += prevOut.value_atoms;
                      }
                    }
                }
                if (sentAtoms > 0) {
                  results.push({ type: 'sent', amount_atoms: sentAtoms, height: h, txid });
                }
              }
            }
          } catch { skip++; }
        }

        results.sort((a, b) => b.height - a.height);
        setEntries(results);
        setSkipped(skip);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load history.');
      } finally {
        setLoading(false);
        setProgress('');
      }
    })();
  }, []);

  const fmt = (atoms: number) =>
    `${Math.floor(atoms / 100_000_000)}.${(atoms % 100_000_000).toString().padStart(8, '0')}`;

  return (
    <div className="wallet-page">
      <div className="wallet-topbar">
        <div className="wallet-brand">
          <button onClick={onBack} className="wallet-back">←</button>
          <BrandMark size="sm" />
          <div className="wallet-brand-copy">
            <div className="wallet-eyebrow">Recent activity</div>
            <h2>Transaction History</h2>
          </div>
        </div>
      </div>
      {error && <ErrorBanner message={error} />}
      {skipped > 0 && <p className="wallet-note" style={{ color: '#f7c76a' }}>{skipped} blocks unavailable</p>}
      {loading && (
        <div className="wallet-card">
          <p className="wallet-subtle">{progress || 'Initializing…'}</p>
        </div>
      )}
      {!loading && entries.length === 0 && (
        <div className="wallet-card">
          <p className="wallet-subtle">No transactions in last {SCAN_DEPTH} blocks.</p>
        </div>
      )}
      <div className="wallet-list">
        {entries.map((e, i) => (
          <div key={i} className="wallet-history-item">
            <div className="wallet-history-head">
              <span style={{ color: e.type === 'sent' ? '#ffd3d3' : '#87e887', fontWeight: 700 }}>
                {e.type === 'mined' ? '⛏ Mined' : e.type === 'received' ? '+ Received' : '− Sent'}
              </span>
              <span style={{ color: '#ffd166', fontWeight: 700 }}>
                {e.type === 'sent' ? '−' : '+'}{fmt(e.amount_atoms)} TXM
              </span>
            </div>
            <div className="wallet-note" style={{ marginTop: 4 }}>Block #{e.height}</div>
            <div className="wallet-code" style={{ fontSize: 10, marginTop: 2, color: '#8899aa', wordBreak: 'break-all' }}>
              {e.txid.slice(0, 16)}…{e.txid.slice(-8)}
            </div>
          </div>
        ))}
      </div>
      {!loading && (
        <p className="wallet-footer-note">
          Showing last {SCAN_DEPTH} blocks (#{scanRange[0]}–#{scanRange[1]}). Full history requires indexer.
        </p>
      )}
    </div>
  );
}
