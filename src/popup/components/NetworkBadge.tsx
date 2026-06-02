import React from 'react';
import type { Network } from '../../lib/storage';

export function NetworkBadge({ network }: { network: Network }) {
  const label = network === 'mainnet' ? 'Mainnet' : 'Custom RPC';
  const color = network === 'mainnet' ? '#f59e0b' : '#a78bfa';
  return (
    <span className="wallet-chip" style={{ color }}>
      <span className="wallet-chip__dot" style={{ background: color }}></span>
      {label}
    </span>
  );
}
