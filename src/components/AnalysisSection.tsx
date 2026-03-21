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

function LoadingState({ steps, elapsed }: LoadingStateProps) {
  return (
    <div style={styles.loadingCard}>
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

      <p style={styles.elapsed}>{elapsed}s elapsed · PhD-level analysis takes 20–40s</p>
    </div>
  )
}

// ── Main AnalysisSection component ──────────────────────────

export default function AnalysisSection({ ticker }: { ticker: string }) {
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  // SSE-driven live steps — each entry is a step label as it arrives
  const [liveSteps, setLiveSteps] = useState<string[]>(['Starting AI research agent…'])
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    // Elapsed seconds counter — starts immediately so user sees time moving
    const interval = setInterval(() => setElapsed((e) => e + 1), 1000)

    async function streamAnalysis() {
      // Track whether a 'complete' or 'error' event was received.
      // Cannot use the loading React state here — closures capture the
      // initial value (true) and React state updates don't mutate it.
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
                setLiveSteps((prev) => [...prev, event.step as string])
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
  }, [ticker]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <LoadingState steps={liveSteps} elapsed={elapsed} />

  if (error) {
    return (
      <div style={styles.errorCard}>
        <span style={{ fontSize: 28 }}>⚠</span>
        <h3 style={{ color: 'var(--red)', marginTop: 12, fontSize: 16 }}>Analysis Error</h3>
        <p style={{ color: 'var(--text-muted)', marginTop: 8, fontSize: 14 }}>{error}</p>
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
  // Loading
  loadingCard: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: '40px 32px',
    textAlign: 'center',
    marginTop: 24,
  },
  pulseRing: {
    width: 64,
    height: 64,
    borderRadius: '50%',
    border: '2px solid var(--accent)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 20px',
    animation: 'pulse 2s infinite',
    boxShadow: '0 0 24px rgba(245,196,0,0.2)',
  },
  pulseInner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingTitle: {
    fontSize: 18,
    fontWeight: 600,
    color: 'var(--text)',
    marginBottom: 8,
  },
  loadingSubtitle: {
    fontSize: 13,
    color: 'var(--text-muted)',
    marginBottom: 28,
  },
  stepList: {
    textAlign: 'left',
    maxWidth: 360,
    margin: '0 auto 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  stepRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  stepIcon: {
    fontFamily: 'monospace',
    fontSize: 13,
    width: 14,
    flexShrink: 0,
  },
  stepLabel: {
    fontSize: 13,
    flex: 1,
  },
  spinner: {
    fontSize: 12,
    color: 'var(--accent)',
    animation: 'spin 1s linear infinite',
  },
  elapsed: {
    fontSize: 12,
    color: 'var(--text-dim)',
    marginTop: 16,
  },

  // Error
  errorCard: {
    background: 'var(--bg-card)',
    border: '1px solid var(--red)',
    borderRadius: 12,
    padding: 32,
    textAlign: 'center',
    marginTop: 24,
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
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.12em',
    color: 'var(--accent)',
  },
  analysisDate: {
    fontSize: 12,
    color: 'var(--text-dim)',
    fontFamily: 'var(--font-dm-mono, monospace)',
  },

  // Generic card
  card: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: '24px',
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: 600,
    letterSpacing: '0.06em',
    color: 'var(--text-muted)',
    textTransform: 'uppercase' as const,
    marginBottom: 16,
  },

  // Executive summary
  execSummary: {
    fontSize: 16,
    lineHeight: 1.7,
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
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: 'var(--purple)',
    flexShrink: 0,
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
    gap: 4,
    background: 'var(--bg-elevated)',
    borderRadius: 8,
    padding: '12px 14px',
  },
  finLabel: {
    fontSize: 11,
    color: 'var(--text-dim)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
  },
  finValue: {
    fontSize: 14,
    fontWeight: 600,
    fontFamily: 'var(--font-dm-mono, monospace)',
    color: 'var(--text)',
  },
  debtNote: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    fontSize: 13,
    color: 'var(--text-muted)',
    background: 'var(--bg-elevated)',
    borderRadius: 8,
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
    background: 'var(--bg-card)',
    border: '1px solid',
    borderRadius: 12,
    padding: 24,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
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
    letterSpacing: '0.1em',
    padding: '3px 10px',
    borderRadius: 4,
    width: 'fit-content',
  },
  caseHeadline: {
    fontSize: 16,
    fontWeight: 600,
    color: 'var(--text)',
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
    background: 'var(--bg-elevated)',
    borderRadius: 8,
    padding: '12px 14px',
    borderTop: '1px solid var(--border)',
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
    background: 'var(--bg-elevated)',
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
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: 28,
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.12em',
    color: 'var(--text-dim)',
    display: 'block',
  },
  summarySubLabel: {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.08em',
    color: 'var(--text-dim)',
    textTransform: 'uppercase' as const,
    display: 'block',
    marginBottom: 10,
  },
  summaryCase: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  summaryText: {
    fontSize: 13,
    lineHeight: 1.7,
    color: 'var(--text-muted)',
  },
  summaryRisks: {
    borderTop: '1px solid var(--border)',
    paddingTop: 18,
  },
  dataGaps: {
    borderTop: '1px solid var(--border)',
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
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: '18px 24px',
  },
  deepDiveSummary: {
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--text-muted)',
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
