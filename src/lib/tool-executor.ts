// ============================================================
// src/lib/tool-executor.ts
// Executes tool calls by name, calling external APIs directly.
// Switch cases MUST exactly match tool names in claude-tools.ts.
// ============================================================

import type {
  CompanyProfileResult,
  FilingsResult,
  FinancialsResult,
  FundamentalsResult,
  NewsResult,
  QuoteResult,
  ToolExecutionError,
  ToolExecutionResult,
} from '@/lib/tools'

const POLYGON_API_KEY = process.env.POLYGON_API_KEY
const SEC_HEADERS = {
  'User-Agent': 'StockForge AI contact@stockforge.ai',
  'Accept': 'application/json',
}

const SOURCES = {
  companyProfile: 'SEC EDGAR browse-edgar company lookup',
  fundamentals: 'Polygon.io /v3/reference/tickers',
  financials: 'Polygon.io /vX/reference/financials',
  filings: 'SEC EDGAR submissions/CIK{cik}.json',
  news: 'Polygon.io /v2/reference/news',
  quote: 'Polygon.io /v2/aggs/ticker/{ticker}/prev',
  filingContent: 'SEC EDGAR Archives filing document',
} as const

interface EdgarIndexItem {
  name?: string
  type?: string
}

interface FilingContentResult {
  content: string
  source: string
}

function nowIso(): string {
  return new Date().toISOString()
}

function success<T>(
  source: string,
  data: T,
  options?: { gaps?: string[]; fetchedAt?: string }
): ToolExecutionResult<T> {
  return {
    status: 'success',
    source,
    data,
    ...(options?.gaps && options.gaps.length > 0 ? { gaps: options.gaps } : {}),
    ...(options?.fetchedAt ? { fetchedAt: options.fetchedAt } : {}),
  }
}

function failure(
  source: string,
  error: string,
  options?: { gaps?: string[]; fetchedAt?: string }
): ToolExecutionError {
  return {
    status: 'error',
    source,
    data: null,
    error,
    ...(options?.gaps && options.gaps.length > 0 ? { gaps: options.gaps } : {}),
    ...(options?.fetchedAt ? { fetchedAt: options.fetchedAt } : {}),
  }
}

function compactGaps(gaps: Array<string | null | undefined>): string[] {
  return gaps.filter((gap): gap is string => Boolean(gap && gap.trim().length > 0))
}

function missingFieldGap(field: string, value: unknown, label?: string): string | null {
  return value === null || value === undefined || value === ''
    ? `${label ?? field} unavailable from source response`
    : null
}

export function unwrapToolExecutionResult<T extends object>(
  result: ToolExecutionResult<T>
): T & { fetchedAt?: string; source?: string; error?: string; gaps?: string[] } {
  if (result.status === 'error') {
    return {
      error: result.error,
      fetchedAt: result.fetchedAt,
      source: result.source,
      gaps: result.gaps,
    } as unknown as T & {
      fetchedAt?: string
      source?: string
      error?: string
      gaps?: string[]
    }
  }

  return {
    ...result.data,
    fetchedAt: result.fetchedAt,
    source: result.source,
    ...(result.gaps ? { gaps: result.gaps } : {}),
  } as T & { fetchedAt?: string; source?: string; error?: string; gaps?: string[] }
}

// ── Individual tool implementations ─────────────────────────

