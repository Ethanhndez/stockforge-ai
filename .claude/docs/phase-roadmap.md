# StockForge AI — Phase-by-Phase Roadmap

**Last updated:** 2026-03-22
**Status:** Canonical. Supersedes prior phase definitions (UI → Data → AI → Design).

---

## Roadmap Principle

The build order is determined by trust dependencies, not feature appeal. A feature is ready to build when everything it depends on is already stable. Trust in AI automation is earned progressively: simulate first, observe, then allow human approval, then — only after controls are proven — allow autonomous action.

**The rule:** Never build execution before approval. Never build approval before memory. Never build memory before portfolio state. Never build portfolio state before auth.

---

## Prior Phase Status (Research App Context)

These phases are complete in the research app context. They are being reframed, not discarded.

| Prior Phase | Status | New Framing |
|---|---|---|
| Phase 1 — App shell + UI | COMPLETE | Intelligence surface layer (entry points into future portfolio app) |
| Phase 2 — Data layer | COMPLETE | Research agent's data toolset |
| Phase 3 — AI analysis | COMPLETE | Single-stock research agent (one component of the future agent layer) |
| Phase 4 — Visual system | IN PROGRESS | Design system for the portfolio platform |

---

## New Phase Definitions (Portfolio Platform Context)

### Phase 1 — Private Portfolio OS
**Goal:** A real user can create an account, log in, and see their portfolio.

**Status: FUNCTIONALLY COMPLETE — QA PASSED — HARDENING IN PROGRESS**
**Last updated:** 2026-03-22

This phase is about establishing the ownership and state foundation. Until a user can own a portfolio, there is nothing for the agent to reason about.

**Deliverables:**
- ✅ Supabase Auth wired to a protected app shell (`middleware.ts`, `/login`, `/dashboard`)
- ✅ User profile: primary goal, investing horizon, risk posture, automation preference — collected via first-run onboarding, persisted to `user_settings`
- ✅ Portfolio schema: `portfolios`, `holdings`, `cash_balance`, `allocation_targets`, `transactions`, `portfolio_policies` — applied in Supabase
- ✅ `user_settings` schema — applied in Supabase
- ✅ Portfolio dashboard: current holdings, total value, allocation breakdown by sector
- ✅ Dashboard first-run path — new users see onboarding questionnaire and dominant next-action cue
- ✅ Manual portfolio entry: user can add/edit/archive positions and update cash balance
- ✅ Profile bootstrap → policy defaults: profile answers set `risk_tier` on `portfolios` and seed initial `portfolio_policies` records
- ✅ Watchlist migrated into portfolio context (`portfolio_type = 'watchlist'`, logged-out local fallback preserved, local entries can migrate on sign-in)
- ✅ Row Level Security enforced on all new tables
- ✅ Runtime QA confirmed: account creation → dashboard → holdings persist → two-account RLS isolation verified

**Not in this phase:** Any AI agent work. Any research surface changes. Any execution logic. Any product redesign.

**Exit criteria met:** A logged-in user can see their portfolio. A logged-out user cannot. Two users cannot see each other's data. ✅

**Remaining hardening before Phase 2 begins:**
- ⬜ Edge case: zero holdings state renders cleanly (no errors, no blank screens)
- ⬜ Edge case: zero cash balance does not break total value calculation
- ⬜ Edge case: archived holdings are excluded from total value and sector allocation
- ⬜ Run `/adversarial-test` clean before any push to `main`
- ⬜ `tsc --noEmit` and ESLint both passing after all hardening changes

---

### Phase 2 — Paper Portfolio Agent
**Goal:** The AI agent reasons about the user's portfolio and proposes actions in simulation.

This phase introduces the agent layer. The agent reads portfolio state, fetches research data, and proposes rebalance actions. All actions are simulated — no real money, no broker integration. The system tracks simulated performance so the user can evaluate the agent's reasoning over time.

