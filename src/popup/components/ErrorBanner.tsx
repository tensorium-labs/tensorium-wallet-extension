import React from 'react';

interface Props { message: string; onRetry?: () => void }

export function ErrorBanner({ message, onRetry }: Props) {
  return (
    <div className="wallet-alert">
      <span>{message}</span>
      {onRetry && (
        <button onClick={onRetry} className="wallet-btn wallet-btn--secondary">Retry</button>
      )}
    </div>
  );
}
