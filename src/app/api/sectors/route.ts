// ============================================================
// src/app/api/sectors/route.ts
// Returns top 5 "trending" stocks for a given industry sector.
// "Trending" = sorted by highest absolute % price change (prev day).
// Data source: Polygon.io prev-day OHLC (free tier compatible).
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const POLYGON_API_KEY = process.env.POLYGON_API_KEY

// ── Curated stock universe per sector ────────────────────────
// Each sector has 8–10 well-known, liquid stocks.
// We fetch prev-day prices for all of them, sort by |% change|,
// and return the top 5 — so the "top 5" changes every day.

const SECTOR_STOCKS: Record<string, { ticker: string; name: string }[]> = {
  Technology: [
    { ticker: 'NVDA', name: 'NVIDIA' },
    { ticker: 'AAPL', name: 'Apple' },
    { ticker: 'MSFT', name: 'Microsoft' },
    { ticker: 'META', name: 'Meta' },
    { ticker: 'GOOGL', name: 'Alphabet' },
    { ticker: 'AMD', name: 'AMD' },
    { ticker: 'CRM', name: 'Salesforce' },
    { ticker: 'ORCL', name: 'Oracle' },
    { ticker: 'ADBE', name: 'Adobe' },
    { ticker: 'INTC', name: 'Intel' },
  ],
  Healthcare: [
    { ticker: 'LLY', name: 'Eli Lilly' },
    { ticker: 'UNH', name: 'UnitedHealth' },
    { ticker: 'JNJ', name: 'Johnson & Johnson' },
    { ticker: 'ABBV', name: 'AbbVie' },
    { ticker: 'MRK', name: 'Merck' },
    { ticker: 'PFE', name: 'Pfizer' },
    { ticker: 'TMO', name: 'Thermo Fisher' },
    { ticker: 'ABT', name: 'Abbott' },
    { ticker: 'AMGN', name: 'Amgen' },
    { ticker: 'GILD', name: 'Gilead Sciences' },
  ],
  Financials: [
    { ticker: 'JPM', name: 'JPMorgan Chase' },
    { ticker: 'BAC', name: 'Bank of America' },
    { ticker: 'GS', name: 'Goldman Sachs' },
    { ticker: 'MS', name: 'Morgan Stanley' },
    { ticker: 'WFC', name: 'Wells Fargo' },
    { ticker: 'BLK', name: 'BlackRock' },
    { ticker: 'SPGI', name: 'S&P Global' },
    { ticker: 'AXP', name: 'American Express' },
    { ticker: 'V', name: 'Visa' },
    { ticker: 'MA', name: 'Mastercard' },
  ],
  Energy: [
    { ticker: 'XOM', name: 'ExxonMobil' },
    { ticker: 'CVX', name: 'Chevron' },
    { ticker: 'COP', name: 'ConocoPhillips' },
    { ticker: 'EOG', name: 'EOG Resources' },
    { ticker: 'SLB', name: 'SLB' },
    { ticker: 'PSX', name: 'Phillips 66' },
    { ticker: 'MPC', name: 'Marathon Petroleum' },
    { ticker: 'VLO', name: 'Valero Energy' },
    { ticker: 'OXY', name: 'Occidental' },
    { ticker: 'HAL', name: 'Halliburton' },
  ],
  'Consumer Discretionary': [
    { ticker: 'AMZN', name: 'Amazon' },
    { ticker: 'TSLA', name: 'Tesla' },
    { ticker: 'HD', name: 'Home Depot' },
    { ticker: 'MCD', name: "McDonald's" },
    { ticker: 'NKE', name: 'Nike' },
    { ticker: 'SBUX', name: 'Starbucks' },
    { ticker: 'LOW', name: "Lowe's" },
    { ticker: 'BKNG', name: 'Booking Holdings' },
    { ticker: 'CMG', name: 'Chipotle' },
    { ticker: 'TGT', name: 'Target' },
  ],
  'Consumer Staples': [
    { ticker: 'WMT', name: 'Walmart' },
    { ticker: 'PG', name: 'Procter & Gamble' },
    { ticker: 'KO', name: 'Coca-Cola' },
    { ticker: 'PEP', name: 'PepsiCo' },
    { ticker: 'COST', name: 'Costco' },
    { ticker: 'PM', name: 'Philip Morris' },
    { ticker: 'MO', name: 'Altria' },
    { ticker: 'CL', name: 'Colgate-Palmolive' },
    { ticker: 'KHC', name: 'Kraft Heinz' },
    { ticker: 'GIS', name: 'General Mills' },
  ],
  Industrials: [
    { ticker: 'CAT', name: 'Caterpillar' },
    { ticker: 'HON', name: 'Honeywell' },
    { ticker: 'UPS', name: 'UPS' },
    { ticker: 'DE', name: 'John Deere' },
    { ticker: 'BA', name: 'Boeing' },
    { ticker: 'RTX', name: 'RTX Corp' },
    { ticker: 'LMT', name: 'Lockheed Martin' },
    { ticker: 'GE', name: 'GE Aerospace' },
    { ticker: 'FDX', name: 'FedEx' },
    { ticker: 'CSX', name: 'CSX Corp' },
  ],
  'Comm. Services': [
    { ticker: 'META', name: 'Meta' },
    { ticker: 'GOOGL', name: 'Alphabet' },
    { ticker: 'NFLX', name: 'Netflix' },
    { ticker: 'DIS', name: 'Disney' },
    { ticker: 'CMCSA', name: 'Comcast' },
    { ticker: 'T', name: 'AT&T' },
    { ticker: 'VZ', name: 'Verizon' },
    { ticker: 'SNAP', name: 'Snap' },
    { ticker: 'SPOT', name: 'Spotify' },
    { ticker: 'PINS', name: 'Pinterest' },
  ],
  'Real Estate': [
    { ticker: 'AMT', name: 'American Tower' },
    { ticker: 'PLD', name: 'Prologis' },
    { ticker: 'EQIX', name: 'Equinix' },
    { ticker: 'CCI', name: 'Crown Castle' },
    { ticker: 'PSA', name: 'Public Storage' },
    { ticker: 'DLR', name: 'Digital Realty' },
    { ticker: 'O', name: 'Realty Income' },
    { ticker: 'AVB', name: 'AvalonBay' },
    { ticker: 'SPG', name: 'Simon Property' },
    { ticker: 'WY', name: 'Weyerhaeuser' },
  ],
  Utilities: [
    { ticker: 'NEE', name: 'NextEra Energy' },
    { ticker: 'DUK', name: 'Duke Energy' },
    { ticker: 'SO', name: 'Southern Co' },
    { ticker: 'AEP', name: 'American Electric' },
    { ticker: 'D', name: 'Dominion Energy' },
    { ticker: 'EXC', name: 'Exelon' },
    { ticker: 'XEL', name: 'Xcel Energy' },
    { ticker: 'PCG', name: 'PG&E' },
    { ticker: 'ED', name: 'Con Edison' },
    { ticker: 'ES', name: 'Eversource' },
  ],
}

