import React, { useState, useEffect } from 'react';
import { loadWallet, loadSelectedRpcUrl } from '../../lib/storage';
import { getSession } from '../../lib/session';
import { hexToBytes, scriptPubKeyFromAddress, signTransaction, type WalletTx } from '../../lib/crypto';
import { createRpcClient, type UtxoEntry, type EstimateFeeResponse } from '../../lib/rpc';
import { BrandMark } from '../components/BrandMark';
import { ErrorBanner } from '../components/ErrorBanner';

interface Props { onBack: () => void }
type SendStep = 'form' | 'confirm' | 'success';
type FeePreset = 'slow' | 'normal' | 'fast' | 'custom';
const MEMPOOL_CONFLICT_HINT = 'This spend is already pending in the mempool. Wait for confirmation before sending again.';

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
  const [successNote, setSuccessNote] = useState('The transaction was accepted by the network RPC.');
  const [balance, setBalance] = useState(0);
  const [utxos, setUtxos] = useState<UtxoEntry[]>([]);

  const [feePreset,    setFeePreset]    = useState<FeePreset>('normal');
  const [customFeeTxm, setCustomFee]   = useState('');
  const [feeEstimate,  setFeeEstimate] = useState<EstimateFeeResponse | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const wallet = await loadWallet();
        if (!wallet) return;
        const rpcUrl = await loadSelectedRpcUrl();
        const rpc = createRpcClient(rpcUrl);
        const [utxoResult] = await Promise.allSettled([
          rpc.getUtxos(wallet.address),
          rpc.estimateFee().then(setFeeEstimate).catch(() => { /* silent fallback */ }),
        ]);
        if (utxoResult.status === 'fulfilled') {
          const mature = utxoResult.value.utxos.filter((u: UtxoEntry) => u.mature);
          setUtxos(mature);
          setBalance(mature.reduce((s: number, u: UtxoEntry) => s + u.value_atoms, 0));
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load balance.');
      }
    })();
  }, []);

  const amountAtoms = Math.floor(parseFloat(amountTxm || '0') * 100_000_000);

  const MIN_RELAY = 10_000;
  const activeFeeAtoms: number =
    feePreset === 'slow'   ? (feeEstimate?.slow_atoms   ?? MIN_RELAY) :
    feePreset === 'normal' ? (feeEstimate?.normal_atoms  ?? MIN_RELAY * 2) :
    feePreset === 'fast'   ? (feeEstimate?.fast_atoms    ?? MIN_RELAY * 10) :
    Math.max(Math.round(parseFloat(customFeeTxm || '0') * 1e8), MIN_RELAY);

  const customFeeAtoms = Math.round(parseFloat(customFeeTxm || '0') * 1e8);
  const customFeeTooLow = feePreset === 'custom' && customFeeTxm !== '' && customFeeAtoms < MIN_RELAY;
  const totalSpendAtoms = amountAtoms + activeFeeAtoms;

  const validate = () => {
    if (!isValidTxmAddress(toAddress)) { setError('Invalid recipient address.'); return false; }
    if (isNaN(amountAtoms) || amountAtoms <= 0) { setError('Amount must be greater than 0.'); return false; }
    if (totalSpendAtoms > balance) { setError('Insufficient balance including network fee.'); return false; }
    return true;
  };

  const review = () => { setError(''); if (validate()) setStep('confirm'); };

  const send = async () => {
    setError(''); setBusy(true);
    setSuccessNote('The transaction was accepted by the network RPC.');
    try {
      const wallet = await loadWallet();
      const privKeyHex = getSession();
      if (!wallet || !privKeyHex) { setError('Wallet locked. Please reload.'); return; }

      let selected: UtxoEntry[] = [];
      let selectedAtoms = 0;
      for (const u of utxos) {
        selected.push(u); selectedAtoms += u.value_atoms;
        if (selectedAtoms >= totalSpendAtoms) break;
      }

      const payloadBytes = new TextEncoder().encode('payment:v1');
      const inputs = selected.map((u) => ({
        previous_output: { txid_bytes: u.txid_bytes, output_index: u.output_index },
        signature_script: [] as number[],
      }));
      const outputs = [{ value_atoms: amountAtoms, script_pubkey: scriptPubKeyFromAddress(toAddress) }];
      const change = selectedAtoms - amountAtoms - activeFeeAtoms;
      if (change > 0) {
        outputs.push({ value_atoms: change, script_pubkey: scriptPubKeyFromAddress(wallet.address) });
      }

      const tx: WalletTx = { inputs, outputs, payload: Array.from(payloadBytes) };
      const signed = await signTransaction(tx, hexToBytes(privKeyHex));
      const signedTxidHex = Array.from(signed.id)
        .map((b) => b.toString(16).padStart(2, '0')).join('');

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
      let result;
      try {
        result = await rpc.sendRawTransaction(rpcTx as unknown as WalletTx);
      } catch (e) {
        if (e instanceof Error && /already in the mempool|conflicts with a transaction already in the mempool/i.test(e.message)) {
          try {
            const mempool = await rpc.getMempoolInfo();
            if (mempool.txids.includes(signedTxidHex)) {
              setTxid(signedTxidHex);
              setSuccessNote('This transaction is already pending in the mempool. Wait for it to be mined before sending another spend.');
              setStep('success');
              return;
            }
          } catch {
            // Keep the original RPC error if mempool inspection fails.
          }
          throw new Error(MEMPOOL_CONFLICT_HINT);
        }
        throw e;
      }
      if (!result.accepted) throw new Error('Transaction rejected by node.');

      const txidHex = Array.from(result.txid as unknown as number[])
        .map((b) => (b as number).toString(16).padStart(2, '0')).join('');
      setTxid(txidHex);
      setSuccessNote('The transaction was accepted by the network RPC.');
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
        <p className="wallet-subtle" style={{ marginTop: 8 }}>{successNote}</p>
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
      <p className="wallet-note" style={{ color: '#ffd3d3' }}>
        Transactions are irreversible. Network fee: {fmt(activeFeeAtoms)}.
      </p>
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
      <p className="wallet-note">Minimum network fee: {fmt(activeFeeAtoms)}</p>
      {error && <ErrorBanner message={error} />}
      <input placeholder="Recipient address (txm1...)" value={toAddress}
        onChange={(e) => setToAddress(e.target.value)} className="wallet-input" />
      {toAddress && !isValidTxmAddress(toAddress) && (
        <span className="wallet-note" style={{ color: '#ffd3d3' }}>Invalid address format</span>
      )}
      <input placeholder="Amount in TXM (e.g. 1.5)" value={amountTxm}
        onChange={(e) => setAmountTxm(e.target.value)} type="number" min="0" className="wallet-input" />
      {/* Fee selector */}
      <div className="wallet-card" style={{ marginTop: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div className="wallet-section-label" style={{ margin: 0 }}>Network Fee</div>
          {feeEstimate && (
            <span style={{
              fontSize: 11, fontWeight: 600, borderRadius: 99, padding: '2px 8px',
              background:
                feeEstimate.congestion_level === 'high'   ? '#ef444422' :
                feeEstimate.congestion_level === 'medium' ? '#f59e0b22' : '#22c55e22',
              color:
                feeEstimate.congestion_level === 'high'   ? '#ef4444' :
                feeEstimate.congestion_level === 'medium' ? '#f59e0b' : '#22c55e',
            }}>
              ●&nbsp;{feeEstimate.congestion_level === 'high' ? 'Congested' :
                      feeEstimate.congestion_level === 'medium' ? 'Busy' : 'Low activity'}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
          {(['slow', 'normal', 'fast'] as const).map((tier) => {
            const atoms = feeEstimate?.[`${tier}_atoms` as keyof EstimateFeeResponse] as number
              ?? (tier === 'slow' ? MIN_RELAY : tier === 'normal' ? MIN_RELAY * 2 : MIN_RELAY * 10);
            const active = feePreset === tier;
            return (
              <button
                key={tier}
                onClick={() => setFeePreset(tier)}
                className={`wallet-btn ${active ? 'wallet-btn--primary' : 'wallet-btn--secondary'}`}
                style={{ flex: 1, padding: '6px 4px', fontSize: 12 }}
              >
                <div style={{ fontWeight: 700, textTransform: 'capitalize' }}>{tier}</div>
                <div style={{ fontSize: 10, opacity: 0.85 }}>{fmt(atoms)}</div>
              </button>
            );
          })}
        </div>
        <button
          onClick={() => setFeePreset((prev) => prev === 'custom' ? 'normal' : 'custom')}
          className={`wallet-btn ${feePreset === 'custom' ? 'wallet-btn--primary' : 'wallet-btn--secondary'}`}
          style={{ width: '100%', fontSize: 12, padding: '5px 0' }}
        >
          Custom {feePreset === 'custom' ? '▲' : '▾'}
        </button>
        {feePreset === 'custom' && (
          <div style={{ marginTop: 8 }}>
            <input
              type="number"
              min="0.0001"
              step="0.0001"
              placeholder="e.g. 0.0005"
              value={customFeeTxm}
              onChange={(e) => setCustomFee(e.target.value)}
              className="wallet-input"
              style={{ borderColor: customFeeTooLow ? '#ef4444' : undefined }}
            />
            {customFeeTooLow && (
              <span className="wallet-note" style={{ color: '#ef4444' }}>
                Below minimum (0.0001 TXM)
              </span>
            )}
            <span className="wallet-note">min 0.0001 TXM</span>
          </div>
        )}
      </div>
      <div className="wallet-stack">
        <button onClick={review} disabled={!toAddress || !amountTxm || customFeeTooLow} className="wallet-btn wallet-btn--primary">Review</button>
        <button onClick={onBack} className="wallet-btn wallet-btn--secondary">Back</button>
      </div>
    </div>
  );
}
