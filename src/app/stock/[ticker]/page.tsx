import Link from 'next/link'
import { notFound } from 'next/navigation'
import Navbar from '@/components/Navbar'
import AnalysisSection from '@/components/AnalysisSection'
import WatchlistButton from '@/components/WatchlistButton'
import { PolygonBadge } from '@/components/PolygonBadge'

interface QuoteData {
  ticker: string
  price: number
  change: number
  changePercent: string
  barTimestamp: string
  fetchedAt: string
}

interface FundamentalsData {
  ticker: string
  name: string
  marketCap: number | null
  peRatio: number | null
  revenueLastYear: number | null
  dilutedEPS: number | null
  employees: number | null
  sector: string | null
  industry: string | null
  description: string | null
  fetchedAt: string
}

function formatPrice(n: number): string {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function formatCompactCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(n)
}

function formatCompactNumber(n: number): string {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(n)
}

function formatDecimal(n: number): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(n)
}

function isPositive(change: number): boolean {
  return change >= 0
}

function formatChangePct(raw: string | number): string {
  const n = typeof raw === 'string' ? parseFloat(raw.replace('%', '')) : raw
  if (isNaN(n)) return '—'
  return `${Math.abs(n).toFixed(2)}%`
}

async function getQuote(ticker: string): Promise<QuoteData | null> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
    const res = await fetch(`${baseUrl}/api/quote?ticker=${ticker}`, {
      cache: 'no-store',
    })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

async function getFundamentals(ticker: string): Promise<FundamentalsData | null> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
    const res = await fetch(`${baseUrl}/api/fundamentals?ticker=${ticker}`, {
      cache: 'no-store',
    })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

function FundamentalsCell({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <div
      style={{
        padding: '16px 16px',
        borderRadius: 22,
        border: '1px solid var(--border)',
        background: 'var(--bg-panel)',
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: 'var(--text-dim)',
          letterSpacing: 'var(--type-eyebrow-tracking)',
          textTransform: 'uppercase',
          marginBottom: 8,
          fontWeight: 650,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 20,
          fontWeight: 650,
          color: accent ? 'var(--purple)' : 'var(--text)',
          letterSpacing: '-0.025em',
          fontFamily: 'var(--font-dm-mono, monospace)',
        }}
      >
        {value}
      </div>
    </div>
  )
}

