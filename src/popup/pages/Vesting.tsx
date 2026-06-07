import React, { useEffect, useState } from 'react';
import { loadWallet, loadSelectedRpcUrl } from '../../lib/storage';
import { getSession } from '../../lib/session';
import { hexToBytes, scriptPubKeyFromAddress, signTransaction, type WalletTx } from '../../lib/crypto';
import { createRpcClient, type UtxoEntry } from '../../lib/rpc';
import { BrandMark } from '../components/BrandMark';
import { ErrorBanner } from '../components/ErrorBanner';

interface Props { onBack: () => void }

// OTC watcher API (self-service vesting lookup).
const OTC_API = 'https://otc.tensoriumlabs.com/api';
const MIN_RELAY = 10_000;

interface Tranche {
  label: string;
  atoms: number;
  txm: number;
  unlock_height: number;
  spk: string;
  liquid: boolean;
  claimable: boolean;
}

export function Vesting({ onBack }: Props) {
  const [address, setAddress] = useState('');
  const [tip, setTip] = useState(0);
  const [tranches, setTranches] = useState<Tranche[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busySpk, setBusySpk] = useState('');
  const [note, setNote] = useState('');

  const load = async () => {
    setError(''); setLoading(true);
    try {
      const w = await loadWallet();
      if (!w) { setError('Wallet not found.'); return; }
      setAddress(w.address);
      const r = await fetch(`${OTC_API}/otc-lookup?txm=${encodeURIComponent(w.address)}`);
      const d = await r.json();
      if (d.error) { setError(d.error); return; }
      setTip(d.tip_height || 0);
      setTranches(d.tranches || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load vesting.');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const fmt = (atoms: number) =>
    `${Math.floor(atoms / 1e8)}.${(atoms % 1e8).toString().padStart(8, '0')} TXM`;

  const claim = async (t: Tranche) => {
    setError(''); setNote(''); setBusySpk(t.spk);
    try {
      const wallet = await loadWallet();
      const privKeyHex = getSession();
      if (!wallet || !privKeyHex) { setError('Wallet locked. Please reload.'); return; }

      const rpcUrl = await loadSelectedRpcUrl();
      const rpc = createRpcClient(rpcUrl);
      // The CLTV tranche lives at its own scriptPubKey, not the plain address.
      const resp = await rpc.getUtxos(t.spk);
      const utxo = (resp.utxos as UtxoEntry[]).find((u) => u.mature);
      if (!utxo) { setError('Tranche not yet claimable (not mature on-chain).'); return; }
      if (utxo.value_atoms <= MIN_RELAY) { setError('Tranche too small to cover the network fee.'); return; }

      const payloadBytes = new TextEncoder().encode('payment:v1');
      const tx: WalletTx = {
        inputs: [{
          previous_output: { txid_bytes: utxo.txid_bytes, output_index: utxo.output_index },
          signature_script: [],
        }],
        outputs: [{ value_atoms: utxo.value_atoms - MIN_RELAY, script_pubkey: scriptPubKeyFromAddress(wallet.address) }],
        payload: Array.from(payloadBytes),
      };
      const signed = await signTransaction(tx, hexToBytes(privKeyHex));
      const rpcTx = {
        id: signed.id,
        inputs: signed.inputs.map((inp) => ({
          previous_output: { txid: inp.previous_output.txid_bytes, output_index: inp.previous_output.output_index },
          signature_script: inp.signature_script,
        })),
        outputs: signed.outputs,
        payload: signed.payload,
      };
      const result = await rpc.sendRawTransaction(rpcTx as unknown as WalletTx);
      if (!result.accepted) throw new Error('Claim rejected by node.');
      setNote(`Claimed ${fmt(utxo.value_atoms - MIN_RELAY)} to your wallet.`);
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Claim failed.';
      setError(/locktime|height/i.test(msg) ? 'Tranche not yet unlocked at the current chain height.' : msg);
    } finally { setBusySpk(''); }
  };

  const locked = tranches.filter((t) => !t.liquid);

  return (
    <div className="wallet-page">
      <div className="wallet-surface" style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <BrandMark size="sm" />
          <div>
            <div className="wallet-eyebrow">OTC</div>
            <h2 style={{ margin: 0, fontSize: 20 }}>Vesting</h2>
          </div>
        </div>

        {error && <ErrorBanner message={error} />}
        {note && <p className="wallet-subtle" style={{ color: '#2ecc71' }}>{note}</p>}

        {loading ? (
          <p className="wallet-subtle">Loading your vesting…</p>
        ) : locked.length === 0 ? (
          <p className="wallet-subtle">No vesting tranches for this wallet. (The 20% liquid portion, if any, is already in your balance.)</p>
        ) : (
          <>
            <p className="wallet-subtle" style={{ marginBottom: 10 }}>Current height: {tip}. Matured tranches can be claimed straight to your wallet — fully on-chain.</p>
            {locked.map((t) => (
              <div key={t.spk} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 0', borderTop: '1px solid rgba(0,0,0,.08)' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{t.label} — {fmt(t.atoms)}</div>
                  <div className="wallet-subtle" style={{ fontSize: 12 }}>
                    {t.claimable ? 'Unlocked ✓' : `Unlocks at height ${t.unlock_height} (${t.unlock_height - tip} blocks left)`}
                  </div>
                </div>
                <button
                  className="wallet-btn wallet-btn--primary"
                  disabled={!t.claimable || busySpk === t.spk}
                  onClick={() => claim(t)}
                  style={{ opacity: t.claimable ? 1 : 0.5 }}
                >
                  {busySpk === t.spk ? 'Claiming…' : 'Claim'}
                </button>
              </div>
            ))}
          </>
        )}

        <button onClick={onBack} className="wallet-btn wallet-btn--ghost" style={{ marginTop: 16 }}>Back</button>
      </div>
    </div>
  );
}
