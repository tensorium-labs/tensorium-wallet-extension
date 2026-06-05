import React, { useState } from 'react';
import { loadWallet, loadSelectedRpcUrl } from '../../lib/storage';
import { getSession } from '../../lib/session';
import { hexToBytes, scriptPubKeyFromAddress, signTransaction, type WalletTx } from '../../lib/crypto';
import { createRpcClient, type UtxoEntry } from '../../lib/rpc';
import { BrandMark } from '../components/BrandMark';
import { ErrorBanner } from '../components/ErrorBanner';

export interface BridgeReq {
  reqId: string;
  to: string;
  amount_atoms: number;
  status: 'pending' | 'confirmed' | 'rejected';
  txid?: string;
  error?: string;
}

interface Props { req: BridgeReq; onDone: () => void }

const MIN_RELAY_FEE_ATOMS = 10_000;
const fmt = (atoms: number) =>
  `${Math.floor(atoms / 100_000_000)}.${(atoms % 100_000_000).toString().padStart(8, '0')} TXM`;

export function BridgeConfirm({ req, onDone }: Props) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const confirm = async () => {
    setError(''); setBusy(true);
    try {
      const wallet = await loadWallet();
      const privKeyHex = getSession();
      if (!wallet || !privKeyHex) {
        setError('Wallet is locked. Lock and re-unlock to retry.'); return;
      }
      const rpcUrl = await loadSelectedRpcUrl();
      const rpc = createRpcClient(rpcUrl);
      const { utxos: allUtxos } = await rpc.getUtxos(wallet.address);
      const utxos = allUtxos.filter((u: UtxoEntry) => u.mature);
      const totalNeeded = req.amount_atoms + MIN_RELAY_FEE_ATOMS;
      const totalBalance = utxos.reduce((s: number, u: UtxoEntry) => s + u.value_atoms, 0);
      if (totalBalance < totalNeeded) {
        setError(`Insufficient balance. Need ${fmt(totalNeeded)}, have ${fmt(totalBalance)}.`); return;
      }

      let selected: UtxoEntry[] = [], selectedAtoms = 0;
      for (const u of utxos) {
        selected.push(u); selectedAtoms += u.value_atoms;
        if (selectedAtoms >= totalNeeded) break;
      }

      const payloadBytes = new TextEncoder().encode('payment:v1');
      const inputs = selected.map((u) => ({
        previous_output: { txid_bytes: u.txid_bytes, output_index: u.output_index },
        signature_script: [] as number[],
      }));
      const outputs: { value_atoms: number; script_pubkey: number[] }[] = [
        { value_atoms: req.amount_atoms, script_pubkey: scriptPubKeyFromAddress(req.to) },
      ];
      const change = selectedAtoms - req.amount_atoms - MIN_RELAY_FEE_ATOMS;
      if (change > 0)
        outputs.push({ value_atoms: change, script_pubkey: scriptPubKeyFromAddress(wallet.address) });

      const tx: WalletTx = { inputs, outputs, payload: Array.from(payloadBytes) };
      const signed = await signTransaction(tx, hexToBytes(privKeyHex));
      const txidHex = Array.from(signed.id).map((b) => b.toString(16).padStart(2, '0')).join('');

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
      if (!result.accepted) throw new Error('Transaction rejected by node.');

      await (chrome.storage.session as any).set({
        txm_bridge_req: { ...req, status: 'confirmed', txid: txidHex },
      });
      await chrome.action.setBadgeText({ text: '' });
      setDone(true);
      setTimeout(onDone, 1800);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Transaction failed.');
    } finally {
      setBusy(false);
    }
  };

  const reject = async () => {
    await (chrome.storage.session as any).set({
      txm_bridge_req: { ...req, status: 'rejected', error: 'User cancelled' },
    });
    await chrome.action.setBadgeText({ text: '' });
    onDone();
  };

  if (done) return (
    <div className="wallet-page wallet-page--centered">
      <div className="wallet-surface" style={{ padding: 22, textAlign: 'center' }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>✅</div>
        <h2>Bridge TX Sent</h2>
        <p className="wallet-subtle" style={{ marginTop: 8 }}>
          wTXM will be minted after 6 confirmations (~12 min).
        </p>
      </div>
    </div>
  );

  return (
    <div className="wallet-page">
      <div className="wallet-topbar">
        <div className="wallet-brand">
          <BrandMark />
          <div className="wallet-brand-copy">
            <div className="wallet-eyebrow">bridge.tensoriumlabs.com</div>
            <h2>Confirm Bridge</h2>
          </div>
        </div>
      </div>
      <div className="wallet-card" style={{ marginBottom: 10 }}>
        <div className="wallet-note">Lock TXM on Tensorium — receive wTXM on Optimism</div>
      </div>
      <div className="wallet-surface" style={{ padding: 16 }}>
        <div className="wallet-section-label">Amount to bridge</div>
        <div className="wallet-balance wallet-balance--accent" style={{ fontSize: 22 }}>
          {fmt(req.amount_atoms)}
        </div>
        <div className="wallet-divider"></div>
        <div className="wallet-section-label">Custody address (Tensorium)</div>
        <div className="wallet-address wallet-code" style={{ fontSize: 10 }}>{req.to}</div>
        <div className="wallet-divider"></div>
        <div className="wallet-section-label">Network fee</div>
        <div className="wallet-subtle">{fmt(MIN_RELAY_FEE_ATOMS)}</div>
      </div>
      {error && <ErrorBanner message={error} />}
      <div className="wallet-stack">
        <button onClick={confirm} disabled={busy} className="wallet-btn wallet-btn--primary">
          {busy ? 'Signing & Broadcasting…' : 'Confirm & Bridge'}
        </button>
        <button onClick={reject} disabled={busy} className="wallet-btn wallet-btn--secondary">
          Cancel
        </button>
      </div>
    </div>
  );
}
