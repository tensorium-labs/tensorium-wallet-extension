import { describe, it, expect } from 'vitest';
import {
  generateKeypair,
  deriveAddress,
  encryptPrivateKey,
  decryptPrivateKey,
  computeTxId,
  signTransaction,
  hexToBytes,
  bytesToHex,
} from '../lib/crypto';
import type { WalletTx } from '../lib/crypto';

describe('hexToBytes / bytesToHex roundtrip', () => {
  it('converts 32-byte hex correctly', () => {
    const hex = 'a'.repeat(64);
    expect(bytesToHex(hexToBytes(hex))).toBe(hex);
  });
});

describe('generateKeypair', () => {
  it('produces a txm1 address and 64-char private key', async () => {
    const kp = await generateKeypair();
    expect(kp.address).toMatch(/^txm1/);
    expect(kp.privateKeyHex).toHaveLength(64);
    expect(kp.publicKeyHex).toHaveLength(66);
  });

  it('same privkey always gives same address', async () => {
    const kp1 = await generateKeypair();
    const addr = await deriveAddress(hexToBytes(kp1.privateKeyHex));
    expect(addr).toBe(kp1.address);
  });
});

describe('encrypt / decrypt', () => {
  it('roundtrips private key through wallet file format', async () => {
    const kp = await generateKeypair();
    const enc = await encryptPrivateKey(kp.privateKeyHex, 'test-passphrase-ok');
    const dec = await decryptPrivateKey(enc, 'test-passphrase-ok');
    expect(dec).toBe(kp.privateKeyHex);
  }, 30000);

  it('throws on wrong password', async () => {
    const kp = await generateKeypair();
    const enc = await encryptPrivateKey(kp.privateKeyHex, 'correct-password');
    await expect(decryptPrivateKey(enc, 'wrong-password')).rejects.toThrow();
  }, 30000);
});

describe('computeTxId', () => {
  it('produces 32-byte result', () => {
    const tx: WalletTx = {
      inputs: [{
        previous_output: { txid_bytes: new Array(32).fill(0), output_index: 0 },
        signature_script: [],
      }],
      outputs: [{ value_atoms: 100, address: 'txm1test' }],
      payload: Array.from(new TextEncoder().encode('payment:v1')),
    };
    const id = computeTxId(tx.inputs, tx.outputs, new Uint8Array(tx.payload));
    expect(id).toHaveLength(32);
  });
});

describe('signTransaction', () => {
  it('produces signed tx with signature_script on all inputs', async () => {
    const kp = await generateKeypair();
    const privBytes = hexToBytes(kp.privateKeyHex);
    const tx: WalletTx = {
      inputs: [
        { previous_output: { txid_bytes: new Array(32).fill(0), output_index: 0 }, signature_script: [] },
        { previous_output: { txid_bytes: new Array(32).fill(1), output_index: 1 }, signature_script: [] },
      ],
      outputs: [{ value_atoms: 50, address: kp.address }],
      payload: Array.from(new TextEncoder().encode('payment:v1')),
    };
    const signed = await signTransaction(tx, privBytes);
    expect(signed.inputs[0].signature_script.length).toBeGreaterThan(0);
    expect(signed.inputs[1].signature_script.length).toBeGreaterThan(0);
    expect(signed.inputs[0].signature_script).toEqual(signed.inputs[1].signature_script);
    expect(signed.id).toHaveLength(32);
  });
});
