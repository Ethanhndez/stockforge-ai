import { redirect } from 'next/navigation'
import { Fragment } from 'react'
import type {
  PipelineStageDurations,
  PolicyAssessment,
  PortfolioRiskReport,
  RebalanceProposal,
  ResearchSummary,
} from '@/lib/portfolio/agentTypes'
import { ensurePortfolioWorkspace } from '@/lib/portfolio/server'
import { createClient } from '@/lib/supabase/server'

interface AgentDecisionRow {
  id: string
  run_at: string
  proposal_status: 'pending' | 'accepted' | 'rejected' | 'expired'
  proposal: RebalanceProposal | null
  research_summaries: ResearchSummary[] | null
  policy_assessment: PolicyAssessment | null
  risk_report: PortfolioRiskReport | null
  stage_durations: PipelineStageDurations | null
  error_log: Array<{ at: string; step: string; message: string }> | null
}

export const dynamic = 'force-dynamic'

type LabSearchParams = Promise<{
  run?: string
  decisionId?: string
  message?: string
}>

function formatDuration(ms: number | null | undefined): string {
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms < 0) {
    return 'n/a'
  }

  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(1)}s`
  }

  return `${Math.round(ms)}ms`
}

function formatTimestamp(value: string): string {
  return new Date(value).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function buildTimingSummary(stageDurations: PipelineStageDurations | null): string {
  if (!stageDurations) {
    return 'Timing unavailable'
  }

  return [
    `Research: ${formatDuration(stageDurations.researchMs)}`,
    `Policy: ${formatDuration(stageDurations.policyAssessmentMs)}`,
    `Risk: ${formatDuration(stageDurations.riskReportMs)}`,
    `Rebalance: ${formatDuration(stageDurations.proposalBuildMs)}`,
    `Write: ${formatDuration(stageDurations.proposalWriteMs)}`,
    `Total: ${formatDuration(stageDurations.totalMs)}`,
  ].join(' | ')
}

function buildTickerTimingSummary(
  ticker: string,
  stageDurations: PipelineStageDurations | null
): string | null {
  const timing = stageDurations?.perTicker[ticker]
  if (!timing) {
    return null
  }

  return [
    `Context ${formatDuration(timing.contextMs)}`,
    `Fundamental ${formatDuration(timing.fundamentalMs)}`,
    `Technical ${formatDuration(timing.technicalMs)}`,
    `Sentiment ${formatDuration(timing.sentimentMs)}`,
    `Synthesis ${formatDuration(timing.synthesisMs)}`,
    `Total ${formatDuration(timing.totalMs)}`,
  ].join(' | ')
}

function buildDecisionHref(decisionId: string, selectedDecisionId: string | null): string {
  return selectedDecisionId === decisionId ? '/lab' : `/lab?decisionId=${decisionId}`
}

export default async function LabPage({
  searchParams,
}: {
  searchParams: LabSearchParams
}) {
  const params = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/lab')
  }

  const { investment } = await ensurePortfolioWorkspace(user.id)

  const { data: decisions, error } = await supabase
    .from('agent_decisions')
    .select(
      'id, run_at, proposal_status, proposal, research_summaries, policy_assessment, risk_report, stage_durations, error_log'
    )
    .eq('user_id', user.id)
    .eq('portfolio_id', investment.id)
    .order('run_at', { ascending: false })
    .limit(5)
    .returns<AgentDecisionRow[]>()

  const decisionsError = error?.message ?? null
  const selectedDecisionId = params.decisionId ?? decisions?.[0]?.id ?? null

  return (
    <main className="mx-auto max-w-7xl p-6 font-mono text-sm text-neutral-900">
      <div className="mb-6 space-y-2">
        <h1 className="text-2xl font-semibold">Lab Operator Console</h1>
        <p>Portfolio: {investment.name}</p>
        <p className="text-neutral-600">
          Phase 2 operator surface for inspecting decision-log runs, timings, and anti-hallucination
          audit trails.
        </p>
      </div>

      {params.run === 'success' ? (
        <p className="mb-4 rounded border border-emerald-300 bg-emerald-50 px-3 py-2 text-emerald-900">
          Analysis run completed. Decision ID: <strong>{params.decisionId ?? 'unknown'}</strong>
        </p>
      ) : null}

      {params.run === 'error' ? (
        <p className="mb-4 rounded border border-red-300 bg-red-50 px-3 py-2 text-red-900">
          Analysis run failed: {params.message ?? 'unknown error'}
        </p>
      ) : null}

      <form action="/api/lab/run-analysis" method="post" className="mb-8">
        <input type="hidden" name="portfolioId" value={investment.id} />
        <button
          type="submit"
          className="rounded border border-neutral-900 px-3 py-2 hover:bg-neutral-900 hover:text-white"
        >
          Run Analysis
        </button>
      </form>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Recent Decisions</h2>
          <p className="text-neutral-600">Expand a row to inspect timing, data gaps, and outputs.</p>
        </div>

        {decisionsError ? (
          <p className="rounded border border-red-300 bg-red-50 px-3 py-2 text-red-900">
            Decision log unavailable: {decisionsError}
          </p>
        ) : decisions && decisions.length > 0 ? (
          <div className="overflow-x-auto rounded border border-neutral-300">
            <table className="min-w-full border-collapse">
              <thead className="bg-neutral-100 text-left">
                <tr>
                  <th className="border-b border-neutral-300 px-3 py-2">Run</th>
                  <th className="border-b border-neutral-300 px-3 py-2">Status</th>
                  <th className="border-b border-neutral-300 px-3 py-2">Proposal</th>
                  <th className="border-b border-neutral-300 px-3 py-2">Timings</th>
                  <th className="border-b border-neutral-300 px-3 py-2">Inspect</th>
                </tr>
              </thead>
              <tbody>
                {decisions.map((decision) => {
                  const isExpanded = selectedDecisionId === decision.id

                  return (
                    <Fragment key={decision.id}>
                      <tr className="align-top">
                        <td className="border-b border-neutral-200 px-3 py-2">
                          <div>{formatTimestamp(decision.run_at)}</div>
                          <div className="text-xs text-neutral-500">{decision.id}</div>
                        </td>
                        <td className="border-b border-neutral-200 px-3 py-2">
                          {decision.proposal_status}
                        </td>
                        <td className="border-b border-neutral-200 px-3 py-2">
                          {decision.proposal ? 'yes' : 'no'}
                        </td>
                        <td className="border-b border-neutral-200 px-3 py-2 text-xs text-neutral-700">
                          {buildTimingSummary(decision.stage_durations)}
                        </td>
                        <td className="border-b border-neutral-200 px-3 py-2">
                          <a
                            href={buildDecisionHref(decision.id, selectedDecisionId)}
                            className="underline"
                          >
                            {isExpanded ? 'Hide' : 'Inspect'}
                          </a>
                        </td>
                      </tr>
                      {isExpanded ? (
                        <tr>
                          <td colSpan={5} className="bg-neutral-50 px-4 py-4">
                            <div className="grid gap-4 lg:grid-cols-2">
                              <section className="rounded border border-neutral-300 bg-white p-4">
                                <h3 className="mb-2 font-semibold">Timing Breakdown</h3>
                                <p className="mb-3 text-xs text-neutral-700">
                                  {buildTimingSummary(decision.stage_durations)}
                                </p>
                                {decision.stage_durations ? (
                                  <div className="space-y-2 text-xs">
                                    <div>Decision write: {formatDuration(decision.stage_durations.decisionWriteMs)}</div>
                                    <div>Cash balance: {formatDuration(decision.stage_durations.cashBalanceMs)}</div>
                                    <div>Research: {formatDuration(decision.stage_durations.researchMs)}</div>
                                    <div>Policy: {formatDuration(decision.stage_durations.policyAssessmentMs)}</div>
                                    <div>Risk: {formatDuration(decision.stage_durations.riskReportMs)}</div>
                                    <div>Rebalance build: {formatDuration(decision.stage_durations.proposalBuildMs)}</div>
                                    <div>Proposal write: {formatDuration(decision.stage_durations.proposalWriteMs)}</div>
                                    <div>Total: {formatDuration(decision.stage_durations.totalMs)}</div>
                                  </div>
                                ) : (
                                  <p className="text-xs text-neutral-500">No stage timing data recorded.</p>
                                )}
                              </section>

                              <section className="rounded border border-neutral-300 bg-white p-4">
                                <h3 className="mb-2 font-semibold">Error Log</h3>
                                {decision.error_log && decision.error_log.length > 0 ? (
                                  <pre className="overflow-x-auto whitespace-pre-wrap text-xs">
                                    {JSON.stringify(decision.error_log, null, 2)}
                                  </pre>
                                ) : (
                                  <p className="text-xs text-neutral-500">No pipeline errors recorded.</p>
                                )}
                              </section>
                            </div>

                            <section className="mt-4 rounded border border-amber-300 bg-amber-50 p-4">
                              <h3 className="mb-2 font-semibold text-amber-950">
                                Research Audit Surface
                              </h3>
                              {decision.research_summaries && decision.research_summaries.length > 0 ? (
                                <div className="space-y-4">
                                  {decision.research_summaries.map((summary) => (
                                    <article
                                      key={summary.ticker}
                                      className="rounded border border-amber-200 bg-white p-4"
                                    >
                                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                                        <div className="flex flex-wrap items-center gap-2">
                                          <h4 className="font-semibold">{summary.ticker}</h4>
                                          {summary.parseError ? (
                                            <span className="rounded border border-red-300 bg-red-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-800">
                                              Parse Error
                                            </span>
                                          ) : null}
                                        </div>
                                        <span className="text-xs text-neutral-600">
                                          {buildTickerTimingSummary(
                                            summary.ticker,
                                            decision.stage_durations
                                          ) ?? 'Ticker timing unavailable'}
                                        </span>
                                      </div>
                                      <div className="grid gap-4 lg:grid-cols-2">
                                        <div>
                                          <h5 className="mb-1 text-xs font-semibold uppercase tracking-wide text-red-700">
                                            Data Gaps
                                          </h5>
                                          {summary.dataGaps.length > 0 ? (
                                            <ul className="list-disc space-y-1 pl-4 text-xs text-red-900">
                                              {summary.dataGaps.map((gap) => (
                                                <li key={gap}>{gap}</li>
                                              ))}
                                            </ul>
                                          ) : (
                                            <p className="text-xs text-neutral-500">No explicit data gaps.</p>
                                          )}
                                        </div>
                                        <div>
                                          <h5 className="mb-1 text-xs font-semibold uppercase tracking-wide text-blue-700">
                                            Data Sources
                                          </h5>
                                          {summary.dataSources.length > 0 ? (
                                            <ul className="list-disc space-y-1 pl-4 text-xs text-blue-900">
                                              {summary.dataSources.map((source) => (
                                                <li key={source}>{source}</li>
                                              ))}
                                            </ul>
                                          ) : (
                                            <p className="text-xs text-neutral-500">No data sources recorded.</p>
                                          )}
                                        </div>
                                      </div>
                                      <details className="mt-3">
                                        <summary className="cursor-pointer text-xs font-semibold">
                                          Full Research Summary JSON
                                        </summary>
                                        <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded bg-neutral-950 p-3 text-xs text-neutral-100">
                                          {JSON.stringify(summary, null, 2)}
                                        </pre>
                                      </details>
                                    </article>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-xs text-neutral-500">
                                  No research summaries were stored for this decision.
                                </p>
                              )}
                            </section>

                            <div className="mt-4 grid gap-4 lg:grid-cols-3">
                              <section className="rounded border border-neutral-300 bg-white p-4">
                                <h3 className="mb-2 font-semibold">Proposal</h3>
                                <pre className="overflow-x-auto whitespace-pre-wrap text-xs">
                                  {JSON.stringify(decision.proposal, null, 2)}
                                </pre>
                              </section>
                              <section className="rounded border border-neutral-300 bg-white p-4">
                                <h3 className="mb-2 font-semibold">Policy Assessment</h3>
                                <pre className="overflow-x-auto whitespace-pre-wrap text-xs">
                                  {JSON.stringify(decision.policy_assessment, null, 2)}
                                </pre>
                              </section>
                              <section className="rounded border border-neutral-300 bg-white p-4">
                                <h3 className="mb-2 font-semibold">Risk Report</h3>
                                <pre className="overflow-x-auto whitespace-pre-wrap text-xs">
                                  {JSON.stringify(decision.risk_report, null, 2)}
                                </pre>
                              </section>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p>No agent decisions recorded yet.</p>
        )}
      </section>
    </main>
  )
}
