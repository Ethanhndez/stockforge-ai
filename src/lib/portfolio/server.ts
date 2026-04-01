import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type {
  CashBalanceRecord,
  HoldingRecord,
  PortfolioDashboardData,
  PortfolioDashboardHolding,
  PortfolioRecord,
  PortfolioType,
  SectorAllocation,
  UserSettingsRecord,
} from '@/lib/portfolio/types'

const FIXTURE_QUOTES: Record<string, number> = {
  AAPL: 227.48,
  NVDA: 912.35,
  TSLA: 176.82,
  MSFT: 438.62,
  AMZN: 182.14,
}

const FIXTURE_SECTORS: Record<string, string> = {
  AAPL: 'Electronic Computers',
  NVDA: 'Semiconductors',
  TSLA: 'Motor Vehicles & Passenger Car Bodies',
  MSFT: 'Prepackaged Software',
  AMZN: 'Retail-Catalog & Mail-Order Houses',
}

function parseNumeric(value: number | string | null | undefined): number {
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function parseNullableNumeric(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') return value
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

interface QuoteSnapshot {
  ticker: string
  price: number | null
}

interface FundamentalsSnapshot {
  ticker: string
  sector: string | null
}

function latestIsoTimestamp(values: Array<string | null | undefined>): string | null {
  const timestamps = values
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value).getTime())
    .filter((value) => Number.isFinite(value))

  if (timestamps.length === 0) {
    return null
  }

  return new Date(Math.max(...timestamps)).toISOString()
}

async function validateTickerViaPolygon(ticker: string): Promise<boolean> {
  if (process.env.NEXT_PUBLIC_USE_FIXTURES === 'true') {
    return ticker in FIXTURE_QUOTES
  }

  const apiKey = process.env.POLYGON_API_KEY
  if (!apiKey) return false

  const response = await fetch(
    `https://api.polygon.io/v3/reference/tickers/${encodeURIComponent(ticker)}?apiKey=${apiKey}`,
    { next: { revalidate: 3600 } }
  )

  if (!response.ok) return false
  const data = (await response.json()) as { results?: { ticker?: string } }
  return Boolean(data.results?.ticker)
}

async function getQuotes(tickers: string[]): Promise<Record<string, QuoteSnapshot>> {
  const uniqueTickers = [...new Set(tickers.map((ticker) => ticker.toUpperCase()))]

  if (process.env.NEXT_PUBLIC_USE_FIXTURES === 'true') {
    return Object.fromEntries(
      uniqueTickers.map((ticker) => [
        ticker,
        { ticker, price: FIXTURE_QUOTES[ticker] ?? null } satisfies QuoteSnapshot,
      ])
    )
  }

  const apiKey = process.env.POLYGON_API_KEY
  if (!apiKey) {
    return Object.fromEntries(
      uniqueTickers.map((ticker) => [ticker, { ticker, price: null } satisfies QuoteSnapshot])
    )
  }

  const results = await Promise.all(
    uniqueTickers.map(async (ticker) => {
      try {
        const response = await fetch(
          `https://api.polygon.io/v2/aggs/ticker/${encodeURIComponent(ticker)}/prev?adjusted=true&apiKey=${apiKey}`,
          { next: { revalidate: 3600 } }
        )

        if (!response.ok) {
          return [ticker, { ticker, price: null } satisfies QuoteSnapshot] as const
        }

        const data = (await response.json()) as { results?: Array<{ c?: number }> }
        return [
          ticker,
          {
            ticker,
            price: typeof data.results?.[0]?.c === 'number' ? data.results[0].c : null,
          } satisfies QuoteSnapshot,
        ] as const
      } catch {
        return [ticker, { ticker, price: null } satisfies QuoteSnapshot] as const
      }
    })
  )

  return Object.fromEntries(results)
}

async function getFundamentals(tickers: string[]): Promise<Record<string, FundamentalsSnapshot>> {
  const uniqueTickers = [...new Set(tickers.map((ticker) => ticker.toUpperCase()))]

  if (process.env.NEXT_PUBLIC_USE_FIXTURES === 'true') {
    return Object.fromEntries(
      uniqueTickers.map((ticker) => [
        ticker,
        { ticker, sector: FIXTURE_SECTORS[ticker] ?? null } satisfies FundamentalsSnapshot,
      ])
    )
  }

  const apiKey = process.env.POLYGON_API_KEY
  if (!apiKey) {
    return Object.fromEntries(
      uniqueTickers.map((ticker) => [
        ticker,
        { ticker, sector: null } satisfies FundamentalsSnapshot,
      ])
    )
  }

  const results = await Promise.all(
    uniqueTickers.map(async (ticker) => {
      try {
        const response = await fetch(
          `https://api.polygon.io/v3/reference/tickers/${encodeURIComponent(ticker)}?apiKey=${apiKey}`,
          { next: { revalidate: 3600 } }
        )

        if (!response.ok) {
          return [ticker, { ticker, sector: null } satisfies FundamentalsSnapshot] as const
        }

        const data = (await response.json()) as {
          results?: { sic_description?: string | null }
        }
        return [
          ticker,
          {
            ticker,
            sector: data.results?.sic_description ?? null,
          } satisfies FundamentalsSnapshot,
        ] as const
      } catch {
        return [ticker, { ticker, sector: null } satisfies FundamentalsSnapshot] as const
      }
    })
  )

  return Object.fromEntries(results)
}

