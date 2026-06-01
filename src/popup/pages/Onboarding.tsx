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
    <div style={pageStyle}>
      <h2 style={titleStyle}>Welcome to Tensorium Wallet</h2>
      <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 8 }}>Your TXM key, your coins.</p>
      <button onClick={() => setStep('create-password')} style={btnStyle}>Create New Wallet</button>
      <button onClick={() => setStep('import')} style={{ ...btnStyle, background: '#1e293b', marginTop: 8 }}>Import Existing Wallet</button>
    </div>
  );

  if (step === 'create-password') return (
    <div style={pageStyle}>
      <h2 style={titleStyle}>Set Password</h2>
      {error && <ErrorBanner message={error} />}
      <input type="password" placeholder="Password (min 8 chars)" value={password}
        onChange={(e) => setPassword(e.target.value)} style={inputStyle} autoFocus />
      <input type="password" placeholder="Confirm password" value={password2}
        onChange={(e) => setPassword2(e.target.value)} style={inputStyle}
        onKeyDown={(e) => e.key === 'Enter' && !busy && createWallet()} />
      <button onClick={createWallet} disabled={busy} style={btnStyle}>
        {busy ? 'Generating…' : 'Create Wallet'}
      </button>
    </div>
  );

  if (step === 'create-backup') return (
    <div style={pageStyle}>
      <h2 style={titleStyle}>Backup Your Wallet</h2>
      <p style={{ color: '#fca5a5', fontSize: 13 }}>If you lose your private key, your funds are permanently lost. Download your backup now.</p>
      <p style={{ color: '#94a3b8', fontSize: 12 }}>Address: <code style={{ color: '#38bdf8' }}>{createdWallet?.address}</code></p>
      <button onClick={downloadBackup} style={{ ...btnStyle, background: '#0f766e' }}>Download Wallet Backup (.json)</button>
      {backupDone && (
        <button onClick={finishCreate} style={{ ...btnStyle, marginTop: 8 }}>I've Saved My Backup — Continue</button>
      )}
    </div>
  );

  return (
    <div style={pageStyle}>
      <h2 style={titleStyle}>Import Wallet</h2>
      {error && <ErrorBanner message={error} />}
      <textarea placeholder="Paste private key hex (64 chars) or wallet JSON..." value={importInput}
        onChange={(e) => setImportInput(e.target.value)} rows={4}
        style={{ ...inputStyle, resize: 'vertical' as React.CSSProperties['resize'] }} />
      <button onClick={() => fileRef.current?.click()} style={{ ...btnStyle, background: '#1e293b', fontSize: 12 }}>Upload .json file</button>
      <input ref={fileRef} type="file" accept=".json" onChange={loadFile} style={{ display: 'none' }} />
      <input type="password" placeholder="Set new password (min 8 chars)" value={password}
        onChange={(e) => setPassword(e.target.value)} style={inputStyle} />
      <button onClick={importWallet} disabled={busy || !importInput || !password} style={btnStyle}>
        {busy ? 'Importing…' : 'Import Wallet'}
      </button>
      <button onClick={() => setStep('choose')} style={{ ...btnStyle, background: 'none', color: '#64748b', fontSize: 12 }}>Back</button>
    </div>
  );
}

const pageStyle: React.CSSProperties = { padding: 24, display: 'flex', flexDirection: 'column', gap: 10 };
const titleStyle: React.CSSProperties = { color: '#38bdf8', fontSize: 18, marginBottom: 4 };
const inputStyle: React.CSSProperties = {
  background: '#1e293b', border: '1px solid #334155', color: '#e2e8f0',
  borderRadius: 6, padding: '10px 12px', fontSize: 14, outline: 'none', width: '100%',
};
const btnStyle: React.CSSProperties = {
  background: '#0ea5e9', color: '#fff', border: 'none', borderRadius: 6,
  padding: '10px 0', fontSize: 14, cursor: 'pointer', width: '100%',
};
