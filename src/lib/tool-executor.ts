// ============================================================
// src/lib/tool-executor.ts
// Executes tool calls by name, calling external APIs directly.
// Switch cases MUST exactly match tool names in claude-tools.ts.
// ============================================================

// ToolResult types defined in ./tools — not imported here since executeTool returns unknown

const POLYGON_API_KEY = process.env.POLYGON_API_KEY
const SEC_HEADERS = {
  'User-Agent': 'StockForge AI contact@stockforge.ai',
  'Accept': 'application/json',
}

// ── Individual tool implementations ─────────────────────────

async function getCompanyProfile(ticker: string) {
  try {
    const res = await fetch(
      `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${ticker}&type=10-K&dateb=&owner=include&count=1&output=atom`,
      { headers: { 'User-Agent': 'StockForge AI contact@stockforge.ai' } }
    )
    const xml = await res.text()
    const cikMatch = xml.match(/CIK=0*(\d+)/) || xml.match(/<cik>(\d+)<\/cik>/)
    const nameMatch =
      xml.match(/<company-name>([^<]+)<\/company-name>/) ||
      xml.match(/<conformed-name>([^<]+)<\/conformed-name>/) ||
      xml.match(/<name>([^<]+)<\/name>/)

    if (!cikMatch) {
      return { error: `Could not find SEC CIK for ${ticker}.`, ticker }
    }
    const cik = cikMatch[1].padStart(10, '0')
    const companyName = nameMatch ? nameMatch[1].trim() : ticker
    return {
      ticker,
      cik,
      companyName,
      secUrl: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}&type=10-K`,
    }
  } catch (e) {
    return { error: `Failed to look up company: ${String(e)}`, ticker }
  }
}

async function getFundamentals(ticker: string) {
  try {
    const res = await fetch(
      `https://api.polygon.io/v3/reference/tickers/${encodeURIComponent(ticker)}?apiKey=${POLYGON_API_KEY}`
    )
    if (!res.ok) return { error: `Polygon returned HTTP ${res.status} for ${ticker}`, ticker }
    const data = await res.json()
    const r = data.results
    if (!r) return { error: `No fundamentals data found for ${ticker}`, ticker }
    return {
      ticker: r.ticker ?? ticker,
      name: r.name ?? ticker,
      marketCap: r.market_cap ?? null,
      employees: r.total_employees ?? null,
      sector: r.sic_description ?? null,
      industry: r.sic_description ?? null,
      description: r.description ?? null,
      fetchedAt: new Date().toISOString(),
    }
  } catch (e) {
    return { error: `Fundamentals fetch failed: ${String(e)}`, ticker }
  }
}

async function getFinancials(ticker: string) {
  try {
    const res = await fetch(
      `https://api.polygon.io/vX/reference/financials?ticker=${encodeURIComponent(ticker)}&timeframe=annual&limit=1&apiKey=${POLYGON_API_KEY}`
    )
    if (!res.ok) return { error: `Polygon Financials returned HTTP ${res.status} for ${ticker}`, ticker }
    const data = await res.json()
    const result = data.results?.[0]
    if (!result) return { error: `No annual financial data found for ${ticker}`, ticker }

    const val = (obj: Record<string, unknown> | undefined): number | null =>
      obj && typeof obj.value === 'number' ? obj.value : null

    const income  = (result.financials?.income_statement   ?? {}) as Record<string, unknown>
    const balance = (result.financials?.balance_sheet       ?? {}) as Record<string, unknown>
    const cf      = (result.financials?.cash_flow_statement ?? {}) as Record<string, unknown>

    const revenue    = val(income.revenues as Record<string, unknown>)
    const netIncome  = val(income.net_income_loss as Record<string, unknown>)
    const opIncome   = val(income.operating_income_loss as Record<string, unknown>)
    const dilutedEPS = val(income.diluted_earnings_per_share as Record<string, unknown>)
    const totalAssets  = val(balance.assets as Record<string, unknown>)
    const longTermDebt = val((balance.long_term_debt ?? balance.noncurrent_liabilities) as Record<string, unknown>)
    const cash = val(
      (balance.cash_and_cash_equivalents_and_short_term_investments ??
       balance.cash_and_cash_equivalents_including_short_term_investments ??
       balance.cash_and_cash_equivalents ??
       balance.current_assets) as Record<string, unknown>
    ) ?? null
    const operatingCashFlow = val(cf.net_cash_flow_from_operating_activities as Record<string, unknown>)
    const operatingMargin = revenue && opIncome ? ((opIncome / revenue) * 100).toFixed(1) + '%' : null

    const fmt = (n: number | null): string | null => {
      if (n === null) return null
      if (Math.abs(n) >= 1e12) return `$${(n / 1e12).toFixed(2)}T`
      if (Math.abs(n) >= 1e9)  return `$${(n / 1e9).toFixed(2)}B`
      if (Math.abs(n) >= 1e6)  return `$${(n / 1e6).toFixed(2)}M`
      return `$${n.toLocaleString()}`
    }

    return {
      ticker,
      fiscalYear: result.fiscal_year ?? null,
      fiscalPeriod: result.fiscal_period ?? null,
      filingDate: result.filing_date ?? null,
      revenue:           fmt(revenue),
      netIncome:         fmt(netIncome),
      operatingIncome:   fmt(opIncome),
      operatingMargin,
      totalAssets:       fmt(totalAssets),
      longTermDebt:      fmt(longTermDebt),
      cash:              fmt(cash),
      operatingCashFlow: fmt(operatingCashFlow),
      dilutedEPS:        dilutedEPS !== null ? `$${dilutedEPS.toFixed(2)}` : null,
      dilutedEPSRaw:     dilutedEPS,
      fetchedAt: new Date().toISOString(),
    }
  } catch (e) {
    return { error: `Financials fetch failed: ${String(e)}`, ticker }
  }
}

