import React, { useEffect, useState } from 'react';
import { ensureMainnetV1Reset, loadWallet } from '../lib/storage';
import { clearSession, isUnlocked, hydrateSession } from '../lib/session';
import { Locked } from './pages/Locked';
import { Onboarding } from './pages/Onboarding';
import { Dashboard } from './pages/Dashboard';
import { Send } from './pages/Send';
import { History } from './pages/History';
import { Settings } from './pages/Settings';
import { Vesting } from './pages/Vesting';
import { Accounts } from './pages/Accounts';
import { BridgeConfirm, type BridgeReq } from './pages/BridgeConfirm';
import { SignAssetTx, type AssetReq } from './pages/SignAssetTx';

export type Page = 'locked' | 'onboarding' | 'dashboard' | 'send' | 'history' | 'settings' | 'bridge' | 'vesting' | 'accounts' | 'asset-tx';

export default function App() {
  const [page, setPage] = useState<Page>('locked');
  const [loading, setLoading] = useState(true);
  const [bridgeReq, setBridgeReq] = useState<BridgeReq | null>(null);
  const [assetReq, setAssetReq] = useState<AssetReq | null>(null);

  useEffect(() => {
    ensureMainnetV1Reset()
      .then((didReset) => {
        if (didReset) clearSession();
        return hydrateSession();
      })
      .then(() => loadWallet())
      .then(async (w) => {
      if (!w) { setPage('onboarding'); setLoading(false); return; }
      if (!isUnlocked()) { setPage('locked'); setLoading(false); return; }
      // Check for a pending bridge request from the dapp provider
      const data = await (chrome.storage.session as any).get(['txm_bridge_req', 'txm_asset_req']);
      const req = data['txm_bridge_req'] as BridgeReq | undefined;
      const aReq = data['txm_asset_req'] as AssetReq | undefined;
      if (req?.status === 'pending') {
        setBridgeReq(req);
        setPage('bridge');
      } else if (aReq?.status === 'pending') {
        setAssetReq(aReq);
        setPage('asset-tx');
      } else {
        setPage('dashboard');
      }
      setLoading(false);
    });
  }, []);

  if (loading) return (
    <div className="app-shell wallet-loading">
      <div className="wallet-surface wallet-loading-card">
        <div className="wallet-orbit"></div>
        <div className="wallet-loading-spinner"></div>
        <div className="wallet-eyebrow">TensorHash v1</div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Preparing mainnet vault</div>
        <div className="wallet-subtle">Loading wallet state, active account, and the right secure flow for TXM mainnet v1.</div>
      </div>
    </div>
  );

  const nav = (p: Page) => setPage(p);

  const content = (() => {
    if (page === 'onboarding') return <Onboarding onDone={() => nav('dashboard')} />;
    if (page === 'locked') return <Locked onUnlocked={async () => {
      // After unlock, check for pending bridge or asset-tx request
      const data = await (chrome.storage.session as any).get(['txm_bridge_req', 'txm_asset_req']);
      const req = data['txm_bridge_req'] as BridgeReq | undefined;
      const aReq = data['txm_asset_req'] as AssetReq | undefined;
      if (req?.status === 'pending') { setBridgeReq(req); nav('bridge'); }
      else if (aReq?.status === 'pending') { setAssetReq(aReq); nav('asset-tx'); }
      else nav('dashboard');
    }} />;
    if (page === 'bridge' && bridgeReq) return <BridgeConfirm req={bridgeReq} onDone={() => nav('dashboard')} />;
    if (page === 'asset-tx' && assetReq) return <SignAssetTx req={assetReq} onDone={() => nav('dashboard')} />;
    if (page === 'send') return <Send onBack={() => nav('dashboard')} />;
    if (page === 'history') return <History onBack={() => nav('dashboard')} />;
    if (page === 'settings') return <Settings onBack={() => nav('dashboard')} onLogout={() => nav('locked')} />;
    if (page === 'vesting') return <Vesting onBack={() => nav('dashboard')} />;
    if (page === 'accounts') return <Accounts onBack={() => nav('dashboard')} onLock={() => nav('locked')} />;
    return <Dashboard onNav={nav} />;
  })();

  return <div className="app-shell">{content}</div>;
}
