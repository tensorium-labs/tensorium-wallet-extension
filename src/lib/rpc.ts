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

  const text = await res.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const message =
      typeof data === 'string' && data.trim()
        ? data.trim()
        : typeof data === 'object' && data !== null && 'error' in data && typeof data.error === 'string'
          ? data.error
          : `RPC request failed (${res.status})`;
    throw new RpcError(message);
  }

  return data as T;
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
export interface TxOutput { value_atoms: number; script_pubkey: number[] }
export interface TxInput {
  previous_output: { txid: number[]; output_index: number };
  signature_script: number[];
}
export interface RpcTransaction { id: number[]; inputs: TxInput[]; outputs: TxOutput[]; payload: number[] }
export interface BlockResponse { header: BlockHeader; transactions: RpcTransaction[] }
export interface SendTxResponse { accepted: boolean; txid: number[]; mempool_size: number }
export interface MempoolInfoResponse {
  count: number;
  fees: {
    max_fee_atoms: number;
    median_fee_atoms: number;
    min_fee_atoms: number;
    min_relay_fee_atoms: number;
    priority_fee_atoms: number;
    total_fee_atoms: number;
  };
  txids: string[];
}

export interface EstimateFeeResponse {
  slow_atoms:       number;
  normal_atoms:     number;
  fast_atoms:       number;
  congestion_level: 'low' | 'medium' | 'high';
  mempool_count:    number;
  slow_txm:         number;
  normal_txm:       number;
  fast_txm:         number;
}

export interface RpcClient {
  health(): Promise<HealthResponse>;
  getBlockCount(): Promise<BlockCountResponse>;
  getBlock(height: number): Promise<BlockResponse>;
  getUtxos(address: string): Promise<UtxosResponse>;
  getMempoolInfo(): Promise<MempoolInfoResponse>;
  estimateFee(): Promise<EstimateFeeResponse>;
  sendRawTransaction(tx: WalletTx): Promise<SendTxResponse>;
}

export function createRpcClient(baseUrl: string): RpcClient {
  const base = baseUrl.replace(/\/$/, '');
  return {
    health: () => rpcFetch(`${base}/health`),
    getBlockCount: () => rpcFetch(`${base}/getblockcount`),
    getBlock: async (h) => {
      const raw = await rpcFetch<BlockResponse | { block: BlockResponse }>(`${base}/getblock/${h}`);
      return 'block' in raw ? raw.block : raw;
    },
    getUtxos: (addr) => rpcFetch(`${base}/getutxos/${encodeURIComponent(addr)}`),
    getMempoolInfo: () => rpcFetch(`${base}/getmempoolinfo`),
    estimateFee: () => rpcFetch(`${base}/estimatefee`),
    sendRawTransaction: (tx) => rpcFetch(`${base}/sendrawtransaction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tx),
    }),
  };
}

export const RPC_URLS: Record<string, string> = {
  mainnet: 'https://rpc.tensoriumlabs.com',
};