export default async function StockPage({
  params,
}: {
  params: Promise<{ ticker: string }>
}) {
  const { ticker } = await params
  const upper = ticker.toUpperCase()

  const [quote, fundamentals] = await Promise.all([
    getQuote(upper),
    getFundamentals(upper),
  ])

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
          maxWidth: 1080,
          margin: '0 auto',
          padding: '32px 24px 80px',
        }}
      >
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
          <Link
            href="/"
            style={{ color: 'var(--text-muted)', textDecoration: 'none' }}
          >
            Home
          </Link>
          <span>/</span>
          <span style={{ color: 'var(--text)' }}>{upper}</span>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 20,
            marginBottom: 24,
            padding: '26px',
            borderRadius: 30,
            border: '1px solid var(--border)',
            background:
              'linear-gradient(180deg, color-mix(in srgb, var(--bg-card) 94%, transparent), color-mix(in srgb, var(--bg-panel) 94%, transparent))',
            boxShadow: 'var(--shadow-strong)',
            backdropFilter: 'blur(16px)',
          }}
        >
          <div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 12,
                flexWrap: 'wrap',
              }}
            >
              <span
                style={{
                  background: 'linear-gradient(135deg, var(--accent), #f7dd63)',
                  color: '#000',
                  padding: '5px 12px',
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 650,
                  fontFamily: 'var(--font-dm-mono, monospace)',
                  letterSpacing: '0.14em',
                }}
              >
                {upper}
              </span>
              <PolygonBadge fetchedAt={quote.fetchedAt} />
            </div>

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
                  fontSize: 'clamp(42px, 6vw, 64px)',
                  fontWeight: 650,
                  fontFamily: 'var(--font-dm-mono, monospace)',
                  color: 'var(--text)',
                  letterSpacing: '-0.03em',
                  lineHeight: 'var(--type-display-line-height)',
                }}
              >
                ${formatPrice(quote.price)}
              </span>

              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  background: changeBg,
                  color: changeColor,
                  padding: '7px 14px',
                  borderRadius: 999,
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: 'var(--font-dm-mono, monospace)',
                  letterSpacing: '0.08em',
                }}
              >
                {arrow} {positive ? '+' : ''}
                {quote.change?.toFixed(2)} ({formatChangePct(quote.changePercent)})
              </span>
            </div>

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

          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <Link
              href={`/compare?a=${upper}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '11px 16px',
                borderRadius: 999,
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                textDecoration: 'none',
                cursor: 'pointer',
                boxShadow: 'var(--shadow-soft)',
              }}
            >
              ⇄ Compare
            </Link>
            <WatchlistButton ticker={upper} />
          </div>
        </div>

        {fundamentals ? (
          <section
            style={{
              marginBottom: 32,
              padding: '24px',
              borderRadius: 30,
              border: '1px solid var(--border)',
              background:
                'linear-gradient(180deg, color-mix(in srgb, var(--bg-card) 94%, transparent), color-mix(in srgb, var(--bg-panel) 94%, transparent))',
              boxShadow: 'var(--shadow-soft)',
              backdropFilter: 'blur(14px)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 16,
                flexWrap: 'wrap',
                marginBottom: 18,
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--purple)',
                    letterSpacing: 'var(--type-eyebrow-tracking)',
                    textTransform: 'uppercase',
                    fontWeight: 650,
                  }}
                >
                  Fundamentals
                </div>
                <h2
                  style={{
                    margin: '10px 0 6px',
                    fontSize: 'clamp(28px, 4vw, 40px)',
                    letterSpacing: 'var(--type-title-tracking)',
                    lineHeight: 'var(--type-title-line-height)',
                    fontWeight: 650,
                  }}
                >
                  {fundamentals.name}
                </h2>
                <p
                  style={{
                    margin: 0,
                    color: 'var(--text-muted)',
                    fontSize: 14,
                    lineHeight: 'var(--type-body-line-height)',
                    maxWidth: 720,
                  }}
                >
                  {fundamentals.description || 'No company description available.'}
                </p>
              </div>

              <PolygonBadge fetchedAt={fundamentals.fetchedAt} />
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                gap: 12,
              }}
            >
              <FundamentalsCell
                label="Market Cap"
                value={
                  fundamentals.marketCap !== null
                    ? formatCompactCurrency(fundamentals.marketCap)
                    : '—'
                }
                accent
              />
              <FundamentalsCell
                label="P/E Ratio"
                value={fundamentals.peRatio !== null ? `${formatDecimal(fundamentals.peRatio)}x` : '—'}
              />
              <FundamentalsCell
                label="Diluted EPS"
                value={
                  fundamentals.dilutedEPS !== null
                    ? `$${formatDecimal(fundamentals.dilutedEPS)}`
                    : '—'
                }
              />
              <FundamentalsCell
                label="Revenue"
                value={
                  fundamentals.revenueLastYear !== null
                    ? formatCompactCurrency(fundamentals.revenueLastYear)
                    : '—'
                }
              />
              <FundamentalsCell
                label="Employees"
                value={
                  fundamentals.employees !== null
                    ? formatCompactNumber(fundamentals.employees)
                    : '—'
                }
              />
              <FundamentalsCell
                label="Sector"
                value={fundamentals.sector || fundamentals.industry || '—'}
              />
            </div>
          </section>
        ) : null}

        <div
          style={{
            height: 1,
            background: 'var(--border)',
            marginBottom: 32,
          }}
        />

        <AnalysisSection key={upper} ticker={upper} />
      </main>
    </>
  )
}
