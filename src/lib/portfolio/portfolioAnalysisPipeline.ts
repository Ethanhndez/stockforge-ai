import { buildStockContext } from '@/lib/ai/contextBuilder'
import { analyzePortfolioWithTelemetry } from '@/lib/ai/agentOrchestrator'
import type {
  PipelineStageDurations,
  PolicyAssessment,
  PortfolioRiskReport,
  RebalanceProposal,
  ResearchSummary,
} from '@/lib/portfolio/agentTypes'
import { optimizePortfolio } from '@/lib/ai/optimizationClient'
import { createClient, type AppSupabaseClient } from '@/lib/supabase/server'
import type { HoldingRecord } from '@/lib/portfolio/types'

interface AllocationTargetRow {
  id: string
  portfolio_id: string
  user_id: string
  target_type: 'ticker' | 'sector' | 'asset_class'
  target_key: string
  target_pct: number | string
  set_at: string
  updated_at: string
}

interface PortfolioPolicyRow {
  id: string
  portfolio_id: string
  user_id: string
  created_at: string
  effective_from: string
  effective_until: string | null
  max_position_pct: number | string | null
  max_sector_pct: number | string | null
  prohibited_tickers: string[]
  required_tickers: string[]
  max_single_trade_value: number | string | null
  automation_level: 'research_only' | 'propose' | 'hitl' | 'autonomous'
  created_by: 'user' | 'system_default' | 'system'
}

interface CashBalanceRow {
  id: string
  portfolio_id: string
  user_id: string
  amount: number | string
  updated_at: string
}

interface AgentDecisionRow {
  id: string
  run_at: string
}

interface PipelineErrorEntry {
  at: string
  step: string
  message: string
}

interface PortfolioOwnershipRow {
  id: string
}

interface HoldingSnapshot extends HoldingRecord {
  shares: number
  cost_basis: number | null
}

export interface PipelineResult {
  decisionId: string
  proposal: RebalanceProposal | null
  policyAssessment: PolicyAssessment
  riskReport: PortfolioRiskReport
  researchSummaries: ResearchSummary[]
  stageDurations: PipelineStageDurations
  ranAt: string
}

function parseNumber(value: number | string | null | undefined): number {
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function parseNullableNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null
  const parsed = parseNumber(value)
  return Number.isFinite(parsed) ? parsed : null
}

function nowIso(): string {
  return new Date().toISOString()
}

function elapsedMs(startedAt: number): number {
  return Date.now() - startedAt
}

function normalizeKey(value: string): string {
  return value.trim().toUpperCase()
}

interface PositionValue {
  ticker: string
  sector: string
  shares: number
  quote: number | null
  value: number | null
}

function createEmptyStageDurations(): PipelineStageDurations {
  return {
    totalMs: 0,
    decisionWriteMs: 0,
    cashBalanceMs: 0,
    researchMs: 0,
    policyAssessmentMs: 0,
    riskReportMs: 0,
    proposalBuildMs: 0,
    proposalWriteMs: 0,
    perTicker: {},
  }
}

function finalizeStageDurations(
  stageDurations: PipelineStageDurations,
  pipelineStartedAt: number
): PipelineStageDurations {
  return {
    ...stageDurations,
    totalMs: elapsedMs(pipelineStartedAt),
  }
}

function normalizeHoldings(holdings: HoldingRecord[]): HoldingSnapshot[] {
  return holdings.map((holding) => ({
    ...holding,
    shares: parseNumber(holding.shares),
    cost_basis: parseNullableNumber(holding.cost_basis),
  }))
}

function buildPositionValues(
  holdings: HoldingSnapshot[],
  researchSummaries: ResearchSummary[]
): PositionValue[] {
  return holdings.map((holding) => {
    const summary = researchSummaries.find((item) => item.ticker === holding.ticker)
    const quote = summary?.quote?.price ?? null

    return {
      ticker: holding.ticker,
      sector: summary?.fundamentals?.sector ?? 'Unclassified',
      shares: holding.shares,
      quote,
      value: quote !== null ? quote * holding.shares : null,
    }
  })
}

function sumKnownPositionValues(positionValues: PositionValue[]): number {
  return positionValues.reduce((sum, position) => sum + (position.value ?? 0), 0)
}

