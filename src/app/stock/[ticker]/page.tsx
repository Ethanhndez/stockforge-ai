// ============================================================
// src/app/stock/[ticker]/page.tsx
// Stock detail page — Server Component
//
// Architecture:
//  - Fetches stock quote server-side (fast, < 1s → page renders immediately)
//  - AI analysis is loaded client-side via <AnalysisSection> (20-40s, shows loading state)
// ============================================================

import { notFound } from 'next/navigation'
import Navbar from '@/components/Navbar'
import AnalysisSection from '@/components/AnalysisSection'
import WatchlistButton from '@/components/WatchlistButton'

// ── Types ───────────────────────────────────────────────────

interface QuoteData {
  ticker: string
  price: number
  change: number
  changePercent: string
  barTimestamp: string   // when the trading bar occurred (ISO 8601) — from Polygon t field
  fetchedAt: string      // when our server received the response
}

// ── Helpers ─────────────────────────────────────────────────

function formatPrice(n: number): string {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function isPositive(change: number): boolean {
  return change >= 0
}

// Ensure changePercent is always displayed as e.g. "0.28%" not "0.28361198706888135"
function formatChangePct(raw: string | number): string {
  const n = typeof raw === 'string' ? parseFloat(raw.replace('%', '')) : raw
  if (isNaN(n)) return '—'
  return `${Math.abs(n).toFixed(2)}%`
}

// ── Data fetching (server-side) ──────────────────────────────

async function getQuote(ticker: string): Promise<QuoteData | null> {
  try {
    // Use absolute URL — required in Server Components
    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
    const res = await fetch(`${baseUrl}/api/quote?ticker=${ticker}`, {
      // Don't cache — always get fresh price data
      cache: 'no-store',
    })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

// ── Page Component ───────────────────────────────────────────

export default async function StockPage({
  params,
}: {
  params: Promise<{ ticker: string }>
}) {
  const { ticker } = await params
  const upper = ticker.toUpperCase()

  const quote = await getQuote(upper)

  if (!quote) {
    notFound()
  }

  const positive = isPositive(quote.change)
  const changeColor = positive ? 'var(--green)' : 'var(--red)'
  const changeBg = positive ? 'var(--green-bg)' : 'var(--red-bg)'
  const arrow = positive ? '▲' : '▼'

  return (
    <>
      <Navbar />

      <main
        style={{
          maxWidth: 900,
          margin: '0 auto',
          padding: '32px 24px 80px',
        }}
      >
        {/* ── Breadcrumb ───────────────────────────────────── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 24,
            fontSize: 13,
            color: 'var(--text-dim)',
          }}
        >
          <a
            href="/"
            style={{ color: 'var(--text-muted)', textDecoration: 'none' }}
          >
            Home
          </a>
          <span>/</span>
          <span style={{ color: 'var(--text)' }}>{upper}</span>
        </div>

        {/* ── Price Header ─────────────────────────────────── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 16,
            marginBottom: 32,
          }}
        >
          <div>
            {/* Ticker badge */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 12,
              }}
            >
              <span
                style={{
                  background: 'var(--accent)',
                  color: '#000',
                  padding: '3px 10px',
                  borderRadius: 4,
                  fontSize: 13,
                  fontWeight: 700,
                  fontFamily: 'var(--font-dm-mono, monospace)',
                  letterSpacing: '0.06em',
                }}
              >
                {upper}
              </span>
            </div>

            {/* Big price */}
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 16,
                flexWrap: 'wrap',
              }}
            >
              <span
                style={{
                  fontSize: 48,
                  fontWeight: 700,
                  fontFamily: 'var(--font-dm-mono, monospace)',
                  color: 'var(--text)',
                  letterSpacing: '-0.02em',
                  lineHeight: 1,
                }}
              >
                ${formatPrice(quote.price)}
              </span>

              {/* Change badge */}
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  background: changeBg,
                  color: changeColor,
                  padding: '4px 12px',
                  borderRadius: 6,
                  fontSize: 15,
                  fontWeight: 600,
                  fontFamily: 'var(--font-dm-mono, monospace)',
                }}
              >
                {arrow} {positive ? '+' : ''}
                {quote.change?.toFixed(2)} ({formatChangePct(quote.changePercent)})
              </span>
            </div>

            {/* Timestamp */}
            <p
              style={{
                marginTop: 8,
                fontSize: 12,
                color: 'var(--text-dim)',
                fontFamily: 'var(--font-dm-mono, monospace)',
              }}
            >
              Previous close ·{' '}
              {new Date(quote.barTimestamp).toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </p>
          </div>

          {/* Compare + Watchlist buttons */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <a
              href={`/compare?a=${upper}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '9px 16px',
                borderRadius: 8,
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                color: 'var(--text-muted)',
                fontSize: 13,
                fontWeight: 500,
                textDecoration: 'none',
                cursor: 'pointer',
              }}
            >
              ⇄ Compare
            </a>
            <WatchlistButton ticker={upper} />
          </div>
        </div>

        {/* ── Divider ──────────────────────────────────────── */}
        <div
          style={{
            height: 1,
            background: 'var(--border)',
            marginBottom: 32,
          }}
        />

        {/* ── AI Analysis Section (Client Component) ───────── */}
        {/* This renders immediately as a loading skeleton,      */}
        {/* then fills in when the AI agent completes.           */}
        <AnalysisSection ticker={upper} />
      </main>
    </>
  )
}
