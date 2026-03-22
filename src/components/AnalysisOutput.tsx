// ============================================================
// src/components/AnalysisOutput.tsx
// Switches between three states:
//   1. Tool-calling phase — shows which tools Claude is calling
//   2. Streaming phase   — shows tokens arriving in real time
//   3. Done phase        — renders ResearchPostureCard or raw text
// Wire this up with useStockAnalysis hook.
// ============================================================

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
  getCompanyProfile:  'Looking up company in SEC EDGAR…',
  getFundamentals:    'Pulling fundamentals from Polygon.io…',
  getFinancials:      'Loading financial statements…',
  get_recent_filings: 'Reading 10-K & 10-Q SEC filings…',
  getNews:            'Scanning recent news & sentiment…',
  getQuote:           'Fetching live price data…',
  compareStocks:      'Fetching comparison data for both tickers…',
}

export function AnalysisOutput({ streaming, text, posture, toolCalls }: Props) {
  // Phase 1: tools are being called, no text yet
  if (streaming && text === '' && toolCalls.length > 0) {
    return (
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: '24px 28px',
        }}
      >
        <p
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--text-muted)',
            marginBottom: 14,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}
        >
          Gathering data…
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {toolCalls.map((name, i) => {
            const isLast = i === toolCalls.length - 1
            return (
              <div
                key={i}
                style={{ display: 'flex', alignItems: 'center', gap: 10 }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: isLast ? 'var(--accent)' : 'var(--green)',
                    flexShrink: 0,
                    animation: isLast ? 'pulse 1.5s infinite' : undefined,
                  }}
                />
                <span
                  style={{
                    fontSize: 13,
                    color: isLast ? 'var(--text)' : 'var(--text-dim)',
                    fontFamily: 'var(--font-dm-mono, monospace)',
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

  // Phase 2: tokens streaming in
  if (streaming && text !== '') {
    return (
      <div
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: '20px 24px',
          whiteSpace: 'pre-wrap',
          fontFamily: 'var(--font-dm-mono, monospace)',
          fontSize: 13,
          color: 'var(--text-muted)',
          lineHeight: 1.7,
        }}
      >
        {text}
        <span style={{ color: 'var(--accent)', animation: 'pulse 1s infinite' }}>▌</span>
      </div>
    )
  }

  // Phase 3a: done with structured posture
  if (!streaming && posture) {
    return <ResearchPostureCard posture={posture} />
  }

  // Phase 3b: done with plain text (posture parse failed)
  if (!streaming && text) {
    return (
      <div
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: '20px 24px',
          whiteSpace: 'pre-wrap',
          fontSize: 13,
          color: 'var(--text-muted)',
          lineHeight: 1.7,
        }}
      >
        {text}
      </div>
    )
  }

  return null
}
