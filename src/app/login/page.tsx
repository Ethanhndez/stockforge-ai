import { Suspense } from 'react'
import Navbar from '@/components/Navbar'
import LoginForm from '@/app/login/LoginForm'

export default function LoginPage() {
  return (
    <>
      <Navbar />

      <main
        style={{
          maxWidth: 1120,
          margin: '0 auto',
          padding: '44px 24px 96px',
        }}
      >
        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 0.92fr) minmax(320px, 0.74fr)',
            gap: 24,
            alignItems: 'start',
          }}
        >
          <div
            style={{
              padding: '20px 6px 0 0',
            }}
          >
            <div
              style={{
                fontSize: 12,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: 'var(--purple-strong)',
                fontWeight: 700,
              }}
            >
              Phase 1 • Private Portfolio OS
            </div>
            <h1
              style={{
                margin: '14px 0 14px',
                fontSize: 'clamp(44px, 8vw, 82px)',
                lineHeight: 0.95,
                letterSpacing: '-0.08em',
                maxWidth: 760,
              }}
            >
              Account first. Portfolio next. Agent after that.
            </h1>
            <p
              style={{
                margin: 0,
                maxWidth: 700,
                color: 'var(--text-muted)',
                fontSize: 17,
                lineHeight: 1.8,
              }}
            >
              Sign in to your private portfolio operating system. This is where holdings,
              cash, targets, and future agent decisions start to become account-owned state
              instead of disconnected research sessions.
            </p>

            <div
              style={{
                display: 'grid',
                gap: 14,
                marginTop: 32,
              }}
            >
              {[
                [
                  'Own the portfolio state',
                  'Every holding, cash balance, and policy record is tied to an authenticated user and protected with RLS.',
                ],
                [
                  'Prepare for paper mode',
                  'Phase 1 creates the portfolio model the future policy, risk, and rebalance agents will reason over.',
                ],
                [
                  'Keep research in its place',
                  'Research stays valuable, but it now feeds the portfolio platform instead of acting as the product center.',
                ],
              ].map(([title, body]) => (
                <div
                  key={title}
                  style={{
                    padding: '18px 20px',
                    borderRadius: 24,
                    border: '1px solid var(--border)',
                    background:
                      'linear-gradient(160deg, color-mix(in srgb, var(--bg-card) 88%, rgba(111, 61, 244, 0.06)), color-mix(in srgb, var(--bg-panel) 92%, rgba(243, 198, 35, 0.05)))',
                    boxShadow: 'var(--shadow-soft)',
                  }}
                >
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: 'var(--text)',
                    }}
                  >
                    {title}
                  </div>
                  <p
                    style={{
                      margin: '8px 0 0',
                      color: 'var(--text-muted)',
                      fontSize: 14,
                      lineHeight: 1.75,
                    }}
                  >
                    {body}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <Suspense
            fallback={
              <div
                style={{
                  borderRadius: 30,
                  border: '1px solid var(--border)',
                  background:
                    'color-mix(in srgb, var(--bg-card) 92%, rgba(111, 61, 244, 0.06))',
                  boxShadow: 'var(--shadow-strong)',
                  padding: 28,
                  minHeight: 420,
                  display: 'grid',
                  placeItems: 'center',
                  color: 'var(--text-muted)',
                }}
              >
                Loading sign-in form...
              </div>
            }
          >
            <LoginForm />
          </Suspense>
        </section>
      </main>
    </>
  )
}