function selectActivePolicy(policies: PortfolioPolicyRow[]): PortfolioPolicyRow | null {
  const now = Date.now()

  return (
    policies.find((policy) => {
      const effectiveFrom = new Date(policy.effective_from).getTime()
      const effectiveUntil = policy.effective_until ? new Date(policy.effective_until).getTime() : null
      return effectiveFrom <= now && (effectiveUntil === null || effectiveUntil >= now)
    }) ?? policies[0] ?? null
  )
}

function buildPolicyAssessment(args: {
  holdings: HoldingSnapshot[]
  targets: AllocationTargetRow[]
  policies: PortfolioPolicyRow[]
  researchSummaries: ResearchSummary[]
  cashBalance: number
}): PolicyAssessment {
  const assessedAt = nowIso()
  const activePolicy = selectActivePolicy(args.policies)
  const positionValues = buildPositionValues(args.holdings, args.researchSummaries)
  const knownHoldingsValue = sumKnownPositionValues(positionValues)
  const totalValue = knownHoldingsValue + args.cashBalance

  const tickerTargets = args.targets.filter((target) => target.target_type === 'ticker')
  const allocationDrift = tickerTargets
    .map((target) => {
      const position = positionValues.find((item) => item.ticker === normalizeKey(target.target_key))
      if (!position || position.value === null) {
        return null
      }

      const currentWeight = totalValue > 0 ? position.value / totalValue : 0
      const targetWeight = parseNumber(target.target_pct)

      return {
        ticker: normalizeKey(target.target_key),
        currentWeight: Number(currentWeight.toFixed(4)),
        targetWeight: Number(targetWeight.toFixed(4)),
        driftAmount: Number((currentWeight - targetWeight).toFixed(4)),
      }
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .filter((item) => Math.abs(item.driftAmount) >= 0.02)

  const policyViolations = []

  if (activePolicy?.prohibited_tickers?.length) {
    for (const ticker of activePolicy.prohibited_tickers) {
      if (args.holdings.some((holding) => holding.ticker === normalizeKey(ticker))) {
        policyViolations.push({
          rule: 'prohibited_ticker',
          description: `${ticker} is currently held despite being listed as prohibited.`,
          severity: 'hard' as const,
        })
      }
    }
  }

  if (activePolicy?.required_tickers?.length) {
    for (const ticker of activePolicy.required_tickers) {
      if (!args.holdings.some((holding) => holding.ticker === normalizeKey(ticker))) {
        policyViolations.push({
          rule: 'required_ticker_missing',
          description: `${ticker} is marked as required but is not present in the portfolio.`,
          severity: 'soft' as const,
        })
      }
    }
  }

  const maxPositionPct = parseNullableNumber(activePolicy?.max_position_pct)
  if (maxPositionPct !== null && totalValue > 0) {
    for (const position of positionValues) {
      if (position.value === null) continue
      const weight = position.value / totalValue
      if (weight > maxPositionPct) {
        policyViolations.push({
          rule: 'max_position_pct',
          description: `${position.ticker} exceeds the max_position_pct policy threshold.`,
          severity: 'hard' as const,
        })
      }
    }
  }

  const maxSectorPct = parseNullableNumber(activePolicy?.max_sector_pct)
  if (maxSectorPct !== null && totalValue > 0) {
    const sectorTotals = new Map<string, number>()
    for (const position of positionValues) {
      if (position.value === null) continue
      sectorTotals.set(position.sector, (sectorTotals.get(position.sector) ?? 0) + position.value)
    }

    for (const [sector, value] of sectorTotals.entries()) {
      if (value / totalValue > maxSectorPct) {
        policyViolations.push({
          rule: 'max_sector_pct',
          description: `${sector} exceeds the max_sector_pct policy threshold.`,
          severity: 'hard' as const,
        })
      }
    }
  }

  const maxSingleTradeValue = parseNullableNumber(activePolicy?.max_single_trade_value)
  if (maxSingleTradeValue !== null && totalValue > 0) {
    for (const drift of allocationDrift) {
      const currentValue = totalValue * drift.currentWeight
      const targetValue = totalValue * drift.targetWeight
      if (Math.abs(targetValue - currentValue) > maxSingleTradeValue) {
        policyViolations.push({
          rule: 'max_single_trade_value',
          description: `${drift.ticker} would require more than the configured max_single_trade_value to rebalance.`,
          severity: 'soft' as const,
        })
      }
    }
  }

  const sectorTargets = args.targets.filter((target) => target.target_type === 'sector')
  if (sectorTargets.length > 0 && totalValue > 0) {
    const sectorTotals = new Map<string, number>()
    for (const position of positionValues) {
      if (position.value === null) continue
      const key = normalizeKey(position.sector)
      sectorTotals.set(key, (sectorTotals.get(key) ?? 0) + position.value)
    }

    for (const target of sectorTargets) {
      const currentWeight = (sectorTotals.get(normalizeKey(target.target_key)) ?? 0) / totalValue
      const targetWeight = parseNumber(target.target_pct)
      if (Math.abs(currentWeight - targetWeight) >= 0.02) {
        policyViolations.push({
          rule: 'sector_target_drift',
          description: `Sector target ${target.target_key} is drifting by ${Number((Math.abs(currentWeight - targetWeight) * 100).toFixed(1))}% from its target.`,
          severity: 'soft' as const,
        })
      }
    }
  }

  const assetClassTargets = args.targets.filter((target) => target.target_type === 'asset_class')
  if (assetClassTargets.length > 0 && totalValue > 0) {
    const cashWeight = args.cashBalance / totalValue
    const equityWeight = knownHoldingsValue / totalValue

    for (const target of assetClassTargets) {
      const key = normalizeKey(target.target_key)
      const currentWeight = key === 'CASH' ? cashWeight : key === 'EQUITY' ? equityWeight : null
      if (currentWeight === null) continue
      const targetWeight = parseNumber(target.target_pct)
      if (Math.abs(currentWeight - targetWeight) >= 0.02) {
        policyViolations.push({
          rule: 'asset_class_target_drift',
          description: `Asset class target ${target.target_key} is drifting by ${Number((Math.abs(currentWeight - targetWeight) * 100).toFixed(1))}% from its target.`,
          severity: 'soft' as const,
        })
      }
    }
  }

  const qualityFlags = [
    ...args.researchSummaries.flatMap((summary) =>
      summary.dataGaps.slice(0, 2).map((gap) => ({
        ticker: summary.ticker,
        flag: gap,
        source: 'dataGaps',
      }))
    ),
    ...positionValues
      .filter((position) => position.quote === null)
      .map((position) => ({
        ticker: position.ticker,
        flag: 'Quote unavailable; drift calculation skipped for this holding.',
        source: 'quote',
      })),
  ]

  const overallStatus =
    policyViolations.some((violation) => violation.severity === 'hard')
      ? 'action_required'
      : allocationDrift.length > 0 || policyViolations.length > 0 || qualityFlags.length > 0
        ? 'attention_needed'
        : 'healthy'

  return {
    allocationDrift,
    policyViolations,
    qualityFlags,
    overallStatus,
    assessedAt,
  }
}

function buildRiskReport(args: {
  holdings: HoldingSnapshot[]
  cashBalance: number
  researchSummaries: ResearchSummary[]
  policies: PortfolioPolicyRow[]
}): PortfolioRiskReport {
  const assessedAt = nowIso()
  const activePolicy = selectActivePolicy(args.policies)
  const maxPositionPct = parseNullableNumber(activePolicy?.max_position_pct) ?? 0.12
  const maxSectorPct = parseNullableNumber(activePolicy?.max_sector_pct) ?? 0.3

  const positionValues = buildPositionValues(args.holdings, args.researchSummaries)
  const totalHoldingsValue = sumKnownPositionValues(positionValues)
  const totalValue = totalHoldingsValue + args.cashBalance
  const missingQuotes = positionValues.filter((position) => position.quote === null)

  const concentrationRisks = positionValues
    .map((holding) => {
      if (holding.value === null) return null
      const weight = totalValue > 0 ? holding.value / totalValue : 0
      return {
        ticker: holding.ticker,
        weight: Number(weight.toFixed(4)),
        threshold: maxPositionPct,
        description: `${holding.ticker} is ${Number((weight * 100).toFixed(1))}% of portfolio value versus a ${Number((maxPositionPct * 100).toFixed(1))}% threshold.`,
      }
    })
    .filter((risk): risk is NonNullable<typeof risk> => Boolean(risk))
    .filter((risk) => risk.weight > risk.threshold)

  const sectorTotals = new Map<string, number>()
  for (const holding of positionValues) {
    if (holding.value === null) continue
    sectorTotals.set(holding.sector, (sectorTotals.get(holding.sector) ?? 0) + holding.value)
  }

  const sectorRisks = [...sectorTotals.entries()]
    .map(([sector, value]) => {
      const weight = totalValue > 0 ? value / totalValue : 0
      return {
        sector,
        weight: Number(weight.toFixed(4)),
        threshold: maxSectorPct,
        description: `${sector} is ${Number((weight * 100).toFixed(1))}% of portfolio value versus a ${Number((maxSectorPct * 100).toFixed(1))}% threshold.`,
      }
    })
    .filter((risk) => risk.weight > risk.threshold)

  const cashWeight = totalValue > 0 ? args.cashBalance / totalValue : 0
  const cashDriftWarning = cashWeight > 0.2 || (totalValue > 0 && cashWeight < 0.02)
  const riskNotes = [
    ...concentrationRisks.map((risk) => risk.description),
    ...sectorRisks.map((risk) => risk.description),
  ]

  if (cashDriftWarning) {
    riskNotes.push(
      `Cash weight is ${Number((cashWeight * 100).toFixed(1))}% of portfolio value, outside the preferred 2%-20% range.`
    )
  }

  if (missingQuotes.length > 0) {
    riskNotes.push(
      `Quote data is unavailable for ${missingQuotes.map((position) => position.ticker).join(', ')}, so concentration checks are incomplete for those holdings.`
    )
  }

  const overallRiskLevel =
    missingQuotes.length > 0
      ? 'elevated'
      : concentrationRisks.length > 1 || sectorRisks.length > 1
      ? 'high'
      : concentrationRisks.length === 1 || sectorRisks.length === 1 || cashDriftWarning
        ? 'elevated'
        : args.researchSummaries.some((summary) => summary.dataGaps.length > 0)
          ? 'moderate'
          : 'low'

  return {
    concentrationRisks,
    sectorRisks,
    cashDriftWarning,
    overallRiskLevel,
    riskNotes,
    assessedAt,
  }
}

function buildRebalanceProposal(args: {
  holdings: HoldingSnapshot[]
  targets: AllocationTargetRow[]
  researchSummaries: ResearchSummary[]
  policyAssessment: PolicyAssessment
  riskReport: PortfolioRiskReport
}): RebalanceProposal {
  void optimizePortfolio

  // PHASE 2/3 INTEGRATION POINT:
  // When optimizationClient.optimizePortfolio() is live, replace the qualitative
  // proposal below with:
  //   1. Build PortfolioOptimizationInput from researchSummaries + priceHistory
  //   2. Call optimizePortfolio(input)
  //   3. Convert optimalWeights -> ProposedTrades via diffing against currentWeights
  // See: src/lib/ai/optimizationClient.ts
  const proposedAt = nowIso()
  const totalValue = sumKnownPositionValues(
    buildPositionValues(args.holdings, args.researchSummaries)
  )

  const proposedTrades = args.policyAssessment.allocationDrift
    .filter((item) => Math.abs(item.driftAmount) >= 0.03)
    .map((item) => {
      const quote = args.researchSummaries.find((summary) => summary.ticker === item.ticker)?.quote?.price ?? null
      if (quote === null) {
        return null
      }
      const targetValue = totalValue * item.targetWeight
      const targetShares = quote > 0 ? Math.max(Math.round(targetValue / quote), 0) : 0
      const action = item.driftAmount > 0 ? 'sell' : 'buy'

      return {
        ticker: item.ticker,
        action,
        targetShares,
        targetValue: Number(targetValue.toFixed(2)),
        reason: `${item.ticker} is drifting ${Number((Math.abs(item.driftAmount) * 100).toFixed(1))}% away from its target weight and needs ${action} pressure to move back toward policy alignment.`,
        dataSource: `Polygon.io /v2/aggs/ticker/${item.ticker}/prev`,
      } satisfies RebalanceProposal['proposedTrades'][number]
    })
    .filter((trade): trade is NonNullable<typeof trade> => Boolean(trade))

  if (proposedTrades.length === 0) {
    for (const risk of args.riskReport.concentrationRisks) {
      const holding = args.holdings.find((row) => row.ticker === risk.ticker)
      const quote = args.researchSummaries.find((summary) => summary.ticker === risk.ticker)?.quote?.price ?? null
      if (quote === null) continue
      const targetValue = totalValue * risk.threshold
      const targetShares = quote > 0 ? Math.round(targetValue / quote) : holding?.shares ?? 0

      proposedTrades.push({
        ticker: risk.ticker,
        action: 'sell',
        targetShares,
        targetValue: Number(targetValue.toFixed(2)),
        reason: `Reduce ${risk.ticker} because it breaches the position concentration threshold.`,
        dataSource: `Polygon.io /v2/aggs/ticker/${risk.ticker}/prev`,
      })
    }
  }

  return {
    proposedTrades,
    justification: proposedTrades.length
      ? 'The portfolio requires action because allocation drift and/or concentration risk exceeds policy tolerances.'
      : 'The portfolio is near policy targets; no concrete rebalance trade cleared the proposal threshold.',
    expectedOutcome: proposedTrades.length
      ? 'Portfolio weights should move closer to target allocations and reduce concentration pressure after paper execution.'
      : 'Portfolio state remains unchanged because no rebalance trade was justified.',
    risks: [
      'Market prices may move before simulated execution is evaluated.',
      'Research coverage may contain explicit data gaps for one or more holdings.',
      'Policy targets may be incomplete if allocation_targets are only partially configured.',
      'Trades are omitted for holdings without reliable quote data at run time.',
    ],
    dataSources: Array.from(new Set(args.researchSummaries.flatMap((summary) => summary.dataSources))),
    confidenceLevel:
      proposedTrades.length >= 2
        ? 'moderate'
        : args.riskReport.overallRiskLevel === 'high'
          ? 'low'
          : 'high',
    confidenceNotes:
      proposedTrades.length > 0
        ? 'Confidence is driven by live quote snapshots, current holdings, and configured policy thresholds.'
        : 'Confidence is constrained because the portfolio did not surface a strong enough rebalance signal.',
    proposedAt,
  }
}

async function appendPipelineError(
  decisionId: string,
  step: string,
  message: string,
  supabase: AppSupabaseClient
) {
  const { data: existing } = await supabase
    .from('agent_decisions')
    .select('error_log')
    .eq('id', decisionId)
    .maybeSingle<{ error_log: PipelineErrorEntry[] | null }>()

  const nextErrors = [...(existing?.error_log ?? []), { at: nowIso(), step, message }]

  const { error } = await supabase
    .from('agent_decisions')
    .update({ error_log: nextErrors })
    .eq('id', decisionId)

  if (error) {
    throw new Error(error.message)
  }
}

async function updateDecisionStep(
  decisionId: string,
  payload: Record<string, unknown>,
  supabase: AppSupabaseClient
): Promise<void> {
  const { error } = await supabase
    .from('agent_decisions')
    .update(payload)
    .eq('id', decisionId)

  if (error) {
    throw new Error(error.message)
  }
}

export async function runPortfolioAnalysisPipeline(
  userId: string,
  portfolioId: string,
  supabaseClient?: AppSupabaseClient
): Promise<PipelineResult> {
  const supabase = supabaseClient ?? (await createClient())
  const pipelineStartedAt = Date.now()
  const stageDurations = createEmptyStageDurations()
  let currentStep = 'validate_portfolio'

  const { data: ownedPortfolio, error: portfolioError } = await supabase
    .from('portfolios')
    .select('id')
    .eq('id', portfolioId)
    .eq('user_id', userId)
    .is('archived_at', null)
    .maybeSingle<PortfolioOwnershipRow>()

  if (portfolioError) {
    throw new Error(portfolioError.message)
  }

  if (!ownedPortfolio) {
    throw new Error('Portfolio not found for this user.')
  }

  const [{ data: holdingsRows, error: holdingsError }, { data: policiesRows, error: policiesError }, { data: targetsRows, error: targetsError }] =
    await Promise.all([
      supabase
        .from('holdings')
        .select('*')
        .eq('user_id', userId)
        .eq('portfolio_id', portfolioId)
        .is('archived_at', null)
        .order('ticker', { ascending: true })
        .returns<HoldingRecord[]>(),
      supabase
        .from('portfolio_policies')
        .select('*')
        .eq('user_id', userId)
        .eq('portfolio_id', portfolioId)
        .order('effective_from', { ascending: false })
        .returns<PortfolioPolicyRow[]>(),
      supabase
        .from('allocation_targets')
        .select('*')
        .eq('user_id', userId)
        .eq('portfolio_id', portfolioId)
        .order('target_type', { ascending: true })
        .returns<AllocationTargetRow[]>(),
    ])

  if (holdingsError) throw new Error(holdingsError.message)
  if (policiesError) throw new Error(policiesError.message)
  if (targetsError) throw new Error(targetsError.message)

  const holdings = normalizeHoldings(holdingsRows ?? [])
  const policies = policiesRows ?? []
  const targets = targetsRows ?? []

  const decisionWriteStartedAt = Date.now()
  const { data: decisionRow, error: decisionError } = await supabase
    .from('agent_decisions')
    .insert({
      user_id: userId,
      portfolio_id: portfolioId,
      holdings_snapshot: holdings,
      policies_snapshot: policies,
      research_summaries: null,
      policy_assessment: null,
      risk_report: null,
      proposal: null,
      proposal_status: 'pending',
      agent_mode: 'parallel',
      stage_durations: null,
      error_log: null,
    })
    .select('id, run_at')
    .single<AgentDecisionRow>()

  if (decisionError || !decisionRow) {
    throw new Error(decisionError?.message ?? 'Failed to create initial agent_decisions record.')
  }
  stageDurations.decisionWriteMs = elapsedMs(decisionWriteStartedAt)

  const decisionId = decisionRow.id

  try {
    currentStep = 'load_cash_balance'
    const cashBalanceStartedAt = Date.now()
    const { data: cashRow, error: cashError } = await supabase
      .from('cash_balance')
      .select('*')
      .eq('user_id', userId)
      .eq('portfolio_id', portfolioId)
      .maybeSingle<CashBalanceRow>()

    if (cashError) {
      throw new Error(cashError.message)
    }
    stageDurations.cashBalanceMs = elapsedMs(cashBalanceStartedAt)

    const tickers = holdings.map((holding) => holding.ticker)
    currentStep = 'research'
    const researchStartedAt = Date.now()
    const researchResult = await analyzePortfolioWithTelemetry(tickers, buildStockContext)
    stageDurations.researchMs = elapsedMs(researchStartedAt)
    stageDurations.perTicker = researchResult.stageDurations
    const researchSummaries = researchResult.summaries

    await updateDecisionStep(decisionId, { research_summaries: researchSummaries }, supabase)

    currentStep = 'policy_assessment'
    const policyAssessmentStartedAt = Date.now()
    const policyAssessment = buildPolicyAssessment({
      holdings,
      targets,
      policies,
      researchSummaries,
      cashBalance: parseNumber(cashRow?.amount),
    })
    stageDurations.policyAssessmentMs = elapsedMs(policyAssessmentStartedAt)

    await updateDecisionStep(decisionId, { policy_assessment: policyAssessment }, supabase)

    currentStep = 'risk_report'
    const riskReportStartedAt = Date.now()
    const riskReport = buildRiskReport({
      holdings,
      cashBalance: parseNumber(cashRow?.amount),
      researchSummaries,
      policies,
    })
    stageDurations.riskReportMs = elapsedMs(riskReportStartedAt)

    await updateDecisionStep(decisionId, { risk_report: riskReport }, supabase)

    currentStep = 'rebalance_proposal'
    const proposalBuildStartedAt = Date.now()
    const proposal =
      policyAssessment.overallStatus !== 'healthy' || riskReport.overallRiskLevel !== 'low'
        ? buildRebalanceProposal({
            holdings,
            targets,
            researchSummaries,
            policyAssessment,
            riskReport,
          })
        : null
    stageDurations.proposalBuildMs = elapsedMs(proposalBuildStartedAt)

    const proposalWriteStartedAt = Date.now()
    await updateDecisionStep(
      decisionId,
      {
        proposal,
        stage_durations: finalizeStageDurations(stageDurations, pipelineStartedAt),
      },
      supabase
    )
    stageDurations.proposalWriteMs = elapsedMs(proposalWriteStartedAt)
    await updateDecisionStep(
      decisionId,
      { stage_durations: finalizeStageDurations(stageDurations, pipelineStartedAt) },
      supabase
    )

    return {
      decisionId,
      proposal,
      policyAssessment,
      riskReport,
      researchSummaries,
      stageDurations: finalizeStageDurations(stageDurations, pipelineStartedAt),
      ranAt: decisionRow.run_at,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await updateDecisionStep(
      decisionId,
      { stage_durations: finalizeStageDurations(stageDurations, pipelineStartedAt) },
      supabase
    )
    await appendPipelineError(decisionId, currentStep, message, supabase)
    throw error
  }
}
