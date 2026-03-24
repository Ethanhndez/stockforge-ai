// ============================================================
// src/components/AnalysisSection.tsx
// Client component — fetches AI analysis after page load
// Shows a research progress animation while Claude works
// ============================================================

'use client'

import { useEffect, useState } from 'react'

// ── Types ────────────────────────────────────────────────────

interface FinancialSnapshot {
  revenue: string
  netIncome: string
  operatingMargin: string
  totalAssets: string
  debtLoad: string
  cashPosition: string
  revenueGrowthNote?: string
  epsNote?: string
}

interface CaseAnalysis {
  headline: string
  points: string[]
  plainEnglish: string
}

interface ResearchPosture {
  bull_case: string
  bear_case: string
  key_risks: string[]
  data_gaps: string[]
}

interface Analysis {
  companyName: string
  ticker: string
  analysisDate: string
  executiveSummary: string
  analystBrief: string
  industryContext: string
  financialSnapshot: FinancialSnapshot
  bullCase: CaseAnalysis
  bearCase: CaseAnalysis
  keyRisks: string[]
  recentNewsImpact: string
  earningsQuality: string
  data_sources: string[]   // required — empty array is a guardrail violation
  researchPosture: ResearchPosture
}

// ── LoadingState subcomponent ────────────────────────────────
// Driven by real SSE progress events from the server

interface LoadingStateProps {
  steps: string[]      // live step labels received from SSE stream
  elapsed: number      // elapsed seconds, tracked by parent
}

function IdleState({
  ticker,
  onStart,
}: {
  ticker: string
  onStart: () => void
}) {
  return (
    <div style={styles.idleCard}>
      <div style={styles.loadingEyebrow}>PhD-level research available</div>
      <h3 style={styles.loadingTitle}>Start the full AI analyst workflow</h3>
      <p style={styles.loadingSubtitle}>
        You already have the quick price and fundamentals view. Run the deeper
        research layer when you want filing review, bull and bear framing, key
        risks, and analyst-style synthesis for {ticker}.
      </p>

      <div style={styles.idleBulletList}>
        <div style={styles.idleBullet}>SEC filings and recent news review</div>
        <div style={styles.idleBullet}>Bull case, bear case, and key risks</div>
        <div style={styles.idleBullet}>Plain-English summary plus deeper brief</div>
      </div>

      <button type="button" style={styles.startButton} onClick={onStart}>
        Run AI Analysis
      </button>
    </div>
  )
}

function LoadingState({ steps, elapsed }: LoadingStateProps) {
  return (
    <div style={styles.loadingCard}>
      <div style={styles.loadingEyebrow}>AI research stream</div>
      {/* Animated pulse ring */}
      <div style={styles.pulseRing}>
        <div style={styles.pulseInner}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"
              fill="var(--accent)"
            />
          </svg>
        </div>
      </div>

      <h3 style={styles.loadingTitle}>AI Research Agent Running</h3>
      <p style={styles.loadingSubtitle}>
        Reading SEC filings, financial statements &amp; live news
      </p>

      {/* Real-time step list — driven by SSE events */}
      <div style={styles.stepList}>
        {steps.map((label, i) => {
          const isDone = i < steps.length - 1
          const isActive = i === steps.length - 1
          return (
            <div key={i} style={styles.stepRow}>
              <span
                style={{
                  ...styles.stepIcon,
                  color: isDone
                    ? 'var(--green)'
                    : isActive
                    ? 'var(--accent)'
                    : 'var(--text-dim)',
                }}
              >
                {isDone ? '✓' : isActive ? '▸' : '○'}
              </span>
              <span
                style={{
                  ...styles.stepLabel,
                  color: isDone
                    ? 'var(--text-muted)'
                    : isActive
                    ? 'var(--text)'
                    : 'var(--text-dim)',
                  fontWeight: isActive ? 500 : 400,
                }}
              >
                {label}
              </span>
              {isActive && <span style={styles.spinner}>⟳</span>}
            </div>
          )
        })}
      </div>

      <p style={styles.elapsed}>
        {elapsed}s elapsed ·{' '}
        {elapsed >= 45
          ? 'Still working — SEC filings can take longer for some tickers…'
          : 'PhD-level analysis takes 45–90s'}
      </p>
    </div>
  )
}

// ── Main AnalysisSection component ──────────────────────────

