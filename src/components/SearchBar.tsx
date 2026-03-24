'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

interface SearchResult {
  ticker: string
  name: string
  exchange: string
}

export default function SearchBar() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (!query.trim()) {
      setResults([])
      setIsOpen(false)
      return
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
        const data = await res.json()
        setResults(data.results ?? [])
        setIsOpen(true)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const goToStock = (ticker: string) => {
    setIsOpen(false)
    setQuery(ticker)
    router.push(`/stock/${ticker}`)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (results.length > 0) {
        goToStock(results[0].ticker)
      } else if (query.trim()) {
        goToStock(query.trim().toUpperCase())
      }
    }
  }

  return (
    <div
      ref={wrapperRef}
      style={{
        position: 'relative',
        maxWidth: 620,
        margin: '0 auto 16px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          background:
            'linear-gradient(180deg, color-mix(in srgb, var(--bg-card) 94%, transparent), color-mix(in srgb, var(--bg-panel) 94%, transparent))',
          border: `1px solid ${isOpen && results.length > 0 ? 'var(--purple)' : 'var(--border)'}`,
          borderRadius: isOpen && results.length > 0 ? '24px 24px 0 0' : '24px',
          padding: '10px 10px 10px 18px',
          gap: 10,
          boxShadow: 'var(--shadow-strong)',
          backdropFilter: 'blur(14px)',
          transition: 'border-color 0.2s ease',
        }}
      >
        <span
          style={{
            color: loading ? 'var(--purple)' : 'var(--text-dim)',
            fontSize: 18,
            flexShrink: 0,
          }}
        >
          {loading ? '◌' : '⌕'}
        </span>
        <input
          type="text"
          placeholder="Search ticker or company / Apple / TSLA"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          style={{
            flex: 1,
            border: 'none',
            background: 'transparent',
            color: 'var(--text)',
            outline: 'none',
            fontSize: 14,
            fontFamily: 'var(--font-dm-mono), monospace',
            letterSpacing: '0.06em',
          }}
        />
        <button
          type="button"
          onClick={() =>
            results.length > 0
              ? goToStock(results[0].ticker)
              : goToStock(query.trim().toUpperCase())
          }
          style={{
            background: 'linear-gradient(135deg, var(--accent), #f7dd63)',
            color: '#000',
            border: 'none',
            padding: '12px 18px',
            borderRadius: 18,
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            flexShrink: 0,
            boxShadow: '0 14px 28px rgba(243, 198, 35, 0.2)',
          }}
        >
          Analyze
        </button>
      </div>

      {isOpen && results.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            background:
              'linear-gradient(180deg, color-mix(in srgb, var(--bg-card) 94%, transparent), color-mix(in srgb, var(--bg-panel) 94%, transparent))',
            border: '1px solid var(--purple)',
            borderTop: 'none',
            borderRadius: '0 0 24px 24px',
            zIndex: 50,
            overflow: 'hidden',
            boxShadow: 'var(--shadow-strong)',
            backdropFilter: 'blur(14px)',
          }}
        >
          {results.map((result, i) => (
            <div
              key={result.ticker}
              onClick={() => goToStock(result.ticker)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 14,
                padding: '14px 16px',
                cursor: 'pointer',
                borderTop: i > 0 ? '1px solid var(--border)' : 'none',
                transition: 'background 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--purple-soft)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                <span
                  style={{
                    background: 'linear-gradient(135deg, var(--accent), #f7dd63)',
                    color: '#000',
                    padding: '4px 10px',
                    borderRadius: 999,
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.14em',
                    fontFamily: 'var(--font-dm-mono), monospace',
                    minWidth: 58,
                    textAlign: 'center',
                    flexShrink: 0,
                  }}
                >
                  {result.ticker}
                </span>
                <span
                  style={{
                    fontSize: 13,
                    color: 'var(--text-muted)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {result.name}
                </span>
              </div>
              <span
                style={{
                  fontSize: 10,
                  color: 'var(--text-dim)',
                  fontFamily: 'var(--font-dm-mono), monospace',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  flexShrink: 0,
                }}
              >
                {result.exchange}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
