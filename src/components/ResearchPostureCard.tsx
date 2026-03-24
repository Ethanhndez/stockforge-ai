import type { ResearchPosture } from '@/lib/tools'

export function ResearchPostureCard({ posture }: { posture: ResearchPosture }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
          padding: '22px 24px',
          borderRadius: 26,
          border: '1px solid var(--border)',
          background:
            'linear-gradient(145deg, rgba(111, 61, 244, 0.94), rgba(24, 18, 38, 0.98))',
          boxShadow: 'var(--shadow-strong)',
          color: 'white',
        }}
      >
        <div>
          <div
            style={{
              fontSize: 11,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.62)',
            }}
          >
            Research Briefing
          </div>
          <h2
            style={{
              margin: '8px 0 0',
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: '-0.05em',
              color: 'white',
            }}
          >
            {posture.ticker}
          </h2>
        </div>
        <span
          style={{
            fontSize: 11,
            color: 'rgba(255,255,255,0.68)',
            fontFamily: 'var(--font-dm-mono, monospace)',
            textAlign: 'right',
          }}
        >
          {new Date(posture.fetchedAt).toLocaleString()}
        </span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 16,
        }}
      >
        <CaseSection label="Bull Case" content={posture.bull_case} color="green" icon="▲" />
        <CaseSection label="Bear Case" content={posture.bear_case} color="red" icon="▼" />
      </div>

      {posture.key_risks.length > 0 && (
        <div
          style={{
            background:
              'linear-gradient(180deg, color-mix(in srgb, var(--bg-card) 94%, transparent), color-mix(in srgb, var(--yellow-bg) 50%, transparent))',
            border: '1px solid var(--border)',
            borderRadius: 24,
            padding: 20,
            boxShadow: 'var(--shadow-soft)',
          }}
        >
          <h3
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.16em',
              color: 'var(--accent)',
              textTransform: 'uppercase',
              margin: '0 0 14px',
            }}
          >
            Key Risks
          </h3>
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            {posture.key_risks.map((risk, i) => (
              <li
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  color: 'var(--text-muted)',
                  lineHeight: 1.7,
                  fontSize: 14,
                }}
              >
                <span style={{ color: 'var(--accent)', flexShrink: 0 }}>{String(i + 1).padStart(2, '0')}</span>
                <span>{risk}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {posture.data_gaps.length > 0 && (
        <div
          style={{
            background:
              'linear-gradient(180deg, color-mix(in srgb, var(--bg-card) 94%, transparent), color-mix(in srgb, var(--bg-panel) 94%, transparent))',
            border: '1px solid var(--border)',
            borderRadius: 24,
            padding: 20,
            boxShadow: 'var(--shadow-soft)',
          }}
        >
          <h3
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.16em',
              color: 'var(--text-dim)',
              textTransform: 'uppercase',
              margin: '0 0 14px',
            }}
          >
            Data Gaps
          </h3>
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            {posture.data_gaps.map((gap, i) => (
              <li key={i} style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.7 }}>
                ◌ {gap}
              </li>
            ))}
          </ul>
        </div>
      )}

      {posture.rag_sources && posture.rag_sources.length > 0 && (
        <p style={{ fontSize: 11, color: 'var(--text-dim)', margin: 0 }}>
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
        background:
          'linear-gradient(180deg, color-mix(in srgb, var(--bg-card) 94%, transparent), color-mix(in srgb, var(--bg-panel) 94%, transparent))',
        border: `1px solid ${isGreen ? 'var(--green)' : 'var(--red)'}`,
        borderRadius: 24,
        padding: 20,
        boxShadow: 'var(--shadow-soft)',
      }}
    >
      <h3
        style={{
          display: 'inline-block',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.16em',
          color: isGreen ? 'var(--green)' : 'var(--red)',
          margin: 0,
          textTransform: 'uppercase',
        }}
      >
        {icon} {label}
      </h3>
      <p
        style={{
          margin: '14px 0 0',
          fontSize: 14,
          lineHeight: 1.8,
          color: 'var(--text-muted)',
        }}
      >
        {content}
      </p>
    </div>
  )
}
