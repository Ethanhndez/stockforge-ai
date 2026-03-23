#!/usr/bin/env node
// scripts/smokeTest.js
// Smoke test for StockForge AI — runs against fixture mode (no real API calls).
// Requires: dev server already running with NEXT_PUBLIC_USE_FIXTURES=true
// Usage:  npm run test:smoke
//         BASE_URL=http://localhost:3001 node scripts/smokeTest.js
//
// Node.js built-ins only — no test framework required.

let http

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'
let passed = 0
let failed = 0

function assert(label, condition) {
  if (condition) {
    console.log(`  ✓ ${label}`)
    passed++
  } else {
    console.error(`  ✗ FAIL: ${label}`)
    failed++
  }
}

function get(urlPath) {
  return new Promise((resolve, reject) => {
    http.get(`${BASE_URL}${urlPath}`, (res) => {
      let body = ''
      res.on('data', (chunk) => (body += chunk))
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(body) })
        } catch {
          resolve({ status: res.statusCode, body })
        }
      })
    }).on('error', reject)
  })
}

function readSse(urlPath, postBody) {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(postBody)
    const url = new URL(`${BASE_URL}${urlPath}`)
    const options = {
      hostname: url.hostname,
      port: parseInt(url.port) || 3000,
      path: urlPath,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr),
      },
    }

    const req = http.request(options, (res) => {
      const events = []
      let buffer = ''
      let completed = null

      res.on('data', (chunk) => {
        buffer += chunk.toString()
        const parts = buffer.split('\n\n')
        buffer = parts.pop() ?? ''
        for (const part of parts) {
          const line = part.trim()
          if (!line.startsWith('data: ')) continue
          try {
            const event = JSON.parse(line.slice(6))
            events.push(event)
            if (event.type === 'complete' || event.type === 'error') {
              completed = event
            }
          } catch { /* skip malformed */ }
        }
      })

      res.on('end', () => resolve({ events, completed }))
      res.on('error', reject)
    })

    req.on('error', reject)
    req.write(bodyStr)
    req.end()
  })
}

