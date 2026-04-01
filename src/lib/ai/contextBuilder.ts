import {
  createExecutionMetadata,
  recordGaps,
  recordToolFailure,
  recordToolUsed,
} from '@/lib/ai/execution-observability'
import { getResearchContext } from '@/lib/rag'
import {
  getCompanyProfile,
  getFilingContent,
  getFinancials,
  getFundamentals,
  getNews,
  getQuote,
  getRecentFilings,
  unwrapToolExecutionResult,
} from '@/lib/tool-executor'
import type { StockContext } from '@/lib/ai/agentOrchestrator'
import type {
  CompanyProfileResult,
  FilingsResult,
  FinancialsResult,
  FundamentalsResult,
  NewsResult,
  QuoteResult,
  ToolExecutionResult,
} from '@/lib/tools'

interface PriceBar {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

interface FilingExcerpt {
  form: string
  filingDate: string
  accessionNumber: string
  description: string
  excerpt: string
  source: string
}

function assertNoError<T extends { error?: string }>(value: T, label: string): T {
  if (value.error) {
    throw new Error(`${label}: ${value.error}`)
  }

  return value
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function latestIsoTimestamp(values: Array<string | undefined | null>): string {
  const timestamps = values
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value).getTime())
    .filter((value) => Number.isFinite(value))

  if (timestamps.length === 0) {
    return new Date().toISOString()
  }

  return new Date(Math.max(...timestamps)).toISOString()
}

async function getPriceHistory(ticker: string): Promise<PriceBar[]> {
  const apiKey = process.env.POLYGON_API_KEY

  if (!apiKey) {
    throw new Error('POLYGON_API_KEY is not configured')
  }

  const end = new Date()
  const start = new Date()
  start.setDate(end.getDate() - 90)

  const response = await fetch(
    `https://api.polygon.io/v2/aggs/ticker/${encodeURIComponent(ticker)}/range/1/day/${formatDate(start)}/${formatDate(end)}?adjusted=true&sort=asc&limit=120&apiKey=${apiKey}`
  )

  if (!response.ok) {
    throw new Error(`Polygon price history returned HTTP ${response.status}`)
  }

  const data = (await response.json()) as {
    results?: Array<{ t: number; o: number; h: number; l: number; c: number; v: number }>
  }

  return (data.results ?? []).map((bar) => ({
    date: new Date(bar.t).toISOString().slice(0, 10),
    open: bar.o,
    high: bar.h,
    low: bar.l,
    close: bar.c,
    volume: bar.v,
  }))
}

