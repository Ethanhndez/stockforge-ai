import type {
  EquityCurvePoint,
  ProofExitGateAssessment,
  ProofPerformanceMetrics,
  ProofScenarioFixture,
  ProofScenarioReport,
} from '@/lib/proof/types'

const DAYS_PER_YEAR = 365.25

function computePeriodReturns(values: number[]): number[] {
  if (values.length < 2) {
    return []
  }

  const returns: number[] = []

  for (let index = 1; index < values.length; index += 1) {
    const previous = values[index - 1]
    const current = values[index]

    if (!Number.isFinite(previous) || !Number.isFinite(current) || previous <= 0 || current <= 0) {
      continue
    }

    returns.push(current / previous - 1)
  }

  return returns
}

function computeAverageDaysBetweenPoints(curve: EquityCurvePoint[]): number {
  if (curve.length < 2) {
    return 1
  }

  const dayDiffs: number[] = []

  for (let index = 1; index < curve.length; index += 1) {
    const previousDate = new Date(curve[index - 1].date).getTime()
    const currentDate = new Date(curve[index].date).getTime()
    const diffDays = (currentDate - previousDate) / (1000 * 60 * 60 * 24)

    if (Number.isFinite(diffDays) && diffDays > 0) {
      dayDiffs.push(diffDays)
    }
  }

  return mean(dayDiffs) || 1
}

function computeElapsedYears(curve: EquityCurvePoint[]): number {
  if (curve.length < 2) {
    return 0
  }

  const start = new Date(curve[0].date).getTime()
  const end = new Date(curve.at(-1)!.date).getTime()
  const elapsedDays = (end - start) / (1000 * 60 * 60 * 24)

  return elapsedDays > 0 ? elapsedDays / DAYS_PER_YEAR : 0
}

