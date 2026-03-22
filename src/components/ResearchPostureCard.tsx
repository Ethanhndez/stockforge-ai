// ============================================================
// src/components/ResearchPostureCard.tsx
// Renders a ResearchPosture object from /api/analysis/stream.
// Used with useStockAnalysis hook. Lightweight alternative to
// the full AnalysisSection — shows posture fields only.
// ============================================================

import type { ResearchPosture } from '@/lib/tools'

export function ResearchPostureCard({ posture }: { posture: ResearchPosture }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border)',
          paddingBottom: 16,
        }}
      >
        <h2
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: 'var(--text)',
            fontFamily: 'var(--font-dm-mono, monospace)',
          }}
        >
          {posture.ticker} Research Briefing
        </h2>
        <span style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-dm-mono, monospace)' }}>
          {new Date(posture.fetchedAt).toLocaleString()}
        </span>
      </div>

      {/* Bull Case */}
      <CaseSection
        label="Bull Case"
        content={posture.bull_case}
        color="green"
        icon="▲"
      />

      {/* Bear Case */}
      <CaseSection
        label="Bear Case"
        content={posture.bear_case}
        color="red"
        icon="▼"
      />

      {/* Key Risks */}
      {posture.key_risks.length > 0 && (
        <div
          style={{
            background: 'var(--yellow-bg, #fefce8)',
            border: '1px solid var(--yellow-border, #fde68a)',
            borderRadius: 10,
            padding: 16,
          }}
        >
          <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--yellow-text, #92400e)', marginBottom: 10 }}>
            ⚠ Key Risks
          </h3>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {posture.key_risks.map((risk, i) => (
              <li key={i} style={{ fontSize: 13, color: 'var(--yellow-text, #92400e)' }}>
                • {risk}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Data Gaps */}
      {posture.data_gaps.length > 0 && (
        <div
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            padding: 16,
          }}
        >
          <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 10 }}>
            ◌ Data Gaps
          </h3>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {posture.data_gaps.map((gap, i) => (
              <li key={i} style={{ fontSize: 13, color: 'var(--text-dim)' }}>
                ○ {gap}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* RAG sources */}
      {posture.rag_sources && posture.rag_sources.length > 0 && (
        <p style={{ fontSize: 11, color: 'var(--text-dim)' }}>
          Research basis: {posture.rag_sources.join(', ')}
        </p>
      )}
    </div>
  )
}

function CaseSection({
  label,
  content,
  color,
  icon,
}: {
  label: string
  content: string
  color: 'green' | 'red'
  icon: string
}) {
  const isGreen = color === 'green'
  return (
    <div
      style={{
        background: isGreen ? 'var(--green-bg)' : 'var(--red-bg)',
        border: `1px solid ${isGreen ? 'var(--green)' : 'var(--red)'}`,
        borderRadius: 10,
        padding: 16,
      }}
    >
      <h3
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: isGreen ? 'var(--green)' : 'var(--red)',
          marginBottom: 8,
        }}
      >
        {icon} {label}
      </h3>
      <p
        style={{
          fontSize: 13,
          lineHeight: 1.7,
          color: isGreen ? 'var(--green-text, #14532d)' : 'var(--red-text, #7f1d1d)',
        }}
      >
        {content}
      </p>
    </div>
  )
}
