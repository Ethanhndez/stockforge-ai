# Portfolio Agent Roadmap

**Last updated:** 2026-03-22
**Status:** Architecture spec for the agent layer build-out.

---

## Agent Layer Overview

The agent layer is a set of specialized AI agents that collaborate to manage a user's portfolio. Each agent has a narrow, well-defined responsibility. No single agent does everything. This design keeps each agent's behavior auditable and its failure modes isolated.

The agents do not operate independently of each other — they form a pipeline. The output of one agent is the input of the next. The pipeline is triggered on a schedule, on a portfolio change, or on a user request.

---

## Agent 1: Research Agent

**Responsibility:** Gather and synthesize market data for tickers relevant to the current portfolio.

**Inputs:**
- List of tickers from the user's holdings and watchlist
- Optional: specific research request from the user ("give me a deeper look at NVDA")

**Process:**
1. For each ticker: call `getQuote`, `getFundamentals`, `getNews`, `getCompanyProfile`
2. Synthesize data into a `ResearchSummary` per ticker
3. Flag data gaps explicitly (do not fill with estimates)
4. Return array of `ResearchSummary` objects

**Output schema:**
```typescript
interface ResearchSummary {
  ticker: string
  quote: QuoteData | null
  fundamentals: FundamentalsData | null
  news: NewsItem[]
  dataGaps: string[]  // explicit list of what could not be fetched
  fetchedAt: string   // ISO timestamp
  dataSources: string[] // Polygon.io endpoint names used
}
```

**Anti-hallucination constraint:** If data is missing for a field, `null` is the correct value. The agent must never estimate, infer, or approximate missing data.

**Current state:** A working research agent exists in `/api/analysis`. It needs to be upgraded to accept a list of tickers (not just one), produce structured `ResearchSummary` objects, and handle partial data gracefully.

---

## Agent 2: Portfolio Policy Agent

**Responsibility:** Evaluate the current portfolio against the user's targets and constraints. Identify what needs attention.

**Inputs:**
- Current portfolio state (holdings, cash, allocation targets)
- Array of `ResearchSummary` objects from Research Agent
- User's policy rules (position limits, sector limits, prohibited tickers)

**Process:**
1. Calculate current allocation weights by position and sector
2. Compare to target allocation weights
3. Identify positions with drift beyond threshold (configurable, default 5%)
4. Flag any policy violations (position too large, prohibited ticker held, etc.)
5. Assess quality signals from research summaries (deteriorating fundamentals, negative news)
6. Produce `PolicyAssessment`

**Output schema:**
```typescript
interface PolicyAssessment {
  allocationDrift: DriftItem[]  // positions deviating from targets
  policyViolations: PolicyViolation[]  // hard constraint breaches
  qualityFlags: QualityFlag[]  // soft signals from research
  overallStatus: 'healthy' | 'attention_needed' | 'action_required'
  assessedAt: string
}
```

**Current state:** Does not exist. Depends on portfolio schema (Phase 1) and Research Agent upgrade.

---

## Agent 3: Risk Agent

**Responsibility:** Identify concentration risk, volatility exposure, and correlation problems in the current portfolio.

**Inputs:**
- Current portfolio state
- Array of `ResearchSummary` objects
- `PolicyAssessment` from Policy Agent

**Process:**
1. Calculate position concentration: flag any position > configurable threshold (default 10%)
2. Calculate sector concentration: flag any sector > configurable threshold (default 30%)
3. Identify correlated positions: holdings that tend to move together reduce effective diversification
4. Flag macro exposure: sector composition relative to current market environment (if context available)
5. Produce `RiskReport`

**Output schema:**
```typescript
interface RiskReport {
  concentrationRisks: ConcentrationRisk[]
  correlationWarnings: CorrelationWarning[]
  overallRiskLevel: 'low' | 'moderate' | 'elevated' | 'high'
  riskNotes: string[]  // human-readable summary of key risks
  assessedAt: string
}
```

**Current state:** Does not exist. Depends on portfolio schema and Policy Agent.

---

## Agent 4: Rebalance Agent

**Responsibility:** Produce a specific, justified rebalance proposal based on the outputs of the upstream agents.

**Inputs:**
- Current portfolio state
- `PolicyAssessment` from Policy Agent
- `RiskReport` from Risk Agent
- User's execution preferences (max trade size, preferred execution timing)

**Process:**
1. Determine which positions need to be adjusted (drift, violation, or risk flag)
2. Calculate target trade sizes to move portfolio toward target allocation
3. Check proposed trades against policy rules (no trade may create a new violation)
4. Produce `RebalanceProposal` with full justification

**Output schema:**
```typescript
interface RebalanceProposal {
  proposedTrades: ProposedTrade[]
  justification: string  // human-readable, cites specific inputs
  expectedOutcome: string  // what the portfolio looks like after these trades
  risks: string[]  // what could go wrong with this proposal
  dataSources: string[]  // all Polygon.io sources used in reasoning
  confidenceLevel: 'high' | 'moderate' | 'low'
  confidenceNotes: string  // why confidence is at this level
  proposedAt: string
}

interface ProposedTrade {
  ticker: string
  action: 'buy' | 'sell'
  targetShares: number
  targetValue: number
  reason: string  // specific justification for this trade
}
```

**Current state:** Does not exist. Depends on all upstream agents.

---

## Agent Pipeline Orchestration

The agents run in sequence. The orchestrator (a server-side function, not a client-side call) manages the pipeline:

```
async function runPortfolioAgentPipeline(userId: string) {
  const portfolio = await getPortfolioState(userId)
  const policy = await getUserPolicy(userId)

  const researchSummaries = await ResearchAgent.run(portfolio.holdings)
  const policyAssessment = await PolicyAgent.run(portfolio, researchSummaries, policy)
  const riskReport = await RiskAgent.run(portfolio, researchSummaries, policyAssessment)

  if (policyAssessment.overallStatus !== 'healthy' || riskReport.overallRiskLevel !== 'low') {
    const proposal = await RebalanceAgent.run(portfolio, policyAssessment, riskReport, policy)
    await logDecision(userId, { researchSummaries, policyAssessment, riskReport, proposal })
    return proposal
  }

  await logDecision(userId, { researchSummaries, policyAssessment, riskReport, proposal: null })
  return null  // portfolio is healthy, no action needed
}
```

Every run is logged to the memory layer regardless of whether a proposal is produced.

---

## Agent Build Order

Build agents in pipeline order, but only after portfolio schema is stable:

1. Portfolio schema (Phase 1 prerequisite)
2. Research Agent upgrade (accepts multiple tickers, returns structured summaries)
3. Policy Agent (first new agent — depends on schema)
4. Risk Agent (depends on Policy Agent output)
5. Rebalance Agent (depends on all upstream agents)
6. Pipeline orchestrator (wires all agents together)
7. Streaming pipeline output (user sees progress as agents run)

Do not build agents out of order. The policy agent without a schema produces nothing useful. The rebalance agent without the risk agent produces proposals that may concentrate risk.
