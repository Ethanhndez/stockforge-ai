export interface EquityCurvePoint {
  date: string
  portfolioValue: number
  benchmarkValue: number
  cash: number
  grossExposure: number
}

export interface ProofDecisionSnapshot {
  date: string
  decisionId: string
  proposalProduced: boolean
  holdings: string[]
  notes: string[]
}

export interface ProofMethodology {
  noLookaheadEnforced: boolean
  benchmarkTicker: string
  rebalanceCadence: 'daily' | 'weekly' | 'monthly' | 'event_driven'
  riskFreeRateAnnual: number
  priceSource: string
  notes: string[]
}

export interface ProofEvaluationWindow {
  id: string
  label: string
  marketRegime: 'bear' | 'bull' | 'mixed'
  startDate: string
  endDate: string
  benchmarkTicker: string
  thesis: string
}

export interface ProofPerformanceMetrics {
  totalReturn: number
  benchmarkReturn: number
  annualizedReturn: number
  benchmarkAnnualizedReturn: number
  annualizedVolatility: number
  benchmarkAnnualizedVolatility: number
  sharpeRatio: number
  benchmarkSharpeRatio: number
  alphaAnnualized: number
  beta: number
  maxDrawdown: number
  benchmarkMaxDrawdown: number
  winRate: number
  proposalHitRate: number
  tradingDays: number
}

export interface ProofExitGateAssessment {
  sharpeAboveOne: boolean
  positiveAlphaVsBenchmark: boolean
  drawdownNotWorseThanBenchmark: boolean
  qualifiesForPhaseExit: boolean
  failedChecks: string[]
}

export interface ProofScenarioFixture {
  window: ProofEvaluationWindow
  methodology: ProofMethodology
  equityCurve: EquityCurvePoint[]
  decisions: ProofDecisionSnapshot[]
}

export interface ProofScenarioReport {
  window: ProofEvaluationWindow
  methodology: ProofMethodology
  metrics: ProofPerformanceMetrics
  exitGate: ProofExitGateAssessment
}
