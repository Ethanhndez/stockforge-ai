'use client'

import { KeyboardEvent, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'

const QUICK_PICKS = ['AAPL', 'NVDA', 'TSLA', 'MSFT', 'AMZN']
const FEATURE_PILLS = [
  'AI thesis framing',
  'Live quote context',
  'Bull / bear pressure test',
  'Watchlist workflow',
]

function isValidTicker(value: string) {
  return /^[A-Z]{1,5}$/.test(value)
}

export default function HomePage() {
  const router = useRouter()
  const [ticker, setTicker] = useState('')
  const [error, setError] = useState('')

  function submitTicker(rawValue: string) {
    const nextTicker = rawValue.trim().toUpperCase()

    if (!isValidTicker(nextTicker)) {
      setError('Enter a valid ticker symbol, 1 to 5 letters.')
      return
    }

    setError('')
    router.push(`/stock/${nextTicker}`)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault()
      submitTicker(ticker)
    }
  }

  return (
    <>
      <Navbar />

      <main
        style={{
          position: 'relative',
          overflow: 'hidden',
          minHeight: 'calc(100vh - 73px)',
          padding: '42px 24px 84px',
        }}
      >
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 44,
            right: '-6%',
            width: 320,
            height: 320,
            borderRadius: '32% 68% 59% 41% / 46% 39% 61% 54%',
            background:
              'radial-gradient(circle at 30% 30%, rgba(243, 198, 35, 0.95), rgba(111, 61, 244, 0.2) 60%, transparent 72%)',
            filter: 'blur(10px)',
            animation: 'drift 8s ease-in-out infinite',
            opacity: 0.85,
          }}
        />

        <section
          style={{
            position: 'relative',
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.25fr) minmax(300px, 0.75fr)',
            gap: 24,
            maxWidth: 1220,
            margin: '0 auto',
            animation: 'fadeIn 0.35s ease-out',
          }}
        >
          <div
            style={{
              padding: '26px 0 0',
            }}
          >
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 14px',
                borderRadius: 999,
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                boxShadow: 'var(--shadow-soft)',
                color: 'var(--text-muted)',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
              }}
            >
              <span
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: '50%',
                  background: 'var(--purple)',
                  boxShadow: '0 0 24px rgba(111, 61, 244, 0.4)',
                  animation: 'pulse 2s ease-in-out infinite',
                }}
              />
              Post-Market Research Console
            </div>

            <h1
              style={{
                margin: '22px 0 18px',
                maxWidth: 760,
                fontSize: 'clamp(48px, 8vw, 88px)',
                lineHeight: 0.92,
                letterSpacing: '-0.07em',
              }}
            >
              Minimal surface.
              <br />
              <span style={{ color: 'var(--purple)' }}>Maximum signal.</span>
            </h1>

            <p
              style={{
                margin: 0,
                maxWidth: 620,
                color: 'var(--text-muted)',
                fontSize: 18,
                lineHeight: 1.75,
              }}
            >
              A slick stock research interface built for fast thesis formation:
              live quote context, structured AI analysis, and a watchlist flow
              that feels more terminal than dashboard.
            </p>

            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 10,
                marginTop: 28,
              }}
            >
              {FEATURE_PILLS.map((pill) => (
                <span
                  key={pill}
                  style={{
                    padding: '10px 14px',
                    borderRadius: 999,
                    border: '1px solid var(--border)',
                    background: 'var(--bg-card)',
                    color: 'var(--text-muted)',
                    fontSize: 13,
                    boxShadow: 'var(--shadow-soft)',
                  }}
                >
                  {pill}
                </span>
              ))}
            </div>

            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 12,
                marginTop: 24,
                alignItems: 'center',
              }}
            >
              <Link
                href="/markets"
                style={{
                  textDecoration: 'none',
                  padding: '13px 16px',
                  borderRadius: 999,
                  border: '1px solid var(--border)',
                  background: 'var(--bg-card)',
                  color: 'var(--text)',
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  boxShadow: 'var(--shadow-soft)',
                }}
              >
                Open Markets Brief
              </Link>
              <span
                style={{
                  color: 'var(--text-dim)',
                  fontSize: 13,
                }}
              >
                Daily market headlines + sector leaders
              </span>
            </div>

            <div
              style={{
                marginTop: 32,
                padding: 18,
                borderRadius: 30,
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
                  flexWrap: 'wrap',
                  gap: 12,
                  alignItems: 'center',
                }}
              >
                <input
                  type="text"
                  inputMode="text"
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="Enter ticker / AAPL"
                  value={ticker}
                  onChange={(event) => {
                    setTicker(event.target.value.toUpperCase())
                    if (error) setError('')
                  }}
                  onKeyDown={handleKeyDown}
                  style={{
                    flex: '1 1 360px',
                    minWidth: 0,
                    borderRadius: 20,
                    border: '1px solid var(--border)',
                    background: 'var(--bg-elevated)',
                    color: 'var(--text)',
                    padding: '18px 20px',
                    fontSize: 16,
                    letterSpacing: '0.08em',
                    fontFamily: 'var(--font-dm-mono), monospace',
                    outline: 'none',
                    boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.02)',
                  }}
                />
                <button
                  type="button"
                  onClick={() => submitTicker(ticker)}
                  style={{
                    border: 'none',
                    borderRadius: 20,
                    padding: '18px 24px',
                    background: 'linear-gradient(135deg, var(--accent), #f7dd63)',
                    color: '#16120a',
                    fontSize: 14,
                    fontWeight: 800,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    boxShadow: '0 14px 30px rgba(243, 198, 35, 0.28)',
                  }}
                >
                  Analyze
                </button>
              </div>

              {error ? (
                <p
                  style={{
                    margin: '12px 4px 0',
                    color: 'var(--red)',
                    fontSize: 13,
                  }}
                >
                  {error}
                </p>
              ) : null}

              <div
                style={{
                  marginTop: 18,
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 8,
                  alignItems: 'center',
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    color: 'var(--text-dim)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.12em',
                  }}
                >
                  Quick picks
                </span>
                {QUICK_PICKS.map((pick) => (
                  <button
                    key={pick}
                    type="button"
                    onClick={() => submitTicker(pick)}
                    style={{
                      borderRadius: 999,
                      border: '1px solid var(--border)',
                      background: 'transparent',
                      color: 'var(--text)',
                      padding: '8px 13px',
                      cursor: 'pointer',
                      fontSize: 12,
                      fontFamily: 'var(--font-dm-mono), monospace',
                      letterSpacing: '0.12em',
                    }}
                  >
                    {pick}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gap: 16,
              alignContent: 'start',
            }}
          >
            <div
              style={{
                minHeight: 220,
                padding: '24px 22px',
                borderRadius: 28,
                border: '1px solid var(--border)',
                background:
                  'linear-gradient(145deg, rgba(111, 61, 244, 0.94), rgba(27, 18, 44, 0.98))',
                color: 'white',
                boxShadow: 'var(--shadow-strong)',
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  textTransform: 'uppercase',
                  letterSpacing: '0.16em',
                  color: 'rgba(255,255,255,0.65)',
                }}
              >
                Research Mode
              </div>
              <div
                style={{
                  marginTop: 18,
                  fontSize: 34,
                  lineHeight: 1,
                  letterSpacing: '-0.05em',
                  fontWeight: 700,
                }}
              >
                Think like an analyst.
                <br />
                Read like a human.
              </div>
              <p
                style={{
                  marginTop: 16,
                  color: 'rgba(255,255,255,0.74)',
                  lineHeight: 1.7,
                  fontSize: 14,
                }}
              >
                The interface stays restrained while the reasoning engine does
                the heavier work underneath.
              </p>
            </div>

            <div
              style={{
                display: 'grid',
                gap: 12,
                padding: '18px',
                borderRadius: 28,
                border: '1px solid var(--border)',
                background: 'var(--bg-card)',
                boxShadow: 'var(--shadow-soft)',
              }}
            >
              {[
                ['01', 'Instant ticker jump'],
                ['02', 'Structured investment framing'],
                ['03', 'Cloud-ready watchlist flow'],
              ].map(([index, label]) => (
                <div
                  key={index}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    padding: '14px 16px',
                    borderRadius: 18,
                    background: 'var(--bg-panel)',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--font-dm-mono), monospace',
                      fontSize: 12,
                      color: 'var(--purple)',
                      letterSpacing: '0.14em',
                    }}
                  >
                    {index}
                  </span>
                  <span
                    style={{
                      color: 'var(--text)',
                      fontSize: 14,
                      textAlign: 'right',
                    }}
                  >
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <p
          style={{
            maxWidth: 1220,
            margin: '18px auto 0',
            color: 'var(--text-dim)',
            fontSize: 12,
            lineHeight: 1.7,
          }}
        >
          For research and education only. Generated analysis is not investment
          advice and should be checked against primary filings and current
          market conditions.
        </p>
      </main>
    </>
  )
}
