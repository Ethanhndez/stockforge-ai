'use client'

import { useSyncExternalStore } from 'react'
import { createClient } from '@/lib/supabase/client'

const WATCHLIST_STORAGE_KEY = 'stockforge.watchlist'
const WATCHLIST_EVENT = 'stockforge:watchlist-change'
const EMPTY_WATCHLIST: string[] = []

let cachedRawWatchlist: string | null = null
let cachedLocalWatchlist: string[] = EMPTY_WATCHLIST
let cachedRemoteWatchlist: string[] = EMPTY_WATCHLIST
let watchlistMode: 'local' | 'remote' = 'local'
let activeUserId: string | null = null
let remoteLoadPromise: Promise<void> | null = null
let authSubscriptionReady = false

const listeners = new Set<() => void>()

function emitWatchlistChange() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(WATCHLIST_EVENT))
  }
  listeners.forEach((listener) => listener())
}

function normalizeTickers(tickers: string[]) {
  return [...new Set(tickers.map((ticker) => ticker.toUpperCase().trim()).filter(Boolean))]
}

function getServerWatchlistSnapshot(): string[] {
  return EMPTY_WATCHLIST
}

function readLocalWatchlist(): string[] {
  if (typeof window === 'undefined') return EMPTY_WATCHLIST

  try {
    const raw = window.localStorage.getItem(WATCHLIST_STORAGE_KEY)
    if (!raw) {
      cachedRawWatchlist = null
      cachedLocalWatchlist = EMPTY_WATCHLIST
      return cachedLocalWatchlist
    }

    if (raw === cachedRawWatchlist) {
      return cachedLocalWatchlist
    }

    const parsed = JSON.parse(raw)
    const normalized = Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === 'string')
      : EMPTY_WATCHLIST

    cachedRawWatchlist = raw
    cachedLocalWatchlist = normalizeTickers(normalized)
    return cachedLocalWatchlist
  } catch {
    cachedRawWatchlist = null
    cachedLocalWatchlist = EMPTY_WATCHLIST
    return cachedLocalWatchlist
  }
}

function writeLocalWatchlist(tickers: string[]) {
  const nextTickers = normalizeTickers(tickers)
  const raw = JSON.stringify(nextTickers)
  window.localStorage.setItem(WATCHLIST_STORAGE_KEY, raw)
  cachedRawWatchlist = raw
  cachedLocalWatchlist = nextTickers
  watchlistMode = 'local'
  emitWatchlistChange()
}

async function ensureRemoteWatchlistPortfolio(userId: string) {
  const supabase = createClient()

  const { data: existing, error: existingError } = await supabase
    .from('portfolios')
    .select('id')
    .eq('user_id', userId)
    .eq('portfolio_type', 'watchlist')
    .is('archived_at', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle<{ id: string }>()

  if (existingError) {
    throw new Error(existingError.message)
  }

  if (existing) return existing.id

  const { data: created, error: createError } = await supabase
    .from('portfolios')
    .insert({
      user_id: userId,
      name: 'Watchlist',
      portfolio_type: 'watchlist',
    })
    .select('id')
    .single<{ id: string }>()

  if (createError || !created) {
    throw new Error(createError?.message ?? 'Failed to create watchlist portfolio.')
  }

  return created.id
}

async function migrateLocalWatchlistToRemote(userId: string, portfolioId: string) {
  const localTickers = readLocalWatchlist()
  if (localTickers.length === 0) return

  const supabase = createClient()
  const { data: existingRows, error: rowsError } = await supabase
    .from('holdings')
    .select('ticker')
    .eq('portfolio_id', portfolioId)
    .eq('user_id', userId)
    .is('archived_at', null)
    .returns<Array<{ ticker: string }>>()

  if (rowsError) {
    throw new Error(rowsError.message)
  }

  const existingTickers = new Set((existingRows ?? []).map((row) => row.ticker))
  const missingTickers = localTickers.filter((ticker) => !existingTickers.has(ticker))

  if (missingTickers.length > 0) {
    const { error: insertError } = await supabase.from('holdings').insert(
      missingTickers.map((ticker) => ({
        portfolio_id: portfolioId,
        user_id: userId,
        ticker,
        shares: 0,
        cost_basis: null,
      }))
    )

    if (insertError) {
      throw new Error(insertError.message)
    }
  }

  window.localStorage.removeItem(WATCHLIST_STORAGE_KEY)
  cachedRawWatchlist = null
  cachedLocalWatchlist = EMPTY_WATCHLIST
}

async function loadRemoteWatchlist(force = false) {
  if (typeof window === 'undefined') return

  if (!force && remoteLoadPromise) {
    await remoteLoadPromise
    return
  }

  remoteLoadPromise = (async () => {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      activeUserId = null
      watchlistMode = 'local'
      cachedRemoteWatchlist = EMPTY_WATCHLIST
      emitWatchlistChange()
      return
    }

    const portfolioId = await ensureRemoteWatchlistPortfolio(user.id)
    await migrateLocalWatchlistToRemote(user.id, portfolioId)

    const { data: rows, error } = await supabase
      .from('holdings')
      .select('ticker')
      .eq('portfolio_id', portfolioId)
      .eq('user_id', user.id)
      .is('archived_at', null)
      .order('ticker', { ascending: true })
      .returns<Array<{ ticker: string }>>()

    if (error) {
      throw new Error(error.message)
    }

    activeUserId = user.id
    watchlistMode = 'remote'
    cachedRemoteWatchlist = normalizeTickers((rows ?? []).map((row) => row.ticker))
    emitWatchlistChange()
  })()

  try {
    await remoteLoadPromise
  } finally {
    remoteLoadPromise = null
  }
}

