'use client'

import { useEffect, useState } from 'react'

export function PolygonBadge({
  fetchedAt,
  compact = false,
}: {
  fetchedAt: string
  compact?: boolean
}) {
  const timestamp = new Date(fetchedAt)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(interval)
  }, [])

  const isStale = now - timestamp.getTime() > 15 * 60 * 1000
  const age = formatAge(timestamp, now)

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: compact ? '6px 10px' : '7px 12px',
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.08em',
        fontFamily: 'var(--font-dm-mono, monospace)',
        background: isStale
          ? 'linear-gradient(135deg, var(--yellow-bg), rgba(111, 61, 244, 0.08))'
          : 'var(--bg-card)',
        color: isStale ? 'var(--text)' : 'var(--text-muted)',
        border: `1px solid ${isStale ? 'var(--accent)' : 'var(--border)'}`,
        boxShadow: 'var(--shadow-soft)',
        textTransform: 'uppercase',
      }}
      title={`Fetched from Polygon.io at ${timestamp.toISOString()}`}
    >
      <span style={{ color: isStale ? 'var(--accent)' : 'var(--purple)' }}>◈</span>
      {!compact && (
        <>
          <span>Polygon</span>
          <span style={{ opacity: 0.58 }}>· {age}</span>
        </>
      )}
    </span>
  )
}

function formatAge(date: Date, now: number): string {
  const s = Math.floor((now - date.getTime()) / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  return `${Math.floor(m / 60)}h ago`
}