async function getRecentFilings(cik: string) {
  try {
    const res = await fetch(`https://data.sec.gov/submissions/CIK${cik}.json`, { headers: SEC_HEADERS })
    if (!res.ok) return { error: `SEC returned HTTP ${res.status}` }
    const data = await res.json()
    const recent = data.filings?.recent
    if (!recent) return { error: 'No recent filing data in SEC EDGAR' }

    const targetForms = ['10-K', '10-Q', '8-K', 'DEF 14A', '10-K/A', '10-Q/A']
    const filings: Array<{ form: string; filingDate: string; reportDate: string; description: string; accessionNumber: string }> = []

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

    return {
      companyName: data.name,
      cik: data.cik,
      sicCode: data.sic,
      industry: data.sicDescription,
      stateOfIncorporation: data.stateOfIncorporation,
      fiscalYearEnd: data.fiscalYearEnd,
      recentFilings: filings,
    }
  } catch (e) {
    return { error: `Filing fetch failed: ${String(e)}` }
  }
}

async function getNews(ticker: string, limit: number) {
  const clampedLimit = Math.min(Math.max(limit, 1), 10)
  try {
    const res = await fetch(
      `https://api.polygon.io/v2/reference/news?ticker=${ticker}&limit=${clampedLimit}&sort=published_utc&order=desc&apiKey=${POLYGON_API_KEY}`
    )
    if (!res.ok) return { error: `Polygon News returned HTTP ${res.status}` }
    const data = await res.json()
    const articles = (data.results || []).map((a: Record<string, unknown>) => {
      const publisher = a.publisher as Record<string, unknown> | undefined
      const insights = a.insights as Array<Record<string, unknown>> | undefined
      return {
        title: a.title,
        published: a.published_utc,
        publisher: publisher?.name || 'Unknown',
        description: typeof a.description === 'string' ? a.description.slice(0, 250) : '',
        sentiment: insights?.[0]?.sentiment || null,
        sentimentReasoning: typeof insights?.[0]?.sentiment_reasoning === 'string'
          ? insights[0].sentiment_reasoning.slice(0, 150)
          : null,
      }
    })
    return { ticker, articleCount: articles.length, articles }
  } catch (e) {
    return { error: `News fetch failed: ${String(e)}`, ticker }
  }
}

async function getQuote(ticker: string) {
  try {
    const res = await fetch(
      `https://api.polygon.io/v2/aggs/ticker/${ticker}/prev?adjusted=true&apiKey=${POLYGON_API_KEY}`
    )
    if (!res.ok) return { error: `Polygon returned HTTP ${res.status}` }
    const data = await res.json()
    const r = data.results?.[0]
    if (!r) return { error: 'No price data returned' }
    const change = r.c - r.o
    const changePct = ((change / r.o) * 100).toFixed(2)
    return {
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
        year: 'numeric', month: 'short', day: 'numeric',
      }),
    }
  } catch (e) {
    return { error: `Quote fetch failed: ${String(e)}`, ticker }
  }
}

async function compareStocks(tickerA: string, tickerB: string) {
  const [[quoteA, profileA], [quoteB, profileB]] = await Promise.all([
    Promise.all([getQuote(tickerA), getCompanyProfile(tickerA)]),
    Promise.all([getQuote(tickerB), getCompanyProfile(tickerB)]),
  ])
  return {
    tickerA: { quote: quoteA, profile: profileA },
    tickerB: { quote: quoteB, profile: profileB },
    fetchedAt: new Date().toISOString(),
  }
}

// ── Dispatcher ───────────────────────────────────────────────

// Returns unknown — callers JSON.stringify the result, so the exact shape doesn't matter.
// ToolResult is used for single-ticker tools; compareStocks returns a different shape.
export async function executeTool(
  toolName: string,
  toolInput: Record<string, string | number | undefined>
): Promise<unknown> {
  switch (toolName) {
    case 'getCompanyProfile':
      return getCompanyProfile(toolInput.ticker as string)
    case 'getFundamentals':
      return getFundamentals(toolInput.ticker as string)
    case 'getFinancials':
      return getFinancials(toolInput.ticker as string)
    case 'get_recent_filings':
      return getRecentFilings(toolInput.cik as string)
    case 'getNews':
      return getNews(toolInput.ticker as string, Number(toolInput.limit ?? 5) || 5)
    case 'getQuote':
      return getQuote(toolInput.ticker as string)
    case 'compareStocks':
      return compareStocks(toolInput.tickerA as string, toolInput.tickerB as string)
    default:
      return { error: `Unknown tool: ${toolName}` }
  }
}
