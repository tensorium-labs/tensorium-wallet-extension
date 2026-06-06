import * as secp256k1 from '@noble/secp256k1';
import { sha256 } from '@noble/hashes/sha256';
import { hmac } from '@noble/hashes/hmac';
import { xchacha20poly1305 } from '@noble/ciphers/chacha';
import { randomBytes } from '@noble/ciphers/webcrypto';
import { bech32 } from '@scure/base';
import { argon2id } from 'hash-wasm';

// Configure hmacSha256Sync so secp256k1.sign() (RFC6979) works synchronously
secp256k1.etc.hmacSha256Sync = (k: Uint8Array, ...msgs: Uint8Array[]) =>
  hmac(sha256, k, secp256k1.etc.concatBytes(...msgs));

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EncryptedPrivateKey {
  kdf: string;
  kdf_memory_kib: number;
  kdf_iterations: number;
  kdf_parallelism: number;
  cipher: string;
  salt_hex: string;
  nonce_hex: string;
  ciphertext_hex: string;
}

export interface WalletFile {
  version: number;
  address: string;
  public_key_hex: string;
  encrypted_private_key: EncryptedPrivateKey;
}

export interface WalletInput {
  previous_output: { txid_bytes: number[]; output_index: number };
  signature_script: number[];
}

export interface WalletOutput {
  value_atoms: number;
  script_pubkey: number[];
}

export interface WalletTx {
  id?: number[];
  inputs: WalletInput[];
  outputs: WalletOutput[];
  payload: number[];
}

// ---------------------------------------------------------------------------
// Encoding helpers
// ---------------------------------------------------------------------------

