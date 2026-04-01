#!/usr/bin/env node

const assert = require('node:assert/strict')
const fs = require('node:fs')
const Module = require('node:module')
const ts = require('typescript')

const originalTsHandler = Module._extensions['.ts']
const originalFetch = global.fetch

Module._extensions['.ts'] = function compileTs(module, filename) {
  const source = fs.readFileSync(filename, 'utf8')
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
    fileName: filename,
  })

  module._compile(transpiled.outputText, filename)
}

const toolExecutor = require('../src/lib/tool-executor.ts')

let passed = 0
let failed = 0

function pass(label) {
  console.log(`PASS ${label}`)
  passed += 1
}

function fail(label, error) {
  console.error(`FAIL ${label}`)
  console.error(error instanceof Error ? error.message : String(error))
  failed += 1
}

async function runCase(label, fn) {
  try {
    await fn()
    pass(label)
  } catch (error) {
    fail(label, error)
  }
}

function makeJsonResponse({ ok = true, status = 200, json, text }) {
  return {
    ok,
    status,
    async json() {
      return json
    },
    async text() {
      return text ?? ''
    },
  }
}

function setFetchMock(handler) {
  global.fetch = async (input) => handler(String(input))
}

async function main() {
  await runCase('successful Polygon response returns success envelope', async () => {
    setFetchMock((url) => {
      assert.match(url, /polygon\.io\/v2\/aggs\/ticker\/AAPL\/prev/i)
      return makeJsonResponse({
        json: {
          results: [{ c: 101, o: 99, h: 102, l: 98, v: 1000, vw: 100.3, t: Date.UTC(2026, 2, 26) }],
        },
      })
    })

    const result = await toolExecutor.getQuote('AAPL')
    assert.equal(result.status, 'success')
    assert.equal(result.source, 'Polygon.io /v2/aggs/ticker/{ticker}/prev')
    assert.equal(result.data.ticker, 'AAPL')
    assert.equal(typeof result.fetchedAt, 'string')
  })

  await runCase('Polygon failure returns error envelope', async () => {
    setFetchMock(() => makeJsonResponse({ ok: false, status: 503 }))
    const result = await toolExecutor.getFundamentals('AAPL')
    assert.equal(result.status, 'error')
    assert.match(result.error, /503/)
    assert.equal(result.data, null)
  })

  await runCase('successful EDGAR response returns success envelope', async () => {
    setFetchMock((url) => {
      assert.match(url, /data\.sec\.gov\/submissions\/CIK0000320193\.json/i)
      return makeJsonResponse({
        json: {
          name: 'Apple Inc.',
          cik: '0000320193',
          sicDescription: 'Electronic Computers',
          filings: {
            recent: {
              form: ['10-Q'],
              filingDate: ['2026-01-30'],
              reportDate: ['2025-12-31'],
              primaryDocDescription: ['Quarterly report'],
              accessionNumber: ['0000320193-26-000010'],
            },
          },
        },
      })
    })

    const result = await toolExecutor.getRecentFilings('0000320193')
    assert.equal(result.status, 'success')
    assert.equal(result.data.companyName, 'Apple Inc.')
    assert.equal(result.data.recentFilings.length, 1)
  })

  await runCase('EDGAR failure returns error envelope', async () => {
    setFetchMock(() => makeJsonResponse({ ok: false, status: 404 }))
    const result = await toolExecutor.getRecentFilings('0000320193')
    assert.equal(result.status, 'error')
    assert.match(result.error, /404/)
  })

  await runCase('partial missing-data case returns success with gaps', async () => {
    setFetchMock(() =>
      makeJsonResponse({
        json: {
          results: {
            ticker: 'AAPL',
            name: 'Apple Inc.',
            market_cap: null,
            total_employees: null,
            sic_description: null,
            description: null,
          },
        },
      })
    )

    const result = await toolExecutor.getFundamentals('AAPL')
    assert.equal(result.status, 'success')
    assert.ok(Array.isArray(result.gaps))
    assert.ok(result.gaps.length > 0)
    assert.match(result.gaps.join(' '), /Market cap unavailable/i)
  })
}

main()
  .catch((error) => {
    fail('tool executor test harness crashed', error)
  })
  .finally(() => {
    global.fetch = originalFetch
    Module._extensions['.ts'] = originalTsHandler

    if (failed > 0) {
      process.exit(1)
    }

    console.log(`PASS tool executor envelope cases: ${passed}`)
  })
