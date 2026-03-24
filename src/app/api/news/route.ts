import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

// ── Types ────────────────────────────────────────────────────

interface NewsItem {
  id: string
  title: string
  publishedAt: string   // ISO string from Polygon
  source: string
  url: string
  tickers: string[]
}

interface NewsResponse {
  ticker: string
  results: NewsItem[]
  count: number
  fetchedAt: string     // ISO string — when our server received the Polygon response
}

// ── Route Handler ─────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const ticker = searchParams.get('ticker')?.toUpperCase().trim()

  if (!ticker) {
    return NextResponse.json(
      { error: 'ticker is required' },
      { status: 400 }
    )
  }

  // Clamp limit: default 5, max 10
  const rawLimit = parseInt(searchParams.get('limit') ?? '5', 10)
  const limit = Number.isNaN(rawLimit) ? 5 : Math.min(Math.max(rawLimit, 1), 10)

  if (process.env.NEXT_PUBLIC_USE_FIXTURES === 'true') {
    await new Promise((r) => setTimeout(r, 100))
    if (ticker !== 'AAPL') {
      return NextResponse.json(
        { error: `Ticker '${ticker}' not found. Check the symbol and try again.` },
        { status: 404 }
      )
    }

    const fixture = JSON.parse(
      fs.readFileSync(
        path.join(process.cwd(), 'src/lib/fixtures/aapl-news.json'),
        'utf-8'
      )
    ) as NewsResponse

    return NextResponse.json({
      ...fixture,
      results: fixture.results.slice(0, limit),
      count: Math.min(limit, fixture.results.length),
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
      `https://api.polygon.io/v2/reference/news?ticker=${encodeURIComponent(ticker)}&limit=${limit}&sort=published_utc&order=desc&apiKey=${apiKey}`
    )

    const fetchedAt = new Date().toISOString()
    const data = await response.json()

    if (!response.ok) {
      return NextResponse.json(
        {
          error: `News lookup failed for ticker '${ticker}'. Polygon.io returned: ${data.error ?? data.message ?? response.statusText}`,
          fetchedAt,
        },
        { status: response.status }
      )
    }

    // Polygon returns [] results for a valid but newsless ticker — treat as empty, not error
    const results: NewsItem[] = (data.results ?? []).map(
      (article: {
        id: string
        title: string
        published_utc: string
        publisher?: { name?: string }
        article_url: string
        tickers?: string[]
      }) => ({
        id: article.id,
        title: article.title,
        publishedAt: article.published_utc,
        source: article.publisher?.name ?? 'Unknown',
        url: article.article_url,
        tickers: article.tickers ?? [],
      })
    )

    const body: NewsResponse = {
      ticker,
      results,
      count: results.length,
      fetchedAt,
    }

    return NextResponse.json(body, { status: 200 })
  } catch (error) {
    console.error('[/api/news] Fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch news. Please try again.' },
      { status: 500 }
    )
  }
}
