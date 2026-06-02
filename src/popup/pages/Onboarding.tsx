import React, { useState, useRef } from 'react';
import {
  generateKeypair, keypairFromPrivKeyHex, encryptPrivateKey, decryptPrivateKey,
  type WalletFile,
} from '../../lib/crypto';
import { saveWallet } from '../../lib/storage';
import { setSession } from '../../lib/session';
import { ErrorBanner } from '../components/ErrorBanner';

interface Props { onDone: () => void }
type Step = 'choose' | 'create-password' | 'create-backup' | 'import';

export function Onboarding({ onDone }: Props) {
  const [step, setStep] = useState<Step>('choose');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [importInput, setImportInput] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [createdWallet, setCreatedWallet] = useState<WalletFile | null>(null);
  const [backupDone, setBackupDone] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const createWallet = async () => {
    setError('');
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== password2) { setError('Passwords do not match.'); return; }
    setBusy(true);
    try {
      const kp = await generateKeypair();
      const enc = await encryptPrivateKey(kp.privateKeyHex, password);
      const wallet: WalletFile = { version: 1, address: kp.address, public_key_hex: kp.publicKeyHex, encrypted_private_key: enc };
      setCreatedWallet(wallet);
      setStep('create-backup');
    } catch (e) { setError(String(e)); } finally { setBusy(false); }
  };

  const downloadBackup = () => {
    if (!createdWallet) return;
    const blob = new Blob([JSON.stringify(createdWallet, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'tensorium-wallet.json'; a.click();
    URL.revokeObjectURL(url);
    setBackupDone(true);
  };

  const finishCreate = async () => {
    if (!createdWallet || !backupDone) return;
    const privKey = await decryptPrivateKey(createdWallet.encrypted_private_key, password);
    await saveWallet(createdWallet);
    setSession(privKey);
    onDone();
  };

  const importWallet = async () => {
    setError(''); setBusy(true);
    try {
      const trimmed = importInput.trim();
      let privKeyHex: string;
      let existingWallet: WalletFile | null = null;

      if (trimmed.length === 64 && /^[0-9a-fA-F]+$/.test(trimmed)) {
        privKeyHex = trimmed.toLowerCase();
      } else {
        const parsed: WalletFile = JSON.parse(trimmed);
        existingWallet = parsed;
        privKeyHex = await decryptPrivateKey(parsed.encrypted_private_key, password);
      }

      const kp = await keypairFromPrivKeyHex(privKeyHex);
      const enc = await encryptPrivateKey(privKeyHex, password);
      const wallet: WalletFile = existingWallet
        ? { ...existingWallet, encrypted_private_key: enc }
        : { version: 1, address: kp.address, public_key_hex: kp.publicKeyHex, encrypted_private_key: enc };

      await saveWallet(wallet);
      setSession(privKeyHex);
      onDone();
    } catch (e) {
      setError(e instanceof SyntaxError ? 'Invalid wallet file format.' :
        String(e).includes('Incorrect') ? 'Incorrect password for this wallet file.' :
        'Invalid private key or wallet file.');
    } finally { setBusy(false); }
  };

  const loadFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setImportInput(ev.target?.result as string);
    reader.readAsText(file);
  };

  if (step === 'choose') return (
    <div className="wallet-page wallet-page--centered">
      <div className="wallet-surface" style={{ padding: 22 }}>
        <div className="wallet-brand" style={{ marginBottom: 12 }}>
          <div className="wallet-brand-mark">T</div>
          <div className="wallet-brand-copy">
            <div className="wallet-eyebrow">Welcome</div>
            <h2>Tensorium Wallet</h2>
          </div>
        </div>
        <p className="wallet-subtle" style={{ marginBottom: 16 }}>
          Create a fresh wallet or import an existing TXM key. You stay in control of the private key at all times.
        </p>
        <div className="wallet-kpi-grid" style={{ marginBottom: 16 }}>
          <div className="wallet-stat">
            <div className="wallet-stat__label">Mode</div>
            <div className="wallet-stat__value">Self-custody</div>
          </div>
          <div className="wallet-stat">
            <div className="wallet-stat__label">Storage</div>
            <div className="wallet-stat__value">Encrypted local</div>
          </div>
        </div>
        <div className="wallet-stack">
          <button onClick={() => setStep('create-password')} className="wallet-btn wallet-btn--primary">Create New Wallet</button>
          <button onClick={() => setStep('import')} className="wallet-btn wallet-btn--secondary">Import Existing Wallet</button>
        </div>
      </div>
    </div>
  );

  if (step === 'create-password') return (
    <div className="wallet-page wallet-page--centered">
      <div className="wallet-surface" style={{ padding: 22 }}>
      <h2 style={{ margin: 0, fontSize: 20 }}>Set Wallet Password</h2>
      <p className="wallet-subtle" style={{ marginTop: 6, marginBottom: 10 }}>
        This password encrypts your local wallet backup and is required to unlock the extension.
      </p>
      {error && <ErrorBanner message={error} />}
      <div className="wallet-stack">
        <input type="password" placeholder="Password (min 8 chars)" value={password}
          onChange={(e) => setPassword(e.target.value)} className="wallet-input" autoFocus />
        <input type="password" placeholder="Confirm password" value={password2}
          onChange={(e) => setPassword2(e.target.value)} className="wallet-input"
          onKeyDown={(e) => e.key === 'Enter' && !busy && createWallet()} />
        <button onClick={createWallet} disabled={busy} className="wallet-btn wallet-btn--primary">
          {busy ? 'Generating…' : 'Create Wallet'}
        </button>
      </div>
      </div>
    </div>
  );

  if (step === 'create-backup') return (
    <div className="wallet-page wallet-page--centered">
      <div className="wallet-surface" style={{ padding: 22 }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>Backup Your Wallet</h2>
        <p className="wallet-subtle" style={{ marginTop: 6 }}>
          Download the encrypted wallet file now. Losing both the password and backup means permanent loss of access.
        </p>
        <div className="wallet-card" style={{ marginTop: 14, marginBottom: 14 }}>
          <div className="wallet-section-label">New Address</div>
          <div className="wallet-address wallet-code">{createdWallet?.address}</div>
        </div>
        <div className="wallet-stack">
          <button onClick={downloadBackup} className="wallet-btn wallet-btn--secondary">Download Wallet Backup (.json)</button>
          {backupDone && (
            <button onClick={finishCreate} className="wallet-btn wallet-btn--primary">I've Saved My Backup — Continue</button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="wallet-page wallet-page--centered">
      <div className="wallet-surface" style={{ padding: 22 }}>
      <h2 style={{ margin: 0, fontSize: 20 }}>Import Wallet</h2>
      <p className="wallet-subtle" style={{ marginTop: 6, marginBottom: 10 }}>
        Paste a 64-character private key or wallet JSON backup, then set a new local password for this browser.
      </p>
      {error && <ErrorBanner message={error} />}
      <div className="wallet-stack">
        <textarea placeholder="Paste private key hex (64 chars) or wallet JSON..." value={importInput}
          onChange={(e) => setImportInput(e.target.value)} rows={4}
          className="wallet-textarea" />
        <button onClick={() => fileRef.current?.click()} className="wallet-btn wallet-btn--secondary">Upload .json file</button>
        <input ref={fileRef} type="file" accept=".json" onChange={loadFile} style={{ display: 'none' }} />
        <input type="password" placeholder="Set new password (min 8 chars)" value={password}
          onChange={(e) => setPassword(e.target.value)} className="wallet-input" />
        <button onClick={importWallet} disabled={busy || !importInput || !password} className="wallet-btn wallet-btn--primary">
          {busy ? 'Importing…' : 'Import Wallet'}
        </button>
        <button onClick={() => setStep('choose')} className="wallet-btn wallet-btn--ghost">Back</button>
      </div>
      </div>
    </div>
  );
}
