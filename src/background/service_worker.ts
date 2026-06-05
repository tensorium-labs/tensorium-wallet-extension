import { clearSession } from '../lib/session';

chrome.runtime.onSuspend.addListener(() => { clearSession(); });

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
    const data = await chrome.storage.local.get('txm_wallet');
    const wallet = data['txm_wallet'] as { address: string } | undefined;
    return wallet?.address ?? null;
  }

  if (method === 'requestAccounts') {
    const data = await chrome.storage.local.get('txm_wallet');
    const wallet = data['txm_wallet'] as { address: string } | undefined;
    return wallet ? [wallet.address] : [];
  }

  if (method === 'sendTransaction') {
    const to = params['to'] as string;
    const amount_atoms = Number(params['amount_atoms']);
    return await pendSendTransaction(to, amount_atoms);
  }

  throw new Error(`Unknown dapp method: ${method}`);
}

async function pendSendTransaction(to: string, amount_atoms: number): Promise<string> {
  const reqId = Date.now().toString();
  await (chrome.storage.session as any).set({
    txm_bridge_req: { reqId, to, amount_atoms, status: 'pending' }
  });
  await chrome.action.setBadgeText({ text: '1' });
  await chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });

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