export async function getCompanyProfile(ticker: string): Promise<ToolExecutionResult<CompanyProfileResult>> {
  const fetchedAt = nowIso()

  try {
    const res = await fetch(
      `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${ticker}&type=10-K&dateb=&owner=include&count=1&output=atom`,
      { headers: { 'User-Agent': 'StockForge AI contact@stockforge.ai' } }
    )
    if (!res.ok) {
      return failure(SOURCES.companyProfile, `SEC returned HTTP ${res.status} for ${ticker}.`, {
        fetchedAt,
      })
    }

    const xml = await res.text()
    const cikMatch = xml.match(/CIK=0*(\d+)/) || xml.match(/<cik>(\d+)<\/cik>/)
    const nameMatch =
      xml.match(/<company-name>([^<]+)<\/company-name>/) ||
      xml.match(/<conformed-name>([^<]+)<\/conformed-name>/) ||
      xml.match(/<name>([^<]+)<\/name>/)

    if (!cikMatch) {
      return failure(
        SOURCES.companyProfile,
        `Could not find SEC CIK for ${ticker}.`,
        { fetchedAt }
      )
    }

    const cik = cikMatch[1].padStart(10, '0')
    const companyName = nameMatch ? nameMatch[1].trim() : ticker

    return success(
      SOURCES.companyProfile,
      {
        ticker,
        cik,
        companyName,
        secUrl: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}&type=10-K`,
      },
      { fetchedAt }
    )
  } catch (e) {
    return failure(SOURCES.companyProfile, `Failed to look up company: ${String(e)}`, {
      fetchedAt,
    })
  }
}

export async function getFundamentals(ticker: string): Promise<ToolExecutionResult<FundamentalsResult>> {
  const fetchedAt = nowIso()

  try {
    const res = await fetch(
      `https://api.polygon.io/v3/reference/tickers/${encodeURIComponent(ticker)}?apiKey=${POLYGON_API_KEY}`
    )

    if (!res.ok) {
      return failure(SOURCES.fundamentals, `Polygon returned HTTP ${res.status} for ${ticker}`, {
        fetchedAt,
      })
    }

    const data = await res.json()
    const r = data.results

    if (!r) {
      return failure(SOURCES.fundamentals, `No fundamentals data found for ${ticker}`, {
        fetchedAt,
      })
    }

    const payload: FundamentalsResult = {
      ticker: r.ticker ?? ticker,
      name: r.name ?? ticker,
      marketCap: r.market_cap ?? null,
      employees: r.total_employees ?? null,
      sector: r.sic_description ?? null,
      industry: r.sic_description ?? null,
      description: r.description ?? null,
    }

    return success(SOURCES.fundamentals, payload, {
      fetchedAt,
      gaps: compactGaps([
        missingFieldGap('marketCap', payload.marketCap, 'Market cap'),
        missingFieldGap('employees', payload.employees, 'Employee count'),
        missingFieldGap('sector', payload.sector, 'Sector'),
        missingFieldGap('description', payload.description, 'Company description'),
      ]),
    })
  } catch (e) {
    return failure(SOURCES.fundamentals, `Fundamentals fetch failed: ${String(e)}`, {
      fetchedAt,
    })
  }
}

