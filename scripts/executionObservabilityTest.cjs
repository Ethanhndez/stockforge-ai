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
  createExecutionMetadata,
  detectFallbackReason,
  mergeExecutionMetadata,
  recordGaps,
  recordToolFailure,
  recordToolUsed,
  recordValidation,
  setFallbackReason,
} = require('../src/lib/ai/execution-observability.ts')

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

runCase('parallel success tracks tools and validation', () => {
  const metadata = createExecutionMetadata('parallel')
  recordToolUsed(metadata, 'getFundamentals')
  recordToolUsed(metadata, 'synthesisAgent')
  recordValidation(metadata, true)
  assert.equal(metadata.path, 'parallel')
  assert.deepEqual(metadata.toolsUsed, ['getFundamentals', 'synthesisAgent'])
  assert.equal(metadata.validationPassed, true)
  assert.equal(metadata.toolsFailed.length, 0)
})

runCase('parallel failure metadata can trigger fallback', () => {
  const parallel = createExecutionMetadata('parallel')
  recordToolUsed(parallel, 'fundamentalAgent')
  setFallbackReason(parallel, detectFallbackReason(new Error('Unexpected parallel failure')))
  const fallback = mergeExecutionMetadata(createExecutionMetadata('fallback'), {
    fallbackReason: parallel.fallbackReason,
    toolsUsed: parallel.toolsUsed,
    toolsFailed: parallel.toolsFailed,
    hadGaps: parallel.hadGaps,
  })
  assert.equal(fallback.path, 'fallback')
  assert.equal(fallback.fallbackReason, 'parallel_error')
  assert.deepEqual(fallback.toolsUsed, ['fundamentalAgent'])
})

runCase('tool failure is traceable by source', () => {
  const metadata = createExecutionMetadata('fallback')
  recordToolFailure(metadata, 'getNews', 'Polygon.io /v2/reference/news', 'HTTP 503')
  assert.equal(metadata.toolsUsed.includes('getNews'), true)
  assert.match(metadata.toolsFailed[0], /getNews/)
  assert.match(metadata.toolsFailed[0], /Polygon\.io/)
  assert.match(metadata.toolsFailed[0], /503/)
  assert.equal(detectFallbackReason(new Error('News lookup failed: Polygon returned HTTP 503')), 'tool_failure')
})

runCase('validation failure is recorded explicitly', () => {
  const metadata = createExecutionMetadata('fallback')
  recordValidation(metadata, false)
  setFallbackReason(metadata, detectFallbackReason(new Error('Canonical analysis validation failed: bullCase')))
  recordGaps(metadata, ['Revenue unavailable'])
  assert.equal(metadata.validationPassed, false)
  assert.equal(metadata.fallbackReason, 'validation_failed')
  assert.equal(metadata.hadGaps, true)
})

Module._extensions['.ts'] = originalTsHandler

if (failed > 0) {
  process.exit(1)
}

console.log(`PASS execution observability cases: ${passed}`)
