import Link from 'next/link'
import Navbar from '@/components/Navbar'

export default function NotFoundPage() {
  return (
    <>
      <Navbar />
      <main
        style={{
          minHeight: 'calc(100vh - 73px)',
          display: 'grid',
          placeItems: 'center',
          padding: '32px 24px 80px',
        }}
      >
        <section
          style={{
            width: '100%',
            maxWidth: 760,
            padding: '34px',
            borderRadius: 32,
            border: '1px solid var(--border)',
            background:
              'linear-gradient(180deg, color-mix(in srgb, var(--bg-card) 94%, transparent), color-mix(in srgb, var(--bg-panel) 94%, transparent))',
            boxShadow: 'var(--shadow-strong)',
            textAlign: 'center',
            animation: 'fadeIn 0.25s ease-out',
          }}
        >
          <div
            style={{
              fontSize: 11,
              letterSpacing: 'var(--type-eyebrow-tracking)',
              textTransform: 'uppercase',
              color: 'var(--purple)',
              fontWeight: 650,
            }}
          >
            Signal Lost
          </div>
          <h1
            style={{
              margin: '14px 0 10px',
              fontSize: 'clamp(44px, 8vw, 78px)',
              lineHeight: 'var(--type-display-line-height)',
              letterSpacing: 'var(--type-display-tracking)',
              fontWeight: 650,
            }}
          >
            Ticker not found.
          </h1>
          <p
            style={{
              margin: '0 auto',
              maxWidth: 520,
              color: 'var(--text-muted)',
              fontSize: 16,
              lineHeight: 'var(--type-body-line-height)',
            }}
          >
            The page you asked for doesn’t exist, or the symbol isn’t available
            in the current dataset.
          </p>

          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: 12,
              flexWrap: 'wrap',
              marginTop: 28,
            }}
          >
            <Link
              href="/"
              style={{
                padding: '14px 18px',
                borderRadius: 999,
                textDecoration: 'none',
                background: 'linear-gradient(135deg, var(--accent), #f7dd63)',
                color: '#121212',
                fontWeight: 800,
                fontSize: 12,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                boxShadow: '0 14px 28px rgba(243, 198, 35, 0.2)',
              }}
            >
              Return Home
            </Link>
            <Link
              href="/watchlist"
              style={{
                padding: '14px 18px',
                borderRadius: 999,
                textDecoration: 'none',
                border: '1px solid var(--border)',
                background: 'var(--bg-card)',
                color: 'var(--text)',
                fontWeight: 700,
                fontSize: 12,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                boxShadow: 'var(--shadow-soft)',
              }}
            >
              Open Watchlist
            </Link>
          </div>
        </section>
      </main>
    </>
  )
}
