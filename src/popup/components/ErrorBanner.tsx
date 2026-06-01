import React from 'react';

interface Props { message: string; onRetry?: () => void }

export function ErrorBanner({ message, onRetry }: Props) {
  return (
    <div style={{
      background: '#7f1d1d', color: '#fca5a5', padding: '10px 14px',
      borderRadius: 6, margin: '8px 0', fontSize: 13,
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    }}>
      <span>{message}</span>
      {onRetry && (
        <button onClick={onRetry} style={{
          background: 'none', border: '1px solid #fca5a5', color: '#fca5a5',
          borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontSize: 12,
        }}>Retry</button>
      )}
    </div>
  );
}
