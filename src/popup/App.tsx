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
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 580 }}>
      <span style={{ color: '#64748b' }}>Loading…</span>
    </div>
  );

  const nav = (p: Page) => setPage(p);

  if (page === 'onboarding') return <Onboarding onDone={() => nav('dashboard')} />;
  if (page === 'locked') return <Locked onUnlocked={() => nav('dashboard')} />;
  if (page === 'send') return <Send onBack={() => nav('dashboard')} />;
  if (page === 'history') return <History onBack={() => nav('dashboard')} />;
  if (page === 'settings') return <Settings onBack={() => nav('dashboard')} onLogout={() => nav('locked')} />;
  return <Dashboard onNav={nav} />;
}