// ── Fetch 7-day closing prices for sparkline ─────────────────
// Uses Polygon's daily aggregates endpoint (free tier compatible).
// We request 14 calendar days to guarantee ~7 trading days back.

async function fetchSparkline(ticker: string): Promise<number[]> {
  try {
    const now = new Date()
    // End: yesterday
    const end = new Date(now)
    end.setDate(end.getDate() - 1)
    // Start: 18 calendar days ago (covers weekends + holidays for ~7 trading days)
    const start = new Date(now)
    start.setDate(start.getDate() - 18)

    const from = start.toISOString().split('T')[0]
    const to = end.toISOString().split('T')[0]

    const res = await fetch(
      `https://api.polygon.io/v2/aggs/ticker/${ticker}/range/1/day/${from}/${to}?adjusted=true&sort=asc&limit=10&apiKey=${POLYGON_API_KEY}`,
      { next: { revalidate: 300 } }
    )
    if (!res.ok) return []
    const data = await res.json() as { results?: Array<{ c: number }> }
    // Return just the closing prices — that's all the sparkline needs
    return (data.results ?? []).map((r) => r.c)
  } catch {
    return []
  }
}

// ── Fetch previous day price + sparkline for a single ticker ──

async function fetchPrevDay(ticker: string, name: string) {
  try {
    // Fetch both in parallel — prev day data + sparkline history
    const [prevRes, sparkline] = await Promise.all([
      fetch(
        `https://api.polygon.io/v2/aggs/ticker/${ticker}/prev?adjusted=true&apiKey=${POLYGON_API_KEY}`,
        { next: { revalidate: 300 } }
      ),
      fetchSparkline(ticker),
    ])

    if (!prevRes.ok) return null
    const data = await prevRes.json()
    const r = data.results?.[0]
    if (!r) return null

    const change = r.c - r.o
    const changePct = (change / r.o) * 100

    return {
      ticker,
      name,
      price: r.c,
      change: +change.toFixed(2),
      changePct: +changePct.toFixed(2),
      absChangePct: Math.abs(changePct),
      volume: r.v,
      sparkline, // array of closing prices, e.g. [182.3, 183.1, 181.9, ...]
    }
  } catch {
    return null
  }
}

