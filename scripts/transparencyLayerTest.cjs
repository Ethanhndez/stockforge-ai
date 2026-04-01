#!/usr/bin/env node

const assert = require('node:assert/strict')
const fs = require('node:fs')
const Module = require('node:module')
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

const {
  buildAnalysisDebugPayload,
  buildTransparencySummary,
  deriveAnalysisQuality,
  sanitizeExecutionMetadata,
} = require('../src/lib/ai/transparency.ts')

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

function buildCanonicalAnalysis(overrides = {}) {
  return {
    symbol: 'AAPL',
    companyName: 'Apple Inc.',
    dataSourcesUsed: ['Polygon.io /v3/reference/tickers/AAPL', 'SEC EDGAR submissions/0000320193.json'],
    bullCase: [{ statement: 'Services mix supports margins.', sources: ['Polygon.io /v3/reference/tickers/AAPL'] }],
    bearCase: [{ statement: 'Hardware demand remains cyclical.', sources: ['SEC EDGAR submissions/0000320193.json'] }],
    keyMetrics: [{ name: 'Revenue', value: '$100B', source: 'Polygon.io /v3/reference/tickers/AAPL' }],
    risks: [{ statement: 'China exposure remains material.', sources: ['SEC EDGAR submissions/0000320193.json'] }],
    missingData: [],
    toolErrors: [],
    executionPath: 'parallel',
    ...overrides,
  }
}

function buildExecutionMetadata(overrides = {}) {
  return {
    path: 'parallel',
    toolsUsed: ['getFundamentals', 'getFinancials', 'synthesisAgent'],
    toolsFailed: [],
    hadGaps: false,
    validationPassed: true,
    ...overrides,
  }
}

runCase('complete quality requires validated analysis with no gaps or failures', () => {
  const quality = deriveAnalysisQuality({
    canonicalAnalysis: buildCanonicalAnalysis(),
    executionMetadata: buildExecutionMetadata(),
  })

  assert.equal(quality, 'complete')
})

runCase('parallel gaps degrade quality without marking analysis limited', () => {
  const summary = buildTransparencySummary({
    canonicalAnalysis: buildCanonicalAnalysis({
      missingData: ['Missing metric: operatingMargin'],
    }),
    executionMetadata: buildExecutionMetadata({
      hadGaps: true,
    }),
  })

  assert.equal(summary.analysisQuality, 'degraded')
  assert.deepEqual(summary.missingData, ['Missing metric: operatingMargin'])
})

runCase('fallback with failures is marked limited and tool errors are sanitized', () => {
  const debug = buildAnalysisDebugPayload({
    canonicalAnalysis: buildCanonicalAnalysis({
      toolErrors: [
        {
          tool: 'getNews',
          source: 'legacy-tool-loop',
          error: 'Polygon returned HTTP 503\n    at fetchNews (/var/task/route.js:88:12)',
        },
      ],
      missingData: ['Recent news unavailable from retrieved data'],
      executionPath: 'fallback',
    }),
    executionMetadata: buildExecutionMetadata({
      path: 'fallback',
      fallbackReason: 'tool_failure',
      toolsFailed: ['getNews (Polygon.io /v2/reference/news): HTTP 503\n    at fetchNews (/var/task/route.js:88:12)'],
      hadGaps: true,
    }),
  })

  assert.equal(debug.transparency.analysisQuality, 'limited')
  assert.equal(debug.execution.toolsFailed[0].includes('\n'), false)
  assert.equal(debug.transparency.toolErrors[0].includes('\n'), false)
  assert.match(debug.transparency.toolErrors[0], /HTTP 503/)
})

runCase('execution metadata sanitization preserves tools used and clones arrays', () => {
  const metadata = buildExecutionMetadata({
    toolsFailed: ['getFinancials: upstream timeout\n    at fn (/tmp/file.js:1:1)'],
  })
  const sanitized = sanitizeExecutionMetadata(metadata)

  assert.deepEqual(sanitized.toolsUsed, metadata.toolsUsed)
  assert.notEqual(sanitized.toolsUsed, metadata.toolsUsed)
  assert.equal(sanitized.toolsFailed[0].includes('\n'), false)
})

Module._extensions['.ts'] = originalTsHandler

if (failed > 0) {
  process.exit(1)
}

console.log(`PASS transparency layer cases: ${passed}`)
