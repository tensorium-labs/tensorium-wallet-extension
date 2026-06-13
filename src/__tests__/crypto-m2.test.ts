import { describe, it, expect } from 'vitest';
import { sha256 } from '@noble/hashes/sha256';
import * as secp from '@noble/secp256k1';
import {
  signMessage, signAssetTxInputs, keypairFromPrivKeyHex, hexToBytes, bytesToHex,
  type WalletTx,
} from '../lib/crypto';

const PRIV = '11'.repeat(32);

// @noble/secp256k1 v2's `verify` here only accepts compact (64-byte) signatures,
// not DER. Decode DER -> compact (r||s, each left-padded/truncated to 32 bytes)
// for the verify call in these tests, while signMessage itself returns DER hex
// (as required by the relay's sig.js, which uses a DER-capable verifier).
function derToCompact(derHex: string): Uint8Array {
  const der = hexToBytes(derHex);
  let offset = 2; // skip 0x30, total-len
  const readInt = () => {
    offset += 1; // 0x02
    const len = der[offset]; offset += 1;
    let bytes = der.slice(offset, offset + len);
    offset += len;
    if (bytes.length > 32) bytes = bytes.slice(bytes.length - 32);
    if (bytes.length < 32) bytes = new Uint8Array([...new Uint8Array(32 - bytes.length), ...bytes]);
    return bytes;
  };
  const r = readInt();
  const s = readInt();
  return new Uint8Array([...r, ...s]);
}

describe('signMessage', () => {
  it('returns a DER signature over sha256(message) that verifies against the pubkey', async () => {
    const { publicKeyHex } = await keypairFromPrivKeyHex(PRIV);
    const msg = 'list:' + 'aa'.repeat(32) + ':100:5000000';
    const { pubkey, sig } = await signMessage(msg, hexToBytes(PRIV));
    expect(pubkey).toBe(publicKeyHex);
    const h = sha256(new TextEncoder().encode(msg));
    expect(secp.verify(derToCompact(sig), h, pubkey)).toBe(true); // sig is DER hex; decode to compact for verify
  });
  it('produces a signature that fails for a different message', async () => {
    const { sig, pubkey } = await signMessage('real', hexToBytes(PRIV));
    const h = sha256(new TextEncoder().encode('tampered'));
    expect(secp.verify(derToCompact(sig), h, pubkey)).toBe(false);
  });
});

describe('signAssetTxInputs', () => {
  const tx = (): WalletTx => ({
    inputs: [
      { previous_output: { txid_bytes: Array(32).fill(1), output_index: 0 }, signature_script: [] },
      { previous_output: { txid_bytes: Array(32).fill(2), output_index: 1 }, signature_script: [] },
    ],
    outputs: [{ value_atoms: 1000, script_pubkey: [0x76, 0xa9, 0x14, ...Array(20).fill(3), 0x88, 0xac] }],
    payload: [],
  });
  it('stamps ONLY the requested input indices, leaving others empty', async () => {
    const out = await signAssetTxInputs(tx(), hexToBytes(PRIV), [1]);
    expect(out.inputs[0].signature_script.length).toBe(0);   // untouched
    expect(out.inputs[1].signature_script.length).toBeGreaterThan(0); // signed
  });
  it('does not broadcast and does not claim a final txid', async () => {
    const out = await signAssetTxInputs(tx(), hexToBytes(PRIV), [0]);
    expect((out as { id?: unknown }).id).toBeUndefined();
  });
  it('two independent partial signs (buyer then seller) both land on the same tx', async () => {
    const buyerSigned = await signAssetTxInputs(tx(), hexToBytes(PRIV), [1]);
    const both = await signAssetTxInputs(buyerSigned, hexToBytes('22'.repeat(32)), [0]);
    expect(both.inputs[0].signature_script.length).toBeGreaterThan(0);
    expect(both.inputs[1].signature_script.length).toBeGreaterThan(0);
  });
});
