import { describe, it, expect } from 'vitest';
import { summarizeSettlement } from '../lib/settlement-summary';

const p2pkh = (b: number) => [0x76, 0xa9, 0x14, ...Array(20).fill(b), 0x88, 0xac];

describe('summarizeSettlement', () => {
  it('lists each spendable output as {address, atoms}, skipping OP_RETURN/data outputs', () => {
    const tx = {
      inputs: [],
      outputs: [
        { value_atoms: 5_000_000, script_pubkey: p2pkh(7) },          // seller payout
        { value_atoms: 125_000, script_pubkey: p2pkh(9) },            // royalty
        { value_atoms: 1_000, script_pubkey: [0x6a, 0x04, 1, 2, 3, 4] }, // OP_RETURN data -> skipped
      ],
      payload: [],
    };
    const out = summarizeSettlement(tx as any);
    expect(out.outputs.length).toBe(2);
    expect(out.outputs[0].atoms).toBe(5_000_000);
    expect(out.outputs[0].address.startsWith('txm1')).toBe(true);
    expect(out.total_spendable_atoms).toBe(5_125_000);
  });
});
