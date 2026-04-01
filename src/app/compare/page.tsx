'use client'

import type { CSSProperties } from 'react'
import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import Navbar from '@/components/Navbar'
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

interface CompanySnapshot {
  ticker: string
  quote: QuoteData | null
  fundamentals: FundamentalsData | null
}

const QUICK_COMPARE_PAIRS = [
  ['AAPL', 'MSFT'],
  ['NVDA', 'AMD'],
  ['AMZN', 'MSFT'],
  ['TSLA', 'NVDA'],
]

function isValidTicker(value: string) {
  return /^[A-Z]{1,5}$/.test(value)
}

function formatPrice(n: number) {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)
}

function formatCompactCurrency(n: number | null) {
  if (n === null) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(n)
}

function formatCompactNumber(n: number | null) {
  if (n === null) return '—'
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(n)
}

function formatMetric(n: number | null, suffix = '') {
  if (n === null) return '—'
  return `${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(n)}${suffix}`
}

function formatChangePct(raw: string | number) {
  const n = typeof raw === 'string' ? parseFloat(raw.replace('%', '')) : raw
  if (Number.isNaN(n)) return '—'
  return `${Math.abs(n).toFixed(2)}%`
}

function winnerStyle(
  left: number | null,
  right: number | null,
  side: 'left' | 'right',
  higherIsBetter = true
) {
  if (left === null || right === null || left === right) return {}
  const leftWins = higherIsBetter ? left > right : left < right
  const active = side === 'left' ? leftWins : !leftWins
  if (!active) return {}

  return {
    borderColor: 'var(--purple)',
    boxShadow: '0 0 0 1px rgba(111, 61, 244, 0.15) inset',
  }
}

async function fetchCompanySnapshot(ticker: string): Promise<CompanySnapshot> {
  const [quoteRes, fundamentalsRes] = await Promise.all([
    fetch(`/api/quote?ticker=${ticker}`),
    fetch(`/api/fundamentals?ticker=${ticker}`),
  ])

  const quote = quoteRes.ok ? ((await quoteRes.json()) as QuoteData) : null
  const fundamentals = fundamentalsRes.ok
    ? ((await fundamentalsRes.json()) as FundamentalsData)
    : null

  return { ticker, quote, fundamentals }
}

function CompareMetricRow({
  label,
  leftLabel,
  rightLabel,
  leftValue,
  rightValue,
  leftRaw,
  rightRaw,
  higherIsBetter = true,
}: {
  label: string
  leftLabel: string
  rightLabel: string
  leftValue: string
  rightValue: string
  leftRaw: number | null
  rightRaw: number | null
  higherIsBetter?: boolean
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) 120px minmax(0, 1fr)',
        gap: 10,
        alignItems: 'stretch',
      }}
    >
      <div
        style={{
          ...metricCellStyle,
          ...winnerStyle(leftRaw, rightRaw, 'left', higherIsBetter),
        }}
      >
        <span style={metricTickerStyle}>{leftLabel}</span>
        <strong style={metricValueStyle}>{leftValue}</strong>
      </div>
      <div
        style={{
          ...metricCellStyle,
          justifyContent: 'center',
          color: 'var(--text-dim)',
          fontSize: 11,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </div>
      <div
        style={{
          ...metricCellStyle,
          ...winnerStyle(leftRaw, rightRaw, 'right', higherIsBetter),
        }}
      >
        <span style={metricTickerStyle}>{rightLabel}</span>
        <strong style={metricValueStyle}>{rightValue}</strong>
      </div>
    </div>
  )
}

const metricCellStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  gap: 8,
  padding: '14px 16px',
  borderRadius: 20,
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: 'var(--border)',
  background: 'var(--bg-panel)',
  minWidth: 0,
}

const metricTickerStyle: CSSProperties = {
  fontSize: 10,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: 'var(--text-dim)',
  fontFamily: 'var(--font-dm-mono, monospace)',
}

const metricValueStyle: CSSProperties = {
  fontSize: 18,
  letterSpacing: '-0.025em',
  color: 'var(--text)',
  fontFamily: 'var(--font-dm-mono, monospace)',
  fontWeight: 650,
}

function ComparePageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialA = (searchParams.get('a') || 'AAPL').toUpperCase()
  const initialB = (searchParams.get('b') || (initialA === 'AAPL' ? 'MSFT' : 'AAPL')).toUpperCase()

  const [tickerA, setTickerA] = useState(initialA)
  const [tickerB, setTickerB] = useState(initialB)
  const [dataA, setDataA] = useState<CompanySnapshot | null>(null)
  const [dataB, setDataB] = useState<CompanySnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setTickerA(initialA)
    setTickerB(initialB)
  }, [initialA, initialB])

  useEffect(() => {
    async function load() {
      if (!isValidTicker(initialA) || !isValidTicker(initialB)) {
        setError('Enter two valid ticker symbols, 1 to 5 letters each.')
        setLoading(false)
        return
      }

      setLoading(true)
      setError('')

      try {
        const [left, right] = await Promise.all([
          fetchCompanySnapshot(initialA),
          fetchCompanySnapshot(initialB),
        ])
        setDataA(left)
        setDataB(right)
      } catch (e) {
        setError(`Compare request failed: ${String(e)}`)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [initialA, initialB])

  function submitCompare(nextA = tickerA, nextB = tickerB) {
    const a = nextA.trim().toUpperCase()
    const b = nextB.trim().toUpperCase()

    if (!isValidTicker(a) || !isValidTicker(b)) {
      setError('Enter two valid ticker symbols, 1 to 5 letters each.')
      return
    }

    if (a === b) {
      setError('Choose two different ticker symbols to compare.')
      return
    }

    router.push(`/compare?a=${a}&b=${b}`)
  }

  const left = dataA
  const right = dataB

  return (
    <>
      <Navbar />

      <main
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          padding: '34px 24px 84px',
          animation: 'fadeIn 0.25s ease-out',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 22,
            fontSize: 13,
            color: 'var(--text-dim)',
          }}
        >
          <Link href="/" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>
            Home
          </Link>
          <span>/</span>
          <span style={{ color: 'var(--text)' }}>Compare</span>
        </div>

        <section
          style={{
            padding: '28px',
            borderRadius: 32,
            border: '1px solid var(--border)',
            background:
              'linear-gradient(180deg, color-mix(in srgb, var(--bg-card) 94%, transparent), color-mix(in srgb, var(--bg-panel) 94%, transparent))',
            boxShadow: 'var(--shadow-strong)',
            backdropFilter: 'blur(16px)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 18,
              flexWrap: 'wrap',
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--purple)',
                  fontWeight: 650,
                  letterSpacing: 'var(--type-eyebrow-tracking)',
                  textTransform: 'uppercase',
                }}
              >
                Side-by-side analysis
              </div>
              <h1
                style={{
                  margin: '10px 0 8px',
                  fontSize: 'clamp(34px, 6vw, 56px)',
                  letterSpacing: 'var(--type-display-tracking)',
                  lineHeight: 'var(--type-display-line-height)',
                  fontWeight: 650,
                  maxWidth: 520,
                }}
              >
                Compare stocks without
                <br />
                losing the thread.
              </h1>
              <p
                style={{
                  margin: 0,
                  maxWidth: 640,
                  color: 'var(--text-muted)',
                  fontSize: 15,
                  lineHeight: 'var(--type-body-line-height)',
                }}
              >
                Put two names against each other on price action and core
                fundamentals before you dive deeper into the AI research layer.
              </p>
            </div>

            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 8,
                alignItems: 'center',
                maxWidth: 320,
                justifyContent: 'flex-end',
              }}
            >
              {QUICK_COMPARE_PAIRS.map(([a, b]) => (
                <button
                  key={`${a}-${b}`}
                  type="button"
                  onClick={() => {
                    setTickerA(a)
                    setTickerB(b)
                    submitCompare(a, b)
                  }}
                  style={{
                    borderRadius: 999,
                    border: '1px solid var(--border)',
                    background: 'var(--bg-card)',
                    color: 'var(--text-muted)',
                    padding: '8px 12px',
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    boxShadow: 'var(--shadow-soft)',
                  }}
                >
                  {a} / {b}
                </button>
              ))}
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) 60px minmax(0, 1fr) auto',
              gap: 12,
              alignItems: 'center',
              marginTop: 28,
            }}
          >
            <input
              value={tickerA}
              onChange={(e) => setTickerA(e.target.value.toUpperCase())}
              placeholder="AAPL"
              style={inputStyle}
            />
            <div
              style={{
                textAlign: 'center',
                color: 'var(--text-dim)',
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                fontSize: 11,
              }}
            >
              vs
            </div>
            <input
              value={tickerB}
              onChange={(e) => setTickerB(e.target.value.toUpperCase())}
              placeholder="MSFT"
              style={inputStyle}
            />
            <button
              type="button"
              onClick={() => submitCompare()}
              style={{
                border: 'none',
                borderRadius: 20,
                padding: '17px 20px',
                background: 'linear-gradient(135deg, var(--accent), #f7dd63)',
                color: '#14110a',
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                boxShadow: '0 14px 30px rgba(243, 198, 35, 0.22)',
              }}
            >
              Compare
            </button>
          </div>

          {error ? (
            <p style={{ margin: '12px 4px 0', color: 'var(--red)', fontSize: 13 }}>{error}</p>
          ) : null}
        </section>

        {loading ? (
          <div
            style={{
              marginTop: 22,
              padding: '22px 24px',
              borderRadius: 28,
              border: '1px solid var(--border)',
              background:
                'linear-gradient(180deg, color-mix(in srgb, var(--bg-card) 94%, transparent), color-mix(in srgb, var(--bg-panel) 94%, transparent))',
              boxShadow: 'var(--shadow-soft)',
              color: 'var(--text-muted)',
            }}
          >
            Loading comparison surface…
          </div>
        ) : null}

        {!loading && left && right ? (
          <>
            <section
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                gap: 16,
                marginTop: 22,
              }}
            >
              {[left, right].map((snapshot) => {
                const quote = snapshot.quote
                const fundamentals = snapshot.fundamentals
                const positive = quote ? Number(quote.change) >= 0 : false

                return (
                  <div
                    key={snapshot.ticker}
                    style={{
                      padding: '22px',
                      borderRadius: 30,
                      border: '1px solid var(--border)',
                      background:
                        'linear-gradient(180deg, color-mix(in srgb, var(--bg-card) 94%, transparent), color-mix(in srgb, var(--bg-panel) 94%, transparent))',
                      boxShadow: 'var(--shadow-soft)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        gap: 12,
                        marginBottom: 16,
                      }}
                    >
                      <div>
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '5px 12px',
                            borderRadius: 999,
                            background: 'linear-gradient(135deg, var(--accent), #f7dd63)',
                            color: '#000',
                            fontSize: 11,
                            fontWeight: 700,
                            letterSpacing: '0.14em',
                            textTransform: 'uppercase',
                            fontFamily: 'var(--font-dm-mono, monospace)',
                          }}
                        >
                          {snapshot.ticker}
                        </div>
                        <h2
                          style={{
                            margin: '12px 0 6px',
                            fontSize: 28,
                            letterSpacing: 'var(--type-title-tracking)',
                            lineHeight: 'var(--type-title-line-height)',
                            fontWeight: 650,
                          }}
                        >
                          {fundamentals?.name || snapshot.ticker}
                        </h2>
                      </div>
                      {quote ? <PolygonBadge fetchedAt={quote.fetchedAt} compact /> : null}
                    </div>

                    {quote ? (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'baseline',
                          gap: 12,
                          flexWrap: 'wrap',
                        }}
                      >
                        <span
                          style={{
                            fontSize: 36,
                            fontWeight: 650,
                            fontFamily: 'var(--font-dm-mono, monospace)',
                            letterSpacing: '-0.03em',
                          }}
                        >
                          ${formatPrice(quote.price)}
                        </span>
                        <span
                          style={{
                            padding: '6px 12px',
                            borderRadius: 999,
                            background: positive ? 'var(--green-bg)' : 'var(--red-bg)',
                            color: positive ? 'var(--green)' : 'var(--red)',
                            fontSize: 12,
                            fontWeight: 700,
                            fontFamily: 'var(--font-dm-mono, monospace)',
                            letterSpacing: '0.08em',
                          }}
                        >
                          {positive ? '+' : ''}
                          {quote.change.toFixed(2)} ({formatChangePct(quote.changePercent)})
                        </span>
                      </div>
                    ) : (
                      <p style={{ margin: 0, color: 'var(--red)' }}>Quote unavailable.</p>
                    )}

                    <p
                      style={{
                        margin: '14px 0 0',
                        color: 'var(--text-muted)',
                        fontSize: 14,
                        lineHeight: 'var(--type-body-line-height)',
                      }}
                    >
                      {fundamentals?.description || 'Fundamentals description unavailable for this ticker in the current dataset.'}
                    </p>

                    <div style={{ marginTop: 18 }}>
                      <Link
                        href={`/stock/${snapshot.ticker}`}
                        style={{
                          textDecoration: 'none',
                          color: 'var(--purple)',
                          fontWeight: 700,
                          fontSize: 13,
                        }}
                      >
                        Open full analysis →
                      </Link>
                    </div>
                  </div>
                )
              })}
            </section>

            <section
              style={{
                marginTop: 18,
                padding: '20px',
                borderRadius: 28,
                border: '1px solid var(--border)',
                background:
                  'linear-gradient(180deg, color-mix(in srgb, var(--bg-card) 94%, transparent), color-mix(in srgb, var(--bg-panel) 94%, transparent))',
                boxShadow: 'var(--shadow-soft)',
              }}
            >
              <div
                style={{
                  marginBottom: 14,
                  fontSize: 11,
                  color: 'var(--purple)',
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  fontWeight: 700,
                }}
              >
                Core comparison
              </div>

              <div style={{ display: 'grid', gap: 10 }}>
                <CompareMetricRow
                  label="Price"
                  leftLabel={left.ticker}
                  rightLabel={right.ticker}
                  leftValue={left.quote ? `$${formatPrice(left.quote.price)}` : '—'}
                  rightValue={right.quote ? `$${formatPrice(right.quote.price)}` : '—'}
                  leftRaw={left.quote?.price ?? null}
                  rightRaw={right.quote?.price ?? null}
                />
                <CompareMetricRow
                  label="Market Cap"
                  leftLabel={left.ticker}
                  rightLabel={right.ticker}
                  leftValue={formatCompactCurrency(left.fundamentals?.marketCap ?? null)}
                  rightValue={formatCompactCurrency(right.fundamentals?.marketCap ?? null)}
                  leftRaw={left.fundamentals?.marketCap ?? null}
                  rightRaw={right.fundamentals?.marketCap ?? null}
                />
                <CompareMetricRow
                  label="Revenue"
                  leftLabel={left.ticker}
                  rightLabel={right.ticker}
                  leftValue={formatCompactCurrency(left.fundamentals?.revenueLastYear ?? null)}
                  rightValue={formatCompactCurrency(right.fundamentals?.revenueLastYear ?? null)}
                  leftRaw={left.fundamentals?.revenueLastYear ?? null}
                  rightRaw={right.fundamentals?.revenueLastYear ?? null}
                />
                <CompareMetricRow
                  label="Diluted EPS"
                  leftLabel={left.ticker}
                  rightLabel={right.ticker}
                  leftValue={
                    left.fundamentals?.dilutedEPS !== null && left.fundamentals?.dilutedEPS !== undefined
                      ? `$${formatMetric(left.fundamentals.dilutedEPS)}`
                      : '—'
                  }
                  rightValue={
                    right.fundamentals?.dilutedEPS !== null && right.fundamentals?.dilutedEPS !== undefined
                      ? `$${formatMetric(right.fundamentals.dilutedEPS)}`
                      : '—'
                  }
                  leftRaw={left.fundamentals?.dilutedEPS ?? null}
                  rightRaw={right.fundamentals?.dilutedEPS ?? null}
                />
                <CompareMetricRow
                  label="P/E"
                  leftLabel={left.ticker}
                  rightLabel={right.ticker}
                  leftValue={
                    left.fundamentals?.peRatio !== null && left.fundamentals?.peRatio !== undefined
                      ? `${formatMetric(left.fundamentals.peRatio)}x`
                      : '—'
                  }
                  rightValue={
                    right.fundamentals?.peRatio !== null && right.fundamentals?.peRatio !== undefined
                      ? `${formatMetric(right.fundamentals.peRatio)}x`
                      : '—'
                  }
                  leftRaw={left.fundamentals?.peRatio ?? null}
                  rightRaw={right.fundamentals?.peRatio ?? null}
                  higherIsBetter={false}
                />
                <CompareMetricRow
                  label="Employees"
                  leftLabel={left.ticker}
                  rightLabel={right.ticker}
                  leftValue={formatCompactNumber(left.fundamentals?.employees ?? null)}
                  rightValue={formatCompactNumber(right.fundamentals?.employees ?? null)}
                  leftRaw={left.fundamentals?.employees ?? null}
                  rightRaw={right.fundamentals?.employees ?? null}
                />
              </div>
            </section>
          </>
        ) : null}
      </main>
    </>
  )
}

export default function ComparePage() {
  return (
    <Suspense fallback={<main style={{ padding: 24, fontFamily: 'monospace' }}>Loading compare view...</main>}>
      <ComparePageContent />
    </Suspense>
  )
}

const inputStyle: CSSProperties = {
  borderRadius: 20,
  border: '1px solid var(--border)',
  background: 'var(--bg-elevated)',
  color: 'var(--text)',
  padding: '16px 18px',
  fontSize: 15,
  fontFamily: 'var(--font-dm-mono, monospace)',
  letterSpacing: '0.1em',
  outline: 'none',
  minWidth: 0,
}
