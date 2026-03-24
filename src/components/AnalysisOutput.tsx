'use client'

import type { ResearchPosture } from '@/lib/tools'
import { ResearchPostureCard } from './ResearchPostureCard'

interface Props {
  streaming: boolean
  text: string
  posture: ResearchPosture | null
  toolCalls: string[]
}

const TOOL_LABELS: Record<string, string> = {
  getCompanyProfile: 'Looking up company in SEC EDGAR…',
  getFundamentals: 'Pulling fundamentals from Polygon.io…',
  getFinancials: 'Loading financial statements…',
  get_recent_filings: 'Reading 10-K & 10-Q SEC filings…',
  getNews: 'Scanning recent news & sentiment…',
  getQuote: 'Fetching live price data…',
  compareStocks: 'Fetching comparison data for both tickers…',
}

export function AnalysisOutput({ streaming, text, posture, toolCalls }: Props) {
  if (streaming && text === '' && toolCalls.length > 0) {
    return (
      <div style={styles.shell}>
        <p style={styles.eyebrow}>Gathering data</p>
        <div style={styles.toolList}>
          {toolCalls.map((name, i) => {
            const isLast = i === toolCalls.length - 1
            return (
              <div key={i} style={styles.toolRow}>
                <span
                  style={{
                    ...styles.toolDot,
                    background: isLast ? 'var(--accent)' : 'var(--purple)',
                    animation: isLast ? 'pulse 1.5s infinite' : undefined,
                  }}
                />
                <span
                  style={{
                    ...styles.toolLabel,
                    color: isLast ? 'var(--text)' : 'var(--text-muted)',
                  }}
                >
                  {TOOL_LABELS[name] ?? name}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  if (streaming && text !== '') {
    return (
      <div style={styles.shell}>
        <p style={styles.eyebrow}>Streaming analysis</p>
        <div style={styles.streamBox}>
          {text}
          <span style={styles.cursor}>▌</span>
        </div>
      </div>
    )
  }

  if (!streaming && posture) {
    return <ResearchPostureCard posture={posture} />
  }

  if (!streaming && text) {
    return (
      <div style={styles.shell}>
        <p style={styles.eyebrow}>Analysis transcript</p>
        <div style={styles.textBox}>{text}</div>
      </div>
    )
  }

  return null
}

const styles: Record<string, React.CSSProperties> = {
  shell: {
    background:
      'linear-gradient(180deg, color-mix(in srgb, var(--bg-card) 94%, transparent), color-mix(in srgb, var(--bg-panel) 94%, transparent))',
    border: '1px solid var(--border)',
    borderRadius: 28,
    padding: '22px 24px',
    boxShadow: 'var(--shadow-soft)',
    backdropFilter: 'blur(14px)',
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: 700,
    color: 'var(--purple)',
    margin: '0 0 14px',
    letterSpacing: '0.16em',
    textTransform: 'uppercase',
  },
  toolList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  toolRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '12px 14px',
    borderRadius: 16,
    border: '1px solid var(--border)',
    background: 'var(--bg-panel)',
  },
  toolDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    flexShrink: 0,
  },
  toolLabel: {
    fontSize: 13,
    fontFamily: 'var(--font-dm-mono, monospace)',
    lineHeight: 1.6,
  },
  streamBox: {
    whiteSpace: 'pre-wrap',
    fontFamily: 'var(--font-dm-mono, monospace)',
    fontSize: 13,
    color: 'var(--text-muted)',
    lineHeight: 1.8,
    padding: '16px 18px',
    borderRadius: 18,
    border: '1px solid var(--border)',
    background: 'var(--bg-panel)',
  },
  cursor: {
    color: 'var(--accent)',
    animation: 'pulse 1s infinite',
  },
  textBox: {
    whiteSpace: 'pre-wrap',
    fontSize: 14,
    color: 'var(--text-muted)',
    lineHeight: 1.8,
    padding: '16px 18px',
    borderRadius: 18,
    border: '1px solid var(--border)',
    background: 'var(--bg-panel)',
  },
}
