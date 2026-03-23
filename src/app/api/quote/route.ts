import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

// This TypeScript interface defines the exact shape of data we'll return.
// Think of it as a contract — if our code doesn't match this shape,
// TypeScript will catch it before it ever runs.
interface QuoteResponse {
  ticker: string
  price: number
  change: number
  changePercent: number
  barTimestamp: string  // when the trading bar occurred (from Polygon bar data)
  fetchedAt: string     // when our server received the Polygon response
}

// We export a named function called GET — Next.js sees this and automatically
// maps HTTP GET requests to /api/quote to this function.
// NextRequest gives us access to the incoming request (headers, query params, etc.)
export async function GET(request: NextRequest) {

  // Read the ?ticker= query param from the URL
  // e.g. /api/quote?ticker=AAPL
  const { searchParams } = new URL(request.url)
  const ticker = searchParams.get('ticker')?.toUpperCase()

  // If no ticker was provided, return a 400 Bad Request immediately
  if (!ticker) {
    return NextResponse.json(
      { error: 'Missing required query parameter: ticker' },
      { status: 400 }
    )
  }

  // ── Fixture mode — no external API calls ──────────────────
  if (process.env.NEXT_PUBLIC_USE_FIXTURES === 'true') {
    await new Promise((r) => setTimeout(r, 150))
    if (ticker !== 'AAPL') {
      return NextResponse.json(
        { error: `Ticker '${ticker}' not found. Check the symbol and try again.` },
        { status: 404 }
      )
    }
    const fixture = JSON.parse(
      fs.readFileSync(
        path.join(process.cwd(), 'src/lib/fixtures/aapl-quote.json'),
        'utf-8'
      )
    )
    return NextResponse.json(fixture, { status: 200 })
  }

  // process.env.POLYGON_API_KEY reads from .env.local
  // This only works server-side — it would be undefined in a client component
  const apiKey = process.env.POLYGON_API_KEY

  if (!apiKey) {
    return NextResponse.json(
      { error: 'Polygon API key not configured' },
      { status: 500 }
    )
  }

  try {
    // Polygon's snapshot endpoint returns real-time quote data
    const response = await fetch(
      `https://api.polygon.io/v2/aggs/ticker/${ticker}/prev?adjusted=true&apiKey=${apiKey}`,
      { next: { revalidate: 3600 } } // Cache for 1 hour since it's previous day data
    )
    const fetchedAt = new Date().toISOString()

    if (!response.ok) {
      return NextResponse.json(
        { error: `Polygon API returned an error: ${response.status} ${response.statusText}` },
        { status: response.status }
      )
    }

    const data = await response.json()

    // Previous day endpoint returns results as an array
    if (!data.results || data.results.length === 0) {
      return NextResponse.json(
        { error: `Ticker "${ticker}" not found. Check the symbol and try again.` },
        { status: 404 }
      )
    }

    const day = data.results[0]
    const result: QuoteResponse = {
      ticker: ticker,
      price: day.c,                                    // closing price
      change: day.c - day.o,                           // close minus open
      changePercent: ((day.c - day.o) / day.o) * 100, // percent change
      barTimestamp: new Date(day.t).toISOString(),     // when the trading bar occurred
      fetchedAt,                                       // when our server received this data
    }

    return NextResponse.json(result, { status: 200 })

  } catch (error) {
    // This catches network failures, JSON parse errors, etc.
    console.error('Polygon API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch quote data. Please try again.' },
      { status: 500 }
    )
  }
}
