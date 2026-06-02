import React, { useEffect, useState } from 'react';
import { loadWallet } from '../lib/storage';
import { isUnlocked } from '../lib/session';
import { Locked } from './pages/Locked';
import { Onboarding } from './pages/Onboarding';
import { Dashboard } from './pages/Dashboard';
import { Send } from './pages/Send';
import { History } from './pages/History';
import { Settings } from './pages/Settings';

export type Page = 'locked' | 'onboarding' | 'dashboard' | 'send' | 'history' | 'settings';

export default function App() {
  const [page, setPage] = useState<Page>('locked');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWallet().then((w) => {
      if (!w) setPage('onboarding');
      else if (isUnlocked()) setPage('dashboard');
      else setPage('locked');
      setLoading(false);
    });
  }, []);

  if (loading) return (
    <div className="app-shell wallet-loading">
      <div className="wallet-surface wallet-loading-card">
        <div className="wallet-loading-spinner"></div>
        <div className="wallet-eyebrow">Tensorium Wallet</div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Preparing secure session</div>
        <div className="wallet-subtle">Loading wallet state and selecting the right flow.</div>
      </div>
    </div>
  );

  const nav = (p: Page) => setPage(p);

  const content = (() => {
    if (page === 'onboarding') return <Onboarding onDone={() => nav('dashboard')} />;
    if (page === 'locked') return <Locked onUnlocked={() => nav('dashboard')} />;
    if (page === 'send') return <Send onBack={() => nav('dashboard')} />;
    if (page === 'history') return <History onBack={() => nav('dashboard')} />;
    if (page === 'settings') return <Settings onBack={() => nav('dashboard')} onLogout={() => nav('locked')} />;
    return <Dashboard onNav={nav} />;
  })();

  return <div className="app-shell">{content}</div>;
}
