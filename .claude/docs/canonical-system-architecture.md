# StockForge AI — Canonical System Architecture

**Last updated:** 2026-03-22
**Status:** Canonical. This is the architecture the product is being built toward.

---

## Architecture Overview

StockForge AI is organized into five vertical layers. Each layer has a clear owner, a defined responsibility, and a dependency relationship with the layers above and below it. No layer should reach two layers away without going through the one between them.

```
┌─────────────────────────────────────────────────────────┐
│                    EXECUTION LAYER                       │
│   Paper mode → Human-in-the-loop → Live execution        │
├─────────────────────────────────────────────────────────┤
│                     AGENT LAYER                          │
│   Research agent · Policy agent · Risk agent · Rebalance │
├─────────────────────────────────────────────────────────┤
│                     MEMORY LAYER                         │
│   Decision logs · Research corpus · Policy records       │
├─────────────────────────────────────────────────────────┤
│                   PORTFOLIO LAYER                        │
│   Holdings · Cash · Targets · History · Watchlist        │
├─────────────────────────────────────────────────────────┤
│                    ACCOUNT LAYER                         │
│   Auth · Identity · Settings · Ownership model           │
└─────────────────────────────────────────────────────────┘
```

---

## Layer 1: Account Layer

**Responsibility:** Establish who is using the system and what they own.

Every other layer depends on a valid user identity. Without this, the portfolio has no owner, agent decisions have no subject, and memory has no context.

| Component | Description | Technology |
|---|---|---|
| Authentication | Email/password + OAuth | Supabase Auth |
| User profile | Name, email, preferences, onboarding state | Supabase `users` table |
| Settings | Risk tolerance, automation level, notification prefs | Supabase `user_settings` |
| Onboarding profile | Primary goal, investing horizon, risk posture, automation preference — collected at first-run, persisted to `user_settings` | Supabase `user_settings` |
| Ownership model | Each portfolio, policy, and decision log belongs to a `user_id` | Supabase RLS |

**Current state (2026-03-22):** Layer 1 is fully implemented and live. `/login`, `/dashboard`, and `/portfolio` are protected routes. `middleware.ts` enforces session on all portfolio routes. Supabase SSR session handling is in place. `user_settings` table implemented, applied, and collecting real data. Account creation and dashboard access confirmed in production.

**Profile → Policy bootstrap — IMPLEMENTED (2026-03-22):** The onboarding questionnaire is not display configuration. It is the operational bootstrap for the policy layer. When a user completes the first-run profile (primary goal, investing horizon, risk posture, automation preference), the answers are persisted to `user_settings` and then used to:

- Set `risk_tier` on the user's primary `portfolios` record
- Seed initial `portfolio_policies` defaults appropriate to the user's stated posture

This means the agent layer, when it reads policy records, will always find defaults derived from real user preferences rather than generic fallbacks. The profile save is an architectural event, not a UI personalization event. Every subsequent agent decision operates within a policy envelope that the user implicitly defined at signup.

**Key constraint:** Row Level Security must be enabled on every data table from the start. Users must never be able to read or modify another user's data. This is non-negotiable.

---

## Layer 2: Portfolio Layer

**Responsibility:** Represent the user's current financial position and their targets.

This is the subject of every agent decision. The agent does not reason about "stocks in the abstract" — it reasons about this user's specific portfolio, their current allocation, their stated goals, and the gap between where they are and where they want to be.

| Component | Description |
|---|---|
| Holdings | Current positions: ticker, shares, cost basis, current value |
| Cash | Available cash balance for deployment |
| Allocation targets | User-defined or agent-proposed target weights by sector/asset/ticker |
| Watchlist | Tickers the user is tracking for potential inclusion |
| Transaction history | All buys, sells, and rebalances (paper and live) |
| Portfolio metadata | Name, inception date, benchmark, risk tier |

**Schema design note:** The portfolio schema must be designed before the agent layer is built. The agent's reasoning is only as good as the data model it reasons over. A schema that cannot represent allocation drift cannot support a rebalance agent.

**Current state:** Portfolio schema implemented in `supabase/migrations/20260322130000_portfolio_os.sql`. Migration is pending application to Supabase; runtime QA is the next step.

---

### Schema Ratifications (2026-03-22)

Two implementation decisions made during Phase 1 SQL authoring are ratified here as canonical.

**1. `transactions.ticker` is nullable — RATIFIED**

The `ticker` column on the `transactions` table is intentionally nullable. Not all transactions involve an equity position. Cash deposits and withdrawals are valid transaction records with no associated ticker. Requiring a non-null ticker would force sentinel values (e.g., the string `"CASH"`) into the ticker column, which would pollute portfolio analytics queries and confuse the agent layer when it reads transaction history. Nullable `ticker` is the correct relational design. Transaction `type` should be used to distinguish equity transactions from cash flow events.

Implication for the agent layer: when reading `transactions`, the agent must filter or branch on `ticker IS NOT NULL` before treating a record as an equity trade.

**2. Watchlist modeled as `portfolio_type = 'watchlist'` — RATIFIED**

Watchlists are not stored in a separate table. They are portfolios with `portfolio_type = 'watchlist'` in the `portfolios` table. This is now the canonical direction.

