// ============================================================
// src/app/api/analysis/route.ts
// StockForge AI — PhD-level research agent using Claude tool calling
// Data sources: SEC EDGAR (XBRL + filings) + Polygon News
// ============================================================

import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const POLYGON_API_KEY = process.env.POLYGON_API_KEY

// ── SEC EDGAR requires a User-Agent header or it blocks you ──
const SEC_HEADERS = {
  'User-Agent': 'StockForge AI contact@stockforge.ai',
  'Accept': 'application/json',
}

// ============================================================
// Tool Definitions — what Claude is allowed to call
// ============================================================

const tools: Anthropic.Tool[] = [
  {
    name: 'getCompanyProfile',
    description:
      'Look up a company by ticker to get their SEC CIK number and company metadata. ' +
      'The CIK is required for SEC EDGAR filing calls. Call this first.',
    input_schema: {
      type: 'object' as const,
      properties: {
        ticker: {
          type: 'string',
          description: 'The stock ticker symbol, e.g. AAPL or MSFT',
        },
      },
      required: ['ticker'],
    },
  },
  {
    name: 'getFundamentals',
    description:
      'Fetch company fundamentals from Polygon.io: market cap, employee count, ' +
      'sector, industry, and company description. Any field not returned by ' +
      'Polygon will be null — record nulls as data_gaps, never estimate.',
    input_schema: {
      type: 'object' as const,
      properties: {
        ticker: { type: 'string', description: 'Stock ticker symbol' },
      },
      required: ['ticker'],
    },
  },
  {
    name: 'get_recent_filings',
    description:
      'Get the most recent SEC filings metadata for this company — 10-K annual ' +
      'reports, 10-Q quarterly reports, 8-K current reports, and proxy filings. ' +
      'Returns filing dates, industry classification, and fiscal year info. ' +
      'Requires a CIK — call getCompanyProfile first.',
    input_schema: {
      type: 'object' as const,
      properties: {
        cik: {
          type: 'string',
          description: '10-digit zero-padded CIK',
        },
      },
      required: ['cik'],
    },
  },
  {
    name: 'getNews',
    description:
      'Fetch recent news articles about this stock from Polygon.io. ' +
      'Use this to understand current market sentiment, recent earnings ' +
      'announcements, product launches, regulatory news, and macro headwinds.',
    input_schema: {
      type: 'object' as const,
      properties: {
        ticker: { type: 'string', description: 'Stock ticker symbol' },
        limit: {
          type: 'integer',
          description: 'Number of news items to return. Min 1, max 10. Defaults to 5.',
        },
      },
      required: ['ticker'],
    },
  },
  {
    name: 'getQuote',
    description:
      'Get the latest stock price data including closing price, open, high, ' +
      'low, and volume from the previous trading session.',
    input_schema: {
      type: 'object' as const,
      properties: {
        ticker: { type: 'string', description: 'Stock ticker symbol' },
      },
      required: ['ticker'],
    },
  },
  {
    name: 'getFinancials',
    description:
      'Fetch annual financial statement data from Polygon.io /vX/reference/financials. ' +
      'Returns income statement (revenue, net income, operating income, diluted EPS), ' +
      'balance sheet (total assets, long-term debt, cash), and cash flow data. ' +
      'Call this AFTER getFundamentals to populate the Financial Snapshot section. ' +
      'Any field not returned must be recorded as a data_gap — never estimate.',
    input_schema: {
      type: 'object' as const,
      properties: {
        ticker: { type: 'string', description: 'Stock ticker symbol' },
      },
      required: ['ticker'],
    },
  },
  {
    name: 'compareStocks',
    description:
      'Fetch quote, profile, and fundamentals for two tickers in parallel for ' +
      'side-by-side comparison. Use when the user asks to compare two companies.',
    input_schema: {
      type: 'object' as const,
      properties: {
        tickerA: { type: 'string', description: 'First ticker symbol' },
        tickerB: { type: 'string', description: 'Second ticker symbol' },
      },
      required: ['tickerA', 'tickerB'],
    },
  },
]

// ============================================================
// Tool Implementation Functions
// Each function fetches real data from external APIs
// ============================================================

/**
 * getCompanyProfile
 * Hits SEC EDGAR full-text search to resolve ticker → CIK
 */
