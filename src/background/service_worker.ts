import { loadWallet } from '../lib/storage';

// NOTE: the unlocked session lives in chrome.storage.session (see lib/session.ts)
// so it deliberately survives service-worker suspensions and popup close/open —
// the user is not re-prompted for the password on every click. It clears when the
// browser fully closes (chrome.storage.session semantics).

// ─── Dapp request handler ─────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== 'dapp') return false;
  handleDapp(msg as { method: string; params: Record<string, unknown> })
    .then((result) => sendResponse({ result }))
    .catch((err: Error) => sendResponse({ error: err.message }));
  return true; // async — keeps channel open
});

async function handleDapp(msg: { method: string; params: Record<string, unknown> }) {
  const { method, params } = msg;

  if (method === 'getAddress') {
    const wallet = await loadWallet();
    return wallet?.address ?? null;
  }

  if (method === 'requestAccounts') {
    const wallet = await loadWallet();
    return wallet ? [wallet.address] : [];
  }

  if (method === 'sendTransaction') {
    const to = params['to'] as string;
    const amount_atoms = Number(params['amount_atoms']);
    return await pendSendTransaction(to, amount_atoms);
  }

  if (method === 'signAssetTx') {
    const unsignedTx = params['unsignedTx'];
    const summary = params['summary'];
    return await pendSignAssetTx(unsignedTx, summary);
  }

  if (method === 'getAssets') {
    const address = params['address'] as string;
    return await fetchAssets(address);
  }

  throw new Error(`Unknown dapp method: ${method}`);
}

async function openApprovalPopup() {
  const actionApi = chrome.action as typeof chrome.action & {
    openPopup?: () => Promise<void>;
  };
  if (!actionApi.openPopup) return;
  try {
    await actionApi.openPopup();
  } catch {
    // Some Chromium builds reject openPopup from the service worker.
    // The request is still queued in session storage and visible via badge.
  }
}

async function pendSendTransaction(to: string, amount_atoms: number): Promise<string> {
  const reqId = Date.now().toString();
  await (chrome.storage.session as any).set({
    txm_bridge_req: { reqId, to, amount_atoms, status: 'pending' }
  });
  await chrome.action.setBadgeText({ text: '1' });
  await chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
  await openApprovalPopup();

  const deadline = Date.now() + 10 * 60 * 1000;
  while (Date.now() < deadline) {
    await sleep(600);
    const data = await (chrome.storage.session as any).get('txm_bridge_req');
    const req = data['txm_bridge_req'] as BridgeReq | undefined;
    if (!req || req.reqId !== reqId || req.status === 'pending') continue;
    if (req.status === 'confirmed') return req.txid as string;
    throw new Error(req.error ?? 'Transaction rejected');
  }

  await (chrome.storage.session as any).remove('txm_bridge_req');
  await chrome.action.setBadgeText({ text: '' });
  throw new Error('Confirmation timed out — please try again');
}

interface BridgeReq {
  reqId: string;
  to: string;
  amount_atoms: number;
  status: 'pending' | 'confirmed' | 'rejected';
  txid?: string;
  error?: string;
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

async function pendSignAssetTx(unsignedTx: unknown, summary: unknown): Promise<string> {
  const reqId = Date.now().toString();
  await (chrome.storage.session as any).set({
    txm_asset_req: { reqId, unsignedTx, summary, status: 'pending' }
  });
  await chrome.action.setBadgeText({ text: '1' });
  await chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
  await openApprovalPopup();

  const deadline = Date.now() + 10 * 60 * 1000;
  while (Date.now() < deadline) {
    await sleep(600);
    const data = await (chrome.storage.session as any).get('txm_asset_req');
    const req = data['txm_asset_req'] as AssetReq | undefined;
    if (!req || req.reqId !== reqId || req.status === 'pending') continue;
    if (req.status === 'confirmed') return req.txid as string;
    throw new Error(req.error ?? 'Transaction rejected');
  }

  await (chrome.storage.session as any).remove('txm_asset_req');
  await chrome.action.setBadgeText({ text: '' });
  throw new Error('Confirmation timed out — please try again');
}

interface AssetReq {
  reqId: string;
  unsignedTx: unknown;
  summary: unknown;
  status: 'pending' | 'confirmed' | 'rejected';
  txid?: string;
  error?: string;
}

async function fetchAssets(address: string): Promise<{ fungible: unknown[]; nfts: unknown[] }> {
  const indexerBase = 'https://marketplace.tensoriumlabs.com/api';
  const resp = await fetch(`${indexerBase}/balance/${address}`);
  if (!resp.ok) throw new Error(`indexer error: ${resp.status}`);
  const data = await resp.json();
  return { fungible: data.fungible ?? [], nfts: data.nfts ?? [] };
}
