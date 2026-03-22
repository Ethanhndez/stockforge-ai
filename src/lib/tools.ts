// ============================================================
// src/lib/tools.ts
// TypeScript types for all tool inputs and outputs.
// Tool inputs  = what Claude sends when requesting a call.
// Tool outputs = what the server sends back after executing.
// ============================================================

// ── Tool Input Types (Claude → Server) ──────────────────────

export interface GetQuoteInput {
  ticker: string
}

export interface GetNewsInput {
  ticker: string
  limit?: number
}

export interface GetFundamentalsInput {
  ticker: string
}

export interface GetFinancialsInput {
  ticker: string
}

export interface GetCompanyProfileInput {
  ticker: string
}

export interface GetRecentFilingsInput {
  cik: string
}

export interface CompareStocksInput {
  tickerA: string
  tickerB: string
}

// ── Tool Output Types (Server → Claude) ─────────────────────

export interface QuoteResult {
  ticker: string
  price: number
  open: number
  high: number
  low: number
  volume: number
  vwap?: number
  dailyChange: number
  dailyChangePct: string
  tradingDate: string
  fetchedAt?: string
  source?: 'polygon.io'
}

export interface NewsItem {
  title: string
  published: string
  publisher: string
  description?: string
  sentiment?: string | null
  sentimentReasoning?: string | null
}

export interface NewsResult {
  ticker: string
  articleCount: number
  articles: NewsItem[]
  fetchedAt?: string
  source?: 'polygon.io'
}

export interface FundamentalsResult {
  ticker: string
  name?: string
  marketCap?: number | null
  employees?: number | null
  sector?: string | null
  industry?: string | null
  description?: string | null
  fetchedAt?: string
  source?: 'polygon.io'
  error?: string
}

export interface FinancialsResult {
  ticker: string
  fiscalYear?: string | null
  fiscalPeriod?: string | null
  filingDate?: string | null
  revenue?: string | null
  netIncome?: string | null
  operatingIncome?: string | null
  operatingMargin?: string | null
  totalAssets?: string | null
  longTermDebt?: string | null
  cash?: string | null
  operatingCashFlow?: string | null
  dilutedEPS?: string | null
  dilutedEPSRaw?: number | null
  fetchedAt?: string
  error?: string
}

export interface CompanyProfileResult {
  ticker: string
  cik?: string
  companyName?: string
  secUrl?: string
  fetchedAt?: string
  error?: string
}

export interface FilingsResult {
  companyName?: string
  cik?: string | number
  sicCode?: string
  industry?: string
  stateOfIncorporation?: string
  fiscalYearEnd?: string
  recentFilings?: Array<{
    form: string
    filingDate: string
    reportDate: string
    description: string
    accessionNumber: string
  }>
  error?: string
}

export type ToolResult =
  | QuoteResult
  | NewsResult
  | FundamentalsResult
  | FinancialsResult
  | CompanyProfileResult
  | FilingsResult
  | { error: string }

// ── Structured Research Posture Output ──────────────────────

export interface ResearchPosture {
  ticker: string
  bull_case: string
  bear_case: string
  key_risks: string[]
  data_gaps: string[]
  rag_sources?: string[]
  fetchedAt: string
}
