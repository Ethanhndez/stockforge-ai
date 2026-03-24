'use client'

import { FormEvent, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type AuthMode = 'signin' | 'signup'

export default function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextPath = searchParams.get('next') || '/dashboard'

  const [mode, setMode] = useState<AuthMode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    setError(null)
    setMessage(null)

    const supabase = createClient()

    if (mode === 'signin') {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        setError(signInError.message)
        setIsSubmitting(false)
        return
      }

      router.replace(nextPath)
      router.refresh()
      return
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name.trim() || undefined,
        },
      },
    })

    if (signUpError) {
      setError(signUpError.message)
      setIsSubmitting(false)
      return
    }

    if (data.session) {
      router.replace(nextPath)
      router.refresh()
      return
    }

    setMessage('Account created. Check your email to confirm your session, then sign in.')
    setIsSubmitting(false)
  }

  return (
    <div
      style={{
        borderRadius: 30,
        border: '1px solid var(--border)',
        background: 'color-mix(in srgb, var(--bg-card) 92%, rgba(111, 61, 244, 0.06))',
        boxShadow: 'var(--shadow-strong)',
        padding: 28,
      }}
    >
      <div
        style={{
          display: 'inline-flex',
          gap: 10,
          padding: 6,
          borderRadius: 999,
          border: '1px solid var(--border)',
          background: 'var(--bg-panel)',
          marginBottom: 24,
        }}
      >
        {(['signin', 'signup'] as const).map((value) => {
          const active = value === mode
          return (
            <button
              key={value}
              type="button"
              onClick={() => {
                setMode(value)
                setError(null)
                setMessage(null)
              }}
              style={{
                border: 'none',
                borderRadius: 999,
                padding: '10px 16px',
                cursor: 'pointer',
                background: active
                  ? 'linear-gradient(135deg, rgba(243, 198, 35, 0.18), rgba(111, 61, 244, 0.24))'
                  : 'transparent',
                color: active ? 'var(--text)' : 'var(--text-muted)',
                fontWeight: 700,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                fontSize: 12,
              }}
            >
              {value === 'signin' ? 'Sign In' : 'Create Account'}
            </button>
          )
        })}
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 16 }}>
        {mode === 'signup' ? (
          <label style={{ display: 'grid', gap: 8 }}>
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: 'var(--text-dim)',
              }}
            >
              Name
            </span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ethan Hernandez"
              style={{
                borderRadius: 18,
                border: '1px solid var(--border)',
                background: 'var(--bg-panel)',
                color: 'var(--text)',
                padding: '14px 16px',
                fontSize: 15,
                outline: 'none',
              }}
            />
          </label>
        ) : null}

        <label style={{ display: 'grid', gap: 8 }}>
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--text-dim)',
            }}
          >
            Email
          </span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            placeholder="you@stockforge.ai"
            style={{
              borderRadius: 18,
              border: '1px solid var(--border)',
              background: 'var(--bg-panel)',
              color: 'var(--text)',
              padding: '14px 16px',
              fontSize: 15,
              outline: 'none',
            }}
          />
        </label>

        <label style={{ display: 'grid', gap: 8 }}>
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--text-dim)',
            }}
          >
            Password
          </span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={8}
            placeholder="Minimum 8 characters"
            style={{
              borderRadius: 18,
              border: '1px solid var(--border)',
              background: 'var(--bg-panel)',
              color: 'var(--text)',
              padding: '14px 16px',
              fontSize: 15,
              outline: 'none',
            }}
          />
        </label>

        {error ? (
          <p
            style={{
              margin: 0,
              padding: '12px 14px',
              borderRadius: 16,
              border: '1px solid color-mix(in srgb, var(--red) 35%, var(--border))',
              background: 'var(--red-bg)',
              color: 'var(--text)',
              fontSize: 14,
              lineHeight: 1.6,
            }}
          >
            {error}
          </p>
        ) : null}

        {message ? (
          <p
            style={{
              margin: 0,
              padding: '12px 14px',
              borderRadius: 16,
              border: '1px solid color-mix(in srgb, var(--green) 35%, var(--border))',
              background: 'var(--green-bg)',
              color: 'var(--text)',
              fontSize: 14,
              lineHeight: 1.6,
            }}
          >
            {message}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting}
          style={{
            marginTop: 8,
            border: 'none',
            borderRadius: 999,
            padding: '15px 20px',
            cursor: isSubmitting ? 'progress' : 'pointer',
            background: 'linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 60%, white))',
            color: '#101010',
            fontWeight: 800,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            fontSize: 12,
            boxShadow: '0 16px 40px rgba(243, 198, 35, 0.25)',
            opacity: isSubmitting ? 0.8 : 1,
          }}
        >
          {isSubmitting
            ? mode === 'signin'
              ? 'Signing In...'
              : 'Creating Account...'
            : mode === 'signin'
              ? 'Enter Portfolio OS'
              : 'Create Portfolio Account'}
        </button>
      </form>
    </div>
  )
}
