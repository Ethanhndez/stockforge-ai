// ============================================================
// src/app/page.tsx
// Home page — hero, search bar, quick picks, sector explorer
// ============================================================

'use client'

import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import SearchBar from '@/components/SearchBar'
import SectorExplorer from '@/components/SectorExplorer'

const QUICK_PICKS = [
  { ticker: 'AAPL', label: 'AAPL' },
  { ticker: 'NVDA', label: 'NVDA' },
  { ticker: 'TSLA', label: 'TSLA' },
  { ticker: 'MSFT', label: 'MSFT' },
  { ticker: 'AMZN', label: 'AMZN' },
]

export default function HomePage() {
  const router = useRouter()

  return (
    <>
      <Navbar />

      <main>
        {/* ── Hero Section ────────────────────────────────── */}
        <section
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '72px 24px 48px',
            textAlign: 'center',
          }}
        >
          {/* Badge */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              background: 'rgba(245,196,0,0.08)',
              border: '1px solid rgba(245,196,0,0.2)',
              borderRadius: 99,
              padding: '5px 14px',
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--accent)',
              letterSpacing: '0.06em',
              marginBottom: 28,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: 'var(--accent)',
                display: 'inline-block',
                animation: 'pulse 2s infinite',
              }}
            />
            PhD-LEVEL AI RESEARCH · LIVE DATA
          </div>

          {/* Headline */}
          <h1
            style={{
              fontSize: 'clamp(32px, 5vw, 52px)',
              fontWeight: 700,
              letterSpacing: '-0.03em',
              lineHeight: 1.1,
              color: 'var(--text)',
              maxWidth: 640,
              marginBottom: 16,
            }}
          >
            Wall Street research,{' '}
            <span style={{ color: 'var(--accent)' }}>explained simply</span>
          </h1>

          {/* Subheadline */}
          <p
            style={{
              fontSize: 16,
              color: 'var(--text-muted)',
              maxWidth: 480,
              lineHeight: 1.6,
              marginBottom: 36,
            }}
          >
            AI reads SEC filings, tracks earnings calls, and tests bull &amp; bear cases — then explains it like a friend who works at Goldman.
          </p>

          {/* Search bar */}
          <div style={{ width: '100%', maxWidth: 560, marginBottom: 20 }}>
            <SearchBar />
          </div>

          {/* Quick picks */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexWrap: 'wrap',
              justifyContent: 'center',
            }}
          >
            <span
              style={{
                fontSize: 12,
                color: 'var(--text-dim)',
                marginRight: 4,
              }}
            >
              Quick picks:
            </span>
            {QUICK_PICKS.map((p) => (
              <button
                key={p.ticker}
                onClick={() => router.push(`/stock/${p.ticker}`)}
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  padding: '4px 12px',
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: 'var(--font-dm-mono, monospace)',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  letterSpacing: '0.04em',
                  transition: 'border-color 0.15s, color 0.15s',
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget
                  el.style.borderColor = 'var(--accent)'
                  el.style.color = 'var(--accent)'
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget
                  el.style.borderColor = 'var(--border)'
                  el.style.color = 'var(--text-muted)'
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </section>

        {/* ── Divider ─────────────────────────────────────── */}
        <div
          style={{
            height: 1,
            background: 'var(--border)',
            margin: '0 24px 48px',
          }}
        />

        {/* ── Sector Explorer ─────────────────────────────── */}
        <div style={{ padding: '0 24px' }}>
          <SectorExplorer />
        </div>
      </main>
    </>
  )
}
