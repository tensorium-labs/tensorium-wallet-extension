import React from 'react';
import type { Network } from '../../lib/storage';

export function NetworkBadge({ network }: { network: Network }) {
  const label = network === 'testnet' ? 'Testnet' : network === 'mc' ? 'MC' : 'Custom';
  const color = network === 'mc' ? '#f59e0b' : network === 'testnet' ? '#22c55e' : '#a78bfa';
  return (
    <span className="wallet-chip" style={{ color }}>
      <span className="wallet-chip__dot" style={{ background: color }}></span>
      {label}
    </span>
  );
}