async function runSuite() {
  if (!http) {
    http = await import('node:http')
  }

  console.log('\nStockForge AI — Smoke Test Suite')
  console.log('=================================')
  console.log(`Target: ${BASE_URL}`)
  console.log('Requires: dev server running in fixture mode\n')

  // ── Suite 1: POST /api/analysis — AAPL ────────────────────
  console.log('Suite 1: POST /api/analysis { ticker: "AAPL" }')
  try {
    const { events, completed } = await readSse('/api/analysis', { ticker: 'AAPL' })
    const progressEvents = events.filter((e) => e.type === 'progress')
    assert('Receives ≥3 progress events before complete', progressEvents.length >= 3)
    assert('Complete event received', completed?.type === 'complete')
    const analysis = completed?.analysis
    assert('analysis.data_sources is non-empty array', Array.isArray(analysis?.data_sources) && analysis.data_sources.length > 0)
    assert('analysis.bullCase exists', !!analysis?.bullCase?.headline)
    assert('analysis.bearCase exists', !!analysis?.bearCase?.headline)
    assert('analysis.financialSnapshot.revenue present', !!analysis?.financialSnapshot?.revenue)
    assert('financialSnapshot.revenue not null/empty string', analysis?.financialSnapshot?.revenue !== 'null' && analysis?.financialSnapshot?.revenue !== '')
    assert('No buy/sell/hold language in bullCase', !/\b(buy|sell|hold)\b/i.test(analysis?.bullCase?.plainEnglish ?? ''))
    assert('No buy/sell/hold language in bearCase', !/\b(buy|sell|hold)\b/i.test(analysis?.bearCase?.plainEnglish ?? ''))
  } catch (err) {
    console.error(`  ✗ FAIL: Suite 1 threw: ${err.message}`)
    failed++
  }

  // ── Suite 2: POST /api/analysis — bad ticker ───────────────
  console.log('\nSuite 2: POST /api/analysis { ticker: "XXXXXXX" }')
  try {
    const { completed } = await readSse('/api/analysis', { ticker: 'XXXXXXX' })
    assert('Error event received for bad ticker', completed?.type === 'error')
    assert('Error message references ticker', /XXXXXXX/i.test(completed?.error ?? ''))
  } catch (err) {
    console.error(`  ✗ FAIL: Suite 2 threw: ${err.message}`)
    failed++
  }

  // ── Suite 3: GET /api/quote — AAPL ────────────────────────
  console.log('\nSuite 3: GET /api/quote?ticker=AAPL')
  try {
    const { status, body } = await get('/api/quote?ticker=AAPL')
    assert('Returns 200', status === 200)
    assert('body.ticker is AAPL', body?.ticker === 'AAPL')
    assert('body.price is positive number', typeof body?.price === 'number' && body.price > 0)
  } catch (err) {
    console.error(`  ✗ FAIL: Suite 3 threw: ${err.message}`)
    failed++
  }

  // ── Suite 4: GET /api/quote — bad ticker ──────────────────
  console.log('\nSuite 4: GET /api/quote?ticker=XXXXXXX')
  try {
    const { status, body } = await get('/api/quote?ticker=XXXXXXX')
    assert('Returns non-200 for bad ticker (not 500)', status !== 500 && status !== 200)
    assert('body.error is present', typeof body?.error === 'string' && body.error.length > 0)
  } catch (err) {
    console.error(`  ✗ FAIL: Suite 4 threw: ${err.message}`)
    failed++
  }

  // ── Suite 5: GET /api/search — Apple ──────────────────────
  console.log('\nSuite 5: GET /api/search?q=Apple')
  try {
    const { status, body } = await get('/api/search?q=Apple')
    assert('Returns 200', status === 200)
    assert('Search returns at least one result', Array.isArray(body?.results) && body.results.length > 0)
    assert('First search result is AAPL', body?.results?.[0]?.ticker === 'AAPL')
  } catch (err) {
    console.error(`  ✗ FAIL: Suite 5 threw: ${err.message}`)
    failed++
  }

  // ── Suite 6: GET /api/news — AAPL ─────────────────────────
  console.log('\nSuite 6: GET /api/news?ticker=AAPL&limit=1')
  try {
    const { status, body } = await get('/api/news?ticker=AAPL&limit=1')
    assert('Returns 200', status === 200)
    assert('News returns exactly one fixture item', body?.count === 1 && body?.results?.length === 1)
    assert('News item has title', typeof body?.results?.[0]?.title === 'string' && body.results[0].title.length > 0)
  } catch (err) {
    console.error(`  ✗ FAIL: Suite 6 threw: ${err.message}`)
    failed++
  }

  // ── Suite 7: GET /api/fundamentals — AAPL ────────────────
  console.log('\nSuite 7: GET /api/fundamentals?ticker=AAPL')
  try {
    const { status, body } = await get('/api/fundamentals?ticker=AAPL')
    assert('Returns 200', status === 200)
    assert('Fundamentals ticker is AAPL', body?.ticker === 'AAPL')
    assert('Fundamentals name is present', typeof body?.name === 'string' && body.name.length > 0)
    assert('Market cap is numeric or null', typeof body?.marketCap === 'number' || body?.marketCap === null)
  } catch (err) {
    console.error(`  ✗ FAIL: Suite 7 threw: ${err.message}`)
    failed++
  }

  // ── Suite 8: GET /api/sectors — Technology ───────────────
  console.log('\nSuite 8: GET /api/sectors?sector=Technology')
  try {
    const { status, body } = await get('/api/sectors?sector=Technology')
    assert('Returns 200', status === 200)
    assert('Sector response is Technology', body?.sector === 'Technology')
    assert('Sector trending list has items', Array.isArray(body?.trending) && body.trending.length > 0)
    assert('Sector first item has sparkline array', Array.isArray(body?.trending?.[0]?.sparkline))
  } catch (err) {
    console.error(`  ✗ FAIL: Suite 8 threw: ${err.message}`)
    failed++
  }

  // ── Result ─────────────────────────────────────────────────
  console.log('\n=================================')
  console.log(`Results: ${passed} passed, ${failed} failed`)
  if (failed > 0) {
    console.error('SMOKE TEST FAILED')
    process.exit(1)
  } else {
    console.log('SMOKE TEST PASSED')
    process.exit(0)
  }
}

runSuite()