export default function AnalysisSection({ ticker }: { ticker: string }) {
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [started, setStarted] = useState(false)
  const [liveSteps, setLiveSteps] = useState<string[]>([])
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!started) return

    const interval = setInterval(() => setElapsed((e) => e + 1), 1000)

    async function streamAnalysis() {
      setLoading(true)
      let completed = false

      try {
        const res = await fetch('/api/analysis', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ticker }),
        })

        // Guard: if server returned a non-stream response (e.g. 400/500 JSON)
        const contentType = res.headers.get('content-type') || ''
        if (!contentType.includes('text/event-stream')) {
          if (res.status === 404) {
            setError('API route not found (404). Restart the dev server.')
          } else {
            try {
              const json = await res.json()
              setError(json.error || `Server returned ${res.status}`)
            } catch {
              setError(`Server returned ${res.status}. Check terminal for errors.`)
            }
          }
          setLoading(false)
          clearInterval(interval)
          return
        }

        // ── Read the SSE stream ────────────────────────────
        const reader = res.body!.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })

          // SSE events are separated by double newlines
          const parts = buffer.split('\n\n')
          // Last part may be incomplete — keep it in the buffer
          buffer = parts.pop() ?? ''

          for (const part of parts) {
            const line = part.trim()
            if (!line.startsWith('data: ')) continue

            try {
              const event = JSON.parse(line.slice(6))

              if (event.type === 'progress') {
                if (event.done) {
                  continue
                }

                setLiveSteps((prev) => {
                  const nextStep = event.step as string
                  if (prev[prev.length - 1] === nextStep) {
                    return prev
                  }
                  return [...prev, nextStep]
                })
              } else if (event.type === 'complete') {
                completed = true
                setAnalysis(event.analysis as Analysis)
                setLoading(false)
                clearInterval(interval)
              } else if (event.type === 'error') {
                completed = true
                setError(event.error as string)
                setLoading(false)
                clearInterval(interval)
              }
            } catch {
              // Malformed SSE line — skip it
            }
          }
        }

        // Stream closed without a 'complete' or 'error' event
        if (!completed) {
          setError('Analysis stream closed unexpectedly. Please try again.')
          setLoading(false)
          clearInterval(interval)
        }
      } catch (e) {
        setError(`Fetch failed: ${String(e)}`)
        setLoading(false)
        clearInterval(interval)
      }
    }

    streamAnalysis()

    return () => clearInterval(interval)
  }, [started, ticker])

  if (!started) {
    return (
      <IdleState
        ticker={ticker}
        onStart={() => {
          setError(null)
          setAnalysis(null)
          setLiveSteps([])
          setElapsed(0)
          setLoading(true)
          setStarted(true)
        }}
      />
    )
  }

  if (loading) return <LoadingState steps={liveSteps} elapsed={elapsed} />

  if (error) {
    return (
      <div style={styles.errorCard}>
        <span style={{ fontSize: 28 }}>⚠</span>
        <h3 style={{ color: 'var(--red)', margin: '12px 0 0', fontSize: 18 }}>Analysis Error</h3>
        <p style={{ color: 'var(--text-muted)', margin: '8px 0 0', fontSize: 14 }}>{error}</p>
      </div>
    )
  }

  if (!analysis) return null

  const posture = analysis.researchPosture

  return (
    <div style={styles.analysisWrapper}>

      {/* ── Section header ─────────────────────────────────── */}
      <div style={styles.sectionHeader}>
        <span style={styles.sectionLabel}>AI RESEARCH ANALYSIS</span>
        <span style={styles.analysisDate}>Generated {analysis.analysisDate}</span>
      </div>

      {/* ── Executive Summary ──────────────────────────────── */}
      <div style={styles.card}>
        <p style={styles.execSummary}>{analysis.executiveSummary}</p>
        <div style={styles.industryTag}>
          <span style={styles.tagDot} />
          {analysis.industryContext}
        </div>
      </div>

      {/* ── Financial Snapshot ─────────────────────────────── */}
      <div style={styles.card}>
        <h3 style={styles.cardTitle}>Financial Snapshot</h3>
        <div style={styles.financialGrid}>
          <FinancialCell label="Revenue" value={analysis.financialSnapshot.revenue} />
          <FinancialCell label="Net Income" value={analysis.financialSnapshot.netIncome} />
          <FinancialCell label="Operating Margin" value={analysis.financialSnapshot.operatingMargin} accent />
          <FinancialCell label="Total Assets" value={analysis.financialSnapshot.totalAssets} />
          <FinancialCell label="Cash Position" value={analysis.financialSnapshot.cashPosition} />
          <FinancialCell label="EPS" value={analysis.financialSnapshot.epsNote || '—'} />
        </div>
        {analysis.financialSnapshot.debtLoad && (
          <div style={styles.debtNote}>
            <span style={styles.noteIcon}>◈</span>
            <span>{analysis.financialSnapshot.debtLoad}</span>
          </div>
        )}
      </div>

      {/* ── Bull / Bear cases ──────────────────────────────── */}
      <div style={styles.twoCol}>
        {/* Bull Case */}
        <div style={{ ...styles.caseCard, borderColor: 'var(--green)' }}>
          <div style={styles.caseHeader}>
            <span style={{ ...styles.caseBadge, background: 'var(--green-bg)', color: 'var(--green)' }}>
              ▲ BULL CASE
            </span>
            <span style={styles.caseHeadline}>{analysis.bullCase.headline}</span>
          </div>
          <ul style={styles.casePoints}>
            {analysis.bullCase.points.map((pt, i) => (
              <li key={i} style={styles.casePoint}>
                <span style={{ color: 'var(--green)', marginRight: 8 }}>+</span>
                {pt}
              </li>
            ))}
          </ul>
          <div style={styles.plainEnglishBox}>
            <span style={styles.plainLabel}>Plain English</span>
            <p style={styles.plainText}>{analysis.bullCase.plainEnglish}</p>
          </div>
        </div>

        {/* Bear Case */}
        <div style={{ ...styles.caseCard, borderColor: 'var(--red)' }}>
          <div style={styles.caseHeader}>
            <span style={{ ...styles.caseBadge, background: 'var(--red-bg)', color: 'var(--red)' }}>
              ▼ BEAR CASE
            </span>
            <span style={styles.caseHeadline}>{analysis.bearCase.headline}</span>
          </div>
          <ul style={styles.casePoints}>
            {analysis.bearCase.points.map((pt, i) => (
              <li key={i} style={styles.casePoint}>
                <span style={{ color: 'var(--red)', marginRight: 8 }}>−</span>
                {pt}
              </li>
            ))}
          </ul>
          <div style={styles.plainEnglishBox}>
            <span style={styles.plainLabel}>Plain English</span>
            <p style={styles.plainText}>{analysis.bearCase.plainEnglish}</p>
          </div>
        </div>
      </div>

      {/* ── Key Risks ──────────────────────────────────────── */}
      <div style={styles.card}>
        <h3 style={styles.cardTitle}>Key Risks</h3>
        <div style={styles.riskList}>
          {analysis.keyRisks.map((risk, i) => (
            <div key={i} style={styles.riskItem}>
              <span style={styles.riskNum}>{i + 1}</span>
              <span style={styles.riskText}>{risk}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── News Impact + Earnings Quality ─────────────────── */}
      <div style={styles.twoCol}>
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Recent News Impact</h3>
          <p style={styles.bodyText}>{analysis.recentNewsImpact}</p>
        </div>
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Earnings Quality</h3>
          <p style={styles.bodyText}>{analysis.earningsQuality}</p>
        </div>
      </div>

      {/* ── Research Summary ────────────────────────────────── */}
      <div style={styles.summaryCard}>
        <span style={styles.summaryLabel}>RESEARCH SUMMARY</span>

        <div style={styles.twoCol}>
          <div style={styles.summaryCase}>
            <span style={{ ...styles.caseBadge, background: 'var(--green-bg)', color: 'var(--green)' }}>
              ▲ BULL FACTORS
            </span>
            <p style={styles.summaryText}>{posture.bull_case}</p>
          </div>
          <div style={styles.summaryCase}>
            <span style={{ ...styles.caseBadge, background: 'var(--red-bg)', color: 'var(--red)' }}>
              ▼ BEAR FACTORS
            </span>
            <p style={styles.summaryText}>{posture.bear_case}</p>
          </div>
        </div>

        {posture.key_risks.length > 0 && (
          <div style={styles.summaryRisks}>
            <span style={styles.summarySubLabel}>Key Risks</span>
            <div style={styles.riskList}>
              {posture.key_risks.map((risk, i) => (
                <div key={i} style={styles.riskItem}>
                  <span style={styles.riskNum}>{i + 1}</span>
                  <span style={styles.riskText}>{risk}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {posture.data_gaps.length > 0 && (
          <div style={styles.dataGaps}>
            <span style={styles.summarySubLabel}>Data Gaps</span>
            <div style={styles.gapList}>
              {posture.data_gaps.map((gap, i) => (
                <div key={i} style={styles.gapItem}>
                  <span style={styles.gapIcon}>◌</span>
                  <span style={styles.riskText}>{gap}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Deep Dive (analyst brief) ──────────────────────── */}
      <details style={styles.deepDive}>
        <summary style={styles.deepDiveSummary}>
          ◈ Deep Dive — Technical Analyst Brief
          <span style={styles.deepDiveHint}>(for sophisticated investors)</span>
        </summary>
        <p style={styles.deepDiveText}>{analysis.analystBrief}</p>
      </details>

      {/* ── Data Sources Attribution ────────────────────────── */}
      {analysis.data_sources?.length > 0 && (
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Data Sources</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {analysis.data_sources.map((src, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <span style={{ color: 'var(--accent)', fontSize: 12, paddingTop: 2, flexShrink: 0 }}>◈</span>
                <span style={{ fontSize: 12, color: 'var(--text-dim)', fontFamily: 'var(--font-dm-mono, monospace)', lineHeight: 1.6 }}>
                  {src}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Disclaimer ─────────────────────────────────────── */}
      <p style={styles.disclaimer}>
        AI-generated research for informational purposes only. Not financial advice.
        Always verify with primary sources before making investment decisions.
      </p>
    </div>
  )
}

// ── FinancialCell helper ─────────────────────────────────────

function FinancialCell({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <div style={styles.finCell}>
      <span style={styles.finLabel}>{label}</span>
      <span
        style={{
          ...styles.finValue,
          color: accent ? 'var(--accent)' : 'var(--text)',
        }}
      >
        {value}
      </span>
    </div>
  )
}

// ============================================================
// Inline styles — mirrors the globals.css CSS variable system
// All colors use CSS variables so dark/light mode works
// ============================================================

const styles: Record<string, React.CSSProperties> = {
  idleCard: {
    background:
      'linear-gradient(180deg, color-mix(in srgb, var(--bg-card) 94%, transparent), color-mix(in srgb, var(--bg-panel) 92%, transparent))',
    border: '1px solid var(--border)',
    borderRadius: 30,
    padding: '34px 32px',
    marginTop: 24,
    boxShadow: 'var(--shadow-strong)',
    backdropFilter: 'blur(16px)',
  },
  idleBulletList: {
    display: 'grid',
    gap: 10,
    marginTop: 20,
    marginBottom: 22,
  },
  idleBullet: {
    padding: '12px 14px',
    borderRadius: 16,
    border: '1px solid var(--border)',
    background: 'var(--bg-panel)',
    color: 'var(--text-muted)',
    fontSize: 13,
    lineHeight: 1.6,
  },
  startButton: {
    border: 'none',
    borderRadius: 20,
    padding: '16px 20px',
    background: 'linear-gradient(135deg, var(--accent), #f7dd63)',
    color: '#16120a',
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: '0.12em',
    textTransform: 'uppercase' as const,
    cursor: 'pointer',
    boxShadow: '0 14px 30px rgba(243, 198, 35, 0.22)',
  },
  // Loading
  loadingCard: {
    background:
      'linear-gradient(180deg, color-mix(in srgb, var(--bg-card) 94%, transparent), color-mix(in srgb, var(--bg-panel) 92%, transparent))',
    border: '1px solid var(--border)',
    borderRadius: 30,
    padding: '44px 34px',
    textAlign: 'center',
    marginTop: 24,
    boxShadow: 'var(--shadow-strong)',
    backdropFilter: 'blur(16px)',
  },
  loadingEyebrow: {
    marginBottom: 18,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.16em',
    textTransform: 'uppercase' as const,
    color: 'var(--purple)',
  },
  pulseRing: {
    width: 78,
    height: 78,
    borderRadius: '50%',
    border: '1px solid color-mix(in srgb, var(--accent) 70%, white 10%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 22px',
    animation: 'pulse 2s infinite',
    boxShadow: '0 0 32px rgba(243, 198, 35, 0.18)',
    background:
      'radial-gradient(circle at center, rgba(243, 198, 35, 0.12), rgba(111, 61, 244, 0.1))',
  },
  pulseInner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingTitle: {
    fontSize: 22,
    fontWeight: 700,
    color: 'var(--text)',
    marginBottom: 8,
    letterSpacing: '-0.03em',
  },
  loadingSubtitle: {
    fontSize: 14,
    color: 'var(--text-muted)',
    marginBottom: 28,
    lineHeight: 1.7,
  },
  stepList: {
    textAlign: 'left',
    maxWidth: 440,
    margin: '0 auto 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  stepRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '11px 14px',
    borderRadius: 16,
    background: 'var(--bg-panel)',
    border: '1px solid var(--border)',
  },
  stepIcon: {
    fontFamily: 'var(--font-dm-mono, monospace)',
    fontSize: 13,
    width: 14,
    flexShrink: 0,
  },
  stepLabel: {
    fontSize: 13,
    flex: 1,
    lineHeight: 1.5,
  },
  spinner: {
    fontSize: 12,
    color: 'var(--purple)',
    animation: 'spin 1s linear infinite',
  },
  elapsed: {
    fontSize: 12,
    color: 'var(--text-dim)',
    marginTop: 16,
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
  },

  // Error
  errorCard: {
    background:
      'linear-gradient(180deg, color-mix(in srgb, var(--bg-card) 94%, transparent), color-mix(in srgb, var(--red-bg) 30%, transparent))',
    border: '1px solid var(--red)',
    borderRadius: 28,
    padding: 32,
    textAlign: 'center',
    marginTop: 24,
    boxShadow: 'var(--shadow-soft)',
  },

  // Wrapper
  analysisWrapper: {
    marginTop: 32,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },

  // Section header
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
    gap: 12,
    flexWrap: 'wrap',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.16em',
    color: 'var(--purple)',
    textTransform: 'uppercase' as const,
  },
  analysisDate: {
    fontSize: 12,
    color: 'var(--text-dim)',
    fontFamily: 'var(--font-dm-mono, monospace)',
  },

  // Generic card
  card: {
    background:
      'linear-gradient(180deg, color-mix(in srgb, var(--bg-card) 94%, transparent), color-mix(in srgb, var(--bg-panel) 94%, transparent))',
    border: '1px solid var(--border)',
    borderRadius: 28,
    padding: '24px',
    boxShadow: 'var(--shadow-soft)',
    backdropFilter: 'blur(14px)',
  },
  cardTitle: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.16em',
    color: 'var(--text-muted)',
    textTransform: 'uppercase' as const,
    marginBottom: 16,
  },

  // Executive summary
  execSummary: {
    fontSize: 17,
    lineHeight: 1.8,
    color: 'var(--text)',
    marginBottom: 14,
  },
  industryTag: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 13,
    color: 'var(--text-muted)',
    borderTop: '1px solid var(--border)',
    paddingTop: 14,
    marginTop: 4,
  },
  tagDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: 'var(--purple)',
    flexShrink: 0,
    boxShadow: '0 0 18px rgba(111, 61, 244, 0.35)',
  },

  // Financial snapshot
  financialGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: 16,
    marginBottom: 16,
  },
  finCell: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    background: 'var(--bg-panel)',
    borderRadius: 18,
    border: '1px solid var(--border)',
    padding: '12px 14px',
  },
  finLabel: {
    fontSize: 11,
    color: 'var(--text-dim)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
  },
  finValue: {
    fontSize: 15,
    fontWeight: 700,
    fontFamily: 'var(--font-dm-mono, monospace)',
    color: 'var(--text)',
  },
  debtNote: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    fontSize: 13,
    color: 'var(--text-muted)',
    background: 'var(--bg-panel)',
    borderRadius: 18,
    border: '1px solid var(--border)',
    padding: '10px 14px',
  },
  noteIcon: {
    color: 'var(--accent)',
    flexShrink: 0,
  },

  // Two-column layout
  twoCol: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: 16,
  },

  // Case cards
  caseCard: {
    background:
      'linear-gradient(180deg, color-mix(in srgb, var(--bg-card) 94%, transparent), color-mix(in srgb, var(--bg-panel) 94%, transparent))',
    border: '1px solid',
    borderRadius: 28,
    padding: 24,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    boxShadow: 'var(--shadow-soft)',
  },
  caseHeader: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  caseBadge: {
    display: 'inline-block',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.14em',
    padding: '6px 12px',
    borderRadius: 999,
    width: 'fit-content',
  },
  caseHeadline: {
    fontSize: 16,
    fontWeight: 700,
    color: 'var(--text)',
    letterSpacing: '-0.02em',
  },
  casePoints: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  casePoint: {
    fontSize: 13,
    lineHeight: 1.6,
    color: 'var(--text-muted)',
    display: 'flex',
    alignItems: 'flex-start',
  },
  plainEnglishBox: {
    background: 'var(--bg-panel)',
    borderRadius: 18,
    border: '1px solid var(--border)',
    padding: '12px 14px',
    marginTop: 4,
  },
  plainLabel: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.1em',
    color: 'var(--text-dim)',
    textTransform: 'uppercase' as const,
    display: 'block',
    marginBottom: 6,
  },
  plainText: {
    fontSize: 13,
    lineHeight: 1.65,
    color: 'var(--text-muted)',
  },

  // Risks
  riskList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  riskItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
  },
  riskNum: {
    width: 22,
    height: 22,
    borderRadius: '50%',
    background: 'var(--bg-panel)',
    border: '1px solid var(--border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--accent)',
    flexShrink: 0,
    fontFamily: 'var(--font-dm-mono, monospace)',
  },
  riskText: {
    fontSize: 13,
    lineHeight: 1.6,
    color: 'var(--text-muted)',
    paddingTop: 2,
  },

  // Body text
  bodyText: {
    fontSize: 13,
    lineHeight: 1.7,
    color: 'var(--text-muted)',
  },

  // Research Summary
  summaryCard: {
    background:
      'linear-gradient(145deg, rgba(111, 61, 244, 0.94), rgba(24, 18, 38, 0.98))',
    border: '1px solid var(--border)',
    borderRadius: 28,
    padding: 28,
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
    boxShadow: 'var(--shadow-strong)',
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.16em',
    color: 'rgba(255,255,255,0.62)',
    display: 'block',
  },
  summarySubLabel: {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.08em',
    color: 'rgba(255,255,255,0.6)',
    textTransform: 'uppercase' as const,
    display: 'block',
    marginBottom: 10,
  },
  summaryCase: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    padding: '16px 18px',
    borderRadius: 20,
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.08)',
  },
  summaryText: {
    fontSize: 13,
    lineHeight: 1.7,
    color: 'rgba(255,255,255,0.82)',
  },
  summaryRisks: {
    borderTop: '1px solid rgba(255,255,255,0.12)',
    paddingTop: 18,
  },
  dataGaps: {
    borderTop: '1px solid rgba(255,255,255,0.12)',
    paddingTop: 18,
  },
  gapList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  gapItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
  },
  gapIcon: {
    color: 'var(--text-dim)',
    fontSize: 14,
    flexShrink: 0,
    paddingTop: 1,
  },

  // Deep dive
  deepDive: {
    background:
      'linear-gradient(180deg, color-mix(in srgb, var(--bg-card) 94%, transparent), color-mix(in srgb, var(--bg-panel) 94%, transparent))',
    border: '1px solid var(--border)',
    borderRadius: 28,
    padding: '18px 24px',
    boxShadow: 'var(--shadow-soft)',
  },
  deepDiveSummary: {
    fontSize: 14,
    fontWeight: 700,
    color: 'var(--text)',
    cursor: 'pointer',
    userSelect: 'none' as const,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  deepDiveHint: {
    fontSize: 12,
    color: 'var(--text-dim)',
    fontWeight: 400,
  },
  deepDiveText: {
    fontSize: 13,
    lineHeight: 1.8,
    color: 'var(--text-muted)',
    marginTop: 16,
    borderTop: '1px solid var(--border)',
    paddingTop: 16,
  },

  // Disclaimer
  disclaimer: {
    fontSize: 12,
    color: 'var(--text-dim)',
    textAlign: 'center' as const,
    paddingTop: 8,
    paddingBottom: 16,
    lineHeight: 1.6,
  },
}
