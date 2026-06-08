import React, { useEffect, useState } from 'react';
import {
  loadWallets, loadSelectedIndex, saveSelectedIndex, addWallet, removeWalletAt,
} from '../../lib/storage';
import {
  generateKeypair, keypairFromPrivKeyHex, encryptPrivateKey, decryptPrivateKey,
  type WalletFile,
} from '../../lib/crypto';
import { setActive, addSessionKey, clearSession, getKeyFor } from '../../lib/session';
import { BrandMark } from '../components/BrandMark';
import { ErrorBanner } from '../components/ErrorBanner';

interface Props { onBack: () => void; onLock: () => void }
type Mode = 'list' | 'add';

export function Accounts({ onBack, onLock }: Props) {
  const [wallets, setWallets] = useState<WalletFile[]>([]);
  const [selected, setSelected] = useState(0);
  const [mode, setMode] = useState<Mode>('list');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [addType, setAddType] = useState<'create' | 'import'>('create');
  const [pw, setPw] = useState('');
  const [importInput, setImportInput] = useState('');
  // Cold wallets (founder/ecosystem/etc.) are often encrypted with their OWN
  // original passphrase, not your extension's master password. This optional
  // field decrypts the imported file; `pw` stays the master password used to
  // verify the existing account and re-encrypt the key for storage.
  const [sourcePw, setSourcePw] = useState('');

  const reload = async () => {
    setWallets(await loadWallets());
    setSelected(await loadSelectedIndex());
  };
  useEffect(() => { reload(); }, []);

  const short = (a: string) => (a.length > 22 ? `${a.slice(0, 12)}…${a.slice(-6)}` : a);

  const select = async (i: number) => {
    setError('');
    const w = wallets[i];
    await saveSelectedIndex(i);
    if (getKeyFor(w.address)) setActive(w.address);
    setSelected(i);
    onBack();
  };

  const addAccount = async () => {
    setError(''); setBusy(true);
    try {
      if (pw.length < 8) throw new Error('Enter your wallet password (min 8 characters).');
      // Keep one password for all accounts — verify against an existing wallet.
      if (wallets.length) {
        try { await decryptPrivateKey(wallets[0].encrypted_private_key, pw); }
        catch { throw new Error('Password does not match your existing wallet.'); }
      }
      let privKeyHex: string;
      if (addType === 'create') {
        privKeyHex = (await generateKeypair()).privateKeyHex;
      } else {
        const t = importInput.trim();
        if (t.length === 64 && /^[0-9a-fA-F]+$/.test(t)) privKeyHex = t.toLowerCase();
        else {
          const parsed: WalletFile = JSON.parse(t);
          // Try the master password first (covers files created in this same
          // extension), then fall back to the file's own original password.
          const candidates = sourcePw.trim() ? [sourcePw.trim(), pw] : [pw];
          let decrypted: string | null = null;
          for (const candidate of candidates) {
            try { decrypted = await decryptPrivateKey(parsed.encrypted_private_key, candidate); break; }
            catch { /* try next candidate */ }
          }
          if (decrypted === null) {
            throw new Error(
              sourcePw.trim()
                ? 'Incorrect password for this wallet file.'
                : "This file was encrypted with a different password than your wallet — enter the file's original password below."
            );
          }
          privKeyHex = decrypted;
        }
      }
      const kp = await keypairFromPrivKeyHex(privKeyHex);
      const enc = await encryptPrivateKey(privKeyHex, pw);
      const wallet: WalletFile = {
        version: 1, address: kp.address, public_key_hex: kp.publicKeyHex, encrypted_private_key: enc,
      };
      const idx = await addWallet(wallet);
      addSessionKey(privKeyHex, kp.address);
      await saveSelectedIndex(idx);
      setActive(kp.address);
      setPw(''); setImportInput(''); setSourcePw(''); setMode('list');
      await reload();
    } catch (e) {
      setError(
        e instanceof SyntaxError ? 'Invalid wallet JSON.' :
        e instanceof Error ? e.message : 'Could not add account.'
      );
    } finally { setBusy(false); }
  };

  const remove = async (i: number) => {
    setError('');
    if (wallets.length <= 1) { setError('Cannot remove your only account.'); return; }
    // eslint-disable-next-line no-alert
    if (!confirm('Remove this account from this browser? Make sure you have its backup or private key — this cannot be undone here.')) return;
    await removeWalletAt(i);
    await reload();
  };

  if (mode === 'add') return (
    <div className="wallet-page">
      <div className="wallet-topbar">
        <div className="wallet-brand"><BrandMark /><div className="wallet-brand-copy"><div className="wallet-eyebrow">Accounts</div><h2>Add account</h2></div></div>
      </div>
      {error && <ErrorBanner message={error} />}
      <div className="wallet-surface" style={{ padding: 18 }}>
        <div className="wallet-row" style={{ gap: 8, marginBottom: 12 }}>
          <button onClick={() => setAddType('create')} className={`wallet-btn ${addType === 'create' ? 'wallet-btn--primary' : 'wallet-btn--secondary'}`}>Create new</button>
          <button onClick={() => setAddType('import')} className={`wallet-btn ${addType === 'import' ? 'wallet-btn--primary' : 'wallet-btn--secondary'}`}>Import</button>
        </div>
        <div className="wallet-stack">
          {addType === 'import' && (
            <textarea placeholder="Private key hex (64 chars) or wallet JSON…" value={importInput}
              onChange={(e) => setImportInput(e.target.value)} rows={4} className="wallet-textarea" />
          )}
          <input type="password" placeholder="Your wallet password" value={pw}
            onChange={(e) => setPw(e.target.value)} className="wallet-input" autoFocus />
          <p className="wallet-subtle" style={{ fontSize: 12, margin: 0 }}>
            New accounts use your existing wallet password, so one unlock covers all of them.
          </p>
          {addType === 'import' && (
            <>
              <input type="password" placeholder="File's original password (only if different from above)"
                value={sourcePw} onChange={(e) => setSourcePw(e.target.value)} className="wallet-input" />
              <p className="wallet-subtle" style={{ fontSize: 12, margin: 0 }}>
                Cold wallets (founder, ecosystem, etc.) are often encrypted with their own
                original passphrase. Leave this blank if the file uses the same password as
                above — fill it in only if importing fails.
              </p>
            </>
          )}
          <button onClick={addAccount} disabled={busy || !pw || (addType === 'import' && !importInput)} className="wallet-btn wallet-btn--primary">
            {busy ? 'Working…' : addType === 'create' ? 'Create account' : 'Import account'}
          </button>
          <button onClick={() => { setMode('list'); setError(''); setSourcePw(''); }} className="wallet-btn wallet-btn--ghost">Cancel</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="wallet-page">
      <div className="wallet-topbar">
        <div className="wallet-brand"><BrandMark /><div className="wallet-brand-copy"><div className="wallet-eyebrow">Wallet</div><h2>Accounts</h2></div></div>
      </div>
      {error && <ErrorBanner message={error} />}
      <div className="wallet-surface" style={{ padding: 14 }}>
        <div className="wallet-stack">
          {wallets.map((w, i) => (
            <div key={w.address} className="wallet-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderColor: i === selected ? 'rgba(224,92,11,.4)' : undefined }}>
              <button onClick={() => select(i)} style={{ background: 'none', border: 0, textAlign: 'left', cursor: 'pointer', flex: 1 }}>
                <div className="wallet-section-label">Account {i + 1}{i === selected ? ' · active' : ''}</div>
                <div className="wallet-code" style={{ fontSize: 12 }}>{short(w.address)}</div>
              </button>
              {wallets.length > 1 && (
                <button onClick={() => remove(i)} className="wallet-btn wallet-btn--ghost" style={{ padding: '6px 10px' }}>Remove</button>
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="wallet-pill-nav">
        <button onClick={() => { setMode('add'); setError(''); }} className="wallet-btn wallet-btn--primary">+ Add account</button>
        <button onClick={onBack} className="wallet-btn wallet-btn--secondary">Back</button>
        <button onClick={() => { clearSession(); onLock(); }} className="wallet-btn wallet-btn--ghost">Lock</button>
      </div>
    </div>
  );
}
