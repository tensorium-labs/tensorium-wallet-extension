// Unlocked-key session. Backed by chrome.storage.session (in-memory, cleared
// when the browser closes) so the popup stays unlocked across open/close without
// re-entering the password on every click. Holds one decrypted private key per
// address (multi-account), plus which address is currently active.

interface SessionData {
  keys: Record<string, string>; // address -> privKeyHex
  active: string | null; // active address
}

const SK = 'txm_session';
let _s: SessionData = { keys: {}, active: null };

function persist(): void {
  try {
    (chrome.storage.session as any).set({ [SK]: _s });
  } catch {
    /* storage.session unavailable (e.g. tests) — in-memory only */
  }
}

/** Load the session from chrome.storage.session into the popup. Call once on popup load. */
export async function hydrateSession(): Promise<void> {
  try {
    const r = await (chrome.storage.session as any).get(SK);
    const d = r?.[SK] as SessionData | undefined;
    _s = d && typeof d === 'object' && d.keys ? d : { keys: {}, active: null };
  } catch {
    _s = { keys: {}, active: null };
  }
}

/** Store a decrypted key for `address` and make it the active account. */
export function setSession(privateKeyHex: string, address: string): void {
  _s.keys[address] = privateKeyHex;
  _s.active = address;
  persist();
}

/** Add a decrypted key for `address` without changing the active account. */
export function addSessionKey(privateKeyHex: string, address: string): void {
  _s.keys[address] = privateKeyHex;
  persist();
}

/** Switch the active account (its key must already be in the session). */
export function setActive(address: string): void {
  if (_s.keys[address]) {
    _s.active = address;
    persist();
  }
}

/** The active account's private key, or null if locked. */
export function getSession(): string | null {
  return _s.active ? _s.keys[_s.active] ?? null : null;
}

/** A specific account's key if unlocked, else null. */
export function getKeyFor(address: string): string | null {
  return _s.keys[address] ?? null;
}

export function isUnlocked(): boolean {
  return getSession() !== null;
}

export function clearSession(): void {
  _s = { keys: {}, active: null };
  try {
    (chrome.storage.session as any).remove(SK);
  } catch {
    /* ignore */
  }
}
