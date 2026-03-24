# Execution and Funding Constraints

**Last updated:** 2026-03-22
**Status:** Constraints and gates for Phase 4 planning. Not active work.

---

## Why This Document Exists Now

Phase 4 (live execution and funding) is not current work. It should not be scoped or estimated until Phase 3 is complete.

This document exists to make the constraints visible early so that Phase 1–3 architecture decisions do not accidentally foreclose Phase 4 options. Building the wrong schema or choosing an incompatible broker API in Phase 1 can make Phase 4 expensive to retrofit. Understanding the constraints now — even if they are not being acted on — keeps the architecture honest.

---

## The Regulatory Reality

Moving real money through an AI system introduces regulatory obligations. The specific obligations depend on jurisdiction, product structure, and the nature of the relationship with the user. This is not a reason to stop building — it is a reason to understand the landscape before Phase 4 scope is finalized.

**Key regulatory areas to evaluate:**

**Investment Adviser Act (U.S.):** If the system provides personalized investment advice for compensation, it may need to register as an investment adviser (RIA) at the state or federal level. "AI-generated proposals" may qualify as investment advice depending on how the product is structured and described.

**Broker-Dealer Registration:** If the platform executes securities transactions on behalf of users (as opposed to routing orders to a registered broker), it may need broker-dealer registration.

**Money Transmission:** If the platform holds or moves user funds (not just securities), it may need money transmitter licenses at the state level.

**What likely avoids the heaviest regulation:** Routing execution to a registered broker via their API (e.g., Alpaca, Interactive Brokers, Schwab), where the broker is the registered entity and the platform is a software interface. This is the most common fintech structure. It does not eliminate all obligations but significantly reduces them.

**Required action before Phase 4:** Legal review by a securities attorney. This is not optional. The regulatory cost of getting this wrong is higher than the cost of the review.

---

## Broker API Options (Preliminary)

These are potential integration paths for Phase 4 execution. No selection has been made. This is for awareness, not commitment.

| Provider | Notes |
|---|---|
| Alpaca | REST API, commission-free, good developer experience, supports paper trading (useful in Phase 2) |
| Interactive Brokers (IBKR) | Institutional-grade, complex API, large user base, more regulatory complexity |
| Schwab / TD Ameritrade API | Legacy API, but large existing user base may be relevant for future partnership |
| Plaid | Primarily for account linking and balance reading, not execution |

**Phase 4 broker selection criteria:**
- Paper trading support (must have — needed for Phase 2 anyway)
- Fractional shares support (important for small portfolio rebalancing)
- Real-time execution confirmation
- Webhook support for execution status updates
- Terms of service compatible with AI-driven order submission

---

## Funding Layer Constraints

"Funding layer" means the ability to deposit money into the platform, withdraw, and hold a cash balance that the agent can deploy. This is more complex and more regulated than execution alone.

**Options:**

1. **No direct funding (Phase 4a):** Users connect an existing brokerage account via broker API. The platform reads their portfolio and routes execution back to that broker. The platform never holds funds. This is the lowest-regulatory-burden path.

2. **Pooled brokerage account (Phase 4b):** Platform holds a pooled brokerage account and users have sub-accounts. This requires either RIA registration or a partnership with a registered broker (FINRA member). High compliance overhead.

3. **Debit card / spending integration (Phase 4c):** This is the "AI manages your debit card spending" vision. Requires money transmitter licenses, bank partnership or sponsor bank, and either BaaS integration (e.g., Stripe Treasury, Unit, Column) or direct bank charter. This is the most complex and most distant option.

**Build order for funding:** Option 1 first. Do not build options 2 or 3 until option 1 is live, users are transacting, and regulatory review has been completed.

---

## Technical Prerequisites for Phase 4

The following must exist and be validated before any live execution is built:

| Prerequisite | Why it is required |
|---|---|
| Portfolio schema (Phase 1) | Execution records must be linked to a portfolio and a user |
| Decision log (Phase 2) | Every execution must have a corresponding agent decision record |
| HITL approval trail (Phase 3) | Every execution must have a corresponding approval record |
| Risk gate (Phase 3) | Every proposed execution must pass automated risk checks |
| Override / pause controls (Phase 3) | User must be able to halt execution instantly |
| Legal review completed | Regulatory exposure must be understood before live money is involved |
| User TOS updated | Terms of service must accurately describe what the system does |
| Security audit (Phase 4 specific) | Additional security review required when real money is in scope |

---

## What "Constrained Autonomous Execution" Means

In Phase 4, the agent can execute without per-action approval, but only within a pre-approved policy envelope. This is not the same as "the AI does whatever it wants."

The user defines constraints:
- Maximum value of any single trade (e.g., $500)
- Maximum total value per month (e.g., $2,000)
- Which tickers can be bought or sold
- Which sectors are permitted
- Target allocation weights

The agent can only act within those constraints. If a proposed action would exceed any constraint, it stops and notifies the user for explicit approval.

This model requires that constraint enforcement is implemented at the database layer, not just the application layer. An application bug should not be able to route around a user's stated limit.

---

## The Debit Card / Spending Integration

The vision of "AI manages your money through a debit card" involves the platform having visibility into and control over a user's spending and cash flow, not just their investment portfolio. This is architecturally distinct from portfolio management.

It requires:
- Bank account integration (Plaid or similar for read access)
- Spending categorization and cash flow analysis
- Rule-based or AI-driven cash management (when to invest excess cash, when to hold)
- Actual payment infrastructure if the platform issues cards

This is a Phase 5+ capability. It should not be architected until Phase 4 is live and stable. Premature integration of banking and investment management creates regulatory complexity before the core product is proven.
