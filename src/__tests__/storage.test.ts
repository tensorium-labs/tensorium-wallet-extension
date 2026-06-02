import { describe, it, expect, vi, beforeEach } from 'vitest';

const store: Record<string, unknown> = {};
vi.stubGlobal('chrome', {
  storage: {
    local: {
      get: vi.fn((keys: string | string[], cb: (r: Record<string, unknown>) => void) => {
        const result: Record<string, unknown> = {};
        const arr = Array.isArray(keys) ? keys : [keys];
        for (const k of arr) if (k in store) result[k] = store[k];
        cb(result);
      }),
      set: vi.fn((items: Record<string, unknown>, cb?: () => void) => {
        Object.assign(store, items); cb?.();
      }),
      remove: vi.fn((keys: string | string[], cb?: () => void) => {
        const arr = Array.isArray(keys) ? keys : [keys];
        for (const k of arr) delete store[k]; cb?.();
      }),
    },
  },
});

import { saveWallet, loadWallet, clearWallet, saveNetwork, loadNetwork } from '../lib/storage';
import { clearSession, setSession, getSession } from '../lib/session';

beforeEach(() => { for (const k of Object.keys(store)) delete store[k]; });

const fakeWallet = {
  version: 1, address: 'txm1test', public_key_hex: '02' + 'ab'.repeat(32),
  encrypted_private_key: {
    kdf: 'argon2id', kdf_memory_kib: 19456, kdf_iterations: 3, kdf_parallelism: 1,
    cipher: 'xchacha20poly1305',
    salt_hex: 'aa'.repeat(32), nonce_hex: 'bb'.repeat(24), ciphertext_hex: 'cc'.repeat(48),
  },
};

describe('storage', () => {
  it('saves and loads wallet', async () => {
    await saveWallet(fakeWallet);
    expect(await loadWallet()).toEqual(fakeWallet);
  });
  it('returns null when no wallet saved', async () => {
    expect(await loadWallet()).toBeNull();
  });
  it('clears wallet', async () => {
    await saveWallet(fakeWallet);
    await clearWallet();
    expect(await loadWallet()).toBeNull();
  });
  it('saves and loads network', async () => {
    await saveNetwork('mainnet');
    expect(await loadNetwork()).toBe('mainnet');
  });
  it('defaults network to mainnet', async () => {
    expect(await loadNetwork()).toBe('mainnet');
  });
});

describe('session', () => {
  it('stores and retrieves private key', () => {
    setSession('deadbeef'.repeat(8));
    expect(getSession()).toBe('deadbeef'.repeat(8));
  });
  it('clearSession removes key', () => {
    setSession('abc');
    clearSession();
    expect(getSession()).toBeNull();
  });
});
