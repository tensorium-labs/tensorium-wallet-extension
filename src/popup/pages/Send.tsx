import React, { useState, useEffect } from 'react';
import { loadWallet, loadNetwork } from '../../lib/storage';
import { getSession } from '../../lib/session';
import { hexToBytes, signTransaction, type WalletTx } from '../../lib/crypto';
import { createRpcClient, RPC_URLS, type UtxoEntry } from '../../lib/rpc';
import { BrandMark } from '../components/BrandMark';
import { ErrorBanner } from '../components/ErrorBanner';

interface Props { onBack: () => void }
type SendStep = 'form' | 'confirm' | 'success';

function isValidTxmAddress(addr: string): boolean {
  // txm bech32 address: starts with "txm1" followed by valid bech32 characters
  return /^txm1[ac-hj-np-z02-9]{20,}$/.test(addr);
}

export function Send({ onBack }: Props) {
  const [toAddress, setToAddress] = useState('');
  const [amountTxm, setAmountTxm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<SendStep>('form');
  const [txid, setTxid] = useState('');
  const [balance, setBalance] = useState(0);
  const [utxos, setUtxos] = useState<UtxoEntry[]>([]);

  useEffect(() => {
    (async () => {
      const wallet = await loadWallet();
      if (!wallet) return;
      const net = await loadNetwork();
      const rpc = createRpcClient(RPC_URLS[net] ?? net);
      const result = await rpc.getUtxos(wallet.address);
      const mature = result.utxos.filter((u: UtxoEntry) => u.mature);
      setUtxos(mature);
      setBalance(mature.reduce((s: number, u: UtxoEntry) => s + u.value_atoms, 0));
    })();
  }, []);

  const amountAtoms = Math.floor(parseFloat(amountTxm || '0') * 100_000_000);

  const validate = () => {
    if (!isValidTxmAddress(toAddress)) { setError('Invalid recipient address.'); return false; }
    if (isNaN(amountAtoms) || amountAtoms <= 0) { setError('Amount must be greater than 0.'); return false; }
    if (amountAtoms > balance) { setError('Insufficient balance.'); return false; }
    return true;
  };

  const review = () => { setError(''); if (validate()) setStep('confirm'); };

  const send = async () => {
    setError(''); setBusy(true);
    try {
      const wallet = await loadWallet();
      const privKeyHex = getSession();
      if (!wallet || !privKeyHex) { setError('Wallet locked. Please reload.'); return; }

      let selected: UtxoEntry[] = [];
      let selectedAtoms = 0;
      for (const u of utxos) {
        selected.push(u); selectedAtoms += u.value_atoms;
        if (selectedAtoms >= amountAtoms) break;
      }

      const payloadBytes = new TextEncoder().encode('payment:v1');
      const inputs = selected.map((u) => ({
        previous_output: { txid_bytes: u.txid_bytes, output_index: u.output_index },
        signature_script: [] as number[],
      }));
      const outputs = [{ value_atoms: amountAtoms, address: toAddress }];
      const change = selectedAtoms - amountAtoms;
      if (change > 0) outputs.push({ value_atoms: change, address: wallet.address });

      const tx: WalletTx = { inputs, outputs, payload: Array.from(payloadBytes) };
      const signed = await signTransaction(tx, hexToBytes(privKeyHex));

      // Build RPC-compatible transaction (txid must match Hash256 byte-array format)
      const rpcTx = {
        id: signed.id,
        inputs: signed.inputs.map((inp, i) => ({
          previous_output: { txid: selected[i].txid_bytes, output_index: inp.previous_output.output_index },
          signature_script: inp.signature_script,
        })),
        outputs: signed.outputs,
        payload: signed.payload,
      };

      const net = await loadNetwork();
      const rpc = createRpcClient(RPC_URLS[net] ?? net);
      const result = await rpc.sendRawTransaction(rpcTx as unknown as WalletTx);
      if (!result.accepted) throw new Error('Transaction rejected by node.');

      const txidHex = Array.from(result.txid as unknown as number[])
        .map((b) => (b as number).toString(16).padStart(2, '0')).join('');
      setTxid(txidHex);
      setStep('success');
    } catch (e) { setError(e instanceof Error ? e.message : 'Send failed.'); }
    finally { setBusy(false); }
  };

  const fmt = (atoms: number) =>
    `${Math.floor(atoms / 100_000_000)}.${(atoms % 100_000_000).toString().padStart(8, '0')} TXM`;

  if (step === 'success') return (
    <div className="wallet-page wallet-page--centered">
      <div className="wallet-surface" style={{ padding: 22 }}>
        <div className="wallet-eyebrow">Broadcast complete</div>
        <h2 style={{ margin: 0, fontSize: 22 }}>Transaction Sent</h2>
        <p className="wallet-subtle" style={{ marginTop: 8 }}>The transaction was accepted by the network RPC.</p>
        <div className="wallet-card" style={{ marginTop: 14, marginBottom: 14 }}>
          <div className="wallet-section-label">TXID</div>
          <div className="wallet-code wallet-address">{txid}</div>
        </div>
        <button onClick={onBack} className="wallet-btn wallet-btn--primary">Back to Dashboard</button>
      </div>
    </div>
  );

  if (step === 'confirm') return (
    <div className="wallet-page">
      <div className="wallet-topbar">
        <div className="wallet-brand">
          <button onClick={() => setStep('form')} className="wallet-back">←</button>
          <BrandMark size="sm" />
          <div className="wallet-brand-copy">
            <div className="wallet-eyebrow">Final review</div>
            <h2>Confirm Transaction</h2>
          </div>
        </div>
      </div>
      <div className="wallet-surface" style={{ padding: 16 }}>
        <div className="wallet-section-label">Recipient</div>
        <div className="wallet-address wallet-code">{toAddress}</div>
        <div className="wallet-divider"></div>
        <div className="wallet-section-label">Amount</div>
        <div className="wallet-balance wallet-balance--accent" style={{ fontSize: 22 }}>{fmt(amountAtoms)}</div>
      </div>
      <p className="wallet-note" style={{ color: '#ffd3d3' }}>Transactions are irreversible. No fee applies.</p>
      {error && <ErrorBanner message={error} />}
      <div className="wallet-stack">
        <button onClick={send} disabled={busy} className="wallet-btn wallet-btn--primary">{busy ? 'Broadcasting…' : 'Confirm & Send'}</button>
        <button onClick={() => setStep('form')} className="wallet-btn wallet-btn--secondary">Cancel</button>
      </div>
    </div>
  );

  return (
    <div className="wallet-page">
      <div className="wallet-topbar">
        <div className="wallet-brand">
          <button onClick={onBack} className="wallet-back">←</button>
          <BrandMark size="sm" />
          <div className="wallet-brand-copy">
            <div className="wallet-eyebrow">Transfer</div>
            <h2>Send TXM</h2>
          </div>
        </div>
      </div>
      <div className="wallet-card">
        <div className="wallet-section-label">Available balance</div>
        <div className="wallet-balance wallet-balance--accent" style={{ fontSize: 22 }}>{fmt(balance)}</div>
      </div>
      {error && <ErrorBanner message={error} />}
      <input placeholder="Recipient address (txm1...)" value={toAddress}
        onChange={(e) => setToAddress(e.target.value)} className="wallet-input" />
      {toAddress && !isValidTxmAddress(toAddress) && (
        <span className="wallet-note" style={{ color: '#ffd3d3' }}>Invalid address format</span>
      )}
      <input placeholder="Amount in TXM (e.g. 1.5)" value={amountTxm}
        onChange={(e) => setAmountTxm(e.target.value)} type="number" min="0" className="wallet-input" />
      <div className="wallet-stack">
        <button onClick={review} disabled={!toAddress || !amountTxm} className="wallet-btn wallet-btn--primary">Review</button>
        <button onClick={onBack} className="wallet-btn wallet-btn--secondary">Back</button>
      </div>
    </div>
  );
}
