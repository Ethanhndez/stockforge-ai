#!/usr/bin/env node

import { evaluateProofScenario } from '@/lib/proof/analytics'
import { PROOF_SCENARIO_FIXTURES } from '@/lib/proof/fixtures'

for (const fixture of PROOF_SCENARIO_FIXTURES) {
  const report = evaluateProofScenario(fixture)

  console.log(`\n${report.window.label}`)
  console.log(`Window: ${report.window.startDate} -> ${report.window.endDate} (${report.window.marketRegime})`)
  console.log(`Sharpe: ${report.metrics.sharpeRatio}`)
  console.log(`Alpha annualized: ${report.metrics.alphaAnnualized}`)
  console.log(`Max drawdown: ${report.metrics.maxDrawdown}`)
  console.log(`Benchmark max drawdown: ${report.metrics.benchmarkMaxDrawdown}`)
  console.log(`Proposal hit rate: ${report.metrics.proposalHitRate}`)
  console.log(`Exit gate: ${report.exitGate.qualifiesForPhaseExit ? 'PASS' : 'FAIL'}`)

  if (report.exitGate.failedChecks.length > 0) {
    console.log(`Failed checks: ${report.exitGate.failedChecks.join(' | ')}`)
  }
}