function average(values: number[]): number | null {
  if (!values.length) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function calcSma(values: number[], period: number): number | null {
  if (values.length < period) return null
  return average(values.slice(-period))
}

function calcRsi(values: number[], period = 14): number | null {
  if (values.length <= period) return null

  let gains = 0
  let losses = 0

  for (let i = values.length - period; i < values.length; i++) {
    const change = values[i] - values[i - 1]
    if (change > 0) gains += change
    if (change < 0) losses += Math.abs(change)
  }

  if (losses === 0) return 100

  const rs = gains / losses
  return 100 - 100 / (1 + rs)
}

function calcEma(values: number[], period: number): number | null {
  if (values.length < period) return null

  const multiplier = 2 / (period + 1)
  let ema = average(values.slice(0, period))
  if (ema === null) return null

  for (let i = period; i < values.length; i++) {
    ema = (values[i] - ema) * multiplier + ema
  }

  return ema
}

function calcMacd(values: number[]): {
  macd: number | null
  signal: number | null
  histogram: number | null
} {
  if (values.length < 35) {
    return { macd: null, signal: null, histogram: null }
  }

  const macdSeries: number[] = []
  for (let i = 26; i <= values.length; i++) {
    const window = values.slice(0, i)
    const ema12 = calcEma(window, 12)
    const ema26 = calcEma(window, 26)
    if (ema12 !== null && ema26 !== null) {
      macdSeries.push(ema12 - ema26)
    }
  }

  const macd = macdSeries.at(-1) ?? null
  const signal = calcEma(macdSeries, 9)

  return {
    macd,
    signal,
    histogram: macd !== null && signal !== null ? macd - signal : null,
  }
}

async function getFilingExcerpts(
  profile: CompanyProfileResult,
  metadata?: StockContext['executionMetadata']
): Promise<FilingExcerpt[]> {
  if (!profile.cik) return []

  const filings = unwrapResultOrThrow({
    result: await getRecentFilings(profile.cik),
    label: 'Recent filings lookup failed',
    toolName: 'get_recent_filings',
    metadata,
  }) as FilingsResult

  const targets = (filings.recentFilings ?? [])
    .filter((filing) => filing.form === '10-Q' || filing.form === '8-K')
    .slice(0, 2)

  const excerpts = await Promise.all(
    targets.map(async (filing) => {
      const content = unwrapResultOrThrow({
        result: await getFilingContent(profile.cik as string, filing.accessionNumber),
        label: 'Filing content lookup failed',
        toolName: 'getFilingContent',
        metadata,
      }) as { content: string; source: string }

      return {
        form: filing.form,
        filingDate: filing.filingDate,
        accessionNumber: filing.accessionNumber,
        description: filing.description,
        excerpt: content.content.slice(0, 1200),
        source: content.source,
      }
    })
  )

  return excerpts
}

function unwrapResultOrThrow<T extends object>(args: {
  result: ToolExecutionResult<T>
  label: string
  toolName: string
  metadata: StockContext['executionMetadata']
}): T & { fetchedAt?: string; source?: string; error?: string; gaps?: string[] } {
  const { result, label, toolName, metadata } = args

  if (metadata) {
    recordToolUsed(metadata, toolName)
    recordGaps(metadata, result.gaps)
  }

  const unwrapped = unwrapToolExecutionResult(result)

  if (unwrapped.error) {
    if (metadata) {
      recordToolFailure(metadata, toolName, result.source, unwrapped.error)
    }
    throw new Error(`${label}: ${unwrapped.error}`)
  }

  return assertNoError(unwrapped, label)
}

export async function buildStockContext(ticker: string): Promise<StockContext> {
  const analysisDate = formatDate(new Date())
  const executionMetadata = createExecutionMetadata('parallel')

  const [profileResult, fundamentalsResult, financialsResult, quoteResult, newsResult, priceBars, researchContext] =
    await Promise.all([
      getCompanyProfile(ticker),
      getFundamentals(ticker),
      getFinancials(ticker),
      getQuote(ticker),
      getNews(ticker, 6),
      getPriceHistory(ticker),
      getResearchContext(`stock analysis ${ticker} investment research fundamentals risk`, {
        matchThreshold: 0.65,
        matchCount: 4,
        intent: 'market_analysis',
      }),
    ])

  const profile = unwrapResultOrThrow({
    result: profileResult,
    label: 'Company profile lookup failed',
    toolName: 'getCompanyProfile',
    metadata: executionMetadata,
  }) as CompanyProfileResult
  const fundamentals = unwrapResultOrThrow({
    result: fundamentalsResult,
    label: 'Fundamentals lookup failed',
    toolName: 'getFundamentals',
    metadata: executionMetadata,
  }) as FundamentalsResult
  const financials = unwrapResultOrThrow({
    result: financialsResult,
    label: 'Financials lookup failed',
    toolName: 'getFinancials',
    metadata: executionMetadata,
  }) as FinancialsResult
  const quote = unwrapResultOrThrow({
    result: quoteResult,
    label: 'Quote lookup failed',
    toolName: 'getQuote',
    metadata: executionMetadata,
  }) as QuoteResult
  const news = unwrapResultOrThrow({
    result: newsResult,
    label: 'News lookup failed',
    toolName: 'getNews',
    metadata: executionMetadata,
  }) as NewsResult
  const filingExcerpts = await getFilingExcerpts(profile, executionMetadata)

  const closes = priceBars.map((bar) => bar.close)
  const volumes = priceBars.map((bar) => bar.volume)
  const sma20 = calcSma(closes, 20)
  const sma50 = calcSma(closes, 50)
  const rsi14 = calcRsi(closes, 14)
  const macd = calcMacd(closes)
  const volume20 = calcSma(volumes, 20)

  return {
    companyName: fundamentals.name ?? profile.companyName ?? ticker,
    ticker,
    analysisDate,
    fetchedAt: latestIsoTimestamp([
      fundamentals.fetchedAt,
      financials.fetchedAt,
      quote.fetchedAt,
      news.fetchedAt,
    ]),
    researchContext,
    fundamentals: {
      companyProfile: profile,
      company: fundamentals,
      financials,
      quote,
      derived: {
        peRatio:
          quote.price && financials.dilutedEPSRaw
            ? Number((quote.price / financials.dilutedEPSRaw).toFixed(2))
            : null,
        debtRatio:
          financials.longTermDebtRaw && financials.totalAssetsRaw
            ? Number((financials.longTermDebtRaw / financials.totalAssetsRaw).toFixed(4))
            : null,
      },
    },
    priceHistory: {
      latestQuote: quote,
      bars: priceBars,
      indicators: {
        sma20,
        sma50,
        rsi14,
        macd: macd.macd,
        macdSignal: macd.signal,
        macdHistogram: macd.histogram,
        averageVolume20: volume20,
        latestVolume: priceBars.at(-1)?.volume ?? null,
      },
    },
    news: {
      headlines: news.articles,
      secFilings: filingExcerpts,
    },
    executionMetadata,
    dataSources: [
      `Polygon.io /v3/reference/tickers/${ticker}`,
      `Polygon.io /vX/reference/financials?ticker=${ticker}&timeframe=annual&limit=1`,
      `Polygon.io /v2/aggs/ticker/${ticker}/prev`,
      `Polygon.io /v2/aggs/ticker/${ticker}/range/1/day/${formatDate(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000))}/${formatDate(new Date())}`,
      `Polygon.io /v2/reference/news?ticker=${ticker}&limit=6`,
      profile.secUrl ?? `SEC browse-edgar lookup for ${ticker}`,
      profile.cik ? `SEC submissions/CIK${profile.cik}.json` : 'SEC submissions unavailable',
      ...filingExcerpts.map((filing) => filing.source),
    ],
  }
}