function mean(values: number[]): number {
  if (values.length === 0) {
    return 0
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function variance(values: number[]): number {
  if (values.length <= 1) {
    return 0
  }

  const average = mean(values)
  const squaredDiffs = values.map((value) => (value - average) ** 2)

  return squaredDiffs.reduce((sum, value) => sum + value, 0) / (values.length - 1)
}

function standardDeviation(values: number[]): number {
  return Math.sqrt(variance(values))
}

function roundMetric(value: number): number {
  return Number(value.toFixed(4))
}

function computeTotalReturn(values: number[]): number {
  if (values.length < 2 || values[0] <= 0) {
    return 0
  }

  return values.at(-1)! / values[0] - 1
}

function computeAnnualizedReturn(values: number[], elapsedYears: number): number {
  if (values.length < 2 || values[0] <= 0 || elapsedYears <= 0) {
    return 0
  }

  const totalReturn = computeTotalReturn(values)

  if (totalReturn <= -1) {
    return -1
  }

  return (1 + totalReturn) ** (1 / elapsedYears) - 1
}

function computeAnnualizedVolatility(periodReturns: number[], periodsPerYear: number): number {
  if (periodReturns.length <= 1) {
    return 0
  }

  return standardDeviation(periodReturns) * Math.sqrt(periodsPerYear)
}

function computeSharpeRatio(
  periodReturns: number[],
  riskFreeRateAnnual: number,
  periodsPerYear: number
): number {
  if (periodReturns.length === 0) {
    return 0
  }

  const riskFreeRatePerPeriod = riskFreeRateAnnual / periodsPerYear
  const excessReturns = periodReturns.map((periodReturn) => periodReturn - riskFreeRatePerPeriod)
  const volatility = standardDeviation(excessReturns)

  if (volatility === 0) {
    return 0
  }

  return (mean(excessReturns) / volatility) * Math.sqrt(periodsPerYear)
}

function computeMaxDrawdown(values: number[]): number {
  if (values.length === 0) {
    return 0
  }

  let peak = values[0]
  let maxDrawdown = 0

  for (const value of values) {
    if (value > peak) {
      peak = value
    }

    if (peak <= 0) {
      continue
    }

    const drawdown = value / peak - 1
    if (drawdown < maxDrawdown) {
      maxDrawdown = drawdown
    }
  }

  return maxDrawdown
}

function computeBeta(
  portfolioReturns: number[],
  benchmarkReturns: number[]
): number {
  const sampleLength = Math.min(portfolioReturns.length, benchmarkReturns.length)
  if (sampleLength <= 1) {
    return 0
  }

  const portfolioSlice = portfolioReturns.slice(-sampleLength)
  const benchmarkSlice = benchmarkReturns.slice(-sampleLength)
  const benchmarkVariance = variance(benchmarkSlice)

  if (benchmarkVariance === 0) {
    return 0
  }

  const portfolioMean = mean(portfolioSlice)
  const benchmarkMean = mean(benchmarkSlice)
  let covariance = 0

  for (let index = 0; index < sampleLength; index += 1) {
    covariance +=
      (portfolioSlice[index] - portfolioMean) *
      (benchmarkSlice[index] - benchmarkMean)
  }

  covariance /= sampleLength - 1

  return covariance / benchmarkVariance
}

function computeAlphaAnnualized(args: {
  portfolioAnnualizedReturn: number
  benchmarkAnnualizedReturn: number
  beta: number
  riskFreeRateAnnual: number
}): number {
  return (
    args.portfolioAnnualizedReturn -
    (args.riskFreeRateAnnual + args.beta * (args.benchmarkAnnualizedReturn - args.riskFreeRateAnnual))
  )
}

function computeWinRate(values: number[]): number {
  if (values.length === 0) {
    return 0
  }

  const wins = values.filter((value) => value > 0).length
  return wins / values.length
}

function computeProposalHitRate(curve: EquityCurvePoint[], proposalDates: Set<string>): number {
  const realizedReturns: number[] = []

  for (let index = 1; index < curve.length; index += 1) {
    const currentPoint = curve[index]
    const previousPoint = curve[index - 1]

    if (!proposalDates.has(currentPoint.date) || previousPoint.portfolioValue <= 0) {
      continue
    }

    realizedReturns.push(currentPoint.portfolioValue / previousPoint.portfolioValue - 1)
  }

  return computeWinRate(realizedReturns)
}

export function computeProofPerformanceMetrics(
  fixture: ProofScenarioFixture
): ProofPerformanceMetrics {
  const portfolioValues = fixture.equityCurve.map((point) => point.portfolioValue)
  const benchmarkValues = fixture.equityCurve.map((point) => point.benchmarkValue)
  const portfolioReturns = computePeriodReturns(portfolioValues)
  const benchmarkReturns = computePeriodReturns(benchmarkValues)
  const averageDaysBetweenPoints = computeAverageDaysBetweenPoints(fixture.equityCurve)
  const periodsPerYear = DAYS_PER_YEAR / averageDaysBetweenPoints
  const elapsedYears = computeElapsedYears(fixture.equityCurve)
  const proposalDates = new Set(
    fixture.decisions.filter((decision) => decision.proposalProduced).map((decision) => decision.date)
  )

  const annualizedReturn = computeAnnualizedReturn(portfolioValues, elapsedYears)
  const benchmarkAnnualizedReturn = computeAnnualizedReturn(benchmarkValues, elapsedYears)
  const beta = computeBeta(portfolioReturns, benchmarkReturns)

  return {
    totalReturn: roundMetric(computeTotalReturn(portfolioValues)),
    benchmarkReturn: roundMetric(computeTotalReturn(benchmarkValues)),
    annualizedReturn: roundMetric(annualizedReturn),
    benchmarkAnnualizedReturn: roundMetric(benchmarkAnnualizedReturn),
    annualizedVolatility: roundMetric(
      computeAnnualizedVolatility(portfolioReturns, periodsPerYear)
    ),
    benchmarkAnnualizedVolatility: roundMetric(
      computeAnnualizedVolatility(benchmarkReturns, periodsPerYear)
    ),
    sharpeRatio: roundMetric(
      computeSharpeRatio(
        portfolioReturns,
        fixture.methodology.riskFreeRateAnnual,
        periodsPerYear
      )
    ),
    benchmarkSharpeRatio: roundMetric(
      computeSharpeRatio(
        benchmarkReturns,
        fixture.methodology.riskFreeRateAnnual,
        periodsPerYear
      )
    ),
    alphaAnnualized: roundMetric(
      computeAlphaAnnualized({
        portfolioAnnualizedReturn: annualizedReturn,
        benchmarkAnnualizedReturn,
        beta,
        riskFreeRateAnnual: fixture.methodology.riskFreeRateAnnual,
      })
    ),
    beta: roundMetric(beta),
    maxDrawdown: roundMetric(computeMaxDrawdown(portfolioValues)),
    benchmarkMaxDrawdown: roundMetric(computeMaxDrawdown(benchmarkValues)),
    winRate: roundMetric(computeWinRate(portfolioReturns)),
    proposalHitRate: roundMetric(computeProposalHitRate(fixture.equityCurve, proposalDates)),
    tradingDays: Math.max(fixture.equityCurve.length - 1, 0),
  }
}

export function assessProofExitGate(
  metrics: ProofPerformanceMetrics
): ProofExitGateAssessment {
  const failedChecks: string[] = []

  if (metrics.sharpeRatio <= 1) {
    failedChecks.push('Sharpe ratio did not exceed 1.0.')
  }

  if (metrics.alphaAnnualized <= 0) {
    failedChecks.push('Alpha versus benchmark was not positive.')
  }

  if (metrics.maxDrawdown < metrics.benchmarkMaxDrawdown) {
    failedChecks.push('Maximum drawdown was worse than the benchmark.')
  }

  return {
    sharpeAboveOne: metrics.sharpeRatio > 1,
    positiveAlphaVsBenchmark: metrics.alphaAnnualized > 0,
    drawdownNotWorseThanBenchmark: metrics.maxDrawdown >= metrics.benchmarkMaxDrawdown,
    qualifiesForPhaseExit: failedChecks.length === 0,
    failedChecks,
  }
}

export function evaluateProofScenario(
  fixture: ProofScenarioFixture
): ProofScenarioReport {
  const metrics = computeProofPerformanceMetrics(fixture)

  return {
    window: fixture.window,
    methodology: fixture.methodology,
    metrics,
    exitGate: assessProofExitGate(metrics),
  }
}