export async function requireAuthenticatedUser(nextPath = '/dashboard') {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`)
  }

  return { supabase, user }
}

export async function getOrCreatePortfolioByType(
  userId: string,
  type: PortfolioType
): Promise<PortfolioRecord> {
  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('portfolios')
    .select('*')
    .eq('user_id', userId)
    .eq('portfolio_type', type)
    .is('archived_at', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle<PortfolioRecord>()

  if (existing) {
    await ensureCashBalance(existing.id, userId)
    return existing
  }

  const name = type === 'watchlist' ? 'Watchlist' : 'Primary Portfolio'
  const { data: created, error } = await supabase
    .from('portfolios')
    .insert({
      user_id: userId,
      name,
      portfolio_type: type,
      benchmark: type === 'investment' ? 'SPY' : null,
      risk_tier: type === 'investment' ? 'moderate' : null,
    })
    .select('*')
    .single<PortfolioRecord>()

  if (error || !created) {
    throw new Error(error?.message ?? `Failed to create ${type} portfolio.`)
  }

  await ensureCashBalance(created.id, userId)
  return created
}

async function ensureCashBalance(portfolioId: string, userId: string) {
  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('cash_balance')
    .select('id')
    .eq('portfolio_id', portfolioId)
    .eq('user_id', userId)
    .maybeSingle<{ id: string }>()

  if (existing) return

  const { error } = await supabase.from('cash_balance').insert({
    portfolio_id: portfolioId,
    user_id: userId,
    amount: 0,
  })

  if (error) {
    throw new Error(error.message)
  }
}

async function getOrCreateUserSettings(userId: string): Promise<UserSettingsRecord> {
  const supabase = await createClient()

  const { data: existing, error: existingError } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle<UserSettingsRecord>()

  if (existingError) {
    throw new Error(existingError.message)
  }

  if (existing) return existing

  const { data: created, error: createError } = await supabase
    .from('user_settings')
    .insert({ user_id: userId })
    .select('*')
    .single<UserSettingsRecord>()

  if (createError || !created) {
    throw new Error(createError?.message ?? 'Failed to create user settings.')
  }

  return created
}

export async function ensurePortfolioWorkspace(userId: string) {
  const investment = await getOrCreatePortfolioByType(userId, 'investment')
  const watchlist = await getOrCreatePortfolioByType(userId, 'watchlist')
  return { investment, watchlist }
}

export async function getPortfolioDashboardData(userId: string): Promise<PortfolioDashboardData> {
  const supabase = await createClient()
  const dashboardGeneratedAt = new Date().toISOString()
  const [{ investment, watchlist }, userSettings] = await Promise.all([
    ensurePortfolioWorkspace(userId),
    getOrCreateUserSettings(userId),
  ])

  const [{ data: holdingsRows, error: holdingsError }, { data: cashRow, error: cashError }] =
    await Promise.all([
      supabase
        .from('holdings')
        .select('*')
        .eq('portfolio_id', investment.id)
        .eq('user_id', userId)
        .is('archived_at', null)
        .order('ticker', { ascending: true })
        .returns<HoldingRecord[]>(),
      supabase
        .from('cash_balance')
        .select('*')
        .eq('portfolio_id', investment.id)
        .eq('user_id', userId)
        .maybeSingle<CashBalanceRecord>(),
    ])

  if (holdingsError) {
    throw new Error(holdingsError.message)
  }

  if (cashError) {
    throw new Error(cashError.message)
  }

  const holdings = holdingsRows ?? []
  const tickers = holdings.map((holding) => holding.ticker)
  const [quotes, fundamentals] = await Promise.all([getQuotes(tickers), getFundamentals(tickers)])

  const cashBalance = parseNumeric(cashRow?.amount)

  const holdingsWithValues: PortfolioDashboardHolding[] = holdings.map((holding) => {
    const shares = parseNumeric(holding.shares)
    const currentPrice = quotes[holding.ticker]?.price ?? null
    const currentValue = currentPrice === null ? 0 : Number((currentPrice * shares).toFixed(2))

    return {
      id: holding.id,
      ticker: holding.ticker,
      shares,
      costBasis: parseNullableNumeric(holding.cost_basis),
      currentPrice,
      currentValue,
      weight: 0,
      sector: fundamentals[holding.ticker]?.sector ?? null,
      updatedAt: holding.updated_at,
    }
  })

  const totalHoldingsValue = holdingsWithValues.reduce(
    (sum, holding) => sum + holding.currentValue,
    0
  )
  const totalValue = Number((cashBalance + totalHoldingsValue).toFixed(2))

  const holdingsWithWeights = holdingsWithValues.map((holding) => ({
    ...holding,
    weight: totalValue > 0 ? holding.currentValue / totalValue : 0,
  }))

  const sectorMap = new Map<string, number>()
  for (const holding of holdingsWithWeights) {
    if (holding.currentValue <= 0) continue
    const sector = holding.sector ?? 'Unclassified'
    sectorMap.set(sector, (sectorMap.get(sector) ?? 0) + holding.currentValue)
  }

  const sectorAllocations: SectorAllocation[] = [...sectorMap.entries()]
    .map(([sector, value]) => ({
      sector,
      value: Number(value.toFixed(2)),
      weight: totalValue > 0 ? value / totalValue : 0,
    }))
    .sort((a, b) => b.value - a.value)

  const workspaceUpdatedAt = latestIsoTimestamp([
    investment.updated_at,
    cashRow?.updated_at ?? null,
    userSettings.updated_at,
    ...holdings.map((holding) => holding.updated_at),
  ])

  return {
    portfolio: investment,
    watchlist,
    cashBalance,
    holdings: holdingsWithWeights,
    totalValue,
    sectorAllocations,
    userSettings,
    dashboardGeneratedAt,
    workspaceUpdatedAt,
  }
}

export async function validateTickerOrThrow(ticker: string) {
  const normalized = ticker.toUpperCase().trim()
  const isValid = await validateTickerViaPolygon(normalized)
  if (!isValid) {
    throw new Error(`Ticker '${normalized}' could not be validated.`)
  }
  return normalized
}
