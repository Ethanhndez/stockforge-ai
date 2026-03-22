'use client'
// src/components/WatchlistButton.tsx
export default function WatchlistButton({ ticker }: { ticker: string }) {
  return (
    <button
      style={{
        padding: '9px 16px',
        borderRadius: 8,
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        color: 'var(--text-muted)',
        fontSize: 13,
        cursor: 'pointer',
      }}
      onClick={() => alert(`Watchlist coming soon — ${ticker}`)}
    >
      + Watchlist
    </button>
  )
}
