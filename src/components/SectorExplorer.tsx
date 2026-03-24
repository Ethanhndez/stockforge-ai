// ============================================================
// src/components/SectorExplorer.tsx
// Client component — Sector tabs + top 5 trending stock cards
// Sits below the search bar on the home page
// ============================================================

'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

// ── Types ─────────────────────────────────────────────────────

interface StockCard {
  ticker: string
  name: string
  price: number
  change: number
  changePct: number
  volume: number
  sparkline: number[] // closing prices over last ~7 trading days
}

// ── Sector list (mirrors the API's SECTOR_STOCKS keys) ────────

const SECTORS = [
  'Technology',
  'Healthcare',
  'Financials',
  'Energy',
  'Consumer Discretionary',
  'Consumer Staples',
  'Industrials',
  'Comm. Services',
  'Real Estate',
  'Utilities',
]

// ── Helpers ───────────────────────────────────────────────────

function formatPrice(n: number): string {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function formatVolume(v: number): string {
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}B`
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`
  return String(v)
}

// ── SVG Sparkline ─────────────────────────────────────────────
// Renders a tiny polyline chart from an array of closing prices.
// Width/height are fixed; prices are normalized to fit the box.

function Sparkline({ prices, positive }: { prices: number[]; positive: boolean }) {
  if (!prices || prices.length < 2) return null

  const W = 100 // viewBox width
  const H = 36  // viewBox height
  const PAD = 2 // vertical padding so the line doesn't clip

  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const range = max - min || 1 // avoid division by zero for flat lines

  // Map each price to an (x, y) coordinate
  const points = prices
    .map((p, i) => {
      const x = (i / (prices.length - 1)) * W
      // Invert Y: higher price = lower y value in SVG coordinates
      const y = PAD + ((max - p) / range) * (H - PAD * 2)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  // Build a closed fill path: line + bottom edge + back to start
  const firstX = 0
  const lastX = W
  const bottom = H
  const fillPoints = `${points} ${lastX},${bottom} ${firstX},${bottom}`

  const lineColor = positive ? 'var(--green)' : 'var(--red)'
  const fillColor = positive ? 'rgba(18,165,107,0.1)' : 'rgba(207,68,92,0.1)'

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height={H}
      style={{ display: 'block', overflow: 'visible' }}
      preserveAspectRatio="none"
    >
      {/* Subtle fill under the line */}
      <polygon points={fillPoints} fill={fillColor} />
      {/* The line itself */}
      <polyline
        points={points}
        fill="none"
        stroke={lineColor}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Dot at the last (most recent) price */}
      {(() => {
        const lastPrice = prices[prices.length - 1]
        const dotX = W
        const dotY = PAD + ((max - lastPrice) / range) * (H - PAD * 2)
        return (
          <circle
            cx={dotX}
            cy={dotY}
            r="2.5"
            fill={lineColor}
          />
        )
      })()}
    </svg>
  )
}

// ── Skeleton card shown while loading ─────────────────────────

function SkeletonCard() {
  return (
    <div style={styles.card}>
      {/* Ticker + change badge row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ ...styles.skeletonLine, width: 44, height: 20 }} />
        <div style={{ ...styles.skeletonLine, width: 52, height: 20 }} />
      </div>
      {/* Company name */}
      <div style={{ ...styles.skeletonLine, width: '65%', height: 13, marginBottom: 10 }} />
      {/* Sparkline placeholder */}
      <div style={{ ...styles.skeletonLine, width: '100%', height: 36, borderRadius: 4, marginBottom: 8 }} />
      {/* Price + volume */}
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div style={{ ...styles.skeletonLine, width: 70, height: 18 }} />
        <div style={{ ...styles.skeletonLine, width: 48, height: 13 }} />
      </div>
    </div>
  )
}

// ── Individual stock card ─────────────────────────────────────

