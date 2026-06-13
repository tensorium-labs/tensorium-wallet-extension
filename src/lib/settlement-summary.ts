import { extractAddressFromScriptPubKey, type WalletTx } from './crypto';

export interface SettlementSummary {
  outputs: { address: string; atoms: number }[];
  total_spendable_atoms: number;
}

// Recompute the human-facing effect of a settlement tx from its outputs alone,
// so the approval UI never has to trust a dapp-supplied summary. Outputs that
// are not standard P2PKH (e.g. OP_RETURN asset-overlay data) are skipped.
export function summarizeSettlement(tx: WalletTx): SettlementSummary {
  const outputs: { address: string; atoms: number }[] = [];
  for (const o of tx.outputs) {
    const address = extractAddressFromScriptPubKey(o.script_pubkey);
    if (address) outputs.push({ address, atoms: o.value_atoms });
  }
  return { outputs, total_spendable_atoms: outputs.reduce((n, o) => n + o.atoms, 0) };
}