**Deliverables:**
- Research agent upgraded to portfolio context: fetches data for all holdings, not just one ticker
- Portfolio policy agent: evaluates actual allocation vs. targets, flags drift
- Risk agent: flags concentration (any position > configurable %, any sector > configurable %)
- Rebalance agent: produces `RebalanceProposal` with specific trade suggestions
- Structured proposal output: includes reasoning, data sources, expected outcome, risk notes
- Paper execution: user can "accept" a proposal, system records it and tracks simulated outcome
- Decision log: every proposal stored with inputs, reasoning, user action (accept/reject/modify), and outcome tracking
- Memory layer extended: decision logs linked to portfolio state snapshots
- `/lab` dashboard: decision history, agent reasoning traces, portfolio performance vs. benchmark

**Not in this phase:** Live money. Broker APIs. Any actual trade execution. Product redesign.

**Exit criteria:** The agent can produce a rebalance proposal for a real portfolio, the user can accept or reject it, and the decision log is storing structured outputs with full data source attribution.

---

### Phase 2.5 — Proof Engine (Backtesting + Performance Validation)
**Goal:** Prove that the agent's decision logic generates positive risk-adjusted returns before investing in product redesign or live execution.

This is an internal validation phase, not a user-facing feature. The output is evidence — numbers, charts, and methodology — that the agent has a real edge beyond what a passive index fund delivers. Without this phase, any claim that the product "works" is anecdotal. With it, you have a defensible, reproducible proof.

**Why this phase comes before redesign:** Design work is expensive. Redesigning a system whose core intelligence hasn't been validated is premature. Build ugly, prove it works, then make it beautiful.

**Core concepts:**

*Backtesting* runs the agent's decision logic against historical price data from Polygon.io. The agent must run in time-locked mode — it can only see data that would have been available on the simulated date. No lookahead. This is the hardest part to implement correctly and the most common place backtests are accidentally falsified.

*Paper trading* runs the agent forward in real-time with simulated money. It validates live behavior but takes months to accumulate meaningful signal. It runs continuously in the background starting from Phase 2.

*Performance analytics* computes the metrics that matter: portfolio value over time, Sharpe ratio, alpha vs. SPY benchmark, maximum drawdown, and win/loss rate on individual rebalance proposals.

**Deliverables:**
- Historical simulation runner: agent decision logic runs over configurable date ranges using Polygon.io historical data, time-locked to prevent lookahead
- Benchmark comparison: identical time window run with simple SPY buy-and-hold; side-by-side results
- Performance analytics module: Sharpe ratio, alpha, max drawdown, win/loss on proposals, annualized return
- Results dashboard in `/lab`: visual performance report with methodology notes — for operator review, not end-user consumption
- Stress test suite: run the agent over at least one major drawdown period (e.g., 2022 bear market) and one bull run; verify it doesn't catastrophically underperform in either

**The profitability bar:**
- Sharpe ratio > 1.0 over the backtested window
- Positive alpha vs. SPY benchmark on a risk-adjusted basis
- Maximum drawdown not worse than the benchmark in the same period
- Results must hold across at least one bear market window — a strategy that only works in bull markets is not validated

**Financial guardrails note:** Backtesting results are internal operator evidence, not user-facing claims. The product must never surface backtest results to end users as proof of future returns. Historical performance does not guarantee future results — this is both legally required and technically true. The proof is for the builder, not the marketing.

**Not in this phase:** Product redesign. Live money. UI overhaul.

**Exit criteria:** The backtesting suite runs clean against a 3-year historical window. The agent demonstrates Sharpe > 1 and positive alpha vs. SPY. Results survive a 2022-equivalent drawdown scenario. These numbers are documented and reproducible.

**What comes after this phase:** Full product redesign. The intelligence is validated. Now make it worthy of that intelligence.

---

### Phase 3 — Human-in-the-Loop Automation
**Goal:** The agent proposes; the user approves; the system executes within defined constraints.

This phase introduces real execution, but with mandatory human approval on every action. The agent cannot act without a user response. This phase is where you validate the approval UX, the audit trail, and the risk controls before removing friction from the loop.

**Deliverables:**
- Broker API integration (paper trade → live trade execution, TBD provider)
- Approval workflow: every proposed action requires explicit user confirmation before execution
- Pre-approval risk gate: system checks proposed action against user policy before presenting it
- Audit trail: every executed action is immutable, timestamped, and linked to the approving user action
- Policy controls UI: user can set and modify constraints (max position size, sector limits, prohibited tickers)
- Override / pause: user can halt all agent activity instantly, with state preserved
- Performance tracking: agent decisions vs. benchmark, win/loss on completed paper trades

