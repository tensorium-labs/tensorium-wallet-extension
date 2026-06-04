import React from 'react';

interface Props {
  size?: 'sm' | 'md';
}

export function BrandMark({ size = 'md' }: Props) {
  const className = size === 'sm' ? 'wallet-brand-mark wallet-brand-mark--sm' : 'wallet-brand-mark';
  return (
    <div className={className} aria-hidden="true">
      <img src="/icons/icon128.png" alt="" className="wallet-brand-mark__img" />
    </div>
  );
}
