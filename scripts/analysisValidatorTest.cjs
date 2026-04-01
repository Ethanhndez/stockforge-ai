#!/usr/bin/env node

const assert = require('node:assert/strict')
const fs = require('node:fs')
const Module = require('node:module')
const path = require('node:path')
const ts = require('typescript')

const originalTsHandler = Module._extensions['.ts']

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

const { validateCanonicalAnalysis } = require('../src/lib/ai/analysis-validator.ts')

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

function runCase(label, fn) {
  try {
    fn()
    pass(label)
  } catch (error) {
    fail(label, error)
  }
}

function buildValidCanonicalOutput() {
  return {
    symbol: 'AAPL',
    companyName: 'Apple Inc.',
    dataSourcesUsed: ['Polygon.io /v2/aggs/ticker/AAPL/prev'],
    bullCase: [
      {
        statement: 'Services revenue remains durable against hardware cyclicality.',
        sources: ['Polygon.io /v3/reference/tickers/AAPL'],
      },
    ],
    bearCase: [
      {
        statement: 'China competition and regulation remain material risks.',
        sources: ['SEC EDGAR filings'],
      },
    ],
    keyMetrics: [
      {
        name: 'Revenue',
        value: '$100B',
        source: 'Polygon.io /vX/reference/financials',
      },
    ],
    risks: [
      {
        statement: 'Margin compression remains possible.',
        sources: ['Polygon.io /vX/reference/financials'],
      },
    ],
    missingData: ['No quarterly geographic revenue split retrieved.'],
    toolErrors: [],
    executionPath: 'parallel',
  }
}

runCase('valid canonical output passes', () => {
  const result = validateCanonicalAnalysis(buildValidCanonicalOutput())
  assert.equal(result.ok, true)
  assert.deepEqual(result.errors, [])
})

runCase('missing bull case fails validation', () => {
  const analysis = buildValidCanonicalOutput()
  analysis.bullCase = []
  const result = validateCanonicalAnalysis(analysis)
  assert.equal(result.ok, false)
  assert.match(result.errors.join(' '), /bullCase/i)
})

runCase('missing bear case fails validation', () => {
  const analysis = buildValidCanonicalOutput()
  analysis.bearCase = []
  const result = validateCanonicalAnalysis(analysis)
  assert.equal(result.ok, false)
  assert.match(result.errors.join(' '), /bearCase/i)
})

runCase('invalid execution path fails validation', () => {
  const analysis = buildValidCanonicalOutput()
  analysis.executionPath = 'legacy'
  const result = validateCanonicalAnalysis(analysis)
  assert.equal(result.ok, false)
  assert.match(result.errors.join(' '), /executionPath/i)
})

runCase('recommendation language fails validation', () => {
  const analysis = buildValidCanonicalOutput()
  analysis.bullCase[0].statement = 'Investors should buy the stock after this quarter.'
  const result = validateCanonicalAnalysis(analysis)
  assert.equal(result.ok, false)
  assert.match(result.errors.join(' '), /Recommendation language detected/i)
})

runCase('empty source list is a warning, not a hard failure', () => {
  const analysis = buildValidCanonicalOutput()
  analysis.dataSourcesUsed = []
  const result = validateCanonicalAnalysis(analysis)
  assert.equal(result.ok, true)
  assert.match(result.warnings.join(' '), /dataSourcesUsed is empty/i)
})

Module._extensions['.ts'] = originalTsHandler

if (failed > 0) {
  process.exit(1)
}

console.log(`PASS analysis validator cases: ${passed}`)