export async function getFinancials(ticker: string): Promise<ToolExecutionResult<FinancialsResult>> {
  const fetchedAt = nowIso()

  try {
    const res = await fetch(
      `https://api.polygon.io/vX/reference/financials?ticker=${encodeURIComponent(ticker)}&timeframe=annual&limit=1&apiKey=${POLYGON_API_KEY}`
    )
    if (!res.ok) {
      return failure(
        SOURCES.financials,
        `Polygon Financials returned HTTP ${res.status} for ${ticker}`,
        { fetchedAt }
      )
    }

    const data = await res.json()
    const result = data.results?.[0]
    if (!result) {
      return failure(SOURCES.financials, `No annual financial data found for ${ticker}`, {
        fetchedAt,
      })
    }

    const val = (obj: Record<string, unknown> | undefined): number | null =>
      obj && typeof obj.value === 'number' ? obj.value : null

    const income = (result.financials?.income_statement ?? {}) as Record<string, unknown>
    const balance = (result.financials?.balance_sheet ?? {}) as Record<string, unknown>
    const cf = (result.financials?.cash_flow_statement ?? {}) as Record<string, unknown>

    const revenue = val(income.revenues as Record<string, unknown>)
    const netIncome = val(income.net_income_loss as Record<string, unknown>)
    const opIncome = val(income.operating_income_loss as Record<string, unknown>)
    const dilutedEPS = val(income.diluted_earnings_per_share as Record<string, unknown>)
    const totalAssets = val(balance.assets as Record<string, unknown>)
    const longTermDebt = val(
      (balance.long_term_debt ?? balance.noncurrent_liabilities) as Record<string, unknown>
    )
    const cash = val(
      (balance.cash_and_cash_equivalents_and_short_term_investments ??
        balance.cash_and_cash_equivalents_including_short_term_investments ??
        balance.cash_and_cash_equivalents) as Record<string, unknown>
    )
    const operatingCashFlow = val(
      cf.net_cash_flow_from_operating_activities as Record<string, unknown>
    )
    const operatingMargin =
      revenue !== null && revenue !== 0 && opIncome !== null
        ? `${((opIncome / revenue) * 100).toFixed(1)}%`
        : null

    const fmt = (n: number | null): string | null => {
      if (n === null) return null
      if (Math.abs(n) >= 1e12) return `$${(n / 1e12).toFixed(2)}T`
      if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
      if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(2)}M`
      return `$${n.toLocaleString()}`
    }

    const payload: FinancialsResult = {
      ticker,
      fiscalYear: result.fiscal_year ?? null,
      fiscalPeriod: result.fiscal_period ?? null,
      filingDate: result.filing_date ?? null,
      revenue: fmt(revenue),
      netIncome: fmt(netIncome),
      operatingIncome: fmt(opIncome),
      operatingMargin,
      totalAssets: fmt(totalAssets),
      longTermDebt: fmt(longTermDebt),
      cash: fmt(cash),
      operatingCashFlow: fmt(operatingCashFlow),
      dilutedEPS: dilutedEPS !== null ? `$${dilutedEPS.toFixed(2)}` : null,
      dilutedEPSRaw: dilutedEPS,
      revenueRaw: revenue,
      netIncomeRaw: netIncome,
      operatingIncomeRaw: opIncome,
      totalAssetsRaw: totalAssets,
      longTermDebtRaw: longTermDebt,
      cashRaw: cash,
      operatingCashFlowRaw: operatingCashFlow,
    }

    return success(SOURCES.financials, payload, {
      fetchedAt,
      gaps: compactGaps([
        missingFieldGap('revenue', payload.revenue, 'Revenue'),
        missingFieldGap('netIncome', payload.netIncome, 'Net income'),
        missingFieldGap('operatingMargin', payload.operatingMargin, 'Operating margin'),
        missingFieldGap('totalAssets', payload.totalAssets, 'Total assets'),
        missingFieldGap('cash', payload.cash, 'Cash'),
        missingFieldGap('dilutedEPS', payload.dilutedEPS, 'Diluted EPS'),
      ]),
    })
  } catch (e) {
    return failure(SOURCES.financials, `Financials fetch failed: ${String(e)}`, {
      fetchedAt,
    })
  }
}

export async function getRecentFilings(cik: string): Promise<ToolExecutionResult<FilingsResult>> {
  const fetchedAt = nowIso()

  try {
    const res = await fetch(`https://data.sec.gov/submissions/CIK${cik}.json`, {
      headers: SEC_HEADERS,
    })
    if (!res.ok) {
      return failure(SOURCES.filings, `SEC returned HTTP ${res.status}`, { fetchedAt })
    }

    const data = await res.json()
    const recent = data.filings?.recent
    if (!recent) {
      return failure(SOURCES.filings, 'No recent filing data in SEC EDGAR', { fetchedAt })
    }

    const targetForms = ['10-K', '10-Q', '8-K', 'DEF 14A', '10-K/A', '10-Q/A']
    const filings: NonNullable<FilingsResult['recentFilings']> = []

    for (let i = 0; i < (recent.form?.length || 0) && filings.length < 8; i++) {
      if (targetForms.includes(recent.form[i])) {
        filings.push({
          form: recent.form[i],
          filingDate: recent.filingDate?.[i] || 'unknown',
          reportDate: recent.reportDate?.[i] || 'unknown',
          description: recent.primaryDocDescription?.[i] || '',
          accessionNumber: recent.accessionNumber?.[i] || '',
        })
      }
    }

    const payload: FilingsResult = {
      companyName: data.name,
      cik: data.cik,
      sicCode: data.sic,
      industry: data.sicDescription,
      stateOfIncorporation: data.stateOfIncorporation,
      fiscalYearEnd: data.fiscalYearEnd,
      recentFilings: filings,
    }

    return success(SOURCES.filings, payload, {
      fetchedAt,
      gaps: compactGaps([
        filings.length === 0 ? 'No target SEC filing forms were available in recent filings.' : null,
        missingFieldGap('industry', payload.industry, 'SEC industry description'),
      ]),
    })
  } catch (e) {
    return failure(SOURCES.filings, `Filing fetch failed: ${String(e)}`, { fetchedAt })
  }
}

