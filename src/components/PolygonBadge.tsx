// ============================================================
// src/components/PolygonBadge.tsx
// Attribution badge displayed next to any Polygon.io data point.
// Shows staleness indicator (yellow if > 15 min old).
// ============================================================

export function PolygonBadge({
  fetchedAt,
  compact = false,
}: {
  fetchedAt: string
  compact?: boolean
}) {
  const timestamp = new Date(fetchedAt)
  const isStale = Date.now() - timestamp.getTime() > 15 * 60 * 1000
  const age = formatAge(timestamp)

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 6px',
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 500,
        fontFamily: 'var(--font-dm-mono, monospace)',
        background: isStale ? 'var(--yellow-bg, #fefce8)' : 'var(--bg-elevated)',
        color: isStale ? 'var(--yellow, #a16207)' : 'var(--text-dim)',
        border: '1px solid var(--border)',
      }}
      title={`Fetched from Polygon.io at ${timestamp.toISOString()}`}
    >
      <span>◈</span>
      {!compact && (
        <>
          <span>via Polygon.io</span>
          <span style={{ opacity: 0.6 }}>· {age}</span>
        </>
      )}
    </span>
  )
}

function formatAge(date: Date): string {
  const s = Math.floor((Date.now() - date.getTime()) / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  return `${Math.floor(m / 60)}h ago`
}