Rationale: A watchlist is conceptually an owned collection of tickers — the same ownership model that governs investment portfolios. Keeping them in the same table means RLS policies, user ownership checks, and portfolio helper functions all work identically across both types. A separate `watchlists` table would duplicate the ownership model, require separate RLS policies, and produce a harder join surface for the agent layer when it needs to consider tickers the user is tracking.

The distinction between portfolio types is always made via `portfolio_type`. Code that operates on investment portfolios must filter to `portfolio_type = 'investment'`. Code that operates on watchlists filters to `portfolio_type = 'watchlist'`. Code that operates on all user-owned ticker collections (e.g., permission checks) can query without the filter.

---

## Layer 3: Memory Layer

**Responsibility:** Make the agent's reasoning auditable, persistent, and improvable over time.

Memory is not a document store. It is the layer that closes the feedback loop between what the agent decided, what the user did, and what happened as a result. Without memory, the agent cannot learn, the user cannot audit, and the system cannot be trusted with increasing autonomy.

| Component | Description |
|---|---|
| Decision logs | Structured records of every agent proposal: inputs, reasoning, output, user action |
| Research corpus | Ingested founder notes, external references, research summaries |
| Policy records | User-defined constraints: no individual stock > 10%, no sector concentration > 30%, etc. |
| User preferences | Stated goals, risk tolerance evolution, feedback on past decisions |
| Agent chain-of-thought | Structured reasoning traces, linked to decisions |

**Current state:** A provenance-aware research memory layer exists with Supabase storage, intent-aware retrieval, and SQL-level provenance filtering. This is a strong foundation. It needs to be extended with decision log schema and policy record storage.

**Key principle:** Memory serves the agent, not the interface. The value of storing a decision is not to show it to the user — it is to let the agent reference past reasoning when making new decisions.

---

## Layer 4: Agent Layer

**Responsibility:** Reason over portfolio state, research data, and memory to produce proposals.

The agent layer is not a single AI call. It is a set of specialized agents, each with a defined scope, that collaborate to produce portfolio-relative recommendations.

| Agent | Responsibility | Inputs | Output |
|---|---|---|---|
| Research agent | Gather and synthesize market data for relevant tickers | Polygon.io tools, portfolio holdings | `ResearchSummary` per ticker |
| Portfolio policy agent | Evaluate current allocation against targets and constraints | Portfolio state, research summaries, user policy | `PolicyAssessment` |
| Risk agent | Identify concentration risk, volatility exposure, correlation issues | Portfolio state, market data | `RiskReport` |
| Rebalance agent | Propose specific trades to move portfolio toward targets | Portfolio state, policy assessment, risk report | `RebalanceProposal` |

**Current state:** A research agent exists (analysis route, tool-calling loop). It is not yet connected to a portfolio state or policy layer. It operates on individual tickers, not portfolios.

**Key constraint:** All agent outputs must be structured JSON. Every proposal must include `data_sources`, `reasoning`, `confidence_notes`, and `proposed_actions`. Unstructured prose is not acceptable as agent output.

---

## Layer 5: Execution Layer

**Responsibility:** Translate approved agent proposals into portfolio changes.

This layer has three modes, and the product must progress through them in order. Skipping modes is a product and risk management failure.

| Mode | Description | When |
|---|---|---|
| Paper / Simulation | Agent proposes, system tracks simulated performance, no real money | Phase 2 launch |
| Human-in-the-loop | Agent proposes, user explicitly approves each action, system records outcome | Phase 3 |
| Live execution | Agent executes within pre-approved constraints, human can override or pause | Phase 4 (gated) |

**Current state:** No execution layer exists. Phase 1 and Phase 2 must be complete before any execution layer work begins.

**Key constraint:** The live execution layer requires broker API integration, compliance review, and a mature approval/audit system. It should not be scoped or estimated until Phase 3 is complete and the HITL model has been validated.

---

## Data Flow

```
User opens app
  → authenticated via Account Layer
  → portfolio state loaded from Portfolio Layer
  → agent reads portfolio + memory context from Memory Layer
  → Research Agent fetches Polygon.io data for relevant holdings
  → Policy Agent evaluates allocation vs. targets
  → Risk Agent flags concentration and volatility issues
  → Rebalance Agent proposes trades (if warranted)
  → Execution Layer presents proposal to user (paper or HITL mode)
  → User approves / modifies / rejects
  → Decision logged to Memory Layer
  → Portfolio state updated in Portfolio Layer
```

---

## Technology Stack

| Layer | Technology | Notes |
|---|---|---|
| Frontend | Next.js 15 (App Router), TypeScript, Tailwind | Live |
| Backend | Next.js API routes (`/api/*`) | Live |
| Database | Supabase (Postgres + Auth + RLS) | Live; portfolio schema applied |
| AI | Anthropic Claude Sonnet (tool-calling + streaming) | Live; portfolio context integration pending Phase 2 |
| Market data | Polygon.io | Live |
| Deployment | Vercel | Live |
| Broker integration | TBD | Phase 4 only |
| Cloud infrastructure | AWS (exploration stream — not adopted) | Future consideration; see `infrastructure-future.md` |

---

## Architecture Non-Negotiables

1. **RLS on every table.** Users only see their own data.
2. **Every agent decision is logged.** No action without a record.
3. **Paper mode before live mode.** Always. No exceptions.
4. **Research agent never speculates.** Anti-hallucination rules apply in portfolio context with higher stakes than in standalone research context.
5. **Human override always works.** The agent can be paused or overridden at any point without data loss.
