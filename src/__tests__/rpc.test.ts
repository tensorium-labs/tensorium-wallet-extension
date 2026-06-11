import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { createRpcClient } from '../lib/rpc';
import type { WalletTx } from '../lib/crypto';

const BASE = 'https://mc-rpc.tensoriumlabs.com';

const server = setupServer(
  http.get(`${BASE}/health`, () => HttpResponse.json({ ok: true })),
  http.get(`${BASE}/getblockcount`, () =>
    HttpResponse.json({ blocks: 5, chain_id: 'tensorium-mainnet', height: 4 })),
  http.get(`${BASE}/getblock/2`, () =>
    HttpResponse.json({ hash: [9, 9, 9], block: { header: { height: 2, chain_id: 'tensorium-mainnet', timestamp_seconds: 1000 }, transactions: [] } })),
  http.get(`${BASE}/getutxos/txm1test`, () =>
    HttpResponse.json({ address: 'txm1test', tip_height: 4, utxo_count: 1, utxos: [
      { txid: 'aa'.repeat(32), txid_bytes: new Array(32).fill(0xaa), output_index: 0,
        value_atoms: 5000, coinbase: false, created_height: 1, mature: true }
    ]})),
  http.get(`${BASE}/getmempoolinfo`, () =>
    HttpResponse.json({ count: 1, fees: {
      max_fee_atoms: 10000, median_fee_atoms: 10000, min_fee_atoms: 10000,
      min_relay_fee_atoms: 10000, priority_fee_atoms: 100000, total_fee_atoms: 10000,
    }, txids: ['ab'.repeat(32)] })),
  http.post(`${BASE}/sendrawtransaction`, () =>
    HttpResponse.json({ accepted: true, txid: [1, 2, 3], mempool_size: 1 })),
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('rpc', () => {
  const rpc = createRpcClient(BASE);

  it('health check returns ok', async () => {
    expect((await rpc.health()).ok).toBe(true);
  });
  it('getblockcount returns height', async () => {
    const r = await rpc.getBlockCount();
    expect(r.height).toBe(4);
    expect(r.blocks).toBe(5);
  });
  it('getblock returns block', async () => {
    const b = await rpc.getBlock(2);
    expect(b.header.height).toBe(2);
  });
  it('getutxos returns utxos', async () => {
    const r = await rpc.getUtxos('txm1test');
    expect(r.utxo_count).toBe(1);
    expect(r.utxos[0].value_atoms).toBe(5000);
  });
  it('sendRawTransaction posts and returns txid', async () => {
    const r = await rpc.sendRawTransaction({} as WalletTx);
    expect(r.accepted).toBe(true);
  });
  it('getMempoolInfo returns txids and fee stats', async () => {
    const r = await rpc.getMempoolInfo();
    expect(r.count).toBe(1);
    expect(r.txids[0]).toBe('ab'.repeat(32));
    expect(r.fees.min_relay_fee_atoms).toBe(10000);
  });
  it('throws RpcError on non-200', async () => {
    server.use(http.get(`${BASE}/health`, () => HttpResponse.json({ error: 'down' }, { status: 500 })));
    await expect(rpc.health()).rejects.toThrow('down');
  });
  it('surfaces plain-text rpc errors', async () => {
    server.use(http.get(`${BASE}/health`, () => new HttpResponse('maintenance', { status: 503 })));
    await expect(rpc.health()).rejects.toThrow('maintenance');
  });
});