export function hexToBytes(hex: string): Uint8Array {
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < arr.length; i++) {
    arr[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return arr;
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

const OP_DUP = 0x76;
const OP_HASH160 = 0xa9;
const OP_EQUALVERIFY = 0x88;
const OP_CHECKSIG = 0xac;

export function scriptPubKeyFromAddress(address: string): number[] {
  const { prefix, words } = bech32.decode(address);
  if (prefix !== 'txm') {
    throw new Error('Invalid TXM address prefix.');
  }
  const hash20 = bech32.fromWords(words);
  if (hash20.length !== 20) {
    throw new Error('Invalid TXM address payload.');
  }

  return [
    OP_DUP,
    OP_HASH160,
    0x14,
    ...hash20,
    OP_EQUALVERIFY,
    OP_CHECKSIG,
  ];
}

export function extractAddressFromScriptPubKey(scriptPubKey: number[]): string | null {
  if (
    scriptPubKey.length === 25 &&
    scriptPubKey[0] === OP_DUP &&
    scriptPubKey[1] === OP_HASH160 &&
    scriptPubKey[2] === 0x14 &&
    scriptPubKey[23] === OP_EQUALVERIFY &&
    scriptPubKey[24] === OP_CHECKSIG
  ) {
    return bech32.encode('txm', bech32.toWords(Uint8Array.from(scriptPubKey.slice(3, 23))));
  }

  return null;
}

// ---------------------------------------------------------------------------
// Key generation + address derivation
// ---------------------------------------------------------------------------

export async function deriveAddress(privKeyBytes: Uint8Array): Promise<string> {
  const pubKey = secp256k1.getPublicKey(privKeyBytes, true); // compressed 33 bytes
  const digest = sha256(pubKey);
  const payload20 = digest.slice(0, 20);
  const words = bech32.toWords(payload20);
  return bech32.encode('txm', words);
}

export interface Keypair {
  privateKeyHex: string;
  publicKeyHex: string;
  address: string;
}

export async function generateKeypair(): Promise<Keypair> {
  const privKeyBytes = secp256k1.utils.randomPrivateKey();
  const pubKey = secp256k1.getPublicKey(privKeyBytes, true);
  const address = await deriveAddress(privKeyBytes);
  return {
    privateKeyHex: bytesToHex(privKeyBytes),
    publicKeyHex: bytesToHex(pubKey),
    address,
  };
}

export async function keypairFromPrivKeyHex(privateKeyHex: string): Promise<Keypair> {
  const privKeyBytes = hexToBytes(privateKeyHex);
  const pubKey = secp256k1.getPublicKey(privKeyBytes, true);
  const address = await deriveAddress(privKeyBytes);
  return { privateKeyHex, publicKeyHex: bytesToHex(pubKey), address };
}

// ---------------------------------------------------------------------------
// Encryption — Argon2id + XChaCha20Poly1305
// Parameters must match txmwallet CLI exactly.
// ---------------------------------------------------------------------------

const KDF_MEMORY_KIB = 19456;
const KDF_ITERATIONS = 3;
const KDF_PARALLELISM = 1;

export async function encryptPrivateKey(
  privateKeyHex: string,
  password: string
): Promise<EncryptedPrivateKey> {
  const salt = randomBytes(32);
  const nonce = randomBytes(24);
  const keyBytes = await argon2id({
    password,
    salt,
    parallelism: KDF_PARALLELISM,
    iterations: KDF_ITERATIONS,
    memorySize: KDF_MEMORY_KIB,
    hashLength: 32,
    outputType: 'binary',
  });
  const aead = xchacha20poly1305(keyBytes as Uint8Array, nonce);
  const plaintext = new TextEncoder().encode(privateKeyHex);
  const ciphertext = aead.encrypt(plaintext);
  return {
    kdf: 'argon2id',
    kdf_memory_kib: KDF_MEMORY_KIB,
    kdf_iterations: KDF_ITERATIONS,
    kdf_parallelism: KDF_PARALLELISM,
    cipher: 'xchacha20poly1305',
    salt_hex: bytesToHex(salt),
    nonce_hex: bytesToHex(nonce),
    ciphertext_hex: bytesToHex(ciphertext),
  };
}

export async function decryptPrivateKey(
  enc: EncryptedPrivateKey,
  password: string
): Promise<string> {
  const salt = hexToBytes(enc.salt_hex);
  const nonce = hexToBytes(enc.nonce_hex);
  const ciphertext = hexToBytes(enc.ciphertext_hex);
  const keyBytes = await argon2id({
    password,
    salt,
    parallelism: enc.kdf_parallelism,
    iterations: enc.kdf_iterations,
    memorySize: enc.kdf_memory_kib,
    hashLength: 32,
    outputType: 'binary',
  });
  const aead = xchacha20poly1305(keyBytes as Uint8Array, nonce);
  const plaintext = aead.decrypt(ciphertext);
  return new TextDecoder().decode(plaintext);
}

// ---------------------------------------------------------------------------
// Transaction ID — must match block.rs:175 byte-for-byte
// ---------------------------------------------------------------------------

function doubleSha256(data: Uint8Array): Uint8Array {
  return sha256(sha256(data));
}

function concatBytes(arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((n, a) => n + a.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const arr of arrays) { result.set(arr, offset); offset += arr.length; }
  return result;
}

export function computeTxId(
  inputs: WalletInput[],
  outputs: WalletOutput[],
  payload: Uint8Array
): Uint8Array {
  const parts: Uint8Array[] = [];
  for (const input of inputs) {
    parts.push(new Uint8Array(input.previous_output.txid_bytes)); // 32 bytes
    const idxBuf = new Uint8Array(4);
    new DataView(idxBuf.buffer).setUint32(0, input.previous_output.output_index, true); // LE
    parts.push(idxBuf);
    parts.push(new Uint8Array(input.signature_script));
  }
  for (const output of outputs) {
    const valBuf = new Uint8Array(8);
    new DataView(valBuf.buffer).setBigUint64(0, BigInt(output.value_atoms), true); // LE
    parts.push(valBuf);
    parts.push(new Uint8Array(output.script_pubkey));
  }
  parts.push(payload);
  return doubleSha256(concatBytes(parts));
}

// ---------------------------------------------------------------------------
// DER encoding for secp256k1 signatures
// @noble/secp256k1 v2.x only supports compact 64-byte format; encode manually.
// ---------------------------------------------------------------------------

function sigToDER(sig: ReturnType<typeof secp256k1.sign>): Uint8Array {
  const compact = sig.toBytes(); // 64 bytes: r (32) || s (32)
  const r = compact.slice(0, 32);
  const s = compact.slice(32, 64);
  // Prepend 0x00 if high bit set (to signal positive integer)
  const rb = r[0] & 0x80 ? concatBytes([new Uint8Array([0x00]), r]) : r;
  const sb = s[0] & 0x80 ? concatBytes([new Uint8Array([0x00]), s]) : s;
  const inner = concatBytes([
    new Uint8Array([0x02, rb.length]),
    rb,
    new Uint8Array([0x02, sb.length]),
    sb,
  ]);
  return concatBytes([new Uint8Array([0x30, inner.length]), inner]);
}

// ---------------------------------------------------------------------------
// Transaction signing — must match wallet.rs:78
// ---------------------------------------------------------------------------

export async function signTransaction(
  tx: WalletTx,
  privKeyBytes: Uint8Array
): Promise<WalletTx & { id: number[] }> {
  const payload = new Uint8Array(tx.payload);
  const emptyInputs = tx.inputs.map((i) => ({ ...i, signature_script: [] as number[] }));
  const sigHash = computeTxId(emptyInputs, tx.outputs, payload);
  // Match tensorium-core/k256 behavior: ECDSA signs the transaction signature-hash
  // as a message, which is SHA-256 hashed once more inside the signer/verifier API.
  const ecdsaMessage = sha256(sigHash);
  const sig = secp256k1.sign(ecdsaMessage, privKeyBytes);
  const pubKey = secp256k1.getPublicKey(privKeyBytes, true);
  const derSig = sigToDER(sig);
  const scriptBytes = Array.from(concatBytes([
    new Uint8Array([derSig.length]),
    derSig,
    new Uint8Array([pubKey.length]),
    pubKey,
  ]));
  const signedInputs = tx.inputs.map((i) => ({ ...i, signature_script: scriptBytes }));
  const newId = computeTxId(signedInputs, tx.outputs, payload);
  return { ...tx, inputs: signedInputs, id: Array.from(newId) };
}
