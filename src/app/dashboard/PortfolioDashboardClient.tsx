'use client'

import { useState, type Dispatch, type SetStateAction } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type {
  PortfolioDashboardHolding,
  SectorAllocation,
  UserSettingsRecord,
} from '@/lib/portfolio/types'

type HoldingTrustQuality = 'complete' | 'degraded' | 'limited' | 'unknown'

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  }).format(value)
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`
}

function formatTimestamp(value: string | null | undefined): string {
  if (!value) return 'Unknown'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown'

  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function trustTone(quality: HoldingTrustQuality) {
  switch (quality) {
    case 'complete':
      return {
        label: 'Complete',
        color: 'var(--green)',
        background: 'var(--green-bg)',
        border: 'color-mix(in srgb, var(--green) 30%, var(--border))',
      }
    case 'degraded':
      return {
        label: 'Degraded',
        color: 'var(--accent)',
        background: 'color-mix(in srgb, var(--accent) 12%, var(--bg-card))',
        border: 'color-mix(in srgb, var(--accent) 28%, var(--border))',
      }
    case 'limited':
      return {
        label: 'Limited',
        color: 'var(--red)',
        background: 'var(--red-bg)',
        border: 'color-mix(in srgb, var(--red) 30%, var(--border))',
      }
    case 'unknown':
      return {
        label: 'Unknown',
        color: 'var(--text-dim)',
        background: 'var(--bg-card)',
        border: 'var(--border)',
      }
  }
}

function getHoldingTrustState(): {
  quality: HoldingTrustQuality
  label: string
  detail: string
  lastAnalyzedAt: string | null
} {
  return {
    quality: 'unknown',
    label: 'Not analyzed',
    detail: 'No per-holding analysis trust metadata is available yet in the portfolio layer.',
    lastAnalyzedAt: null,
  }
}

function humanizeGoal(value: NonNullable<UserSettingsRecord['primary_goal']>) {
  switch (value) {
    case 'growth':
      return 'long-term growth'
    case 'income':
      return 'income generation'
    case 'preservation':
      return 'capital preservation'
    case 'balanced':
      return 'balanced compounding'
  }
}

function humanizeHorizon(value: NonNullable<UserSettingsRecord['investing_horizon']>) {
  switch (value) {
    case 'short_term':
      return 'short-term'
    case 'medium_term':
      return 'medium-term'
    case 'long_term':
      return 'long-term'
  }
}

function humanizeAutomation(
  value: NonNullable<UserSettingsRecord['automation_preference']>
) {
  switch (value) {
    case 'research_only':
      return 'research-first'
    case 'guided':
      return 'guided automation'
    case 'approval_required':
      return 'approval-required automation'
  }
}

function automationReadinessLabel(
  value: NonNullable<UserSettingsRecord['automation_preference']>
) {
  switch (value) {
    case 'research_only':
      return 'Research-only lane'
    case 'guided':
      return 'Guided automation'
    case 'approval_required':
      return 'Approval gate active'
  }
}

function goalHeadline(value: NonNullable<UserSettingsRecord['primary_goal']>) {
  switch (value) {
    case 'growth':
      return 'Compounding-first portfolio'
    case 'income':
      return 'Income-oriented portfolio'
    case 'preservation':
      return 'Capital-preservation portfolio'
    case 'balanced':
      return 'Balanced mandate portfolio'
  }
}

function goalGuidance(value: NonNullable<UserSettingsRecord['primary_goal']>) {
  switch (value) {
    case 'growth':
      return 'Prioritize durable compounders, clearer upside asymmetry, and long-horizon portfolio construction.'
    case 'income':
      return 'Focus on cash-generating holdings, yield quality, and stability of recurring income streams.'
    case 'preservation':
      return 'Bias toward downside control, resilience, and limiting avoidable concentration or volatility shocks.'
    case 'balanced':
      return 'Balance return generation with resilience so the portfolio can compound without becoming fragile.'
  }
}

function automationGuidance(
  value: NonNullable<UserSettingsRecord['automation_preference']>
) {
  switch (value) {
    case 'research_only':
      return 'The future agent should stay in analysis mode and avoid action framing until you explicitly escalate it.'
    case 'guided':
      return 'The future agent can surface stronger suggestions, but the dashboard should still keep you in the loop as the operator.'
    case 'approval_required':
      return 'The future agent should prepare toward human-in-the-loop operation, with every meaningful action routed through your approval.'
  }
}

function goalActionLabel(value: NonNullable<UserSettingsRecord['primary_goal']>) {
  switch (value) {
    case 'growth':
      return 'Add your first compounder'
    case 'income':
      return 'Add your first income holding'
    case 'preservation':
      return 'Add your first defensive holding'
    case 'balanced':
      return 'Add your first core holding'
  }
}

function goalActionGuidance(value: NonNullable<UserSettingsRecord['primary_goal']>) {
  switch (value) {
    case 'growth':
      return 'Start with a high-conviction long-term name the future agent can evaluate for upside durability and compounding potential.'
    case 'income':
      return 'Start with a holding where yield quality, cash generation, and stability matter more than narrative or short-term momentum.'
    case 'preservation':
      return 'Start with a resilient name that can anchor the portfolio while keeping downside risk and concentration under control.'
    case 'balanced':
      return 'Start with a core position that can support both resilience and steady compounding as the portfolio expands.'
  }
}

function riskDefaults(risk: NonNullable<UserSettingsRecord['risk_tolerance']>) {
  switch (risk) {
    case 'conservative':
      return { maxPositionPct: 0.08, maxSectorPct: 0.2 }
    case 'moderate':
      return { maxPositionPct: 0.12, maxSectorPct: 0.3 }
    case 'aggressive':
      return { maxPositionPct: 0.18, maxSectorPct: 0.4 }
  }
}

async function validateTicker(ticker: string) {
  const response = await fetch(`/api/fundamentals?ticker=${encodeURIComponent(ticker)}`)
  return response.ok
}

interface Props {
  userLabel: string
  userId: string
  portfolioId: string
  portfolioName: string
  benchmark: string | null
  riskTier: string | null
  cashBalance: number
  totalValue: number
  holdings: PortfolioDashboardHolding[]
  sectorAllocations: SectorAllocation[]
  userSettings: UserSettingsRecord
  dashboardGeneratedAt: string
  workspaceUpdatedAt: string | null
}

export default function PortfolioDashboardClient({
  userLabel,
  userId,
  portfolioId,
  portfolioName,
  benchmark,
  riskTier,
  cashBalance,
  totalValue,
  holdings,
  sectorAllocations,
  userSettings,
  dashboardGeneratedAt,
  workspaceUpdatedAt,
}: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [addTicker, setAddTicker] = useState('')
  const [addShares, setAddShares] = useState('')
  const [addCostBasis, setAddCostBasis] = useState('')
  const [cashDraft, setCashDraft] = useState(cashBalance.toString())
  const [isBusy, setIsBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [profileSaved, setProfileSaved] = useState(false)
  const [goal, setGoal] = useState(userSettings.primary_goal ?? 'growth')
  const [horizon, setHorizon] = useState(userSettings.investing_horizon ?? 'long_term')
  const [riskProfile, setRiskProfile] = useState(userSettings.risk_tolerance ?? 'moderate')
  const [automationPreference, setAutomationPreference] = useState(
    userSettings.automation_preference ?? 'approval_required'
  )
  const hasHoldings = holdings.length > 0
  const hasCash = cashBalance > 0
  const onboardingComplete = Boolean(userSettings.onboarding_completed_at)
  const onboardingSteps = [
    {
      label: 'Fund the workspace',
      status: hasCash ? 'complete' : 'pending',
      description: hasCash
        ? `Cash balance set to ${formatCurrency(cashBalance)}.`
        : 'Set an initial cash balance so the future agent has deployable capital context.',
    },
    {
      label: 'Add first position',
      status: hasHoldings ? 'complete' : 'pending',
      description: hasHoldings
        ? `${holdings.length} active position${holdings.length === 1 ? '' : 's'} in place.`
        : 'Add at least one holding to turn this from an account shell into a portfolio subject.',
    },
    {
      label: 'Shape the opportunity queue',
      status: 'ready',
      description: 'Use the watchlist as the second portfolio where future ideas and monitored names live.',
    },
  ] as const

  const personalizationSummary = onboardingComplete
    ? `Configured for ${humanizeGoal(goal)} on a ${humanizeHorizon(horizon)} horizon with ${humanizeAutomation(automationPreference)} and a ${riskProfile} risk posture.`
    : 'Answer a few setup questions to create the first personalized version of your portfolio operating system.'
  const activeGoalHeadline = goalHeadline(goal)
  const activeGoalGuidance = goalGuidance(goal)
  const activeAutomationGuidance = automationGuidance(automationPreference)
  const dominantActionLabel = goalActionLabel(goal)
  const dominantActionGuidance = goalActionGuidance(goal)
  const holdingTrustStates = holdings.map((holding) => ({
    holdingId: holding.id,
    ...getHoldingTrustState(holding),
  }))
  const analyzedHoldings = holdingTrustStates.filter((state) => state.quality !== 'unknown').length
  const completeCount = holdingTrustStates.filter((state) => state.quality === 'complete').length
  const degradedCount = holdingTrustStates.filter((state) => state.quality === 'degraded').length
  const limitedCount = holdingTrustStates.filter((state) => state.quality === 'limited').length
  const unknownCount = holdingTrustStates.filter((state) => state.quality === 'unknown').length
  const holdingsWithMarketContext = holdings.filter((holding) => holding.currentPrice !== null).length

  async function refreshAfterMutation(options?: { profileSaved?: boolean }) {
    setProfileSaved(options?.profileSaved ?? false)
    router.refresh()
  }

  async function handleSignOut() {
    setIsBusy(true)
    setError(null)
    setProfileSaved(false)
    await supabase.auth.signOut()
    router.replace('/')
    router.refresh()
  }

  async function handleAddPosition() {
    const ticker = addTicker.toUpperCase().trim()
    const shares = Number(addShares)
    const costBasis =
      addCostBasis.trim().length > 0 ? Number(addCostBasis.trim()) : null

    setError(null)
    setProfileSaved(false)

    if (!ticker) {
      setError('Ticker is required.')
      return
    }

    if (!Number.isFinite(shares) || shares <= 0) {
      setError('Shares must be greater than zero.')
      return
    }

    if (costBasis !== null && (!Number.isFinite(costBasis) || costBasis < 0)) {
      setError('Cost basis must be zero or greater.')
      return
    }

    setIsBusy(true)

    if (!(await validateTicker(ticker))) {
      setIsBusy(false)
      setError(`Ticker '${ticker}' could not be validated.`)
      return
    }

    const { data: existing, error: existingError } = await supabase
      .from('holdings')
      .select('id')
      .eq('portfolio_id', portfolioId)
      .eq('ticker', ticker)
      .is('archived_at', null)
      .maybeSingle<{ id: string }>()

    if (existingError) {
      setIsBusy(false)
      setError(existingError.message)
      return
    }

    const payload = {
      portfolio_id: portfolioId,
      user_id: userId,
      ticker,
      shares,
      cost_basis: costBasis,
      archived_at: null,
    }

    const mutation = existing
      ? supabase.from('holdings').update(payload).eq('id', existing.id)
      : supabase.from('holdings').insert(payload)

    const { error: mutationError } = await mutation

    if (mutationError) {
      setIsBusy(false)
      setError(mutationError.message)
      return
    }

    setAddTicker('')
    setAddShares('')
    setAddCostBasis('')
    setIsBusy(false)
    await refreshAfterMutation()
  }

  async function handleUpdateHolding(
    holdingId: string,
    ticker: string,
    sharesValue: string,
    costBasisValue: string
  ) {
    setIsBusy(true)
    setError(null)
    setProfileSaved(false)

    const shares = Number(sharesValue)
    const costBasis = costBasisValue.trim().length > 0 ? Number(costBasisValue) : null

    if (!Number.isFinite(shares) || shares < 0) {
      setIsBusy(false)
      setError(`Shares for ${ticker} must be zero or greater.`)
      return
    }

    if (costBasis !== null && (!Number.isFinite(costBasis) || costBasis < 0)) {
      setIsBusy(false)
      setError(`Cost basis for ${ticker} must be zero or greater.`)
      return
    }

    const { error: updateError } = await supabase
      .from('holdings')
      .update({
        shares,
        cost_basis: costBasis,
      })
      .eq('id', holdingId)

    setIsBusy(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    await refreshAfterMutation()
  }

  async function handleArchiveHolding(holdingId: string) {
    setIsBusy(true)
    setError(null)
    setProfileSaved(false)

    const { error: archiveError } = await supabase
      .from('holdings')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', holdingId)

    setIsBusy(false)

    if (archiveError) {
      setError(archiveError.message)
      return
    }

    await refreshAfterMutation()
  }

  async function handleCashUpdate() {
    setIsBusy(true)
    setError(null)
    setProfileSaved(false)

    const amount = Number(cashDraft)
    if (!Number.isFinite(amount) || amount < 0) {
      setIsBusy(false)
      setError('Cash balance must be zero or greater.')
      return
    }

    const { error: updateError } = await supabase
      .from('cash_balance')
      .update({ amount })
      .eq('portfolio_id', portfolioId)

    setIsBusy(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    await refreshAfterMutation()
  }

  async function handleSaveProfile() {
    setIsBusy(true)
    setError(null)
    setProfileSaved(false)

    const defaults = riskDefaults(riskProfile)

    const { error: settingsError } = await supabase.from('user_settings').upsert({
      user_id: userId,
      primary_goal: goal,
      investing_horizon: horizon,
      risk_tolerance: riskProfile,
      automation_preference: automationPreference,
      onboarding_completed_at: new Date().toISOString(),
    })

    if (settingsError) {
      setIsBusy(false)
      setError(settingsError.message)
      return
    }

    const { error: portfolioError } = await supabase
      .from('portfolios')
      .update({ risk_tier: riskProfile })
      .eq('id', portfolioId)

    if (portfolioError) {
      setIsBusy(false)
      setError(portfolioError.message)
      return
    }

    const { data: activePolicy, error: policyLookupError } = await supabase
      .from('portfolio_policies')
      .select('id, automation_level, max_position_pct, max_sector_pct')
      .eq('portfolio_id', portfolioId)
      .eq('user_id', userId)
      .is('effective_until', null)
      .order('effective_from', { ascending: false })
      .limit(1)
      .maybeSingle<{
        id: string
        automation_level: string | null
        max_position_pct: number | null
        max_sector_pct: number | null
      }>()

    if (policyLookupError) {
      setIsBusy(false)
      setError(policyLookupError.message)
      return
    }

    const needsNewPolicy =
      !activePolicy ||
      activePolicy.automation_level !== automationPreference ||
      activePolicy.max_position_pct !== defaults.maxPositionPct ||
      activePolicy.max_sector_pct !== defaults.maxSectorPct

    if (needsNewPolicy) {
      const effectiveFrom = new Date().toISOString()

      if (activePolicy) {
        const { error: closePolicyError } = await supabase
          .from('portfolio_policies')
          .update({ effective_until: effectiveFrom })
          .eq('id', activePolicy.id)

        if (closePolicyError) {
          setIsBusy(false)
          setError(closePolicyError.message)
          return
        }
      }

      const { error: createPolicyError } = await supabase.from('portfolio_policies').insert({
        portfolio_id: portfolioId,
        user_id: userId,
        effective_from: effectiveFrom,
        max_position_pct: defaults.maxPositionPct,
        max_sector_pct: defaults.maxSectorPct,
        automation_level: automationPreference,
        created_by: 'user',
      })

      if (createPolicyError) {
        setIsBusy(false)
        setError(createPolicyError.message)
        return
      }
    }

    setIsBusy(false)
    await refreshAfterMutation({ profileSaved: true })
  }

  return (
    <main
      style={{
        maxWidth: 1200,
        margin: '0 auto',
        padding: '36px 24px 96px',
      }}
    >
      <section
        style={{
          display: 'grid',
          gap: 24,
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) auto',
            gap: 16,
            alignItems: 'start',
            padding: '26px 28px',
            borderRadius: 32,
            border: '1px solid var(--border)',
            background:
              'linear-gradient(155deg, color-mix(in srgb, var(--bg-card) 90%, rgba(111, 61, 244, 0.08)), color-mix(in srgb, var(--bg-panel) 92%, rgba(243, 198, 35, 0.05)))',
            boxShadow: 'var(--shadow-strong)',
          }}
        >
          <div style={{ display: 'grid', gap: 14 }}>
            <div
              style={{
                display: 'inline-flex',
                gap: 10,
                flexWrap: 'wrap',
              }}
            >
              {[
                `Operator: ${userLabel}`,
                benchmark ? `Benchmark: ${benchmark}` : null,
                onboardingComplete
                  ? `Risk tier: ${riskProfile}`
                  : riskTier
                    ? `Risk tier: ${riskTier}`
                    : null,
                onboardingComplete ? automationReadinessLabel(automationPreference) : null,
                'Phase 1 • Portfolio OS',
              ]
                .filter(Boolean)
                .map((item) => (
                  <span
                    key={item}
                    style={{
                      padding: '9px 12px',
                      borderRadius: 999,
                      border: '1px solid color-mix(in srgb, var(--purple-strong) 18%, var(--border))',
                      background:
                        'linear-gradient(135deg, rgba(111, 61, 244, 0.12), rgba(243, 198, 35, 0.08))',
                      color: 'var(--text-muted)',
                      fontSize: 12,
                      fontWeight: 700,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {item}
                  </span>
                ))}
            </div>

            <div>
              <div
                style={{
                  fontSize: 12,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  color: 'var(--purple-strong)',
                  fontWeight: 700,
                }}
              >
                Protected Portfolio Workspace
              </div>
              <h1
                style={{
                  margin: '12px 0 10px',
                  fontSize: 'clamp(38px, 6vw, 68px)',
                  lineHeight: 0.98,
                  letterSpacing: '-0.07em',
                }}
              >
                {onboardingComplete ? activeGoalHeadline : portfolioName}
              </h1>
              <p
                style={{
                  margin: 0,
                  color: 'var(--text-muted)',
                  maxWidth: 760,
                  fontSize: 16,
                  lineHeight: 1.75,
                }}
              >
                {personalizationSummary}
              </p>
              {onboardingComplete ? (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                    gap: 12,
                    marginTop: 18,
                    maxWidth: 860,
                  }}
                >
                  <div
                    style={{
                      padding: '14px 16px',
                      borderRadius: 20,
                      border: '1px solid var(--border)',
                      background: 'color-mix(in srgb, var(--bg-panel) 92%, rgba(111, 61, 244, 0.06))',
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        letterSpacing: '0.14em',
                        textTransform: 'uppercase',
                        color: 'var(--text-dim)',
                        fontWeight: 700,
                      }}
                    >
                      Portfolio Intent
                    </div>
                    <p
                      style={{
                        margin: '8px 0 0',
                        color: 'var(--text-muted)',
                        fontSize: 14,
                        lineHeight: 1.7,
                      }}
                    >
                      {activeGoalGuidance}
                    </p>
                  </div>
                  <div
                    style={{
                      padding: '14px 16px',
                      borderRadius: 20,
                      border: '1px solid var(--border)',
                      background: 'color-mix(in srgb, var(--bg-panel) 92%, rgba(243, 198, 35, 0.05))',
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        letterSpacing: '0.14em',
                        textTransform: 'uppercase',
                        color: 'var(--text-dim)',
                        fontWeight: 700,
                      }}
                    >
                      Agent Posture
                    </div>
                    <p
                      style={{
                        margin: '8px 0 0',
                        color: 'var(--text-muted)',
                        fontSize: 14,
                        lineHeight: 1.7,
                      }}
                    >
                      {activeAutomationGuidance}
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <button
            type="button"
            onClick={handleSignOut}
            style={{
              alignSelf: 'start',
              borderRadius: 999,
              border: '1px solid var(--border)',
              background: 'var(--bg-card)',
              color: 'var(--text)',
              padding: '12px 16px',
              cursor: 'pointer',
              fontWeight: 700,
            }}
          >
            Sign Out
          </button>
        </div>

        {error ? (
          <div
            style={{
              padding: '14px 18px',
              borderRadius: 20,
              border: '1px solid color-mix(in srgb, var(--red) 36%, var(--border))',
              background: 'var(--red-bg)',
              color: 'var(--text)',
              fontSize: 14,
              lineHeight: 1.7,
            }}
          >
            {error}
          </div>
        ) : null}

        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
            gap: 16,
          }}
        >
          {[
            ['Total Value', formatCurrency(totalValue)],
            ['Cash', formatCurrency(cashBalance)],
            ['Positions', holdings.length.toString().padStart(2, '0')],
            ['Sectors', sectorAllocations.length.toString().padStart(2, '0')],
          ].map(([label, value]) => (
            <div
              key={label}
              style={{
                padding: '22px 20px',
                borderRadius: 26,
                border: '1px solid var(--border)',
                background: 'var(--bg-card)',
                boxShadow: 'var(--shadow-soft)',
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  color: 'var(--text-dim)',
                }}
              >
                {label}
              </div>
              <div
                style={{
                  marginTop: 12,
                  fontSize: 36,
                  lineHeight: 1,
                  letterSpacing: '-0.06em',
                  fontWeight: 700,
                }}
              >
                {value}
              </div>
            </div>
          ))}
        </section>

        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.3fr) minmax(320px, 0.82fr)',
            gap: 24,
            alignItems: 'start',
          }}
        >
            <div
              style={{
                display: 'grid',
                gap: 20,
              }}
            >
            <div
              style={{
                padding: 22,
                borderRadius: 28,
                border: '1px solid var(--border)',
                background:
                  'linear-gradient(180deg, color-mix(in srgb, var(--bg-card) 94%, transparent), color-mix(in srgb, var(--bg-panel) 94%, transparent))',
                boxShadow: 'var(--shadow-soft)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 16,
                  alignItems: 'flex-start',
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 12,
                      letterSpacing: '0.16em',
                      textTransform: 'uppercase',
                      color: 'var(--purple-strong)',
                      fontWeight: 700,
                    }}
                  >
                    Portfolio Trust Summary
                  </div>
                  <p
                    style={{
                      margin: '10px 0 0',
                      color: 'var(--text-muted)',
                      fontSize: 14,
                      lineHeight: 1.8,
                      maxWidth: 720,
                    }}
                  >
                    This view reflects tracked holdings, position sizing, and currently available market context. Per-holding analysis quality is shown only when the portfolio layer has real trust metadata.
                  </p>
                </div>
                <div
                  style={{
                    display: 'grid',
                    gap: 8,
                    justifyItems: 'start',
                  }}
                >
                  <span
                    style={{
                      padding: '8px 10px',
                      borderRadius: 999,
                      border: '1px solid var(--border)',
                      background: 'var(--bg-panel)',
                      color: 'var(--text-muted)',
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                    }}
                  >
                    Last refresh {formatTimestamp(dashboardGeneratedAt)}
                  </span>
                  <span
                    style={{
                      padding: '8px 10px',
                      borderRadius: 999,
                      border: '1px solid var(--border)',
                      background: 'var(--bg-panel)',
                      color: 'var(--text-muted)',
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                    }}
                  >
                    Workspace update {formatTimestamp(workspaceUpdatedAt)}
                  </span>
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                  gap: 12,
                  marginTop: 18,
                }}
              >
                {[
                  ['Coverage', `${analyzedHoldings} of ${holdings.length} holdings analyzed`],
                  ['Quality mix', `${completeCount} complete · ${degradedCount} degraded · ${limitedCount} limited`],
                  ['Missing coverage', `${unknownCount} holding${unknownCount === 1 ? '' : 's'} without trust state`],
                  ['Market context', `${holdingsWithMarketContext} of ${holdings.length} holdings priced`],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    style={{
                      padding: '16px 16px',
                      borderRadius: 20,
                      border: '1px solid var(--border)',
                      background: 'var(--bg-panel)',
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        letterSpacing: '0.14em',
                        textTransform: 'uppercase',
                        color: 'var(--text-dim)',
                        fontWeight: 700,
                      }}
                    >
                      {label}
                    </div>
                    <div
                      style={{
                        marginTop: 8,
                        color: 'var(--text)',
                        fontSize: 15,
                        fontWeight: 700,
                        lineHeight: 1.5,
                      }}
                    >
                      {value}
                    </div>
                  </div>
                ))}
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                  gap: 14,
                  marginTop: 18,
                }}
              >
                <div
                  style={{
                    padding: '16px 18px',
                    borderRadius: 20,
                    border: '1px solid var(--border)',
                    background: 'var(--bg-panel)',
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                      color: 'var(--text-dim)',
                      fontWeight: 700,
                    }}
                  >
                    What This View Knows
                  </div>
                  <p
                    style={{
                      margin: '8px 0 0',
                      color: 'var(--text-muted)',
                      fontSize: 14,
                      lineHeight: 1.7,
                    }}
                  >
                    {holdings.length === 0
                      ? 'No active holdings are tracked yet, so trust coverage is limited to account setup state.'
                      : `It knows ${holdings.length} tracked holding${holdings.length === 1 ? '' : 's'}, current prices for ${holdingsWithMarketContext}, and portfolio weights derived from saved positions plus cash.`}
                  </p>
                </div>
                <div
                  style={{
                    padding: '16px 18px',
                    borderRadius: 20,
                    border: '1px solid var(--border)',
                    background: 'var(--bg-panel)',
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                      color: 'var(--text-dim)',
                      fontWeight: 700,
                    }}
                  >
                    What May Be Missing
                  </div>
                  <p
                    style={{
                      margin: '8px 0 0',
                      color: 'var(--text-muted)',
                      fontSize: 14,
                      lineHeight: 1.7,
                    }}
                  >
                    {unknownCount > 0
                      ? `Some holdings do not yet have analysis coverage. Trust metadata is unavailable for ${unknownCount} position${unknownCount === 1 ? '' : 's'}.`
                      : 'No missing trust state is currently exposed in this portfolio view.'}
                  </p>
                  {workspaceUpdatedAt === null ? (
                    <p
                      style={{
                        margin: '8px 0 0',
                        color: 'var(--text-dim)',
                        fontSize: 13,
                        lineHeight: 1.7,
                      }}
                    >
                      Last workspace refresh unavailable.
                    </p>
                  ) : null}
                </div>
              </div>
            </div>

            {!onboardingComplete ? (
              <div
                style={{
                  padding: 24,
                  borderRadius: 30,
                  border: '1px solid color-mix(in srgb, var(--accent) 26%, var(--border))',
                  background:
                    'linear-gradient(155deg, color-mix(in srgb, var(--bg-card) 88%, rgba(243, 198, 35, 0.06)), color-mix(in srgb, var(--bg-panel) 90%, rgba(111, 61, 244, 0.08)))',
                  boxShadow: 'var(--shadow-strong)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 18,
                    alignItems: 'flex-start',
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ maxWidth: 680 }}>
                    <div
                      style={{
                        fontSize: 12,
                        letterSpacing: '0.16em',
                        textTransform: 'uppercase',
                        color: 'var(--purple-strong)',
                        fontWeight: 700,
                      }}
                    >
                      Personalize The Portfolio OS
                    </div>
                    <h2
                      style={{
                        margin: '10px 0 10px',
                        fontSize: 'clamp(30px, 4vw, 46px)',
                        lineHeight: 1,
                        letterSpacing: '-0.06em',
                      }}
                    >
                      Answer four questions. Shape the agent before it ever acts.
                    </h2>
                    <p
                      style={{
                        margin: 0,
                        color: 'var(--text-muted)',
                        fontSize: 15,
                        lineHeight: 1.8,
                      }}
                    >
                      These answers become account-owned operating context for your future
                      portfolio agent. They define what kind of portfolio you are building,
                      what time horizon matters, and how much automation should be allowed later.
                    </p>
                  </div>
                  <span
                    style={{
                      padding: '10px 12px',
                      borderRadius: 999,
                      border: '1px solid color-mix(in srgb, var(--accent) 24%, var(--border))',
                      background: 'color-mix(in srgb, var(--accent) 12%, transparent)',
                      color: 'var(--text)',
                      fontSize: 12,
                      fontWeight: 800,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                    }}
                  >
                    Account Memory Seed
                  </span>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                    gap: 14,
                    marginTop: 22,
                  }}
                >
                  <QuestionCard
                    label="Primary Goal"
                    description="What should this portfolio optimize for first?"
                    value={goal}
                    onChange={setGoal}
                    options={[
                      ['growth', 'Long-term growth'],
                      ['balanced', 'Balanced compounding'],
                      ['income', 'Income generation'],
                      ['preservation', 'Capital preservation'],
                    ]}
                  />
                  <QuestionCard
                    label="Investing Horizon"
                    description="What time frame should the portfolio be judged on?"
                    value={horizon}
                    onChange={setHorizon}
                    options={[
                      ['short_term', 'Short-term'],
                      ['medium_term', 'Medium-term'],
                      ['long_term', 'Long-term'],
                    ]}
                  />
                  <QuestionCard
                    label="Risk Posture"
                    description="How much volatility should the system tolerate?"
                    value={riskProfile}
                    onChange={setRiskProfile}
                    options={[
                      ['conservative', 'Conservative'],
                      ['moderate', 'Moderate'],
                      ['aggressive', 'Aggressive'],
                    ]}
                  />
                  <QuestionCard
                    label="Automation Preference"
                    description="How close should the future agent get to action?"
                    value={automationPreference}
                    onChange={setAutomationPreference}
                    options={[
                      ['research_only', 'Research only'],
                      ['guided', 'Guided automation'],
                      ['approval_required', 'Approval required'],
                    ]}
                  />
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 16,
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    marginTop: 22,
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      color: 'var(--text-dim)',
                      fontSize: 13,
                      lineHeight: 1.7,
                      maxWidth: 720,
                    }}
                  >
                    These answers are saved to your account and become the first layer of
                    personalized agent context. You can change them later as the product matures.
                  </p>
                  <button
                    type="button"
                    onClick={handleSaveProfile}
                    disabled={isBusy}
                    style={{
                      border: 'none',
                      borderRadius: 999,
                      background:
                        'linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 62%, white))',
                      color: '#111',
                      fontWeight: 800,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      padding: '15px 22px',
                      cursor: isBusy ? 'progress' : 'pointer',
                      minHeight: 52,
                      boxShadow: '0 16px 34px rgba(243, 198, 35, 0.18)',
                    }}
                  >
                    Save Agent Profile
                  </button>
                </div>
                <div
                  style={{
                    marginTop: 18,
                    padding: '16px 18px',
                    borderRadius: 22,
                    border: '1px solid color-mix(in srgb, var(--accent) 20%, var(--border))',
                    background: 'color-mix(in srgb, var(--accent) 8%, var(--bg-card))',
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                      color: 'var(--text-dim)',
                      fontWeight: 700,
                    }}
                  >
                    Dominant Next Action
                  </div>
                  <div
                    style={{
                      marginTop: 10,
                      fontSize: 22,
                      fontWeight: 700,
                      letterSpacing: '-0.04em',
                      color: 'var(--text)',
                    }}
                  >
                    {hasCash ? dominantActionLabel : 'Fund the workspace'}
                  </div>
                  <p
                    style={{
                      margin: '8px 0 0',
                      color: 'var(--text-muted)',
                      fontSize: 14,
                      lineHeight: 1.75,
                    }}
                  >
                    {hasCash
                      ? dominantActionGuidance
                      : 'Add an initial cash balance first so future policy and rebalance logic has deployable capital context.'}
                  </p>
                </div>
            </div>
          ) : (
              <div
                style={{
                  padding: 22,
                  borderRadius: 28,
                  border: '1px solid color-mix(in srgb, var(--purple) 20%, var(--border))',
                  background:
                    'linear-gradient(155deg, color-mix(in srgb, var(--bg-card) 92%, rgba(111, 61, 244, 0.08)), color-mix(in srgb, var(--bg-panel) 95%, rgba(243, 198, 35, 0.05)))',
                  boxShadow: 'var(--shadow-soft)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 12,
                    alignItems: 'center',
                    flexWrap: 'wrap',
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 12,
                        letterSpacing: '0.16em',
                        textTransform: 'uppercase',
                        color: 'var(--purple-strong)',
                        fontWeight: 700,
                      }}
                    >
                      Personalized Agent Profile
                    </div>
                    <p
                      style={{
                        margin: '8px 0 0',
                        color: 'var(--text-muted)',
                        fontSize: 14,
                        lineHeight: 1.75,
                      }}
                    >
                      Built for {humanizeGoal(goal)} with a {humanizeHorizon(horizon)} horizon,
                      a {riskProfile} risk posture, and {humanizeAutomation(automationPreference)}.
                    </p>
                    {profileSaved ? (
                      <div
                        style={{
                          marginTop: 10,
                          display: 'inline-flex',
                          padding: '8px 12px',
                          borderRadius: 999,
                          border: '1px solid color-mix(in srgb, var(--green) 26%, var(--border))',
                          background: 'var(--green-bg)',
                          color: 'var(--green)',
                          fontSize: 12,
                          fontWeight: 700,
                          letterSpacing: '0.08em',
                          textTransform: 'uppercase',
                        }}
                      >
                        Profile synced to portfolio defaults
                      </div>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={handleSaveProfile}
                    disabled={isBusy}
                    style={{
                      border: '1px solid var(--border)',
                      borderRadius: 999,
                      background: 'var(--bg-card)',
                      color: 'var(--text)',
                      padding: '11px 14px',
                      fontWeight: 700,
                      cursor: isBusy ? 'progress' : 'pointer',
                    }}
                  >
                    Update Profile
                  </button>
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                    gap: 12,
                    marginTop: 16,
                  }}
                >
                  {[
                    ['Goal', humanizeGoal(goal)],
                    ['Horizon', humanizeHorizon(horizon)],
                    ['Automation', humanizeAutomation(automationPreference)],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      style={{
                        padding: '14px 14px',
                        borderRadius: 18,
                        border: '1px solid var(--border)',
                        background: 'var(--bg-panel)',
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          letterSpacing: '0.14em',
                          textTransform: 'uppercase',
                          color: 'var(--text-dim)',
                          fontWeight: 700,
                        }}
                      >
                        {label}
                      </div>
                      <div
                        style={{
                          marginTop: 8,
                          color: 'var(--text)',
                          fontSize: 14,
                          fontWeight: 700,
                        }}
                      >
                        {value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!hasHoldings ? (
              <div
                style={{
                  padding: 24,
                  borderRadius: 30,
                  border: '1px solid color-mix(in srgb, var(--purple) 24%, var(--border))',
                  background:
                    'linear-gradient(155deg, color-mix(in srgb, var(--bg-card) 90%, rgba(111, 61, 244, 0.1)), color-mix(in srgb, var(--bg-panel) 94%, rgba(243, 198, 35, 0.06)))',
                  boxShadow: 'var(--shadow-strong)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 16,
                    alignItems: 'flex-start',
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ maxWidth: 640 }}>
                    <div
                      style={{
                        fontSize: 12,
                        letterSpacing: '0.16em',
                        textTransform: 'uppercase',
                        color: 'var(--purple-strong)',
                        fontWeight: 700,
                      }}
                    >
                      First-Run Path
                    </div>
                    <h2
                      style={{
                        margin: '10px 0 10px',
                        fontSize: 'clamp(28px, 4.4vw, 44px)',
                        lineHeight: 1,
                        letterSpacing: '-0.06em',
                      }}
                    >
                      Turn this account into a live portfolio workspace.
                    </h2>
                    <p
                      style={{
                        margin: 0,
                        color: 'var(--text-muted)',
                        fontSize: 15,
                        lineHeight: 1.8,
                      }}
                    >
                      The product is now behaving correctly: account first, portfolio second.
                      To move toward the paper agent phase, establish real portfolio state here.
                    </p>
                  </div>

                  <Link
                    href="/watchlist"
                    style={{
                      textDecoration: 'none',
                      color: '#121212',
                      borderRadius: 999,
                      background:
                        'linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 62%, white))',
                      padding: '13px 18px',
                      fontWeight: 800,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      fontSize: 12,
                      boxShadow: '0 16px 36px rgba(243, 198, 35, 0.18)',
                    }}
                  >
                    Open Watchlist
                  </Link>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                    gap: 14,
                    marginTop: 22,
                  }}
                >
                  {onboardingSteps.map((step, index) => {
                    const complete = step.status === 'complete'
                    return (
                      <div
                        key={step.label}
                        style={{
                          padding: '18px 18px',
                          borderRadius: 24,
                          border: `1px solid ${complete ? 'color-mix(in srgb, var(--green) 34%, var(--border))' : 'var(--border)'}`,
                          background: complete ? 'var(--green-bg)' : 'var(--bg-card)',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 12,
                          }}
                        >
                          <span
                            style={{
                              fontSize: 12,
                              letterSpacing: '0.14em',
                              textTransform: 'uppercase',
                              color: complete ? 'var(--green)' : 'var(--text-dim)',
                              fontWeight: 700,
                            }}
                          >
                            Step {index + 1}
                          </span>
                          <span
                            style={{
                              padding: '6px 10px',
                              borderRadius: 999,
                              background: complete
                                ? 'color-mix(in srgb, var(--green) 12%, transparent)'
                                : 'color-mix(in srgb, var(--purple) 10%, transparent)',
                              color: complete ? 'var(--green)' : 'var(--text-muted)',
                              fontSize: 11,
                              fontWeight: 700,
                              letterSpacing: '0.08em',
                              textTransform: 'uppercase',
                            }}
                          >
                            {complete ? 'Complete' : step.status === 'ready' ? 'Ready' : 'Next'}
                          </span>
                        </div>
                        <div
                          style={{
                            marginTop: 12,
                            fontSize: 18,
                            fontWeight: 700,
                            color: 'var(--text)',
                            letterSpacing: '-0.03em',
                          }}
                        >
                          {step.label}
                        </div>
                        <p
                          style={{
                            margin: '10px 0 0',
                            color: 'var(--text-muted)',
                            fontSize: 14,
                            lineHeight: 1.7,
                          }}
                        >
                          {step.description}
                        </p>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : null}

            <div
              style={{
                padding: 24,
                borderRadius: 30,
                border: '1px solid var(--border)',
                background: 'var(--bg-card)',
                boxShadow: 'var(--shadow-strong)',
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  color: 'var(--purple-strong)',
                  fontWeight: 700,
                }}
              >
                Manual Portfolio Entry
              </div>
              <p
                style={{
                  margin: '10px 0 0',
                  color: 'var(--text-muted)',
                  fontSize: 14,
                  lineHeight: 1.8,
                }}
              >
                Add the current positions the future portfolio agent will reason about.
                Every ticker is validated before it touches the holdings table.
              </p>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr)',
                  gap: 12,
                  marginTop: 22,
                }}
              >
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 0.7fr) minmax(120px, 0.3fr) minmax(150px, 0.35fr)',
                    gap: 12,
                  }}
                >
                  <label style={{ display: 'grid', gap: 8 }}>
                    <span
                      style={{
                        fontSize: 11,
                        letterSpacing: '0.14em',
                        textTransform: 'uppercase',
                        color: 'var(--text-dim)',
                        fontWeight: 700,
                      }}
                    >
                      Ticker
                    </span>
                    <input
                      value={addTicker}
                      onChange={(event) => setAddTicker(event.target.value.toUpperCase())}
                      placeholder="AAPL"
                      style={{
                        borderRadius: 18,
                        border: '1px solid var(--border)',
                        background: 'var(--bg-panel)',
                        color: 'var(--text)',
                        padding: '14px 16px',
                        fontSize: 15,
                      }}
                    />
                  </label>
                  <label style={{ display: 'grid', gap: 8 }}>
                    <span
                      style={{
                        fontSize: 11,
                        letterSpacing: '0.14em',
                        textTransform: 'uppercase',
                        color: 'var(--text-dim)',
                        fontWeight: 700,
                      }}
                    >
                      Shares
                    </span>
                    <input
                      value={addShares}
                      onChange={(event) => setAddShares(event.target.value)}
                      placeholder="10"
                      type="number"
                      min="0"
                      step="any"
                      style={{
                        borderRadius: 18,
                        border: '1px solid var(--border)',
                        background: 'var(--bg-panel)',
                        color: 'var(--text)',
                        padding: '14px 16px',
                        fontSize: 15,
                      }}
                    />
                  </label>
                  <label style={{ display: 'grid', gap: 8 }}>
                    <span
                      style={{
                        fontSize: 11,
                        letterSpacing: '0.14em',
                        textTransform: 'uppercase',
                        color: 'var(--text-dim)',
                        fontWeight: 700,
                      }}
                    >
                      Cost Basis
                    </span>
                    <input
                      value={addCostBasis}
                      onChange={(event) => setAddCostBasis(event.target.value)}
                      placeholder="185.50"
                      type="number"
                      min="0"
                      step="any"
                      style={{
                        borderRadius: 18,
                        border: '1px solid var(--border)',
                        background: 'var(--bg-panel)',
                        color: 'var(--text)',
                        padding: '14px 16px',
                        fontSize: 15,
                      }}
                    />
                  </label>
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 16,
                    alignItems: 'center',
                    flexWrap: 'wrap',
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      color: 'var(--text-dim)',
                      fontSize: 13,
                      lineHeight: 1.7,
                    }}
                  >
                    Add one real holding to unlock portfolio weight, sector mix, and future
                    policy context.
                  </p>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={handleAddPosition}
                    style={{
                      border: 'none',
                      borderRadius: 999,
                      background:
                        'linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 62%, white))',
                      color: '#111',
                      fontWeight: 800,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      padding: '15px 22px',
                      cursor: isBusy ? 'progress' : 'pointer',
                      minHeight: 52,
                      boxShadow: '0 16px 34px rgba(243, 198, 35, 0.18)',
                    }}
                  >
                    Add Position
                  </button>
                </div>
              </div>
            </div>

            <div
              style={{
                padding: 24,
                borderRadius: 30,
                border: '1px solid var(--border)',
                background: 'var(--bg-card)',
                boxShadow: 'var(--shadow-strong)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 16,
                  alignItems: 'flex-start',
                  marginBottom: 18,
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 12,
                      letterSpacing: '0.16em',
                      textTransform: 'uppercase',
                      color: 'var(--purple-strong)',
                      fontWeight: 700,
                    }}
                  >
                    Holdings
                  </div>
                  <p
                    style={{
                      margin: '10px 0 0',
                      color: 'var(--text-muted)',
                      fontSize: 14,
                      lineHeight: 1.8,
                    }}
                  >
                    Edit shares and cost basis directly. Removing a row archives it instead of
                    hard deleting historical context.
                  </p>
                </div>
                <Link
                  href="/watchlist"
                  style={{
                    alignSelf: 'center',
                    textDecoration: 'none',
                    color: 'var(--text)',
                    borderRadius: 999,
                    border: '1px solid var(--border)',
                    background: 'var(--bg-panel)',
                    padding: '11px 14px',
                    fontWeight: 700,
                    fontSize: 13,
                  }}
                >
                  Open Watchlist
                </Link>
              </div>

              {holdings.length === 0 ? (
                <div
                  style={{
                    padding: '26px 24px',
                    borderRadius: 24,
                    border: '1px dashed var(--border)',
                    background: 'var(--bg-panel)',
                    display: 'grid',
                    gap: 14,
                  }}
                >
                  <div
                    style={{
                      fontSize: 18,
                      fontWeight: 700,
                      letterSpacing: '-0.03em',
                      color: 'var(--text)',
                    }}
                  >
                    No active positions yet.
                  </div>
                  <p
                    style={{
                      margin: 0,
                      color: 'var(--text-muted)',
                      lineHeight: 1.8,
                    }}
                  >
                    Add your first holding above, then use the cash panel to shape the starting
                    portfolio state. The policy, risk, and rebalance agents need both before they
                    can do meaningful work later.
                  </p>
                  <div
                    style={{
                      display: 'flex',
                      gap: 10,
                      flexWrap: 'wrap',
                    }}
                  >
                    {[
                      hasCash ? 'Cash set' : 'Set cash balance',
                      'Add first ticker',
                      'Review watchlist queue',
                    ].map((item) => (
                      <span
                        key={item}
                        style={{
                          padding: '8px 12px',
                          borderRadius: 999,
                          border: '1px solid var(--border)',
                          background: 'var(--bg-card)',
                          color: 'var(--text-muted)',
                          fontSize: 12,
                          fontWeight: 700,
                          letterSpacing: '0.08em',
                          textTransform: 'uppercase',
                        }}
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 14 }}>
                  {holdings.map((holding) => (
                    <HoldingRow
                      key={holding.id}
                      holding={holding}
                      trustState={holdingTrustStates.find((state) => state.holdingId === holding.id) ?? getHoldingTrustState(holding)}
                      onSave={handleUpdateHolding}
                      onArchive={handleArchiveHolding}
                      disabled={isBusy}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          <aside style={{ display: 'grid', gap: 20 }}>
            <div
              style={{
                padding: 24,
                borderRadius: 30,
                border: '1px solid var(--border)',
                background:
                  'linear-gradient(155deg, rgba(111, 61, 244, 0.94), rgba(23, 16, 40, 0.98))',
                boxShadow: 'var(--shadow-strong)',
                color: 'white',
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  color: 'rgba(255,255,255,0.68)',
                }}
              >
                Cash Balance
              </div>
              <div
                style={{
                  marginTop: 14,
                  fontSize: 42,
                  fontWeight: 700,
                  letterSpacing: '-0.06em',
                  lineHeight: 1,
                }}
              >
                {formatCurrency(cashBalance)}
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr) auto',
                  gap: 10,
                  marginTop: 18,
                }}
              >
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={cashDraft}
                  onChange={(event) => setCashDraft(event.target.value)}
                  style={{
                    borderRadius: 18,
                    border: '1px solid rgba(255,255,255,0.14)',
                    background: 'rgba(255,255,255,0.08)',
                    color: 'white',
                    padding: '13px 16px',
                    fontSize: 15,
                  }}
                />
                <button
                  type="button"
                  onClick={handleCashUpdate}
                  disabled={isBusy}
                  style={{
                    border: '1px solid rgba(255,255,255,0.14)',
                    borderRadius: 999,
                    background: 'rgba(255,255,255,0.1)',
                    color: 'white',
                    padding: '0 16px',
                    fontWeight: 700,
                    cursor: isBusy ? 'progress' : 'pointer',
                  }}
                >
                  Save
                </button>
              </div>
            </div>

            <div
              style={{
                padding: 24,
                borderRadius: 30,
                border: '1px solid var(--border)',
                background: 'var(--bg-card)',
                boxShadow: 'var(--shadow-soft)',
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  color: 'var(--purple-strong)',
                  fontWeight: 700,
                }}
              >
                Sector Allocation
              </div>

              {sectorAllocations.length === 0 ? (
                <p
                  style={{
                    margin: '14px 0 0',
                    color: 'var(--text-muted)',
                    lineHeight: 1.8,
                    fontSize: 14,
                  }}
                >
                  Sector breakdown appears once positions are in place and current market
                  context is available.
                </p>
              ) : (
                <div style={{ display: 'grid', gap: 12, marginTop: 16 }}>
                  {sectorAllocations.map((allocation) => (
                    <div
                      key={allocation.sector}
                      style={{
                        padding: '14px 16px',
                        borderRadius: 20,
                        border: '1px solid var(--border)',
                        background: 'var(--bg-panel)',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          gap: 12,
                          alignItems: 'baseline',
                        }}
                      >
                        <span style={{ fontWeight: 700, color: 'var(--text)' }}>
                          {allocation.sector}
                        </span>
                        <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                          {formatPercent(allocation.weight)}
                        </span>
                      </div>
                      <div
                        style={{
                          marginTop: 8,
                          height: 8,
                          borderRadius: 999,
                          background: 'color-mix(in srgb, var(--purple) 12%, var(--bg-panel))',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${Math.min(allocation.weight * 100, 100)}%`,
                            height: '100%',
                            borderRadius: 999,
                            background:
                              'linear-gradient(90deg, var(--purple-strong), var(--accent))',
                          }}
                        />
                      </div>
                      <div
                        style={{
                          marginTop: 8,
                          color: 'var(--text-muted)',
                          fontSize: 13,
                        }}
                      >
                        {formatCurrency(allocation.value)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </section>
      </section>
    </main>
  )
}