// ── Route Handler ─────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const sector = searchParams.get('sector') || ''

  if (process.env.NEXT_PUBLIC_USE_FIXTURES === 'true') {
    await new Promise((r) => setTimeout(r, 120))

    if (!SECTOR_STOCKS[sector]) {
      return NextResponse.json(
        {
          error: `Unknown sector "${sector}". Valid sectors: ${Object.keys(SECTOR_STOCKS).join(', ')}`,
        },
        { status: 400 }
      )
    }

    if (sector !== 'Technology') {
      return NextResponse.json({
        sector,
        trending: [],
        totalFetched: 0,
        fetchedAt: new Date().toISOString(),
      })
    }

    const fixture = JSON.parse(
      fs.readFileSync(
        path.join(process.cwd(), 'src/lib/fixtures/technology-sector.json'),
        'utf-8'
      )
    ) as {
      sector: string
      trending: Array<Record<string, unknown>>
      totalFetched: number
      fetchedAt: string
    }

    return NextResponse.json({
      ...fixture,
      fetchedAt: new Date().toISOString(),
    })
  }

  if (!POLYGON_API_KEY) {
    return NextResponse.json(
      { error: 'Polygon API key not configured' },
      { status: 500 }
    )
  }

  const stocks = SECTOR_STOCKS[sector]
  if (!stocks) {
    return NextResponse.json(
      {
        error: `Unknown sector "${sector}". Valid sectors: ${Object.keys(SECTOR_STOCKS).join(', ')}`,
      },
      { status: 400 }
    )
  }

  // Fetch in batches of 5 with a 300ms pause between batches.
  // Each stock now makes 2 Polygon calls (prev day + sparkline), so 10 stocks
  // in parallel = 20 simultaneous requests — enough to trigger free-tier rate limits.
  const results: Awaited<ReturnType<typeof fetchPrevDay>>[] = []
  const BATCH = 5
  for (let i = 0; i < stocks.length; i += BATCH) {
    const batch = stocks.slice(i, i + BATCH)
    const batchResults = await Promise.all(batch.map((s) => fetchPrevDay(s.ticker, s.name)))
    results.push(...batchResults)
    if (i + BATCH < stocks.length) {
      await new Promise((r) => setTimeout(r, 300))
    }
  }
  // Stamp after all batches complete — this is when all Polygon data arrived at our server
  const fetchedAt = new Date().toISOString()

  // Filter out nulls (failed fetches), sort by highest absolute % change
  const valid = results
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => b.absChangePct - a.absChangePct)

  if (valid.length === 0) {
    return NextResponse.json(
      {
        error: `No sector data could be retrieved for "${sector}".`,
        fetchedAt,
      },
      { status: 502 }
    )
  }

  // Return top 5 trending + the full sector list for reference
  return NextResponse.json({
    sector,
    trending: valid.slice(0, 5),
    totalFetched: valid.length,
    fetchedAt,
  })
}

// Also export the sector list so the frontend can build the tabs
export const SECTORS = Object.keys(SECTOR_STOCKS)