function ensureAuthSubscription() {
  if (typeof window === 'undefined' || authSubscriptionReady) return

  authSubscriptionReady = true
  const supabase = createClient()
  supabase.auth.onAuthStateChange(() => {
    void loadRemoteWatchlist(true)
  })
}

export function subscribeToWatchlist(onStoreChange: () => void) {
  if (typeof window === 'undefined') {
    return () => undefined
  }

  const handleChange = () => onStoreChange()
  listeners.add(handleChange)
  window.addEventListener('storage', handleChange)
  window.addEventListener(WATCHLIST_EVENT, handleChange)
  ensureAuthSubscription()
  void loadRemoteWatchlist()

  return () => {
    listeners.delete(handleChange)
    window.removeEventListener('storage', handleChange)
    window.removeEventListener(WATCHLIST_EVENT, handleChange)
  }
}

export function getWatchlist(): string[] {
  if (watchlistMode === 'remote' && activeUserId) {
    return cachedRemoteWatchlist
  }

  return readLocalWatchlist()
}

export async function addToWatchlist(ticker: string) {
  const normalizedTicker = ticker.toUpperCase().trim()
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    const watchlist = readLocalWatchlist()
    if (watchlist.includes(normalizedTicker)) return
    writeLocalWatchlist([...watchlist, normalizedTicker])
    return
  }

  const portfolioId = await ensureRemoteWatchlistPortfolio(user.id)
  const { data: existing, error: existingError } = await supabase
    .from('holdings')
    .select('id')
    .eq('portfolio_id', portfolioId)
    .eq('user_id', user.id)
    .eq('ticker', normalizedTicker)
    .maybeSingle<{ id: string }>()

  if (existingError) {
    throw new Error(existingError.message)
  }

  const mutation = existing
    ? supabase
        .from('holdings')
        .update({ archived_at: null, shares: 0, cost_basis: null })
        .eq('id', existing.id)
    : supabase.from('holdings').insert({
        portfolio_id: portfolioId,
        user_id: user.id,
        ticker: normalizedTicker,
        shares: 0,
        cost_basis: null,
      })

  const { error: mutationError } = await mutation
  if (mutationError) {
    throw new Error(mutationError.message)
  }

  cachedRemoteWatchlist = normalizeTickers([...cachedRemoteWatchlist, normalizedTicker])
  watchlistMode = 'remote'
  activeUserId = user.id
  emitWatchlistChange()
}

export async function removeFromWatchlist(ticker: string) {
  const normalizedTicker = ticker.toUpperCase().trim()
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    const nextTickers = readLocalWatchlist().filter((savedTicker) => savedTicker !== normalizedTicker)
    writeLocalWatchlist(nextTickers)
    return
  }

  const portfolioId = await ensureRemoteWatchlistPortfolio(user.id)
  const { error } = await supabase
    .from('holdings')
    .update({ archived_at: new Date().toISOString() })
    .eq('portfolio_id', portfolioId)
    .eq('user_id', user.id)
    .eq('ticker', normalizedTicker)

  if (error) {
    throw new Error(error.message)
  }

  cachedRemoteWatchlist = cachedRemoteWatchlist.filter(
    (savedTicker) => savedTicker !== normalizedTicker
  )
  watchlistMode = 'remote'
  activeUserId = user.id
  emitWatchlistChange()
}

export default function WatchlistButton({ ticker }: { ticker: string }) {
  const watchlist = useSyncExternalStore(
    subscribeToWatchlist,
    getWatchlist,
    getServerWatchlistSnapshot
  )
  const normalizedTicker = ticker.toUpperCase()
  const isSaved = watchlist.includes(normalizedTicker)

  return (
    <button
      type="button"
      aria-pressed={isSaved}
      style={{
        padding: '11px 16px',
        borderRadius: 999,
        background: isSaved
          ? 'linear-gradient(135deg, var(--yellow-bg), rgba(111, 61, 244, 0.08))'
          : 'var(--bg-card)',
        border: `1px solid ${isSaved ? 'var(--accent)' : 'var(--border)'}`,
        color: isSaved ? 'var(--text)' : 'var(--text-muted)',
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        cursor: 'pointer',
        boxShadow: 'var(--shadow-soft)',
      }}
      onClick={() => {
        void (isSaved
          ? removeFromWatchlist(normalizedTicker)
          : addToWatchlist(normalizedTicker))
      }}
    >
      {isSaved ? '✓ Watchlisted' : '+ Watchlist'}
    </button>
  )
}