function QuestionCard<T extends string>({
  label,
  description,
  value,
  onChange,
  options,
}: {
  label: string
  description: string
  value: T
  onChange: Dispatch<SetStateAction<T>>
  options: Array<[T, string]>
}) {
  return (
    <label
      style={{
        display: 'grid',
        gap: 8,
        padding: '18px 18px',
        borderRadius: 24,
        border: '1px solid var(--border)',
        background: 'var(--bg-card)',
      }}
    >
      <span
        style={{
          fontSize: 12,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'var(--text-dim)',
          fontWeight: 700,
        }}
      >
        {label}
      </span>
      <span
        style={{
          color: 'var(--text-muted)',
          fontSize: 14,
          lineHeight: 1.7,
        }}
      >
        {description}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        style={{
          borderRadius: 16,
          border: '1px solid var(--border)',
          background: 'var(--bg-panel)',
          color: 'var(--text)',
          padding: '13px 14px',
          fontSize: 14,
        }}
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  )
}

function HoldingRow({
  holding,
  trustState,
  onSave,
  onArchive,
  disabled,
}: {
  holding: PortfolioDashboardHolding
  trustState: ReturnType<typeof getHoldingTrustState>
  onSave: (holdingId: string, ticker: string, shares: string, costBasis: string) => Promise<void>
  onArchive: (holdingId: string) => Promise<void>
  disabled: boolean
}) {
  const [sharesDraft, setSharesDraft] = useState(holding.shares.toString())
  const [costBasisDraft, setCostBasisDraft] = useState(
    holding.costBasis === null ? '' : holding.costBasis.toString()
  )
  const tone = trustTone(trustState.quality)

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1.1fr) minmax(110px, 0.32fr) minmax(140px, 0.38fr) auto',
        gap: 14,
        alignItems: 'center',
        padding: '18px 18px',
        borderRadius: 24,
        border: '1px solid var(--border)',
        background: 'var(--bg-panel)',
      }}
    >
      <div style={{ display: 'grid', gap: 8 }}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 10,
            alignItems: 'center',
          }}
        >
          <span
            style={{
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: '-0.04em',
            }}
          >
            {holding.ticker}
          </span>
          <span
            style={{
              padding: '6px 10px',
              borderRadius: 999,
              border: '1px solid color-mix(in srgb, var(--purple) 24%, var(--border))',
              background: 'color-mix(in srgb, var(--purple) 10%, var(--bg-card))',
              color: 'var(--text-muted)',
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            {holding.sector ?? 'Unclassified'}
          </span>
          <span
            style={{
              padding: '6px 10px',
              borderRadius: 999,
              border: `1px solid ${tone.border}`,
              background: tone.background,
              color: tone.color,
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            {tone.label}
          </span>
        </div>

        <div
          style={{
            display: 'flex',
            gap: 16,
            flexWrap: 'wrap',
            color: 'var(--text-muted)',
            fontSize: 13,
          }}
        >
          <span>Price {holding.currentPrice === null ? 'Data unavailable' : formatCurrency(holding.currentPrice)}</span>
          <span>Value {formatCurrency(holding.currentValue)}</span>
          <span>Weight {formatPercent(holding.weight)}</span>
        </div>
        <div
          style={{
            display: 'flex',
            gap: 16,
            flexWrap: 'wrap',
            color: 'var(--text-dim)',
            fontSize: 12,
            lineHeight: 1.6,
          }}
        >
          <span>{trustState.label}</span>
          <span>Holding updated {formatTimestamp(holding.updatedAt)}</span>
          <span>
            Analysis updated {formatTimestamp(trustState.lastAnalyzedAt)}
          </span>
        </div>
        <div
          style={{
            color: 'var(--text-dim)',
            fontSize: 12,
            lineHeight: 1.6,
            maxWidth: 560,
          }}
        >
          {trustState.detail}
        </div>
      </div>

      <input
        type="number"
        min="0"
        step="any"
        value={sharesDraft}
        onChange={(event) => setSharesDraft(event.target.value)}
        style={{
          borderRadius: 18,
          border: '1px solid var(--border)',
          background: 'var(--bg-card)',
          color: 'var(--text)',
          padding: '13px 14px',
          fontSize: 14,
        }}
      />

      <input
        type="number"
        min="0"
        step="any"
        value={costBasisDraft}
        onChange={(event) => setCostBasisDraft(event.target.value)}
        placeholder="Cost basis"
        style={{
          borderRadius: 18,
          border: '1px solid var(--border)',
          background: 'var(--bg-card)',
          color: 'var(--text)',
          padding: '13px 14px',
          fontSize: 14,
        }}
      />

      <div style={{ display: 'flex', gap: 10 }}>
        <button
          type="button"
          disabled={disabled}
          onClick={() => void onSave(holding.id, holding.ticker, sharesDraft, costBasisDraft)}
          style={{
            border: '1px solid var(--border)',
            borderRadius: 999,
            background: 'var(--bg-card)',
            color: 'var(--text)',
            padding: '12px 14px',
            fontWeight: 700,
            cursor: disabled ? 'progress' : 'pointer',
          }}
        >
          Save
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => void onArchive(holding.id)}
          style={{
            border: '1px solid color-mix(in srgb, var(--red) 28%, var(--border))',
            borderRadius: 999,
            background: 'transparent',
            color: 'var(--text-muted)',
            padding: '12px 14px',
            fontWeight: 700,
            cursor: disabled ? 'progress' : 'pointer',
          }}
        >
          Archive
        </button>
      </div>
    </div>
  )
}