export async function getNews(ticker: string, limit: number): Promise<ToolExecutionResult<NewsResult>> {
  const fetchedAt = nowIso()
  const clampedLimit = Math.min(Math.max(limit, 1), 10)

  try {
    const res = await fetch(
      `https://api.polygon.io/v2/reference/news?ticker=${ticker}&limit=${clampedLimit}&sort=published_utc&order=desc&apiKey=${POLYGON_API_KEY}`
    )
    if (!res.ok) {
      return failure(SOURCES.news, `Polygon News returned HTTP ${res.status}`, { fetchedAt })
    }

    const data = await res.json()
    const articles = (data.results || []).map((a: Record<string, unknown>) => {
      const publisher = a.publisher as Record<string, unknown> | undefined
      const insights = a.insights as Array<Record<string, unknown>> | undefined
      return {
        title: String(a.title ?? ''),
        published: String(a.published_utc ?? ''),
        publisher: String(publisher?.name || 'Unknown'),
        description: typeof a.description === 'string' ? a.description.slice(0, 250) : '',
        sentiment: typeof insights?.[0]?.sentiment === 'string' ? insights[0].sentiment : null,
        sentimentReasoning:
          typeof insights?.[0]?.sentiment_reasoning === 'string'
            ? insights[0].sentiment_reasoning.slice(0, 150)
            : null,
      }
    })

    return success(
      SOURCES.news,
      {
        ticker,
        articleCount: articles.length,
        articles,
      },
      {
        fetchedAt,
        gaps: compactGaps([
          articles.length === 0 ? `No Polygon news articles returned for ${ticker}.` : null,
        ]),
      }
    )
  } catch (e) {
    return failure(SOURCES.news, `News fetch failed: ${String(e)}`, { fetchedAt })
  }
}

export async function getQuote(ticker: string): Promise<ToolExecutionResult<QuoteResult>> {
  const fetchedAt = nowIso()

  try {
    const res = await fetch(
      `https://api.polygon.io/v2/aggs/ticker/${ticker}/prev?adjusted=true&apiKey=${POLYGON_API_KEY}`
    )
    if (!res.ok) {
      return failure(SOURCES.quote, `Polygon returned HTTP ${res.status}`, { fetchedAt })
    }

    const data = await res.json()
    const r = data.results?.[0]
    if (!r) {
      return failure(SOURCES.quote, 'No price data returned', { fetchedAt })
    }

    const change = r.c - r.o
    const changePct = ((change / r.o) * 100).toFixed(2)

    return success(
      SOURCES.quote,
      {
        ticker,
        price: r.c,
        open: r.o,
        high: r.h,
        low: r.l,
        volume: r.v,
        vwap: r.vw,
        dailyChange: +change.toFixed(2),
        dailyChangePct: `${changePct}%`,
        tradingDate: new Date(r.t).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        }),
      },
      { fetchedAt }
    )
  } catch (e) {
    return failure(SOURCES.quote, `Quote fetch failed: ${String(e)}`, { fetchedAt })
  }
}

export async function compareStocks(tickerA: string, tickerB: string) {
  const [[quoteA, profileA], [quoteB, profileB]] = await Promise.all([
    Promise.all([getQuote(tickerA), getCompanyProfile(tickerA)]),
    Promise.all([getQuote(tickerB), getCompanyProfile(tickerB)]),
  ])

  return {
    tickerA: {
      quote: unwrapToolExecutionResult(quoteA),
      profile: unwrapToolExecutionResult(profileA),
    },
    tickerB: {
      quote: unwrapToolExecutionResult(quoteB),
      profile: unwrapToolExecutionResult(profileB),
    },
    fetchedAt: nowIso(),
  }
}

