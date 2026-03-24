import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

interface SearchResult {
  ticker: string
  name: string
  exchange: string
}

interface SearchResponse {
  results: SearchResult[]
  count: number
  fetchedAt: string   // when our server received the Polygon response
  message?: string    // present when results are empty but the request was valid
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const rawQuery = searchParams.get('q')

  // ── Input validation ─────────────────────────────────────
  if (rawQuery === null) {
    return NextResponse.json(
      { error: 'query is required', fetchedAt: new Date().toISOString() },
      { status: 400 }
    )
  }

  const query = rawQuery.trim()

  if (query.length === 0) {
    return NextResponse.json(
      { error: 'Search query cannot be empty', fetchedAt: new Date().toISOString() },
      { status: 400 }
    )
  }

  if (query.length < 2) {
    return NextResponse.json(
      { error: 'Search query must be at least 2 characters', fetchedAt: new Date().toISOString() },
      { status: 400 }
    )
  }

  if (process.env.NEXT_PUBLIC_USE_FIXTURES === 'true') {
    await new Promise((r) => setTimeout(r, 100))
    const fetchedAt = new Date().toISOString()

    if (['aapl', 'apple'].some((term) => query.toLowerCase().includes(term))) {
      const fixture = JSON.parse(
        fs.readFileSync(
          path.join(process.cwd(), 'src/lib/fixtures/aapl-search.json'),
          'utf-8'
        )
      ) as SearchResponse

      return NextResponse.json({ ...fixture, fetchedAt })
    }

    return NextResponse.json({
      results: [],
      count: 0,
      message: `No tickers found matching '${query}'`,
      fetchedAt,
    } satisfies SearchResponse)
  }

  const apiKey = process.env.POLYGON_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'API key not configured' },
      { status: 500 }
    )
  }

  try {
    const response = await fetch(
      `https://api.polygon.io/v3/reference/tickers?search=${encodeURIComponent(query)}&active=true&market=stocks&limit=6&apiKey=${apiKey}`,
      { next: { revalidate: 3600 } }
    )

    const data = await response.json()
    const fetchedAt = new Date().toISOString()

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Search failed. Please try again.', fetchedAt },
        { status: response.status }
      )
    }

    // Shape the results into something clean for our UI
    const results: SearchResult[] = (data.results ?? []).map((r: {
      ticker: string
      name: string
      primary_exchange?: string
    }) => ({
      ticker: r.ticker,
      name: r.name,
      exchange: r.primary_exchange ?? '',
    }))

    // Valid request, empty results — keep 200 but include a message so the
    // UI has something to display rather than silently showing nothing
    if (results.length === 0) {
      const body: SearchResponse = {
        results: [],
        count: 0,
        message: `No tickers found matching '${query}'`,
        fetchedAt,
      }
      return NextResponse.json(body)
    }

    const body: SearchResponse = { results, count: results.length, fetchedAt }
    return NextResponse.json(body)
  } catch {
    return NextResponse.json(
      { error: 'Search failed. Please try again.', fetchedAt: new Date().toISOString() },
      { status: 500 }
    )
  }
}
