import Link from 'next/link'

export default function Navbar() {
  return (
    <nav
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 20,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        padding: '18px 24px',
        borderBottom: '1px solid var(--border)',
        background: 'color-mix(in srgb, var(--bg-panel) 84%, transparent)',
        backdropFilter: 'blur(18px)',
      }}
    >
      <Link
        href="/"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 12,
          textDecoration: 'none',
        }}
      >
        <span
          style={{
            width: 12,
            height: 12,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--purple) 0%, var(--accent) 100%)',
            boxShadow: '0 0 24px rgba(111, 61, 244, 0.35)',
          }}
        />
        <span
          style={{
            fontWeight: 700,
            color: 'var(--text)',
            letterSpacing: '-0.05em',
            fontSize: 20,
          }}
        >
          StockForge <span style={{ color: 'var(--accent)' }}>AI</span>
        </span>
      </Link>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <span
          style={{
            fontSize: 11,
            color: 'var(--text-dim)',
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
          }}
        >
          Intelligence Layer
        </span>
        <Link
          href="/dashboard"
          style={{
            textDecoration: 'none',
            color: 'var(--text)',
            fontSize: 13,
            fontWeight: 600,
            padding: '10px 14px',
            borderRadius: 999,
            border: '1px solid var(--border)',
            background: 'var(--bg-card)',
            boxShadow: 'var(--shadow-soft)',
          }}
        >
          Portfolio OS
        </Link>
        <Link
          href="/markets"
          style={{
            textDecoration: 'none',
            color: 'var(--text-muted)',
            fontSize: 13,
            fontWeight: 600,
            padding: '10px 14px',
            borderRadius: 999,
            border: '1px solid var(--border)',
            background: 'var(--bg-card)',
            boxShadow: 'var(--shadow-soft)',
          }}
        >
          Markets
        </Link>
        <Link
          href="/watchlist"
          style={{
            textDecoration: 'none',
            color: 'var(--text)',
            fontSize: 13,
            fontWeight: 600,
            padding: '10px 14px',
            borderRadius: 999,
            border: '1px solid var(--border)',
            background: 'var(--bg-card)',
            boxShadow: 'var(--shadow-soft)',
          }}
        >
          ☆ Watchlist
        </Link>
      </div>
    </nav>
  )
}
