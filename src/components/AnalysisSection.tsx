// ============================================================
// src/components/AnalysisSection.tsx
// Client component — fetches AI analysis after page load
// Shows a research progress animation while Claude works
// ============================================================

'use client'

import { useEffect, useState } from 'react'
import type {
  AnalysisDebugPayload,
  AnalysisExecutionPath,
  AnalysisFallbackReason,
  AnalysisQuality,
  AnalysisResponse,
} from '@/lib/ai/analysis-contract'

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
          ? 'Still working — transparency checks and SEC reads can take longer for some tickers…'
          : 'Research, validation, and source checks usually take 45–90s'}
      </p>
    </div>
  )
}

function qualityTone(quality: AnalysisQuality): {
  label: string
  color: string
  background: string
  description: string
} {
  switch (quality) {
    case 'complete':
      return {
        label: 'Complete',
        color: 'var(--green)',
        background: 'var(--green-bg)',
        description: 'No reported tool failures or material data gaps were carried into the final analysis.',
      }
    case 'degraded':
      return {
        label: 'Degraded',
        color: 'var(--accent)',
        background: 'color-mix(in srgb, var(--accent) 18%, transparent)',
        description: 'The analysis is valid, but some data gaps or tool degradation reduced coverage.',
      }
    case 'limited':
      return {
        label: 'Limited',
        color: 'var(--red)',
        background: 'var(--red-bg)',
        description: 'Fallback or missing support materially narrowed the evidence behind this report.',
      }
  }
}

function formatExecutionPath(path: AnalysisExecutionPath): string {
  return path === 'parallel' ? 'Parallel agents' : 'Legacy fallback'
}

function formatFallbackReason(reason: AnalysisFallbackReason | undefined): string {
  switch (reason) {
    case 'validation_failed':
      return 'Parallel output failed validation'
    case 'tool_failure':
      return 'A required source tool failed'
    case 'timeout':
      return 'Parallel path timed out'
    case 'parallel_error':
      return 'Parallel orchestration failed'
    default:
      return 'No fallback reason recorded'
  }
}