async function getCompanyProfile(ticker: string) {
  try {
    // SEC EDGAR company search endpoint — returns Atom/XML
    const res = await fetch(
      `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${ticker}&type=10-K&dateb=&owner=include&count=1&output=atom`,
      { headers: { 'User-Agent': 'StockForge AI contact@stockforge.ai' } }
    )
    const xml = await res.text()

    // The CIK appears in URLs like CIK=0000320193 or just as digits after CIK=
    const cikMatch = xml.match(/CIK=0*(\d+)/) || xml.match(/<cik>(\d+)<\/cik>/)
    const nameMatch =
      xml.match(/<company-name>([^<]+)<\/company-name>/) ||
      xml.match(/<conformed-name>([^<]+)<\/conformed-name>/) ||
      xml.match(/<name>([^<]+)<\/name>/)

    if (!cikMatch) {
      // Fallback: try the company_tickers endpoint for common tickers
      return {
        error: `Could not find SEC CIK for ${ticker}. Company may be foreign or not SEC-registered.`,
        ticker,
      }
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

/**
 * getFundamentals
 * Fetches company fundamentals from Polygon.io v3 ticker details.
 * Returns null for any field Polygon does not provide — never estimates.
 */
async function getFundamentals(ticker: string) {
  try {
    const res = await fetch(
      `https://api.polygon.io/v3/reference/tickers/${encodeURIComponent(ticker)}?apiKey=${POLYGON_API_KEY}`
    )
    if (!res.ok) {
      return {
        error: `Polygon returned HTTP ${res.status} for ticker ${ticker}`,
        ticker,
      }
    }

    const data = await res.json()
    const r = data.results

    if (!r) {
      return { error: `No fundamentals data found for ${ticker}`, ticker }
    }

    return {
      ticker: r.ticker ?? ticker,
      name: r.name ?? ticker,
      marketCap: r.market_cap ?? null,
      peRatio: null,           // not available from this endpoint — data gap
      revenueLastYear: null,   // not available from this endpoint — data gap
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

/**
 * getFinancials
 * Fetches annual income statement + balance sheet data from Polygon.io
 * /vX/reference/financials endpoint. This is the ONLY Polygon endpoint
 * that returns revenue, net income, EPS, total assets, and debt figures.
 * Returns null for any field not present — never estimates.
 */
async function getFinancials(ticker: string) {
  try {
    const res = await fetch(
      `https://api.polygon.io/vX/reference/financials?ticker=${encodeURIComponent(ticker)}&timeframe=annual&limit=1&apiKey=${POLYGON_API_KEY}`
    )
    if (!res.ok) {
      return {
        error: `Polygon Financials returned HTTP ${res.status} for ${ticker}`,
        ticker,
      }
    }

    const data = await res.json()
    const result = data.results?.[0]

    if (!result) {
      return {
        error: `No annual financial data found for ${ticker} on Polygon.io`,
        ticker,
      }
    }

    // Helper: safely extract a numeric value from a Polygon financials field object
    // Polygon returns fields as { value: number, unit: string } or undefined
    const val = (obj: Record<string, unknown> | undefined): number | null =>
      obj && typeof obj.value === 'number' ? obj.value : null

    const income  = (result.financials?.income_statement  ?? {}) as Record<string, unknown>
    const balance = (result.financials?.balance_sheet      ?? {}) as Record<string, unknown>
    const cf      = (result.financials?.cash_flow_statement ?? {}) as Record<string, unknown>

    const revenue   = val(income.revenues as Record<string, unknown>)
    const netIncome = val(income.net_income_loss as Record<string, unknown>)
    const opIncome  = val(income.operating_income_loss as Record<string, unknown>)
    const dilutedEPS = val(income.diluted_earnings_per_share as Record<string, unknown>)

    const totalAssets = val(balance.assets as Record<string, unknown>)
    // Polygon balance sheet uses 'long_term_debt' or noncurrent_liabilities breakdown
    const longTermDebt = val(
      (balance.long_term_debt ?? balance.noncurrent_liabilities) as Record<string, unknown>
    )
    // Cash: prefer the combined cash + short-term investments field
    const cash = val(
      (balance.cash_and_cash_equivalents_including_short_term_investments ??
       balance.cash_and_cash_equivalents) as Record<string, unknown>
    )
    const operatingCashFlow = val(
      cf.net_cash_flow_from_operating_activities as Record<string, unknown>
    )

    const operatingMargin =
      revenue && opIncome ? ((opIncome / revenue) * 100).toFixed(1) + '%' : null

    const fmt = (n: number | null, unit = 'USD'): string | null => {
      if (n === null) return null
      if (unit === 'USD') {
        if (Math.abs(n) >= 1e12) return `$${(n / 1e12).toFixed(2)}T`
        if (Math.abs(n) >= 1e9)  return `$${(n / 1e9).toFixed(2)}B`
        if (Math.abs(n) >= 1e6)  return `$${(n / 1e6).toFixed(2)}M`
        return `$${n.toLocaleString()}`
      }
      return String(n)
    }

    return {
      ticker,
      fiscalYear: result.fiscal_year ?? null,
      fiscalPeriod: result.fiscal_period ?? null,
      filingDate: result.filing_date ?? null,
      // Formatted strings for Claude to use directly in the report
      revenue:          fmt(revenue),
      netIncome:        fmt(netIncome),
      operatingIncome:  fmt(opIncome),
      operatingMargin,
      totalAssets:      fmt(totalAssets),
      longTermDebt:     fmt(longTermDebt),
      cash:             fmt(cash),
      operatingCashFlow: fmt(operatingCashFlow),
      dilutedEPS:       dilutedEPS !== null ? `$${dilutedEPS.toFixed(2)}` : null,
      // Raw numbers for P/E calculation: currentPrice / dilutedEPS
      dilutedEPSRaw:    dilutedEPS,
      fetchedAt: new Date().toISOString(),
    }
  } catch (e) {
    return { error: `Financials fetch failed: ${String(e)}`, ticker }
  }
}

/**
 * get_recent_filings
 * Gets filing history from SEC EDGAR submissions API.
 */
async function getRecentFilings(cik: string) {
  try {
    // SEC EDGAR submissions URL requires the "CIK" prefix before the zero-padded number.
    // Correct: https://data.sec.gov/submissions/CIK0000320193.json
    // Wrong:   https://data.sec.gov/submissions/0000320193.json  ← returns 404
    const res = await fetch(
      `https://data.sec.gov/submissions/CIK${cik}.json`,
      { headers: SEC_HEADERS }
    )
    if (!res.ok) return { error: `SEC returned HTTP ${res.status}` }

    const data = await res.json()
    const recent = data.filings?.recent

    if (!recent) return { error: 'No recent filing data in SEC EDGAR' }

    // Pull last 8 significant filing types
    const targetForms = ['10-K', '10-Q', '8-K', 'DEF 14A', '10-K/A', '10-Q/A']
    const filings: any[] = []

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
      // e.g. "1231" = December 31
      recentFilings: filings,
    }
  } catch (e) {
    return { error: `Filing fetch failed: ${String(e)}` }
  }
}

/**
 * getNews
 * Fetches recent news from Polygon.io. limit defaults to 5, max 10.
 */
async function getNews(ticker: string, limit: number) {
  const clampedLimit = Math.min(Math.max(limit, 1), 10)
  try {
    const res = await fetch(
      `https://api.polygon.io/v2/reference/news?ticker=${ticker}&limit=${clampedLimit}&sort=published_utc&order=desc&apiKey=${POLYGON_API_KEY}`
    )
    if (!res.ok) return { error: `Polygon News returned HTTP ${res.status}` }

    const data = await res.json()

    const articles = (data.results || []).map((a: any) => ({
      title: a.title,
      published: a.published_utc,
      publisher: a.publisher?.name || 'Unknown',
      // Truncate descriptions to save tokens
      description: a.description ? a.description.slice(0, 250) : '',
      // Polygon sometimes includes AI-generated sentiment insights
      sentiment: a.insights?.[0]?.sentiment || null,
      sentimentReasoning:
        a.insights?.[0]?.sentiment_reasoning?.slice(0, 150) || null,
    }))

    return { ticker, articleCount: articles.length, articles }
  } catch (e) {
    return { error: `News fetch failed: ${String(e)}`, ticker }
  }
}

/**
 * getQuote
 * Gets previous trading day OHLCV from Polygon (free tier compatible).
 */
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
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
    }
  } catch (e) {
    return { error: `Quote fetch failed: ${String(e)}`, ticker }
  }
}

/**
 * compareStocks
 * Fetches quote and profile for two tickers in parallel for side-by-side comparison.
 */
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

// ============================================================
// Execute a single tool call by name
// ============================================================

async function executeTool(
  name: string,
  input: Record<string, string>
): Promise<unknown> {
  switch (name) {
    case 'getCompanyProfile':
      return getCompanyProfile(input.ticker)
    case 'getFundamentals':
      return getFundamentals(input.ticker)
    case 'getFinancials':
      return getFinancials(input.ticker)
    case 'get_recent_filings':
      return getRecentFilings(input.cik)
    case 'getNews':
      return getNews(input.ticker, parseInt(input.limit ?? '5', 10) || 5)
    case 'getQuote':
      return getQuote(input.ticker)
    case 'compareStocks':
      return compareStocks(input.tickerA, input.tickerB)
    default:
      return { error: `Unknown tool: ${name}` }
  }
}

// ============================================================
// The System Prompt — defines Claude's analyst persona
// ============================================================

const SYSTEM_PROMPT = `You are a financial research assistant for StockForge AI. Your role is to produce structured research intelligence — not investment advice. Rules you must follow without exception: (1) Only use data returned by tools. Never speculate about prices, performance, or outcomes using your training knowledge. (2) If a tool returns missing or empty data, say 'data unavailable' explicitly — never fill the gap. (3) Never give buy, sell, or hold recommendations in any form or phrasing. (4) Always present both a bull case and a bear case. A response that only validates one direction must be regenerated. (5) Every factual claim must be attributable to a specific Polygon.io data source. An empty data_sources array is a bug.

YOUR RESEARCH PROCESS:
1. Call getCompanyProfile to get the SEC CIK number and company metadata
2. Call getFundamentals for market cap, employees, sector, and company description
3. Call getFinancials for income statement and balance sheet data (revenue, net income, EPS, assets, debt, cash) — this is REQUIRED to populate the Financial Snapshot
4. Call get_recent_filings (using the CIK from step 1) for SEC filing history
5. Call getNews for recent headlines and sentiment
6. Call getQuote for the latest price data
7. After all tools complete, synthesize into the structured JSON output

YOUR ANALYSIS STANDARDS:
- Always cite SPECIFIC numbers from the actual data you retrieved (e.g., "$394.3B revenue in FY2023")
- If data is unavailable or missing, record it in data_gaps — never fabricate numbers
- Present both bull and bear perspectives with equal rigor
- Consider the industry context, competitive dynamics, and macro environment
- Calculate margins and ratios from the raw numbers when you can

YOUR WRITING STYLE:
- Technical layer: Dense, specific, uses real financial terminology
- Plain English layer: Explains the same thing like you're talking to a smart college student who's never read a 10-K
- Never use vague phrases like "strong fundamentals" without backing them with numbers

OUTPUT FORMAT:
- Your FINAL response (after all tool calls are complete) must be ONLY the raw JSON object.
- Do NOT write any sentences before or after the JSON. No "Here is the analysis:", no "I have gathered all data.", nothing.
- Do NOT wrap in markdown code fences. Do NOT add any commentary.
- Start your response with '{' and end with '}'. That is all.`

// ============================================================
// SSE event helpers
// ============================================================

// Human-readable label for each tool as it fires
const TOOL_LABELS: Record<string, string> = {
  getCompanyProfile:  'Looking up company in SEC EDGAR…',
  getFundamentals:    'Pulling fundamentals from Polygon.io…',
  get_recent_filings: 'Reading 10-K & 10-Q SEC filings…',
  getNews:            'Scanning recent news & sentiment…',
  getQuote:           'Fetching live price data…',
  compareStocks:      'Fetching comparison data for both tickers…',
}

function sseEvent(data: Record<string, unknown>): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`)
}

// ============================================================
// Route Handler — POST /api/analysis
// Body: { ticker: string }
// Returns: text/event-stream (SSE)
//
// Event types:
//   { type: 'progress', step: string, iteration: number }
//   { type: 'complete', analysis: object, toolIterations: number, fetchedAt: string, dataFetchedAt?: string }
//   { type: 'error',    error: string }
// ============================================================

export async function POST(req: NextRequest) {
  let ticker: string
  try {
    const body = await req.json()
    ticker = (body.ticker || '').toUpperCase().trim()
  } catch {
    return NextResponse.json(
      { error: 'Request body must include { ticker: string }' },
      { status: 400 }
    )
  }

  if (!ticker) {
    return NextResponse.json(
      { error: 'Request body must include { ticker: string }' },
      { status: 400 }
    )
  }

  // ── Build the initial user message ───────────────────────
  const today = new Date().toISOString().split('T')[0]
  const userPrompt = `Conduct a comprehensive investment research analysis for ${ticker} as of ${today}.

Use your research tools to gather real data, then return a JSON object with this EXACT structure:

{
  "companyName": "Full legal company name",
  "ticker": "${ticker}",
  "analysisDate": "${today}",
  "executiveSummary": "2-3 sentences a smart college student can understand. What does this company do, and what's the investment story right now?",
  "analystBrief": "Dense technical paragraph for institutional investors. Reference specific revenue figures, margins, growth rates, and competitive dynamics from the data you retrieved.",
  "industryContext": "1-2 sentences on the industry, where it's heading, and this company's competitive position.",
  "financialSnapshot": {
    "revenue": "Use the revenue field from getFinancials (e.g. '$391.04B (FY2024)'). If null, write 'data unavailable — Polygon.io financials endpoint'",
    "netIncome": "Use the netIncome field from getFinancials (e.g. '$93.74B (FY2024)'). If null, write 'data unavailable'",
    "operatingMargin": "Use the operatingMargin field from getFinancials (e.g. '31.5%'). If null, write 'data unavailable'",
    "totalAssets": "Use the totalAssets field from getFinancials (e.g. '$364.98B'). If null, write 'data unavailable'",
    "debtLoad": "Use longTermDebt and cash from getFinancials to write a plain English debt assessment (e.g. 'Net cash positive — $65.2B cash vs $91.8B long-term debt'). If data unavailable, say so explicitly.",
    "cashPosition": "Use the cash field from getFinancials. If null, write 'data unavailable'",
    "revenueGrowthNote": "Comment on YoY revenue trend if inferable from news or filings, otherwise 'not available from retrieved data'",
    "epsNote": "Use dilutedEPS from getFinancials (e.g. 'Diluted EPS $6.08 (FY2024)'). Then calculate P/E: divide the getQuote closing price by dilutedEPSRaw. E.g. 'P/E ~40.8x (calculated: $247.99 / $6.08)'. If EPS is null, write 'EPS data unavailable from Polygon.io financials endpoint'"
  },
  "bullCase": {
    "headline": "Short catchy title (e.g. 'The Ecosystem Flywheel')",
    "points": [
      "First bull point with a specific number from the data",
      "Second bull point",
      "Third bull point"
    ],
    "plainEnglish": "In simple terms, why a bull investor gets excited about this stock."
  },
  "bearCase": {
    "headline": "Short catchy title (e.g. 'Peak Hardware, Peak Margins')",
    "points": [
      "First bear point with specific data",
      "Second bear point",
      "Third bear point"
    ],
    "plainEnglish": "In simple terms, why a bear investor thinks the stock is risky or overvalued."
  },
  "keyRisks": [
    "Risk 1 — specific and data-informed",
    "Risk 2",
    "Risk 3"
  ],
  "recentNewsImpact": "What the recent news headlines mean for the stock's near-term outlook.",
  "earningsQuality": "Is this company generating real cash? How do cash flows compare to reported earnings? Any red flags?",
  "data_sources": [
    "List every Polygon.io endpoint and SEC EDGAR source you actually called, e.g. 'Polygon.io /v3/reference/tickers/${ticker} — fundamentals', 'Polygon.io /v2/reference/news?ticker=${ticker} — N articles', 'Polygon.io /v2/aggs/ticker/${ticker}/prev — previous session quote', 'SEC EDGAR submissions/{cik}.json — recent filings'. Never leave this array empty."
  ],
  "researchPosture": {
    "bull_case": "Data-backed reasons the stock could perform well, sourced from tool results only",
    "bear_case": "Data-backed reasons the stock faces headwinds, sourced from tool results only",
    "key_risks": [
      "Named, sourced risk 1 — cite the specific data point",
      "Named, sourced risk 2",
      "Named, sourced risk 3"
    ],
    "data_gaps": [
      "Any metric or data point that was unavailable or missing from tool results — leave empty array if all data was retrieved"
    ]
  }
}`

  // ── SSE streaming response ────────────────────────────────
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) =>
        controller.enqueue(sseEvent(data))

      try {
        const messages: Anthropic.MessageParam[] = [
          { role: 'user', content: userPrompt },
        ]

        send({ type: 'progress', step: 'Starting AI research agent…', iteration: 0 })

        let response = await anthropic.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 8000,
          system: SYSTEM_PROMPT,
          tools,
          messages,
        })

        let iterations = 0
        const MAX_ITERATIONS = 6
        let dataFetchedAt: string | undefined

        // ── Agentic research loop ──────────────────────────
        while (response.stop_reason === 'tool_use' && iterations < MAX_ITERATIONS) {
          iterations++

          const toolUseBlocks = response.content.filter(
            (c): c is Anthropic.ToolUseBlock => c.type === 'tool_use'
          )

          // Send a progress event for each tool being called
          for (const toolUse of toolUseBlocks) {
            send({
              type: 'progress',
              step: TOOL_LABELS[toolUse.name] ?? `Running ${toolUse.name}…`,
              iteration: iterations,
              tool: toolUse.name,
            })
          }

          // Execute all tool calls in parallel
          const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
            toolUseBlocks.map(async (toolUse) => {
              const result = await executeTool(
                toolUse.name,
                toolUse.input as Record<string, string>
              )
              return {
                type: 'tool_result' as const,
                tool_use_id: toolUse.id,
                content: JSON.stringify(result),
              }
            })
          )

          dataFetchedAt = new Date().toISOString()

          // Confirm tools completed
          for (const toolUse of toolUseBlocks) {
            send({
              type: 'progress',
              step: `${TOOL_LABELS[toolUse.name] ?? toolUse.name} ✓`,
              iteration: iterations,
              tool: toolUse.name,
              done: true,
            })
          }

          messages.push({ role: 'assistant', content: response.content })
          messages.push({ role: 'user', content: toolResults })

          response = await anthropic.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 8000,
            system: SYSTEM_PROMPT,
            tools,
            messages,
          })
        }

        send({ type: 'progress', step: 'Synthesizing research summary…', iteration: iterations + 1 })

        // ── Force synthesis if loop exited while Claude still wanted tools ──
        // This happens when MAX_ITERATIONS is hit but Claude hasn't written text yet.
        // Re-call without the tools array so Claude can only respond with text.
        if (response.stop_reason === 'tool_use') {
          messages.push({ role: 'assistant', content: response.content })
          messages.push({
            role: 'user',
            content:
              'You have gathered sufficient data. Now write your complete research analysis ' +
              'in the exact JSON format specified in the original request. Do not call any more tools.',
          })
          response = await anthropic.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 8000,
            system: SYSTEM_PROMPT,
            // Omit tools — forces a text-only response
            messages,
          })
        }

        const fetchedAt = new Date().toISOString()

        // ── Extract and parse final JSON ───────────────────
        const textBlock = response.content.find(
          (c): c is Anthropic.TextBlock => c.type === 'text'
        )

        if (!textBlock) {
          send({ type: 'error', error: 'Claude did not return a text response' })
          controller.close()
          return
        }

        const raw = textBlock.text.trim()
        const stripped = raw
          .replace(/^```json\s*/i, '')
          .replace(/^```\s*/i, '')
          .replace(/\s*```$/i, '')
          .trim()

        const jsonStart = stripped.indexOf('{')
        const jsonEnd = stripped.lastIndexOf('}')

        if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) {
          console.error('[/api/analysis] No JSON object in response:', stripped.slice(0, 200))
          send({ type: 'error', error: 'Claude did not return a JSON object. Please try again.' })
          controller.close()
          return
        }

        const analysis = JSON.parse(stripped.slice(jsonStart, jsonEnd + 1))

        // ── Send the complete payload ──────────────────────
        send({
          type: 'complete',
          analysis,
          toolIterations: iterations,
          fetchedAt,
          ...(dataFetchedAt ? { dataFetchedAt } : {}),
        })

        controller.close()
      } catch (err) {
        console.error('[/api/analysis] Error:', err)
        const message =
          err instanceof SyntaxError
            ? 'Claude returned malformed JSON — try again'
            : String(err)
        controller.enqueue(sseEvent({ type: 'error', error: message }))
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