function StockCardItem({ stock, onClick }: { stock: StockCard; onClick: () => void }) {
  const positive = stock.changePct >= 0
  const changeColor = positive ? 'var(--green)' : 'var(--red)'
  const changeBg = positive ? 'var(--green-bg)' : 'var(--red-bg)'
  const arrow = positive ? '▲' : '▼'

  return (
    <div
      style={styles.card}
      onClick={onClick}
      onMouseEnter={(e) => {
        ;(e.currentTarget as HTMLDivElement).style.borderColor = 'var(--purple)'
        ;(e.currentTarget as HTMLDivElement).style.transform = 'translateY(-4px)'
        ;(e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-strong)'
      }}
      onMouseLeave={(e) => {
        ;(e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)'
        ;(e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'
        ;(e.currentTarget as HTMLDivElement).style.boxShadow = 'none'
      }}
    >
      {/* Top row: ticker badge + change badge */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={styles.tickerBadge}>{stock.ticker}</span>
        <span
          style={{
            ...styles.changeBadge,
            background: changeBg,
            color: changeColor,
          }}
        >
          {arrow} {positive ? '+' : ''}{stock.changePct.toFixed(2)}%
        </span>
      </div>

      {/* Company name */}
      <p style={styles.companyName}>{stock.name}</p>

      {/* Sparkline — 7-day price history */}
      <div style={{ margin: '6px 0 4px', height: 36 }}>
        <Sparkline prices={stock.sparkline} positive={positive} />
      </div>

      {/* Price + volume row */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <p style={styles.price}>${formatPrice(stock.price)}</p>
        <span style={styles.volume}>Vol {formatVolume(stock.volume)}</span>
      </div>
    </div>
  )
}

// ── Main SectorExplorer component ────────────────────────────

export default function SectorExplorer() {
  const router = useRouter()
  const [activeSector, setActiveSector] = useState<string>('Technology')
  const [stocks, setStocks] = useState<StockCard[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchSector = useCallback(async (sector: string) => {
    setLoading(true)
    setError(null)
    setStocks([])
    try {
      const res = await fetch(`/api/sectors?sector=${encodeURIComponent(sector)}`)
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || 'Failed to load sector data')
      } else {
        setStocks(json.trending || [])
      }
    } catch (e) {
      setError(`Network error: ${String(e)}`)
    } finally {
      setLoading(false)
    }
  }, [])

  // Load default sector on mount
  useEffect(() => {
    fetchSector('Technology')
  }, [fetchSector])

  function handleSectorClick(sector: string) {
    if (sector === activeSector && !error) return // don't re-fetch same sector
    setActiveSector(sector)
    fetchSector(sector)
  }

  return (
    <section style={styles.wrapper}>
      {/* ── Section header ──────────────────────────────────── */}
      <div style={styles.header}>
        <div>
          <div style={styles.eyebrow}>Market scan</div>
          <h2 style={styles.title}>Trending by Sector</h2>
          <p style={styles.subtitle}>Top 5 most active stocks by price movement today</p>
        </div>
      </div>

      {/* ── Sector tab bar ──────────────────────────────────── */}
      <div style={styles.tabScrollWrapper}>
        <div style={styles.tabRow}>
          {SECTORS.map((sector) => {
            const isActive = sector === activeSector
            return (
              <button
                key={sector}
                onClick={() => handleSectorClick(sector)}
                style={{
                  ...styles.tab,
                  background: isActive ? 'var(--purple)' : 'var(--bg-card)',
                  color: isActive ? '#fff' : 'var(--text-muted)',
                  borderColor: isActive ? 'var(--purple)' : 'var(--border)',
                  fontWeight: isActive ? 700 : 500,
                }}
              >
                {sector}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Stock cards grid ────────────────────────────────── */}
      {error ? (
        <div style={styles.errorBox}>
          <span style={{ color: 'var(--red)' }}>⚠</span> {error}
        </div>
      ) : (
        <div style={styles.grid}>
          {loading
            ? Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)
            : stocks.map((stock) => (
                <StockCardItem
                  key={stock.ticker}
                  stock={stock}
                  onClick={() => router.push(`/stock/${stock.ticker}`)}
                />
              ))}
        </div>
      )}

      {/* ── Subtle "sorted by movement" note ───────────────── */}
      {!loading && !error && stocks.length > 0 && (
        <p style={styles.footNote}>
          Sorted by highest price movement · Previous trading session · Click any card to research
        </p>
      )}
    </section>
  )
}

// ── Styles ────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    width: '100%',
    maxWidth: 1080,
    margin: '0 auto',
    padding: '0 0 48px',
  },

  header: {
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.16em',
    textTransform: 'uppercase' as const,
    color: 'var(--purple)',
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 700,
    color: 'var(--text)',
    marginBottom: 6,
    letterSpacing: '-0.04em',
  },
  subtitle: {
    fontSize: 14,
    color: 'var(--text-dim)',
    lineHeight: 1.7,
  },

  // Tab bar — horizontally scrollable on small screens
  tabScrollWrapper: {
    overflowX: 'auto',
    marginBottom: 20,
    // Hide scrollbar visually
    msOverflowStyle: 'none',
  },
  tabRow: {
    display: 'flex',
    gap: 8,
    paddingBottom: 4,
    minWidth: 'max-content', // prevents wrapping, enables scroll
  },
  tab: {
    padding: '10px 16px',
    borderRadius: 99,
    border: '1px solid',
    fontSize: 12,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'all 0.15s ease',
    fontFamily: 'var(--font-geist-sans, sans-serif)',
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    boxShadow: 'var(--shadow-soft)',
  },

  // Stock cards — 5 columns on desktop, 2-3 on mobile
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: 14,
  },

  // Individual card
  card: {
    background:
      'linear-gradient(180deg, color-mix(in srgb, var(--bg-card) 94%, transparent), color-mix(in srgb, var(--bg-panel) 94%, transparent))',
    border: '1px solid var(--border)',
    borderRadius: 24,
    padding: '18px 16px',
    cursor: 'pointer',
    transition: 'border-color 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    minWidth: 0, // prevents overflow in grid
    boxShadow: 'var(--shadow-soft)',
    backdropFilter: 'blur(14px)',
  },

  tickerBadge: {
    display: 'inline-block',
    background: 'linear-gradient(135deg, var(--accent), #f7dd63)',
    border: '1px solid var(--border)',
    color: '#000',
    fontSize: 11,
    fontWeight: 700,
    fontFamily: 'var(--font-dm-mono, monospace)',
    padding: '5px 10px',
    borderRadius: 999,
    letterSpacing: '0.14em',
    marginBottom: 6,
    width: 'fit-content',
  },

  companyName: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--text)',
    marginBottom: 8,
    lineHeight: 1.3,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },

  price: {
    fontSize: 20,
    fontWeight: 700,
    fontFamily: 'var(--font-dm-mono, monospace)',
    color: 'var(--text)',
    letterSpacing: '-0.04em',
    marginBottom: 6,
  },

  changeBadge: {
    fontSize: 11,
    fontWeight: 700,
    fontFamily: 'var(--font-dm-mono, monospace)',
    padding: '5px 9px',
    borderRadius: 999,
    letterSpacing: '0.08em',
  },

  volume: {
    fontSize: 11,
    color: 'var(--text-dim)',
    fontFamily: 'var(--font-dm-mono, monospace)',
  },

  // Skeleton animation
  skeletonLine: {
    background: 'var(--bg-panel)',
    borderRadius: 10,
    animation: 'pulse 1.5s ease-in-out infinite',
  },

  errorBox: {
    background:
      'linear-gradient(180deg, color-mix(in srgb, var(--bg-card) 94%, transparent), color-mix(in srgb, var(--red-bg) 24%, transparent))',
    border: '1px solid var(--red)',
    borderRadius: 22,
    padding: '16px 18px',
    fontSize: 13,
    color: 'var(--text-muted)',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    boxShadow: 'var(--shadow-soft)',
  },

  footNote: {
    fontSize: 12,
    color: 'var(--text-dim)',
    textAlign: 'center',
    marginTop: 14,
  },
}
