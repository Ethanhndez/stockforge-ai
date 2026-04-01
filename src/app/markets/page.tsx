'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import SectorExplorer from '@/components/SectorExplorer'

interface MarketNewsItem {
  id: string
  title: string
  publishedAt: string
  source: string
  url: string
  tickers: string[]
}

function formatPublishedAt(value: string) {
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export default function MarketsPage() {
  const [news, setNews] = useState<MarketNewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError('')

      try {
        const res = await fetch('/api/market-news')
        const json = await res.json()

        if (!res.ok) {
          setError(json.error || 'Failed to load market headlines.')
          return
        }

        setNews(json.results ?? [])
      } catch (e) {
        setError(`Failed to load market headlines: ${String(e)}`)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  return (
    <>
      <Navbar />

      <main
        style={{
          maxWidth: 1220,
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
          <span style={{ color: 'var(--text)' }}>Markets</span>
        </div>

        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 0.9fr) minmax(300px, 0.7fr)',
            gap: 18,
            marginBottom: 26,
          }}
        >
          <div
            style={{
              padding: '28px',
              borderRadius: 32,
              border: '1px solid var(--border)',
              background:
                'linear-gradient(180deg, color-mix(in srgb, var(--bg-card) 94%, transparent), color-mix(in srgb, var(--bg-panel) 94%, transparent))',
              boxShadow: 'var(--shadow-strong)',
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: 'var(--purple)',
                letterSpacing: 'var(--type-eyebrow-tracking)',
                textTransform: 'uppercase',
                fontWeight: 650,
              }}
            >
              Daily market briefing
            </div>
            <h1
              style={{
                margin: '10px 0 10px',
                fontSize: 'clamp(38px, 6vw, 62px)',
                letterSpacing: 'var(--type-display-tracking)',
                lineHeight: 'var(--type-display-line-height)',
                fontWeight: 650,
                maxWidth: 620,
              }}
            >
              Track market headlines and sector leaders in one place.
            </h1>
            <p
              style={{
                margin: 0,
                maxWidth: 620,
                color: 'var(--text-muted)',
                fontSize: 15,
                lineHeight: 'var(--type-body-line-height)',
              }}
            >
              Use this page for the fast market read: broad headlines first,
              then jump into sector strength and top movers before opening a
              full stock analysis.
            </p>
          </div>

          <div
            style={{
              padding: '24px',
              borderRadius: 32,
              border: '1px solid var(--border)',
              background:
                'linear-gradient(145deg, rgba(111, 61, 244, 0.94), rgba(24, 18, 38, 0.98))',
              boxShadow: 'var(--shadow-strong)',
              color: 'white',
            }}
          >
            <div
              style={{
                fontSize: 11,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.62)',
                fontWeight: 700,
              }}
            >
              How to use it
            </div>
            <div
              style={{
                marginTop: 14,
                display: 'grid',
                gap: 12,
              }}
            >
              {[
                'Read the top market-moving headlines.',
                'Flip through sectors to see top performers.',
                'Open any company for fundamentals and deeper AI analysis.',
              ].map((line, index) => (
                <div
                  key={line}
                  style={{
                    padding: '14px 16px',
                    borderRadius: 18,
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    lineHeight: 1.7,
                    fontSize: 14,
                  }}
                >
                  <span
                    style={{
                      color: 'var(--accent)',
                      fontFamily: 'var(--font-dm-mono, monospace)',
                      marginRight: 10,
                    }}
                  >
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  {line}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section
          style={{
            marginBottom: 26,
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
              marginBottom: 16,
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: 'var(--purple)',
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                fontWeight: 700,
              }}
            >
              Top market news
            </div>
            <h2
              style={{
                margin: '10px 0 6px',
                fontSize: 28,
                letterSpacing: '-0.05em',
              }}
            >
              Headlines shaping the session
            </h2>
          </div>

          {loading ? (
            <div style={{ color: 'var(--text-muted)', padding: '8px 2px' }}>
              Loading market headlines…
            </div>
          ) : error ? (
            <div
              style={{
                color: 'var(--text-muted)',
                border: '1px solid var(--red)',
                borderRadius: 20,
                padding: '16px 18px',
                background: 'color-mix(in srgb, var(--red-bg) 30%, transparent)',
              }}
            >
              {error}
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gap: 12,
              }}
            >
              {news.map((item) => (
                <a
                  key={item.id}
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: 'block',
                    textDecoration: 'none',
                    border: '1px solid var(--border)',
                    borderRadius: 22,
                    padding: '18px 18px',
                    background: 'var(--bg-panel)',
                    boxShadow: 'var(--shadow-soft)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: 12,
                      flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <h3
                        style={{
                          margin: 0,
                          color: 'var(--text)',
                          fontSize: 18,
                          lineHeight: 1.4,
                          letterSpacing: '-0.03em',
                        }}
                      >
                        {item.title}
                      </h3>
                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: 8,
                          marginTop: 12,
                          alignItems: 'center',
                        }}
                      >
                        <span
                          style={{
                            color: 'var(--text-dim)',
                            fontSize: 11,
                            letterSpacing: '0.12em',
                            textTransform: 'uppercase',
                          }}
                        >
                          {item.source}
                        </span>
                        <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>
                          {formatPublishedAt(item.publishedAt)}
                        </span>
                      </div>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 8,
                        justifyContent: 'flex-end',
                      }}
                    >
                      {item.tickers.slice(0, 3).map((ticker) => (
                        <span
                          key={ticker}
                          style={{
                            padding: '6px 10px',
                            borderRadius: 999,
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border)',
                            color: 'var(--text-muted)',
                            fontSize: 11,
                            fontFamily: 'var(--font-dm-mono, monospace)',
                            letterSpacing: '0.12em',
                          }}
                        >
                          {ticker}
                        </span>
                      ))}
                    </div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </section>

        <section
          style={{
            padding: '22px',
            borderRadius: 30,
            border: '1px solid var(--border)',
            background:
              'linear-gradient(180deg, color-mix(in srgb, var(--bg-card) 94%, transparent), color-mix(in srgb, var(--bg-panel) 94%, transparent))',
            boxShadow: 'var(--shadow-soft)',
          }}
        >
          <SectorExplorer />
        </section>
      </main>
    </>
  )
}