function TrustPanel({ debug }: { debug: AnalysisDebugPayload }) {
  const quality = qualityTone(debug.transparency.analysisQuality)
  const hasIssues =
    debug.transparency.missingData.length > 0 || debug.transparency.toolErrors.length > 0

  return (
    <div style={styles.trustCard}>
      <div style={styles.trustHeader}>
        <div>
          <span style={styles.sectionLabel}>Trust & Transparency</span>
          <p style={styles.trustIntro}>
            This panel shows how the analysis was produced, where coverage narrowed, and whether fallback logic was used.
          </p>
        </div>
        <span
          style={{
            ...styles.qualityBadge,
            color: quality.color,
            background: quality.background,
            borderColor: quality.color,
          }}
        >
          {quality.label} coverage
        </span>
      </div>

      <div style={styles.trustMetrics}>
        <div style={styles.trustMetricCard}>
          <span style={styles.trustMetricLabel}>Execution Path</span>
          <span style={styles.trustMetricValue}>{formatExecutionPath(debug.execution.path)}</span>
        </div>
        <div style={styles.trustMetricCard}>
          <span style={styles.trustMetricLabel}>Validation</span>
          <span style={styles.trustMetricValue}>
            {debug.execution.validationPassed ? 'Passed' : 'Failed'}
          </span>
        </div>
        <div style={styles.trustMetricCard}>
          <span style={styles.trustMetricLabel}>Sources Used</span>
          <span style={styles.trustMetricValue}>{debug.transparency.dataSourcesUsed.length}</span>
        </div>
        <div style={styles.trustMetricCard}>
          <span style={styles.trustMetricLabel}>Coverage Gaps</span>
          <span style={styles.trustMetricValue}>
            {debug.transparency.missingData.length + debug.transparency.toolErrors.length}
          </span>
        </div>
      </div>

      <div style={styles.trustStatus}>
        <span style={{ ...styles.statusDot, background: quality.color }} />
        <span style={styles.trustStatusText}>{quality.description}</span>
      </div>

      {debug.execution.path === 'fallback' && (
        <div style={styles.fallbackNotice}>
          <span style={styles.fallbackLabel}>Fallback Path</span>
          <span style={styles.fallbackText}>
            {formatFallbackReason(debug.execution.fallbackReason)}
          </span>
        </div>
      )}

      <div style={styles.trustColumns}>
        <div style={styles.trustListCard}>
          <h3 style={styles.cardTitle}>Missing Data</h3>
          {debug.transparency.missingData.length > 0 ? (
            <div style={styles.gapList}>
              {debug.transparency.missingData.map((gap, index) => (
                <div key={`${gap}-${index}`} style={styles.gapItem}>
                  <span style={styles.gapIcon}>◌</span>
                  <span style={styles.riskText}>{gap}</span>
                </div>
              ))}
            </div>
          ) : (
            <p style={styles.bodyText}>No explicit missing-data items were carried into the final report.</p>
          )}
        </div>

        <div style={styles.trustListCard}>
          <h3 style={styles.cardTitle}>Tool Degradation</h3>
          {debug.transparency.toolErrors.length > 0 ? (
            <div style={styles.gapList}>
              {debug.transparency.toolErrors.map((error, index) => (
                <div key={`${error}-${index}`} style={styles.gapItem}>
                  <span style={{ ...styles.gapIcon, color: 'var(--red)' }}>!</span>
                  <span style={styles.riskText}>{error}</span>
                </div>
              ))}
            </div>
          ) : (
            <p style={styles.bodyText}>No tool failures were surfaced in the sanitized execution summary.</p>
          )}
        </div>
      </div>

      <div style={styles.trustSources}>
        <h3 style={styles.cardTitle}>Grounded Sources</h3>
        {debug.transparency.dataSourcesUsed.length > 0 ? (
          <div style={styles.sourceChipGrid}>
            {debug.transparency.dataSourcesUsed.map((source) => (
              <span key={source} style={styles.sourceChip}>
                {source}
              </span>
            ))}
          </div>
        ) : (
          <p style={styles.bodyText}>No source list was captured for this analysis.</p>
        )}
      </div>

      {!hasIssues && (
        <p style={styles.trustFootnote}>
          Transparency details are available because this stock page requests debug coverage from the analysis route.
        </p>
      )}
    </div>
  )
}

function titleFromSourceCategory(source: string): string {
  const lower = source.toLowerCase()

  if (lower.includes('sec') || lower.includes('edgar') || lower.includes('10-k') || lower.includes('10-q') || lower.includes('8-k')) {
    return 'SEC & Filings'
  }

  if (lower.includes('news') || lower.includes('sentiment')) {
    return 'News & Sentiment'
  }

  if (
    lower.includes('polygon') ||
    lower.includes('quote') ||
    lower.includes('financials') ||
    lower.includes('market') ||
    lower.includes('ticker')
  ) {
    return 'Market Data'
  }

  if (lower.includes('rag') || lower.includes('supabase') || lower.includes('context')) {
    return 'Research Context'
  }

  return 'Analysis Inputs'
}

function groupDataSources(sources: string[]) {
  const grouped = new Map<string, string[]>()

  for (const source of sources) {
    const title = titleFromSourceCategory(source)
    const existing = grouped.get(title) ?? []
    existing.push(source)
    grouped.set(title, existing)
  }

  return Array.from(grouped.entries()).map(([title, entries]) => ({
    title,
    entries,
  }))
}

