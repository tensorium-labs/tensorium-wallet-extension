import type { WalletTx } from './crypto';

export class RpcError extends Error {
  constructor(message: string) { super(message); this.name = 'RpcError'; }
}

async function rpcFetch<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(10_000), ...init });
  } catch {
    throw new RpcError('Node unreachable — check network or try again');
  }
  if (!res.ok) throw new RpcError('Node unreachable — check network or try again');
  return res.json() as Promise<T>;
}

export interface HealthResponse { ok: boolean }
export interface BlockCountResponse { blocks: number; chain_id: string; height: number }
export interface UtxoEntry {
  txid: string; txid_bytes: number[]; output_index: number;
  value_atoms: number; coinbase: boolean; created_height: number; mature: boolean;
}
export interface UtxosResponse {
  address: string; tip_height: number; utxo_count: number; utxos: UtxoEntry[];
}
export interface BlockHeader {
  version?: number; chain_id: string; height: number;
  previous_hash?: number[]; merkle_root?: number[];
  timestamp_seconds: number; leading_zero_bits?: number; nonce?: number;
}
export interface TxOutput { value_atoms: number; address: string }
export interface TxInput {
  previous_output: { txid: number[]; output_index: number };
  signature_script: number[];
}
export interface RpcTransaction { id: number[]; inputs: TxInput[]; outputs: TxOutput[]; payload: number[] }
export interface BlockResponse { header: BlockHeader; transactions: RpcTransaction[] }
export interface SendTxResponse { accepted: boolean; txid: number[]; mempool_size: number }

export interface RpcClient {
  health(): Promise<HealthResponse>;
  getBlockCount(): Promise<BlockCountResponse>;
  getBlock(height: number): Promise<BlockResponse>;
  getUtxos(address: string): Promise<UtxosResponse>;
  sendRawTransaction(tx: WalletTx): Promise<SendTxResponse>;
}

export function createRpcClient(baseUrl: string): RpcClient {
  const base = baseUrl.replace(/\/$/, '');
  return {
    health: () => rpcFetch(`${base}/health`),
    getBlockCount: () => rpcFetch(`${base}/getblockcount`),
    getBlock: (h) => rpcFetch(`${base}/getblock/${h}`),
    getUtxos: (addr) => rpcFetch(`${base}/getutxos/${encodeURIComponent(addr)}`),
    sendRawTransaction: (tx) => rpcFetch(`${base}/sendrawtransaction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tx),
    }),
  };
}

export const RPC_URLS: Record<string, string> = {
  testnet: 'https://rpc.tensoriumlabs.com',
  mc: 'https://mc-rpc.tensoriumlabs.com',
};
