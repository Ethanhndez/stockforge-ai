import { buildStockContext } from '@/lib/ai/contextBuilder'
import { analyzePortfolio } from '@/lib/ai/agentOrchestrator'
import type {
  PolicyAssessment,
  PortfolioRiskReport,
  RebalanceProposal,
  ResearchSummary,
} from '@/lib/portfolio/agentTypes'
import { createClient } from '@/lib/supabase/server'
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

function normalizeHoldings(holdings: HoldingRecord[]): HoldingSnapshot[] {
  return holdings.map((holding) => ({
    ...holding,
    shares: parseNumber(holding.shares),
    cost_basis: parseNullableNumber(holding.cost_basis),
  }))
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
}): PolicyAssessment {
  const assessedAt = nowIso()
  const activePolicy = selectActivePolicy(args.policies)
  const totalValue = args.researchSummaries.reduce((sum, summary) => {
    const quote = summary.quote?.price ?? 0
    const shares = args.holdings.find((holding) => holding.ticker === summary.ticker)?.shares ?? 0
    return sum + quote * shares
  }, 0)

  const tickerTargets = args.targets.filter((target) => target.target_type === 'ticker')
  const allocationDrift = tickerTargets
    .map((target) => {
      const holding = args.holdings.find((item) => item.ticker === target.target_key)
      const quote = args.researchSummaries.find((item) => item.ticker === target.target_key)?.quote?.price ?? 0
      const currentWeight =
        totalValue > 0 && holding ? (holding.shares * quote) / totalValue : 0
      const targetWeight = parseNumber(target.target_pct)

      return {
        ticker: target.target_key,
        currentWeight: Number(currentWeight.toFixed(4)),
        targetWeight: Number(targetWeight.toFixed(4)),
        driftAmount: Number((currentWeight - targetWeight).toFixed(4)),
      }
    })
    .filter((item) => Math.abs(item.driftAmount) >= 0.02)

  const policyViolations = []

  if (activePolicy?.prohibited_tickers?.length) {
    for (const ticker of activePolicy.prohibited_tickers) {
      if (args.holdings.some((holding) => holding.ticker === ticker)) {
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
      if (!args.holdings.some((holding) => holding.ticker === ticker)) {
        policyViolations.push({
          rule: 'required_ticker_missing',
          description: `${ticker} is marked as required but is not present in the portfolio.`,
          severity: 'soft' as const,
        })
      }
    }
  }

  const qualityFlags = args.researchSummaries.flatMap((summary) =>
    summary.dataGaps.slice(0, 2).map((gap) => ({
      ticker: summary.ticker,
      flag: gap,
      source: 'dataGaps',
    }))
  )

  const overallStatus =
    policyViolations.some((violation) => violation.severity === 'hard')
      ? 'action_required'
      : allocationDrift.length > 0 || qualityFlags.length > 0
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

  const holdingValues = args.holdings.map((holding) => {
    const price = args.researchSummaries.find((summary) => summary.ticker === holding.ticker)?.quote?.price ?? 0
    return {
      ticker: holding.ticker,
      value: price * holding.shares,
      sector:
        args.researchSummaries.find((summary) => summary.ticker === holding.ticker)?.fundamentals?.sector ??
        'Unclassified',
    }
  })

  const totalHoldingsValue = holdingValues.reduce((sum, holding) => sum + holding.value, 0)
  const totalValue = totalHoldingsValue + args.cashBalance

  const concentrationRisks = holdingValues
    .map((holding) => {
      const weight = totalValue > 0 ? holding.value / totalValue : 0
      return {
        ticker: holding.ticker,
        weight: Number(weight.toFixed(4)),
        threshold: maxPositionPct,
        description: `${holding.ticker} is ${Number((weight * 100).toFixed(1))}% of portfolio value versus a ${Number((maxPositionPct * 100).toFixed(1))}% threshold.`,
      }
    })
    .filter((risk) => risk.weight > risk.threshold)

  const sectorTotals = new Map<string, number>()
  for (const holding of holdingValues) {
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

  const overallRiskLevel =
    concentrationRisks.length > 1 || sectorRisks.length > 1
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
  const proposedAt = nowIso()
  const totalValue = args.holdings.reduce((sum, holding) => {
    const quote = args.researchSummaries.find((summary) => summary.ticker === holding.ticker)?.quote?.price ?? 0
    return sum + quote * holding.shares
  }, 0)

  const proposedTrades = args.policyAssessment.allocationDrift
    .filter((item) => Math.abs(item.driftAmount) >= 0.03)
    .map((item) => {
      const quote = args.researchSummaries.find((summary) => summary.ticker === item.ticker)?.quote?.price ?? 0
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

  if (proposedTrades.length === 0) {
    for (const risk of args.riskReport.concentrationRisks) {
      const holding = args.holdings.find((row) => row.ticker === risk.ticker)
      const quote = args.researchSummaries.find((summary) => summary.ticker === risk.ticker)?.quote?.price ?? 0
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

async function appendPipelineError(decisionId: string, message: string) {
  const supabase = await createClient()
  const { data: existing } = await supabase
    .from('agent_decisions')
    .select('error_log')
    .eq('id', decisionId)
    .maybeSingle<{ error_log: object[] | null }>()

  const nextErrors = [...(existing?.error_log ?? []), { at: nowIso(), message }]

  await supabase
    .from('agent_decisions')
    .update({ error_log: nextErrors })
    .eq('id', decisionId)
}

export async function runPortfolioAnalysisPipeline(
  userId: string,
  portfolioId: string
): Promise<PipelineResult> {
  const supabase = await createClient()

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
      error_log: null,
    })
    .select('id, run_at')
    .single<AgentDecisionRow>()

  if (decisionError || !decisionRow) {
    throw new Error(decisionError?.message ?? 'Failed to create initial agent_decisions record.')
  }

  const decisionId = decisionRow.id

  try {
    const { data: cashRow, error: cashError } = await supabase
      .from('cash_balance')
      .select('*')
      .eq('user_id', userId)
      .eq('portfolio_id', portfolioId)
      .maybeSingle<CashBalanceRow>()

    if (cashError) {
      throw new Error(cashError.message)
    }

    const tickers = holdings.map((holding) => holding.ticker)
    const researchSummaries = await analyzePortfolio(tickers, buildStockContext)

    await supabase
      .from('agent_decisions')
      .update({ research_summaries: researchSummaries })
      .eq('id', decisionId)

    const policyAssessment = buildPolicyAssessment({
      holdings,
      targets,
      policies,
      researchSummaries,
    })

    await supabase
      .from('agent_decisions')
      .update({ policy_assessment: policyAssessment })
      .eq('id', decisionId)

    const riskReport = buildRiskReport({
      holdings,
      cashBalance: parseNumber(cashRow?.amount),
      researchSummaries,
      policies,
    })

    await supabase
      .from('agent_decisions')
      .update({ risk_report: riskReport })
      .eq('id', decisionId)

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

    await supabase
      .from('agent_decisions')
      .update({ proposal })
      .eq('id', decisionId)

    return {
      decisionId,
      proposal,
      policyAssessment,
      riskReport,
      researchSummaries,
      ranAt: decisionRow.run_at,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await appendPipelineError(decisionId, message)
    throw error
  }
}
