import React, { useState, useEffect } from 'react';
import { loadWallet, loadNetwork } from '../../lib/storage';
import { getSession } from '../../lib/session';
import { hexToBytes, signTransaction, type WalletTx } from '../../lib/crypto';
import { createRpcClient, RPC_URLS, type UtxoEntry } from '../../lib/rpc';
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
    <div style={pageStyle}>
      <h2 style={titleStyle}>Transaction Sent</h2>
      <p style={{ color: '#22c55e', fontSize: 13 }}>Accepted by the network.</p>
      <p style={{ fontSize: 11, color: '#64748b', wordBreak: 'break-all', marginTop: 8 }}>TXID: {txid}</p>
      <button onClick={onBack} style={btnStyle}>Back to Dashboard</button>
    </div>
  );

  if (step === 'confirm') return (
    <div style={pageStyle}>
      <h2 style={titleStyle}>Confirm Transaction</h2>
      <div style={{ background: '#1e293b', borderRadius: 8, padding: 14, fontSize: 13 }}>
        <div><span style={{ color: '#64748b' }}>To: </span>{toAddress}</div>
        <div style={{ marginTop: 8 }}><span style={{ color: '#64748b' }}>Amount: </span>
          <strong style={{ color: '#38bdf8' }}>{fmt(amountAtoms)}</strong></div>
      </div>
      <p style={{ color: '#fca5a5', fontSize: 12 }}>Transactions are irreversible. No fee applies.</p>
      {error && <ErrorBanner message={error} />}
      <button onClick={send} disabled={busy} style={btnStyle}>{busy ? 'Broadcasting…' : 'Confirm & Send'}</button>
      <button onClick={() => setStep('form')} style={{ ...btnStyle, background: '#1e293b' }}>Cancel</button>
    </div>
  );

  return (
    <div style={pageStyle}>
      <h2 style={titleStyle}>Send TXM</h2>
      <p style={{ color: '#94a3b8', fontSize: 12 }}>Balance: {fmt(balance)}</p>
      {error && <ErrorBanner message={error} />}
      <input placeholder="Recipient address (txm1...)" value={toAddress}
        onChange={(e) => setToAddress(e.target.value)} style={inputStyle} />
      {toAddress && !isValidTxmAddress(toAddress) && (
        <span style={{ color: '#fca5a5', fontSize: 11 }}>Invalid address format</span>
      )}
      <input placeholder="Amount in TXM (e.g. 1.5)" value={amountTxm}
        onChange={(e) => setAmountTxm(e.target.value)} type="number" min="0" style={inputStyle} />
      <button onClick={review} disabled={!toAddress || !amountTxm} style={btnStyle}>Review</button>
      <button onClick={onBack} style={{ ...btnStyle, background: '#1e293b' }}>Back</button>
    </div>
  );
}

const pageStyle: React.CSSProperties = { padding: 20, display: 'flex', flexDirection: 'column', gap: 12 };
const titleStyle: React.CSSProperties = { color: '#38bdf8', fontSize: 18 };
const inputStyle: React.CSSProperties = {
  background: '#1e293b', border: '1px solid #334155', color: '#e2e8f0',
  borderRadius: 6, padding: '10px 12px', fontSize: 14, outline: 'none', width: '100%',
};
const btnStyle: React.CSSProperties = {
  background: '#0ea5e9', color: '#fff', border: 'none', borderRadius: 6,
  padding: '10px 0', fontSize: 14, cursor: 'pointer', width: '100%',
};