export async function getFilingContent(
  cik: string,
  accessionNumber: string
): Promise<ToolExecutionResult<FilingContentResult>> {
  const fetchedAt = nowIso()
  const accessionClean = accessionNumber.replace(/-/g, '')
  const baseUrl = `https://data.sec.gov/Archives/edgar/data/${parseInt(cik, 10)}/${accessionClean}`
  const indexUrl = `${baseUrl}/${accessionClean}-index.json`

  try {
    const indexRes = await fetch(indexUrl, { headers: SEC_HEADERS })
    if (!indexRes.ok) {
      return failure(indexUrl, `Index fetch failed: ${indexRes.status}`, { fetchedAt })
    }

    const index = (await indexRes.json()) as {
      directory?: { item?: EdgarIndexItem[] }
      documents?: Array<{ document?: string; type?: string }>
    }

    const directoryItems = index.directory?.item ?? []
    const documentEntries = index.documents ?? []

    const primaryDocFromDocuments =
      documentEntries.find(
        (doc) => doc.type && ['10-K', '10-Q', '8-K'].includes(doc.type)
      )?.document ?? documentEntries[0]?.document

    const primaryDocFromDirectory =
      directoryItems.find((item) => {
        const name = item.name?.toLowerCase() ?? ''
        return (
          !name.endsWith('-index.html') &&
          !name.endsWith('-index.htm') &&
          (name.endsWith('.htm') || name.endsWith('.html') || name.endsWith('.txt'))
        )
      })?.name

    const primaryDocument = primaryDocFromDocuments ?? primaryDocFromDirectory
    if (!primaryDocument) {
      return failure(indexUrl, 'No primary document found in filing index', { fetchedAt })
    }

    const docUrl = `${baseUrl}/${primaryDocument}`
    const docRes = await fetch(docUrl, { headers: SEC_HEADERS })
    if (!docRes.ok) {
      return failure(docUrl, `Document fetch failed: ${docRes.status}`, { fetchedAt })
    }

    const rawHtml = await docRes.text()
    const stripped = rawHtml
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s{2,}/g, ' ')
      .trim()

    const content =
      stripped.length > 8000
        ? `${stripped.slice(0, 8000)}\n\n[Content truncated at 8,000 characters]`
        : stripped

    return success(docUrl, { content, source: docUrl }, {
      fetchedAt,
      gaps: compactGaps([
        content.length === 0 ? 'SEC filing document was fetched but contained no readable text.' : null,
      ]),
    })
  } catch (e) {
    return failure(indexUrl, `getFilingContent failed: ${String(e)}`, { fetchedAt })
  }
}

// ── Dispatcher ───────────────────────────────────────────────

// Returns legacy-shaped payloads for the existing tool-loop prompts.
export async function executeTool(
  toolName: string,
  toolInput: Record<string, string | number | undefined>
): Promise<unknown> {
  switch (toolName) {
    case 'getCompanyProfile':
      return unwrapToolExecutionResult(await getCompanyProfile(toolInput.ticker as string))
    case 'getFundamentals':
      return unwrapToolExecutionResult(await getFundamentals(toolInput.ticker as string))
    case 'getFinancials':
      return unwrapToolExecutionResult(await getFinancials(toolInput.ticker as string))
    case 'get_recent_filings':
      return unwrapToolExecutionResult(await getRecentFilings(toolInput.cik as string))
    case 'getNews':
      return unwrapToolExecutionResult(
        await getNews(toolInput.ticker as string, Number(toolInput.limit ?? 5) || 5)
      )
    case 'getQuote':
      return unwrapToolExecutionResult(await getQuote(toolInput.ticker as string))
    case 'compareStocks':
      return compareStocks(toolInput.tickerA as string, toolInput.tickerB as string)
    case 'getFilingContent':
      return unwrapToolExecutionResult(
        await getFilingContent(toolInput.cik as string, toolInput.accessionNumber as string)
      )
    default:
      return { error: `Unknown tool: ${toolName}` }
  }
}
