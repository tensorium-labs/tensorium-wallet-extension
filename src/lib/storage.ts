import type { WalletFile } from './crypto';

export type Network = 'testnet' | 'mc' | 'custom';

const WALLET_KEY = 'txm_wallet';
const NETWORK_KEY = 'txm_network';

function chromeGet(keys: string[]): Promise<Record<string, unknown>> {
  return new Promise((resolve) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (chrome.storage.local as any).get(keys, (r: Record<string, unknown>) => resolve(r))
  );
}
function chromeSet(items: Record<string, unknown>): Promise<void> {
  return new Promise((resolve) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (chrome.storage.local as any).set(items, () => resolve())
  );
}
function chromeRemove(keys: string[]): Promise<void> {
  return new Promise((resolve) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (chrome.storage.local as any).remove(keys, () => resolve())
  );
}

export async function saveWallet(wallet: WalletFile): Promise<void> {
  await chromeSet({ [WALLET_KEY]: wallet });
}
export async function loadWallet(): Promise<WalletFile | null> {
  const r = await chromeGet([WALLET_KEY]);
  return (r[WALLET_KEY] as WalletFile) ?? null;
}
export async function clearWallet(): Promise<void> {
  await chromeRemove([WALLET_KEY]);
}
export async function saveNetwork(network: Network): Promise<void> {
  await chromeSet({ [NETWORK_KEY]: network });
}
export async function loadNetwork(): Promise<Network> {
  const r = await chromeGet([NETWORK_KEY]);
  return (r[NETWORK_KEY] as Network) ?? 'testnet';
}
export async function saveCustomRpc(url: string): Promise<void> {
  await chromeSet({ txm_custom_rpc: url });
}
export async function loadCustomRpc(): Promise<string> {
  const r = await chromeGet(['txm_custom_rpc']);
  return (r['txm_custom_rpc'] as string) ?? '';
}
