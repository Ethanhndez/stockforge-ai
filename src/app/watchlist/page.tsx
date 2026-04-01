'use client'

import Link from 'next/link'
import { useSyncExternalStore } from 'react'
import Navbar from '@/components/Navbar'
import {
  getWatchlist,
  removeFromWatchlist,
  subscribeToWatchlist,
} from '@/components/WatchlistButton'

export default function WatchlistPage() {
  const tickers = useSyncExternalStore(subscribeToWatchlist, getWatchlist, () => [])

  return (
    <>
      <Navbar />

      <main
        style={{
          maxWidth: 1120,
          margin: '0 auto',
          padding: '42px 24px 90px',
          animation: 'fadeIn 0.25s ease-out',
        }}
      >
        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 0.78fr) minmax(280px, 0.45fr)',
            gap: 20,
            alignItems: 'start',
          }}
        >
          <div
            style={{
              border: '1px solid var(--border)',
              borderRadius: 30,
              background: 'var(--bg-card)',
              boxShadow: 'var(--shadow-strong)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '24px 24px 18px',
                borderBottom: '1px solid var(--border)',
                background:
                  'linear-gradient(135deg, rgba(111, 61, 244, 0.08), rgba(243, 198, 35, 0.08))',
              }}
            >
              <div
              style={{
                fontSize: 11,
                letterSpacing: 'var(--type-eyebrow-tracking)',
                textTransform: 'uppercase',
                color: 'var(--text-dim)',
                fontWeight: 650,
              }}
            >
                Saved Coverage
              </div>
              <h1
              style={{
                margin: '10px 0 6px',
                fontSize: 'clamp(34px, 6vw, 54px)',
                letterSpacing: 'var(--type-display-tracking)',
                lineHeight: 'var(--type-display-line-height)',
                fontWeight: 650,
              }}
            >
                Watchlist
              </h1>
              <p
                style={{
                  margin: 0,
                  color: 'var(--text-muted)',
                  fontSize: 15,
                  lineHeight: 'var(--type-body-line-height)',
                  maxWidth: 520,
                }}
              >
                Account-owned watchlist symbols live here once you are signed in. Logged-out
                sessions still fall back to local mode.
              </p>
            </div>

            {tickers.length === 0 ? (
              <div
                style={{
                  padding: '34px 24px',
                }}
              >
                <div
                  style={{
                    padding: '26px 22px',
                    borderRadius: 24,
                    background: 'var(--bg-panel)',
                    border: '1px dashed var(--border)',
                  }}
                >
                  <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 15 }}>
                    Your watchlist is empty.
                  </p>
                  <Link
                    href="/"
                    style={{
                      display: 'inline-block',
                      marginTop: 14,
                      color: 'var(--purple)',
                      textDecoration: 'none',
                      fontWeight: 700,
                      letterSpacing: '0.04em',
                    }}
                  >
                    Search stocks →
                  </Link>
                </div>
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gap: 12,
                  padding: 18,
                }}
              >
                {tickers.map((ticker) => (
                  <div
                    key={ticker}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 16,
                      padding: '18px 18px',
                      borderRadius: 22,
                      border: '1px solid var(--border)',
                      background: 'var(--bg-panel)',
                      animation: 'fadeIn 0.2s ease-out',
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <span
                        style={{
                          fontFamily: 'var(--font-dm-mono), monospace',
                          fontSize: 18,
                          color: 'var(--text)',
                          letterSpacing: '0.16em',
                        }}
                      >
                        {ticker}
                      </span>
                      <Link
                        href={`/stock/${ticker}`}
                        style={{
                          color: 'var(--text-muted)',
                          textDecoration: 'none',
                          fontSize: 13,
                        }}
                      >
                        Open analysis
                      </Link>
                    </div>

                    <button
                      type="button"
                      onClick={() => void removeFromWatchlist(ticker)}
                      style={{
                        border: '1px solid var(--border)',
                        background: 'transparent',
                        color: 'var(--text-muted)',
                        borderRadius: 999,
                        padding: '10px 14px',
                        cursor: 'pointer',
                        opacity: 0.72,
                        transition: 'opacity 0.18s ease',
                      }}
                      onMouseEnter={(event) => {
                        event.currentTarget.style.opacity = '1'
                      }}
                      onMouseLeave={(event) => {
                        event.currentTarget.style.opacity = '0.72'
                      }}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <aside
            style={{
              display: 'grid',
              gap: 16,
            }}
          >
            <div
              style={{
                padding: '22px 20px',
                borderRadius: 28,
                border: '1px solid var(--border)',
                background:
                  'linear-gradient(160deg, rgba(111, 61, 244, 0.94), rgba(23, 16, 40, 0.98))',
                color: 'white',
                boxShadow: 'var(--shadow-strong)',
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  color: 'rgba(255,255,255,0.66)',
                }}
              >
                Queue Status
              </div>
              <div
                style={{
                  marginTop: 14,
                  fontSize: 40,
                  lineHeight: 1,
                  letterSpacing: '-0.06em',
                  fontWeight: 700,
                }}
              >
                {tickers.length.toString().padStart(2, '0')}
              </div>
              <p
                style={{
                  margin: '10px 0 0',
                  color: 'rgba(255,255,255,0.76)',
                  lineHeight: 1.7,
                  fontSize: 14,
                }}
              >
                Saved symbols ready for deeper analysis.
              </p>
            </div>

            <div
              style={{
                padding: '20px',
                borderRadius: 28,
                border: '1px solid var(--border)',
                background: 'var(--bg-card)',
                boxShadow: 'var(--shadow-soft)',
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--text-dim)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.16em',
                }}
              >
                Workflow
              </div>
              <p
                style={{
                  margin: '12px 0 0',
                  color: 'var(--text-muted)',
                  lineHeight: 1.8,
                  fontSize: 14,
                }}
              >
                Save names here, open the stock page, then pressure-test the
                thesis with the AI research panel.
              </p>
            </div>
          </aside>
        </section>
      </main>
    </>
  )
}
