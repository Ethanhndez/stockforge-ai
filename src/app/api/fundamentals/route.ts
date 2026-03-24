import { NextRequest, NextResponse } from 'next/server'
interface FundamentalsResponse {
  ticker: string
  name: string
  marketCap: number | null
  peRatio: number | null
  revenueLastYear: number | null
  dilutedEPS: number | null
  employees: number | null
  sector: string | null
  industry: string | null
  description: string | null
  fetchedAt: string
}

const FIXTURE_FUNDAMENTALS: Record<string, Omit<FundamentalsResponse, 'fetchedAt'>> = {
  AAPL: {
    ticker: 'AAPL',
    name: 'Apple Inc.',
    marketCap: 3_480_000_000_000,
    peRatio: 37.4,
    revenueLastYear: 391_040_000_000,
    dilutedEPS: 6.08,
    employees: 161_000,
    sector: 'Electronic Computers',
    industry: 'Electronic Computers',
    description:
      'Apple designs, manufactures, and markets smartphones, personal computers, tablets, wearables, and services.',
  },
  NVDA: {
    ticker: 'NVDA',
    name: 'NVIDIA Corporation',
    marketCap: 2_250_000_000_000,
    peRatio: 75.6,
    revenueLastYear: 60_920_000_000,
    dilutedEPS: 12.07,
    employees: 29_600,
    sector: 'Semiconductors',
    industry: 'Semiconductors',
    description:
      'NVIDIA designs GPUs, AI computing platforms, networking infrastructure, and accelerated data center systems.',
  },
  TSLA: {
    ticker: 'TSLA',
    name: 'Tesla, Inc.',
    marketCap: 563_000_000_000,
    peRatio: 58.9,
    revenueLastYear: 96_770_000_000,
    dilutedEPS: 3.0,
    employees: 140_500,
    sector: 'Motor Vehicles & Passenger Car Bodies',
    industry: 'Motor Vehicles & Passenger Car Bodies',
    description:
      'Tesla designs and manufactures electric vehicles, battery storage systems, charging infrastructure, and energy software.',
  },
  MSFT: {
    ticker: 'MSFT',
    name: 'Microsoft Corporation',
    marketCap: 3_260_000_000_000,
    peRatio: 39.8,
    revenueLastYear: 245_120_000_000,
    dilutedEPS: 11.02,
    employees: 221_000,
    sector: 'Prepackaged Software',
    industry: 'Prepackaged Software',
    description:
      'Microsoft develops cloud infrastructure, productivity software, enterprise tools, gaming platforms, and AI services.',
  },
  AMZN: {
    ticker: 'AMZN',
    name: 'Amazon.com, Inc.',
    marketCap: 1_910_000_000_000,
    peRatio: 50.3,
    revenueLastYear: 574_780_000_000,
    dilutedEPS: 3.62,
    employees: 1_525_000,
    sector: 'Retail-Catalog & Mail-Order Houses',
    industry: 'Retail-Catalog & Mail-Order Houses',
    description:
      'Amazon operates e-commerce marketplaces, AWS cloud infrastructure, logistics networks, advertising products, and consumer subscriptions.',
  },
}

interface PolygonTickerDetails {
  ticker?: string
  name?: string
  market_cap?: number | null
  total_employees?: number | null
  sic_description?: string | null
  description?: string | null
}

interface PolygonFinancialsResponse {
  results?: Array<{
    financials?: {
      income_statement?: {
        revenues?: { value?: number }
        diluted_earnings_per_share?: { value?: number }
      }
    }
  }>
}

interface PolygonPrevDayResponse {
  results?: Array<{
    c?: number
  }>
}

function valueOfNumberField(field?: { value?: number }): number | null {
  return typeof field?.value === 'number' ? field.value : null
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const ticker = searchParams.get('ticker')?.toUpperCase().trim()

  if (!ticker) {
    return NextResponse.json({ error: 'ticker is required' }, { status: 400 })
  }

  if (process.env.NEXT_PUBLIC_USE_FIXTURES === 'true') {
    await new Promise((r) => setTimeout(r, 100))
    const fixture = FIXTURE_FUNDAMENTALS[ticker]
    if (!fixture) {
      return NextResponse.json(
        { error: `Fundamentals not found for ticker '${ticker}'.` },
        { status: 404 }
      )
    }

    return NextResponse.json({
      ...fixture,
      fetchedAt: new Date().toISOString(),
    } satisfies FundamentalsResponse)
  }

  const apiKey = process.env.POLYGON_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Polygon API key not configured' },
      { status: 500 }
    )
  }

  try {
    const detailsUrl =
      `https://api.polygon.io/v3/reference/tickers/${encodeURIComponent(ticker)}?apiKey=${apiKey}`
    const financialsUrl =
      `https://api.polygon.io/vX/reference/financials?ticker=${encodeURIComponent(ticker)}&timeframe=annual&limit=1&apiKey=${apiKey}`
    const prevDayUrl =
      `https://api.polygon.io/v2/aggs/ticker/${encodeURIComponent(ticker)}/prev?adjusted=true&apiKey=${apiKey}`

    const [detailsRes, financialsRes, prevDayRes] = await Promise.all([
      fetch(detailsUrl),
      fetch(financialsUrl),
      fetch(prevDayUrl),
    ])

    const fetchedAt = new Date().toISOString()
    const detailsData = (await detailsRes.json()) as { results?: PolygonTickerDetails; error?: string; message?: string }

    if (!detailsRes.ok) {
      return NextResponse.json(
        {
          error: `Fundamentals lookup failed for ticker '${ticker}'. Polygon.io returned: ${detailsData.error ?? detailsData.message ?? detailsRes.statusText}`,
          fetchedAt,
        },
        { status: detailsRes.status }
      )
    }

    if (!detailsData.results) {
      return NextResponse.json(
        { error: `Fundamentals not found for ticker '${ticker}'.`, fetchedAt },
        { status: 404 }
      )
    }

    let revenueLastYear: number | null = null
    let dilutedEPS: number | null = null
    if (financialsRes.ok) {
      const financialsData = (await financialsRes.json()) as PolygonFinancialsResponse
      const latest = financialsData.results?.[0]
      revenueLastYear = valueOfNumberField(latest?.financials?.income_statement?.revenues)
      dilutedEPS = valueOfNumberField(
        latest?.financials?.income_statement?.diluted_earnings_per_share
      )
    }

    let peRatio: number | null = null
    if (prevDayRes.ok && dilutedEPS && dilutedEPS > 0) {
      const prevDayData = (await prevDayRes.json()) as PolygonPrevDayResponse
      const price = prevDayData.results?.[0]?.c
      if (typeof price === 'number') {
        peRatio = Number((price / dilutedEPS).toFixed(1))
      }
    }

    const r = detailsData.results

    const body: FundamentalsResponse = {
      ticker: r.ticker ?? ticker,
      name: r.name ?? ticker,
      marketCap: r.market_cap ?? null,
      peRatio,
      revenueLastYear,
      dilutedEPS,
      employees: r.total_employees ?? null,
      sector: r.sic_description ?? null,
      industry: r.sic_description ?? null,
      description: r.description ?? null,
      fetchedAt,
    }

    return NextResponse.json(body, { status: 200 })
  } catch (error) {
    console.error('[/api/fundamentals] Fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch fundamentals. Please try again.' },
      { status: 500 }
    )
  }
}