function MethodologySection({
  analysis,
  debug,
}: {
  analysis: AnalysisResponse
  debug?: AnalysisDebugPayload
}) {
  const compositionRows = [
    {
      label: 'Execution Path',
      value: formatExecutionPath(debug?.execution.path ?? 'fallback'),
      detail:
        debug?.execution.path === 'parallel'
          ? 'Parallel synthesis path'
          : 'Fallback-safe route',
      purpose: 'How the final report was assembled',
    },
    {
      label: 'Validation',
      value: debug?.execution.validationPassed ? 'Passed' : 'Pending / fallback',
      detail: `${analysis.data_sources.length} grounded sources`,
      purpose: 'Output contract and coverage checks',
    },
    {
      label: 'Coverage',
      value: debug ? qualityTone(debug.transparency.analysisQuality).label : 'Available',
      detail: `${debug?.transparency.missingData.length ?? 0} missing-data items`,
      purpose: 'Signal quality after tool execution',
    },
    {
      label: 'Gaps',
      value: `${analysis.researchPosture.data_gaps.length}`,
      detail: `${debug?.transparency.toolErrors.length ?? 0} tool issues`,
      purpose: 'Explicit unknowns carried into the report',
    },
  ]

  const methodologySteps = [
    {
      title: '1. Data Aggregation',
      body:
        'Quote data, company reference fields, filings context, and source metadata are assembled before synthesis.',
    },
    {
      title: '2. Structured Synthesis',
      body:
        'The report frames both upside and downside cases, then translates the findings into plain-English research output.',
    },
    {
      title: '3. Validation & Transparency',
      body:
        'Coverage gaps, fallback behavior, and grounded source lists are surfaced instead of being hidden or estimated away.',
    },
  ]

  const groupedSources = groupDataSources(
    debug?.transparency.dataSourcesUsed?.length
      ? debug.transparency.dataSourcesUsed
      : analysis.data_sources
  )

  return (
    <section style={styles.methodologySection}>
      <div style={styles.methodologyIntro}>
        <span style={styles.sectionLabel}>Transparency & Methodology</span>
        <h3 style={styles.methodologyTitle}>How this research page was built</h3>
        <p style={styles.methodologyCopy}>
          The interface presents the analysis as a clean investment memo, but
          the underlying report still shows where data came from, what was
          validated, and what remained incomplete.
        </p>
      </div>

      <div style={styles.compositionTable}>
        <div style={styles.compositionHeaderRow}>
          <span style={styles.compositionHeader}>Signal Layer</span>
          <span style={styles.compositionHeader}>Current State</span>
          <span style={styles.compositionHeader}>Detail</span>
          <span style={styles.compositionHeader}>Purpose</span>
        </div>
        {compositionRows.map((row) => (
          <div key={row.label} style={styles.compositionRow}>
            <span style={styles.compositionPrimary}>{row.label}</span>
            <span style={styles.compositionValue}>{row.value}</span>
            <span style={styles.compositionDetail}>{row.detail}</span>
            <span style={styles.compositionPurpose}>{row.purpose}</span>
          </div>
        ))}
      </div>

      <div style={styles.methodologyGrid}>
        {methodologySteps.map((step) => (
          <div key={step.title} style={styles.methodCard}>
            <h4 style={styles.methodCardTitle}>{step.title}</h4>
            <p style={styles.methodCardBody}>{step.body}</p>
          </div>
        ))}
      </div>

      {groupedSources.length > 0 ? (
        <div style={styles.sourceSection}>
          <h4 style={styles.sourceSectionTitle}>Data Sources</h4>
          <div style={styles.sourceCardGrid}>
            {groupedSources.map((group) => (
              <div key={group.title} style={styles.sourceCard}>
                <div style={styles.sourceCardHeader}>
                  <span style={styles.sourceCardTitle}>{group.title}</span>
                  <span style={styles.sourceCount}>{group.entries.length} items</span>
                </div>
                <div style={styles.sourceList}>
                  {group.entries.map((entry) => (
                    <div key={entry} style={styles.sourceListItem}>
                      <span style={styles.sourceBullet}>•</span>
                      <span style={styles.sourceListText}>{entry}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div style={styles.methodDisclaimer}>
        AI-generated research for informational purposes only. This page is a
        research workflow, not personalized investment advice. Verify material
        claims against primary filings and current market data.
      </div>
    </section>
  )
}

// ── Main AnalysisSection component ──────────────────────────

export default function AnalysisSection({ ticker }: { ticker: string }) {
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [started, setStarted] = useState(false)
  const [runNonce, setRunNonce] = useState(0)
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
          body: JSON.stringify({ ticker, includeDebug: true }),
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
                setAnalysis(event.analysis as AnalysisResponse)
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
  }, [runNonce, started, ticker])

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
          setRunNonce((value) => value + 1)
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
        <button
          type="button"
          style={{ ...styles.startButton, marginTop: 18 }}
          onClick={() => {
            setError(null)
            setAnalysis(null)
            setLiveSteps([])
            setElapsed(0)
            setLoading(true)
            setStarted(true)
            setRunNonce((value) => value + 1)
          }}
        >
          Retry Analysis
        </button>
      </div>
    )
  }

  if (!analysis) return null

  const posture = analysis.researchPosture
  const debug = analysis.debug
  const qualityBadge = debug
    ? qualityTone(debug.transparency.analysisQuality).label
    : 'Grounded'
  const hasRealtimeSource = analysis.data_sources.some((source) =>
    /polygon|quote|news|market/i.test(source)
  )

  return (
    <div style={styles.analysisWrapper}>
      <div style={styles.sectionHeader}>
        <div>
          <div style={styles.analysisTitleRow}>
            <div style={styles.analysisIcon}>✦</div>
            <div>
              <h2 style={styles.analysisTitle}>AI Investment Analysis</h2>
              <p style={styles.analysisSubtitle}>
                Multi-source synthesis shaped into a cleaner research memo for {ticker}.
              </p>
            </div>
          </div>

          <div style={styles.headerBadges}>
            <span style={styles.analysisStatusPill}>Verified Sources</span>
            {hasRealtimeSource ? (
              <span style={{ ...styles.analysisStatusPill, color: 'var(--purple)' }}>
                Real-time Data
              </span>
            ) : null}
            <span style={styles.analysisStatusPill}>{qualityBadge} Coverage</span>
          </div>
        </div>
        <span style={styles.analysisDate}>Generated {analysis.analysisDate}</span>
      </div>

      <div style={styles.summaryHero}>
        <div style={styles.signalCard}>
          <div style={styles.signalEyebrowRow}>
            <span style={styles.signalEyebrow}>Bullish Outlook</span>
            <span style={styles.signalCaption}>{analysis.bullCase.headline}</span>
          </div>
          <p style={styles.signalText}>{posture.bull_case}</p>
        </div>
        <div style={styles.signalCardSecondary}>
          <div style={styles.signalEyebrowRow}>
            <span style={styles.signalEyebrow}>Caution Areas</span>
            <span style={styles.signalCaption}>{analysis.bearCase.headline}</span>
          </div>
          <p style={styles.signalText}>{posture.bear_case}</p>
        </div>
      </div>

      <div style={styles.executiveCard}>
        <p style={styles.execSummary}>{analysis.executiveSummary}</p>
        <div style={styles.industryTag}>
          <span style={styles.tagDot} />
          {analysis.industryContext}
        </div>
      </div>

      <div style={styles.highlightGrid}>
        <div style={styles.highlightCard}>
          <span style={styles.highlightLabel}>Revenue</span>
          <span style={styles.highlightValue}>{analysis.financialSnapshot.revenue}</span>
          <span style={styles.highlightNote}>
            {analysis.financialSnapshot.revenueGrowthNote || 'Revenue growth detail unavailable.'}
          </span>
        </div>
        <div style={styles.highlightCard}>
          <span style={styles.highlightLabel}>Net Income</span>
          <span style={styles.highlightValue}>{analysis.financialSnapshot.netIncome}</span>
          <span style={styles.highlightNote}>{analysis.financialSnapshot.debtLoad}</span>
        </div>
        <div style={styles.highlightCard}>
          <span style={styles.highlightLabel}>Operating Margin</span>
          <span style={styles.highlightValue}>{analysis.financialSnapshot.operatingMargin}</span>
          <span style={styles.highlightNote}>
            Cash position {analysis.financialSnapshot.cashPosition}
          </span>
        </div>
        <div style={styles.highlightCard}>
          <span style={styles.highlightLabel}>EPS Context</span>
          <span style={styles.highlightValue}>
            {analysis.financialSnapshot.epsNote || 'Data unavailable'}
          </span>
          <span style={styles.highlightNote}>Total assets {analysis.financialSnapshot.totalAssets}</span>
        </div>
      </div>

      <div style={styles.sectionBlock}>
        <span style={styles.sectionLabel}>Key Investment Drivers</span>
        <div style={styles.longformList}>
          {analysis.bullCase.points.map((point, index) => (
            <div key={point} style={styles.longformRow}>
              <span style={styles.driverDot}>●</span>
              <div>
                <div style={styles.longformTitle}>
                  {index === 0 ? analysis.bullCase.headline : `Driver ${index + 1}`}
                </div>
                <p style={styles.longformText}>{point}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={styles.sectionDivider} />

      <div style={styles.sectionBlock}>
        <span style={styles.sectionLabel}>Key Risks To Monitor</span>
        <div style={styles.longformList}>
          {analysis.keyRisks.map((risk, index) => (
            <div key={risk} style={styles.longformRow}>
              <span style={styles.riskIcon}>△</span>
              <div>
                <div style={styles.longformTitle}>
                  {index === 0 ? analysis.bearCase.headline : `Risk ${index + 1}`}
                </div>
                <p style={styles.longformText}>{risk}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

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

      <div style={styles.summaryCard}>
        <span style={styles.summaryLabel}>Research Summary</span>

        <div style={styles.twoCol}>
          <div style={styles.summaryCase}>
            <span style={{ ...styles.caseBadge, background: 'var(--green-bg)', color: 'var(--green)' }}>
              ▲ Bull Factors
            </span>
            <p style={styles.summaryText}>{analysis.bullCase.plainEnglish}</p>
          </div>
          <div style={styles.summaryCase}>
            <span style={{ ...styles.caseBadge, background: 'var(--red-bg)', color: 'var(--red)' }}>
              ▼ Bear Factors
            </span>
            <p style={styles.summaryText}>{analysis.bearCase.plainEnglish}</p>
          </div>
        </div>

        {posture.data_gaps.length > 0 ? (
          <div style={styles.dataGaps}>
            <span style={styles.summarySubLabel}>Known Data Gaps</span>
            <div style={styles.gapList}>
              {posture.data_gaps.map((gap, i) => (
                <div key={i} style={styles.gapItem}>
                  <span style={styles.gapIcon}>◌</span>
                  <span style={styles.riskText}>{gap}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <details style={styles.deepDive}>
        <summary style={styles.deepDiveSummary}>
          ◈ Deep Dive — Technical Analyst Brief
          <span style={styles.deepDiveHint}>(for sophisticated investors)</span>
        </summary>
        <p style={styles.deepDiveText}>{analysis.analystBrief}</p>
      </details>

      <MethodologySection analysis={analysis} debug={debug} />

      {debug ? (
        <details style={styles.deepDive}>
          <summary style={styles.deepDiveSummary}>
            ◈ Execution Transparency
            <span style={styles.deepDiveHint}>(advanced diagnostics)</span>
          </summary>
          <div style={{ marginTop: 18 }}>
            <TrustPanel debug={debug} />
          </div>
        </details>
      ) : null}
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
  headerMeta: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  headerBadges: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
  },
  headerBadge: {
    padding: '7px 10px',
    borderRadius: 999,
    border: '1px solid var(--border)',
    background: 'var(--bg-panel)',
    color: 'var(--text-muted)',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
  },
  analysisDate: {
    fontSize: 12,
    color: 'var(--text-dim)',
    fontFamily: 'var(--font-dm-mono, monospace)',
  },
  analysisTitleRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 14,
  },
  analysisIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    display: 'grid',
    placeItems: 'center',
    background: 'color-mix(in srgb, var(--purple-soft) 88%, var(--bg-card))',
    color: 'var(--purple)',
    flexShrink: 0,
    fontSize: 16,
  },
  analysisTitle: {
    margin: 0,
    fontSize: 'clamp(28px, 4vw, 44px)',
    lineHeight: 'var(--type-title-line-height)',
    letterSpacing: 'var(--type-title-tracking)',
    fontWeight: 650,
    color: 'var(--text)',
  },
  analysisSubtitle: {
    margin: '6px 0 0',
    color: 'var(--text-muted)',
    fontSize: 15,
    lineHeight: 1.7,
  },
  analysisStatusPill: {
    padding: '8px 12px',
    borderRadius: 12,
    border: '1px solid var(--border)',
    background: 'var(--bg-panel)',
    color: 'var(--text-muted)',
    fontSize: 13,
    fontWeight: 600,
  },
  summaryHero: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: 16,
  },
  signalCard: {
    background:
      'linear-gradient(180deg, color-mix(in srgb, var(--bg-card) 96%, transparent), color-mix(in srgb, var(--green-bg) 18%, transparent))',
    border: '1px solid var(--border)',
    borderRadius: 28,
    padding: '24px',
    boxShadow: 'var(--shadow-soft)',
  },
  signalCardSecondary: {
    background:
      'linear-gradient(180deg, color-mix(in srgb, var(--bg-card) 96%, transparent), color-mix(in srgb, var(--red-bg) 16%, transparent))',
    border: '1px solid var(--border)',
    borderRadius: 28,
    padding: '24px',
    boxShadow: 'var(--shadow-soft)',
  },
  signalEyebrowRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 10,
    alignItems: 'center',
    marginBottom: 14,
  },
  signalEyebrow: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.16em',
    color: 'var(--text-muted)',
    textTransform: 'uppercase' as const,
  },
  signalCaption: {
    fontSize: 13,
    color: 'var(--text-dim)',
    fontWeight: 600,
  },
  signalText: {
    margin: 0,
    color: 'var(--text)',
    fontSize: 16,
    lineHeight: 1.75,
  },
  executiveCard: {
    background:
      'linear-gradient(180deg, color-mix(in srgb, var(--bg-card) 96%, transparent), color-mix(in srgb, var(--bg-panel) 94%, transparent))',
    border: '1px solid var(--border)',
    borderRadius: 28,
    padding: '24px',
    boxShadow: 'var(--shadow-soft)',
  },
  highlightGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 16,
  },
  highlightCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    padding: '22px',
    borderRadius: 24,
    border: '1px solid var(--border)',
    background: 'var(--bg-card)',
    boxShadow: 'var(--shadow-soft)',
  },
  highlightLabel: {
    fontSize: 11,
    color: 'var(--text-dim)',
    letterSpacing: 'var(--type-eyebrow-tracking)',
    textTransform: 'uppercase' as const,
    fontWeight: 650,
  },
  highlightValue: {
    fontSize: 26,
    color: 'var(--text)',
    lineHeight: 1.2,
    letterSpacing: '-0.03em',
    fontWeight: 650,
  },
  highlightNote: {
    fontSize: 13,
    color: 'var(--text-muted)',
    lineHeight: 1.7,
  },
  sectionBlock: {
    display: 'grid',
    gap: 18,
    paddingTop: 8,
  },
  longformList: {
    display: 'grid',
    gap: 24,
  },
  longformRow: {
    display: 'grid',
    gridTemplateColumns: '16px minmax(0, 1fr)',
    gap: 14,
    alignItems: 'flex-start',
  },
  driverDot: {
    color: 'var(--purple)',
    fontSize: 10,
    paddingTop: 10,
  },
  riskIcon: {
    color: 'var(--text-dim)',
    fontSize: 16,
    paddingTop: 4,
  },
  longformTitle: {
    fontSize: 18,
    lineHeight: 1.4,
    color: 'var(--text)',
    fontWeight: 650,
    marginBottom: 6,
    letterSpacing: '-0.02em',
  },
  longformText: {
    margin: 0,
    fontSize: 15,
    color: 'var(--text-muted)',
    lineHeight: 1.78,
  },
  sectionDivider: {
    height: 1,
    background: 'var(--border)',
    margin: '4px 0',
  },
  methodologySection: {
    display: 'grid',
    gap: 22,
    paddingTop: 10,
  },
  methodologyIntro: {
    display: 'grid',
    gap: 10,
  },
  methodologyTitle: {
    margin: 0,
    fontSize: 'clamp(28px, 4vw, 42px)',
    lineHeight: 'var(--type-title-line-height)',
    letterSpacing: 'var(--type-title-tracking)',
    fontWeight: 650,
    color: 'var(--text)',
  },
  methodologyCopy: {
    margin: 0,
    maxWidth: 760,
    fontSize: 15,
    color: 'var(--text-muted)',
    lineHeight: 1.75,
  },
  compositionTable: {
    border: '1px solid var(--border)',
    borderRadius: 24,
    overflow: 'hidden',
    background: 'var(--bg-card)',
    boxShadow: 'var(--shadow-soft)',
  },
  compositionHeaderRow: {
    display: 'grid',
    gridTemplateColumns: '1.2fr 1fr 1fr 1.2fr',
    gap: 16,
    padding: '14px 20px',
    background: 'var(--bg-panel)',
    borderBottom: '1px solid var(--border)',
  },
  compositionHeader: {
    fontSize: 11,
    color: 'var(--text-dim)',
    letterSpacing: 'var(--type-eyebrow-tracking)',
    textTransform: 'uppercase' as const,
    fontWeight: 650,
  },
  compositionRow: {
    display: 'grid',
    gridTemplateColumns: '1.2fr 1fr 1fr 1.2fr',
    gap: 16,
    padding: '18px 20px',
    borderBottom: '1px solid var(--border)',
    alignItems: 'center',
  },
  compositionPrimary: {
    fontSize: 15,
    fontWeight: 650,
    color: 'var(--text)',
  },
  compositionValue: {
    fontSize: 15,
    color: 'var(--text)',
    fontWeight: 600,
  },
  compositionDetail: {
    fontSize: 14,
    color: 'var(--text-muted)',
    lineHeight: 1.6,
  },
  compositionPurpose: {
    fontSize: 14,
    color: 'var(--text-muted)',
    lineHeight: 1.6,
  },
  methodologyGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: 16,
  },
  methodCard: {
    padding: '22px',
    borderRadius: 22,
    border: '1px solid var(--border)',
    background: 'var(--bg-card)',
    boxShadow: 'var(--shadow-soft)',
  },
  methodCardTitle: {
    margin: 0,
    color: 'var(--text)',
    fontSize: 16,
    fontWeight: 650,
    lineHeight: 1.5,
  },
  methodCardBody: {
    margin: '10px 0 0',
    color: 'var(--text-muted)',
    fontSize: 15,
    lineHeight: 1.75,
  },
  sourceSection: {
    display: 'grid',
    gap: 16,
  },
  sourceSectionTitle: {
    margin: 0,
    fontSize: 16,
    fontWeight: 650,
    color: 'var(--text)',
  },
  sourceCardGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: 14,
  },
  sourceCard: {
    padding: '18px',
    borderRadius: 22,
    border: '1px solid var(--border)',
    background: 'var(--bg-card)',
    boxShadow: 'var(--shadow-soft)',
    display: 'grid',
    gap: 12,
  },
  sourceCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'center',
  },
  sourceCardTitle: {
    fontSize: 17,
    fontWeight: 650,
    color: 'var(--text)',
  },
  sourceCount: {
    fontSize: 11,
    color: 'var(--purple)',
    fontWeight: 700,
    letterSpacing: '0.12em',
    textTransform: 'uppercase' as const,
  },
  sourceList: {
    display: 'grid',
    gap: 10,
  },
  sourceListItem: {
    display: 'grid',
    gridTemplateColumns: '10px minmax(0, 1fr)',
    gap: 8,
    alignItems: 'flex-start',
  },
  sourceBullet: {
    color: 'var(--text-dim)',
    fontSize: 14,
  },
  sourceListText: {
    fontSize: 13,
    color: 'var(--text-muted)',
    lineHeight: 1.7,
  },
  methodDisclaimer: {
    padding: '18px 20px',
    borderRadius: 18,
    border: '1px solid var(--border)',
    background: 'var(--bg-panel)',
    color: 'var(--text-muted)',
    fontSize: 14,
    lineHeight: 1.75,
  },

  trustCard: {
    background:
      'linear-gradient(180deg, color-mix(in srgb, var(--bg-card) 94%, transparent), color-mix(in srgb, var(--bg-panel) 94%, transparent))',
    border: '1px solid var(--border)',
    borderRadius: 28,
    padding: '24px',
    boxShadow: 'var(--shadow-soft)',
    backdropFilter: 'blur(14px)',
    display: 'flex',
    flexDirection: 'column',
    gap: 18,
  },
  trustHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
    flexWrap: 'wrap',
  },
  trustIntro: {
    margin: '8px 0 0',
    color: 'var(--text-muted)',
    fontSize: 14,
    lineHeight: 1.7,
    maxWidth: 720,
  },
  qualityBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '8px 12px',
    borderRadius: 999,
    border: '1px solid',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.14em',
    textTransform: 'uppercase' as const,
  },
  trustMetrics: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: 12,
  },
  trustMetricCard: {
    padding: '14px 16px',
    borderRadius: 20,
    border: '1px solid var(--border)',
    background: 'var(--bg-panel)',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  trustMetricLabel: {
    fontSize: 11,
    color: 'var(--text-dim)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.12em',
  },
  trustMetricValue: {
    fontSize: 16,
    fontWeight: 700,
    color: 'var(--text)',
    lineHeight: 1.4,
  },
  trustStatus: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '12px 14px',
    borderRadius: 18,
    background: 'var(--bg-panel)',
    border: '1px solid var(--border)',
  },
  statusDot: {
    width: 9,
    height: 9,
    borderRadius: '50%',
    flexShrink: 0,
  },
  trustStatusText: {
    fontSize: 13,
    lineHeight: 1.6,
    color: 'var(--text-muted)',
  },
  fallbackNotice: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
    padding: '12px 14px',
    borderRadius: 18,
    background: 'color-mix(in srgb, var(--red-bg) 70%, transparent)',
    border: '1px solid color-mix(in srgb, var(--red) 45%, var(--border))',
  },
  fallbackLabel: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.12em',
    textTransform: 'uppercase' as const,
    color: 'var(--red)',
  },
  fallbackText: {
    fontSize: 13,
    color: 'var(--text-muted)',
    lineHeight: 1.6,
  },
  trustColumns: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: 16,
  },
  trustListCard: {
    padding: '20px',
    borderRadius: 24,
    border: '1px solid var(--border)',
    background: 'var(--bg-panel)',
  },
  trustSources: {
    borderTop: '1px solid var(--border)',
    paddingTop: 18,
  },
  sourceChipGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 10,
  },
  sourceChip: {
    padding: '10px 12px',
    borderRadius: 16,
    border: '1px solid var(--border)',
    background: 'var(--bg-panel)',
    color: 'var(--text-muted)',
    fontSize: 12,
    lineHeight: 1.6,
    fontFamily: 'var(--font-dm-mono, monospace)',
  },
  trustFootnote: {
    margin: 0,
    fontSize: 12,
    lineHeight: 1.6,
    color: 'var(--text-dim)',
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
