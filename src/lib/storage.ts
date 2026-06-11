import type { WalletFile } from './crypto';

export type Network = 'mainnet' | 'custom';

const WALLET_KEY = 'txm_wallet'; // legacy single-wallet key (migrated)
const WALLETS_KEY = 'txm_wallets'; // WalletFile[]
const SELECTED_KEY = 'txm_selected'; // selected account index
const NETWORK_KEY = 'txm_network';
const CUSTOM_RPC_KEY = 'txm_custom_rpc';
const MAINNET_V1_RESET_KEY = 'txm_mainnet_v1_reset_done';

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

// ── Multi-account storage ────────────────────────────────────────────────────
// Wallets live in `txm_wallets` (an array); `txm_selected` is the active index.
// A legacy single `txm_wallet` is migrated into the array on first read.

export async function loadWallets(): Promise<WalletFile[]> {
  const r = await chromeGet([WALLETS_KEY, WALLET_KEY]);
  let list = r[WALLETS_KEY] as WalletFile[] | undefined;
  if (!Array.isArray(list)) {
    const legacy = r[WALLET_KEY] as WalletFile | undefined;
    list = legacy ? [legacy] : [];
    if (legacy) await chromeSet({ [WALLETS_KEY]: list });
  }
  return list;
}
export async function saveWallets(list: WalletFile[]): Promise<void> {
  await chromeSet({ [WALLETS_KEY]: list });
}
export async function loadSelectedIndex(): Promise<number> {
  const r = await chromeGet([SELECTED_KEY]);
  const i = r[SELECTED_KEY];
  return typeof i === 'number' ? i : 0;
}
export async function saveSelectedIndex(i: number): Promise<void> {
  await chromeSet({ [SELECTED_KEY]: i });
}
/** Append a wallet; returns its new index. */
export async function addWallet(wallet: WalletFile): Promise<number> {
  const list = await loadWallets();
  // De-dupe by address: if it already exists, just select it.
  const existing = list.findIndex((w) => w.address === wallet.address);
  if (existing >= 0) return existing;
  list.push(wallet);
  await saveWallets(list);
  return list.length - 1;
}
/** Remove the wallet at `index`; clamps the selected index. */
export async function removeWalletAt(index: number): Promise<void> {
  const list = await loadWallets();
  if (index < 0 || index >= list.length) return;
  list.splice(index, 1);
  await saveWallets(list);
  const sel = await loadSelectedIndex();
  if (sel >= list.length) await saveSelectedIndex(Math.max(0, list.length - 1));
}

/** Save the first wallet (used by onboarding); resets to a single-account list. */
export async function saveWallet(wallet: WalletFile): Promise<void> {
  await chromeSet({ [WALLETS_KEY]: [wallet], [SELECTED_KEY]: 0 });
}
/** The active (selected) wallet, or null. Back-compat for existing pages. */
export async function loadWallet(): Promise<WalletFile | null> {
  const list = await loadWallets();
  if (list.length === 0) return null;
  const i = await loadSelectedIndex();
  return list[i] ?? list[0];
}
export async function clearWallet(): Promise<void> {
  await chromeRemove([WALLET_KEY, WALLETS_KEY, SELECTED_KEY]);
}
/**
 * One-time relaunch reset for TensorHash v1 / `tensorium-mainnet`.
 * Old local wallets and custom RPC selections must not silently carry over
 * into the fresh-chain extension experience.
 *
 * Returns true when a reset was applied during this call.
 */
export async function ensureMainnetV1Reset(): Promise<boolean> {
  const r = await chromeGet([MAINNET_V1_RESET_KEY]);
  if (r[MAINNET_V1_RESET_KEY] === true) return false;

  await chromeRemove([WALLET_KEY, WALLETS_KEY, SELECTED_KEY, CUSTOM_RPC_KEY]);
  await chromeSet({
    [NETWORK_KEY]: 'mainnet',
    [MAINNET_V1_RESET_KEY]: true,
  });
  return true;
}
export async function saveNetwork(network: Network): Promise<void> {
  await chromeSet({ [NETWORK_KEY]: network });
}
export async function loadNetwork(): Promise<Network> {
  const r = await chromeGet([NETWORK_KEY]);
  return (r[NETWORK_KEY] as Network) ?? 'mainnet';
}
export async function saveCustomRpc(url: string): Promise<void> {
  await chromeSet({ [CUSTOM_RPC_KEY]: url });
}
export async function loadCustomRpc(): Promise<string> {
  const r = await chromeGet([CUSTOM_RPC_KEY]);
  return (r[CUSTOM_RPC_KEY] as string) ?? '';
}

export async function loadSelectedRpcUrl(): Promise<string> {
  const network = await loadNetwork();
  if (network === 'mainnet') return 'https://rpc.tensoriumlabs.com';

  const customRpc = (await loadCustomRpc()).trim().replace(/\/$/, '');
  if (!customRpc) throw new Error('Custom RPC is empty. Open Settings and save a valid RPC URL.');
  return customRpc;
}
