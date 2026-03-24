import { NextResponse } from 'next/server'

interface MarketNewsItem {
  id: string
  title: string
  publishedAt: string
  source: string
  url: string
  tickers: string[]
}

interface PolygonNewsArticle {
  id?: string
  title?: string
  published_utc?: string
  article_url?: string
  publisher?: { name?: string }
  tickers?: string[]
}

const MARKET_NEWS_FIXTURE: MarketNewsItem[] = [
  {
    id: 'market-1',
    title: 'Mega-cap tech leads U.S. equities as AI spending expectations stay elevated',
    publishedAt: '2026-03-22T13:15:00.000Z',
    source: 'FixtureWire',
    url: 'https://example.com/market-tech-rally',
    tickers: ['NVDA', 'MSFT', 'AAPL'],
  },
  {
    id: 'market-2',
    title: 'Treasury yields stabilize while investors rotate into quality large caps',
    publishedAt: '2026-03-22T11:40:00.000Z',
    source: 'FixtureWire',
    url: 'https://example.com/yields-quality',
    tickers: ['SPY', 'QQQ', 'MSFT'],
  },
  {
    id: 'market-3',
    title: 'Energy and financials outperform as traders rebalance sector exposure',
    publishedAt: '2026-03-22T10:05:00.000Z',
    source: 'FixtureWire',
    url: 'https://example.com/sector-rotation',
    tickers: ['XOM', 'CVX', 'JPM'],
  },
  {
    id: 'market-4',
    title: 'Retail and cloud names remain key focus heading into next earnings cycle',
    publishedAt: '2026-03-21T18:20:00.000Z',
    source: 'FixtureWire',
    url: 'https://example.com/cloud-retail-focus',
    tickers: ['AMZN', 'CRM', 'META'],
  },
]

const MARKET_TICKERS = ['SPY', 'QQQ', 'DIA', 'AAPL', 'NVDA', 'MSFT', 'AMZN', 'TSLA']

export async function GET() {
  if (process.env.NEXT_PUBLIC_USE_FIXTURES === 'true') {
    return NextResponse.json({
      results: MARKET_NEWS_FIXTURE,
      count: MARKET_NEWS_FIXTURE.length,
      fetchedAt: new Date().toISOString(),
    })
  }

  const apiKey = process.env.POLYGON_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Polygon API key not configured' },
      { status: 500 }
    )
  }

  try {
    const response = await fetch(
      `https://api.polygon.io/v2/reference/news?limit=25&sort=published_utc&order=desc&apiKey=${apiKey}`
    )

    const data = (await response.json()) as {
      results?: PolygonNewsArticle[]
      error?: string
      message?: string
    }
    const fetchedAt = new Date().toISOString()

    if (!response.ok) {
      return NextResponse.json(
        {
          error: `Market news lookup failed. Polygon.io returned: ${data.error ?? data.message ?? response.statusText}`,
          fetchedAt,
        },
        { status: response.status }
      )
    }

    const filtered = (data.results ?? [])
      .filter((article) =>
        (article.tickers ?? []).some((ticker) => MARKET_TICKERS.includes(ticker))
      )
      .slice(0, 8)
      .map((article, index): MarketNewsItem => ({
        id: article.id ?? `market-${index}`,
        title: article.title ?? 'Untitled market headline',
        publishedAt: article.published_utc ?? fetchedAt,
        source: article.publisher?.name ?? 'Unknown',
        url: article.article_url ?? '#',
        tickers: article.tickers ?? [],
      }))

    return NextResponse.json({
      results: filtered,
      count: filtered.length,
      fetchedAt,
    })
  } catch (error) {
    console.error('[/api/market-news] Fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch market news. Please try again.' },
      { status: 500 }
    )
  }
}