**Not in this phase:** Autonomous execution without approval. Debit card integration. Funding rails.

**Exit criteria:** A real user has used the approval workflow for at least 10 real trades, the audit trail is complete, and no execution has occurred without a matching user approval record.

---

### Phase 4 — Live Execution / Funding Layer
**Goal:** The agent executes autonomously within user-defined constraints, with the user as final backstop.

This phase unlocks selective autonomy. The user defines execution constraints (e.g., "rebalance when any position drifts more than 5% from target, up to $500 per rebalance"). Within those constraints, the agent acts without requiring per-action approval. The user receives a summary and retains override capability.

**Prerequisites (all must be met before Phase 4 work begins):**
- Phase 3 approval workflow has been used in production for a meaningful period
- Audit trail has been independently reviewed for completeness
- Policy controls have been validated against adversarial inputs
- Legal/compliance review of proposed automation scope has been completed
- User terms of service updated to reflect automation capabilities and limitations

**Deliverables:**
- Constrained autonomous execution (agent acts within pre-approved policy envelope)
- Funding integration (deposit, withdraw, cash management — TBD provider and regulatory structure)
- Execution notification: user receives a clear record of every autonomous action taken
- Emergency pause: single action disables all autonomous execution immediately
- Compliance reporting: tax lot tracking, realized gain/loss, exportable transaction history

**This phase is the highest-risk phase.** Do not scope or estimate Phase 4 deliverables until Phase 3 is complete and validated.

---

### Phase 5 — Full Product Redesign
**Goal:** Redesign the entire product — architecture, UX, and visual system — with full knowledge of what the agent does and how users interact with it.

This phase does not exist on the original roadmap. It was added after the strategic decision to prove the core intelligence before investing in product quality. The sequence is intentional: build ugly, prove it works, then build it properly.

**Why this is Phase 5, not Phase 1:** Designing a product before you know what it needs to communicate is expensive and usually wrong. After Phases 1–2.5, you will have lived with the product, watched it make proposals, seen what users need to understand to trust it, and know exactly which data visualizations matter. The redesign will be highly specific, not speculative. Every design decision will have a reason grounded in observed behavior.

**What triggers this phase:** Phase 2.5 proof is documented and defensible. The agent is making structurally sound proposals. You have a clear picture of the user's trust journey through the product.

**Deliverables:**
- Architecture review: every layer re-examined for what was learned in production; schema migrations if needed; technical debt addressed before new design is built on top
- Design system: component library, typography, color, spacing, data visualization standards — built from scratch with the studio arts discipline applied
- UI/UX redesign: every screen rebuilt. The portfolio dashboard, the agent proposal view, the approval workflow, the `/lab` operator interface, the onboarding flow
- Performance visualization layer: the backtesting and paper trading results displayed in a way that builds trust without making forward-looking claims
- Mobile-first responsive layout — designed at 390px baseline, scaled up
- Visual identity: logo, brand language, the product feels like a premium financial intelligence tool, not a student project

**The design standard for this phase:** Study FinChat, Robinhood Research, and Linear. Then ask: what would this look like if it cost $50/month and people trusted it with real money? Build that.

**Not in this phase:** New features. New agents. New data sources. This phase is exclusively about making what already works look and feel like what it is.

---

## Current Priority

**Phase 1 is code-complete. Apply the migration and run QA.**

The portfolio schema is designed and implemented. The immediate action is runtime validation, not more design work. See Phase 1 QA checklist above.

**Build sequence going forward:**
1. Phase 1 QA + hardening (now)
2. Phase 2 — Paper Portfolio Agent (May–July 2026)
3. Phase 2.5 — Proof Engine / Backtesting (August–October 2026)
4. Phase 3 — Human-in-the-Loop (after proof is documented)
5. Phase 4 — Live Execution (after Phase 3 validated)
6. Phase 5 — Full Product Redesign (after intelligence is proven, before public launch)

The product is not ready for public launch until Phase 5 is complete. Internal use, testing, and iteration happen throughout Phases 1–4. The public-facing product is Phase 5.
