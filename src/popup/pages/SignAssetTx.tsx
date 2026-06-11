import React, { useState } from 'react';
import { loadWallet, loadSelectedRpcUrl } from '../../lib/storage';
import { getSession } from '../../lib/session';
import { hexToBytes, signTransaction, type WalletTx } from '../../lib/crypto';
import { createRpcClient } from '../../lib/rpc';
import { BrandMark } from '../components/BrandMark';
import { ErrorBanner } from '../components/ErrorBanner';

export interface AssetReq {
  reqId: string;
  unsignedTx: WalletTx;
  summary: { description?: string; fee_atoms?: number; [key: string]: unknown };
  status: 'pending' | 'confirmed' | 'rejected';
  txid?: string;
  error?: string;
}

interface Props { req: AssetReq; onDone: () => void }

const fmt = (atoms: number) =>
  `${Math.floor(atoms / 100_000_000)}.${(atoms % 100_000_000).toString().padStart(8, '0')} TXM`;

export function SignAssetTx({ req, onDone }: Props) {
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

      const signed = await signTransaction(req.unsignedTx, hexToBytes(privKeyHex));
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

      const rpcUrl = await loadSelectedRpcUrl();
      const rpc = createRpcClient(rpcUrl);
      const result = await rpc.sendRawTransaction(rpcTx as unknown as WalletTx);
      if (!result.accepted) throw new Error('Transaction rejected by node.');

      await (chrome.storage.session as any).set({
        txm_asset_req: { ...req, status: 'confirmed', txid: txidHex },
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
      txm_asset_req: { ...req, status: 'rejected', error: 'User rejected' },
    });
    await chrome.action.setBadgeText({ text: '' });
    onDone();
  };

  if (done) return (
    <div className="wallet-page wallet-page--centered">
      <div className="wallet-surface" style={{ padding: 22, textAlign: 'center' }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>✅</div>
        <h2>Asset Transaction Sent</h2>
        <p className="wallet-subtle" style={{ marginTop: 8 }}>
          Your transaction has been broadcast to the network.
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
            <div className="wallet-eyebrow">marketplace.tensoriumlabs.com</div>
            <h2>Confirm Asset Transaction</h2>
          </div>
        </div>
      </div>
      <div className="wallet-card" style={{ marginBottom: 10 }}>
        <div className="wallet-note">A dapp is requesting you sign an asset transaction</div>
      </div>
      <div className="wallet-surface" style={{ padding: 16 }}>
        <div className="wallet-section-label">Description</div>
        <div className="wallet-balance wallet-balance--accent" style={{ fontSize: 16 }}>
          {req.summary?.description ?? 'Asset transaction'}
        </div>
        <div className="wallet-divider"></div>
        <div className="wallet-section-label">Network fee</div>
        <div className="wallet-subtle">{fmt(req.summary?.fee_atoms ?? 0)}</div>
      </div>
      {error && <ErrorBanner message={error} />}
      <div className="wallet-stack">
        <button onClick={confirm} disabled={busy} className="wallet-btn wallet-btn--primary">
          {busy ? 'Signing & Broadcasting…' : 'Approve & Sign'}
        </button>
        <button onClick={reject} disabled={busy} className="wallet-btn wallet-btn--secondary">
          Reject
        </button>
      </div>
    </div>
  );
}
