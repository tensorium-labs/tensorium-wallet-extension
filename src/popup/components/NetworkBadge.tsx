import React from 'react';
import type { Network } from '../../lib/storage';

export function NetworkBadge({ network }: { network: Network }) {
  const label = network === 'testnet' ? 'Testnet' : network === 'mc' ? 'MC' : 'Custom';
  const color = network === 'mc' ? '#f59e0b' : network === 'testnet' ? '#22c55e' : '#a78bfa';
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, color, background: color + '22',
      borderRadius: 4, padding: '2px 7px', letterSpacing: '0.05em',
    }}>{label}</span>
  );
}
