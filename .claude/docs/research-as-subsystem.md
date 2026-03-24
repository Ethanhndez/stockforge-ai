# Research as Subsystem, Not Core Product

**Last updated:** 2026-03-22
**Status:** Canonical framing for all research-layer work.

---

## The Correction

For the first three phases of development, StockForge AI was built and described as a stock research application. The AI generated analysis. The UI surfaced market data. The product story was: "research stocks better with AI."

That framing is wrong for the machine we are building. Research is a capability. It is one of several tools a portfolio agent uses to reason about what to do. The user is not paying for research — they are paying for a system that takes action on their behalf, informed by research.

This document defines what the research layer is, what it is not, and how it relates to the layers above it.

---

## What the Research Layer Is

The research layer is the portfolio agent's perception system. It answers the question: "what is happening with the assets I care about?"

It includes:
- Market data retrieval (quotes, price history, volume)
- Fundamental data (revenue, earnings, P/E, market cap, sector)
- News and events (relevant to held or watched tickers)
- Comparative analysis (how does this position compare to alternatives?)
- Sector and macro context (what environment is the portfolio operating in?)

All of this exists to inform agent decisions. It is not a destination for the user.

---

## What the Research Layer Is Not

- Not the product users log in to use. The portfolio dashboard is.
- Not the primary value delivery mechanism. Actionable portfolio proposals are.
- Not a substitute for agent reasoning. The research layer gathers data; the policy agent decides what to do with it.
- Not optional. Without research data, the agent has no grounded basis for proposals and cannot meet anti-hallucination requirements.

---

## How Research Integrates with the Agent Layer

```
Portfolio state (Layer 2)
  → Agent layer begins reasoning
  → Research agent is invoked for each relevant holding
  → Research agent calls Polygon.io tools: quote, fundamentals, news
  → Research agent returns structured ResearchSummary per ticker
  → Policy agent receives portfolio state + research summaries
  → Policy agent evaluates allocation drift, quality signals, risk flags
  → Risk agent and Rebalance agent receive policy assessment
  → Final proposal produced and logged
```

The research agent is a worker inside the agent layer. It does not produce user-facing output directly. It produces `ResearchSummary` objects consumed by the policy agent.

---

## Existing Research Infrastructure — Status and Reuse

The following were built during the research app phases. They are valuable and should be preserved, but they need to be repositioned:

| Component | Current role | New role |
|---|---|---|
| `/api/quote` | User-facing stock lookup | Research agent tool (`getQuote`) |
| `/api/fundamentals` | Fundamentals display page | Research agent tool (`getFundamentals`) |
| `/api/news` | News display | Research agent tool (`getNews`) |
| `/api/analysis` | Primary product output | Portfolio research sub-routine |
| `/api/compare` | Compare UI surface | Available as agent capability |
| Stock detail pages | Product surface | Supporting view, accessible within portfolio context |
| AnalysisSection component | Primary output component | Embedded in portfolio proposal view |

None of these need to be deleted. They need to be treated as internal tools consumed by agents, not as surfaces the user navigates to independently.

---

## User-Facing Research Surfaces — Revised Role

Research surfaces (stock pages, compare, fundamentals) remain in the app. Their revised role:

1. **As supporting evidence** — when the agent makes a proposal, research data is surfaced as the evidence behind the reasoning. The user sees it in context, not as a standalone page.

2. **As on-demand tools** — a logged-in user can still look up a stock they are considering. But this is a secondary use case, not the primary product loop.

3. **As agent-triggered views** — the agent can surface a research view as part of a proposal ("here is the fundamentals data I used to recommend reducing this position").

---

## Anti-Hallucination in Portfolio Context

The anti-hallucination rules that govern the research agent are even more important in portfolio context than in standalone research context.

In standalone research: a hallucinated claim misleads the user.
In portfolio context: a hallucinated claim can propagate into a rebalance proposal that affects multiple positions.

Additional requirements in portfolio context:
- Every `ResearchSummary` must include a `data_sources` array with specific endpoint names and tickers.
- If any required data is unavailable for a holding, the policy agent must be notified explicitly — it cannot proceed as if the data exists.
- The research agent must flag data staleness: if market data is older than a configurable threshold, the agent must note it in the summary and the policy agent must factor it into confidence scoring.

---

## What "Research Is a Subsystem" Means for Development

For CodeX:
- Research routes are internal tools. Their API contracts should be stabilized before the agent layer is built on top of them (already done in Phase 2).
- New research surfaces should not be built unless they serve a specific agent capability or portfolio workflow.

For Cowork:
- Research feature requests should be evaluated against the question: "does this help the portfolio agent make better decisions, or does it add a surface for its own sake?"
- Roadmap priority goes to portfolio schema, agent architecture, and memory structure — not to additional market data views.
