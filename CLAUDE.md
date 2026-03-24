# StockForge AI — Claude Code Context

## Product Identity

**StockForge AI** is an account-based AI portfolio management platform. It is NOT a stock research app and NOT a trading platform. It does not give investment advice. It produces research intelligence that feeds an AI agent layer that manages a user's portfolio under their oversight.

**The product in one sentence:** A user creates an account, builds a portfolio, and an AI agent reasons about that portfolio continuously — proposing rebalances, flagging risks, and eventually (in later phases) executing within constraints the user has set.

Research is one input the agents use. It is not the product.

## Canonical Docs (read before building)

All architecture, product, and roadmap decisions are documented in `.claude/docs/`:

| Document | Purpose |
|---|---|
| `product-vision.md` | What this product is and is not |
| `canonical-system-architecture.md` | 5-layer architecture: Account → Portfolio → Memory → Agent → Execution |
| `phase-roadmap.md` | Corrected phase order: Portfolio OS → Paper Agent → HITL → Live Execution |
| `research-as-subsystem.md` | Why research was demoted and how it integrates with the agent layer |
| `portfolio-agent-roadmap.md` | 4-agent pipeline: Research → Policy → Risk → Rebalance |
| `human-in-the-loop-safety.md` | HITL approval model, audit trail, override controls |
| `execution-funding-constraints.md` | Phase 4 gates, regulatory constraints, funding options |
| `memory-decision-log-architecture.md` | Decision log schema, retrieval, memory integrity rules |
| `lab-control-room.md` | /lab as the internal operator interface |

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router), TypeScript, Tailwind CSS |
| Backend | Next.js API routes (`/api/*`) |
| Database | Supabase (Postgres + Auth + RLS) |
| AI | Anthropic Claude Haiku + Sonnet via direct SDK orchestration, plus legacy tool-calling fallback |
| Market Data | Polygon.io (via `/api/*` routes) |
| Deployment | Vercel |

## Current Phase Status

| Phase | Name | Status |
|---|---|---|
| Prior Phases 1–4 | Research app build (UI, Data, AI Layer, Visual System) | COMPLETE / IN PROGRESS |
| **Phase 1** | **Private Portfolio OS** | **IMPLEMENTED IN CODE / AWAITING RUNTIME QA** |
| Phase 2 | Paper Portfolio Agent | Blocked on Phase 1 |
| Phase 3 | Human-in-the-Loop Automation | Blocked on Phase 2 |
| Phase 4 | Live Execution / Funding Layer | Blocked on Phase 3 + legal review |

## Immediate Next Action

**Run runtime QA on the portfolio foundation and harden the research subsystem handoff.**

Immediate checks:
- Apply and verify current Supabase migrations against real auth flows
- Run `/login` -> `/dashboard` -> holding creation -> two-account RLS verification
- Validate the new parallel research path in `src/app/api/analysis/route.ts` and `src/app/api/analysis/stream/route.ts`
- Confirm legacy Claude tool-loop fallback still works when the parallel path fails

Recent implementation context:
- `AGENTS.md` now exists at repo root with real project paths and agent boundaries
- `src/lib/ai/agentOrchestrator.ts` runs three parallel Haiku agents plus one Sonnet synthesis agent
- `src/lib/ai/agentPrompts.ts` holds all orchestration prompts
- `src/lib/ai/contextBuilder.ts` assembles Polygon, SEC EDGAR, and Supabase RAG context for analysis routes
- `.ruflo/config.json` and `npm run ruflo:start` configure Ruflo as a development accelerator, not a runtime dependency

## Architecture Non-Negotiables

- **Auth and RLS first.** Every portfolio route must be protected. Users can never read another user's data. Enforced at the Supabase layer, not just the application layer.
- **Paper before live.** Execution layer begins in simulation mode. No real money until Phase 3 safety controls are validated.
- **Every agent decision is logged.** No action without a record. Execution without a decision log entry is a critical bug.
- **Anti-hallucination rules apply with higher stakes in portfolio context.** A hallucinated data point in standalone research misleads one user. In portfolio context, it can propagate into a rebalance proposal affecting multiple positions.
- **Human override always works.** The user can pause or stop the agent at any point without data loss.

## Core Constraint — Anti-Hallucination

**The AI layer must ONLY use data returned by tools. It must never speculate.**

- Never give buy/sell/hold recommendations under any phrasing
- Never fill data gaps with plausible-sounding estimates — say "data unavailable"
- If data is missing, say so explicitly
- Every AI claim must be attributable to a named Polygon.io data source
- Anti-hallucination is non-negotiable for all users (free and paid)
- In portfolio context: every `ResearchSummary` must include explicit `dataGaps` and `dataSources`

## Workflow Split

- **Cowork (Claude):** Owns product docs, architecture, roadmap, design decisions, and strategic consulting. Does not write implementation code.
- **CodeX (VS Code):** Owns all implementation. Outputs change summaries and session-log updates so Cowork can keep Notion and docs current.

## Ship Rules

- **Weekly ship rule**: Working code every Friday. Depth over breadth.
- Current phase must be hardened before moving to the next phase.
- Adversarial test suite (`/adversarial-test`) runs every Friday before any push.

## Session Memory

At the end of every session, append a brief summary to `.claude/memory/session-log.md` covering:
1. What was built or decided
2. Current phase status
3. Next concrete action

At the start of every session, read the last entry in `.claude/memory/session-log.md` to load active context.

## Source of Truth

- Notion board: https://www.notion.so/322d7b895c0b812a8feddfeb0edb8cf7

## Skills and Rules

- `.claude/skills/stockforge/SKILL.md` — StockForge-specific operating modes
- `.claude/rules/financial-guardrails.md` — Non-negotiable financial safety rules
- `.claude/rules/everything-claude-code-guardrails.md` — ECC commit and architecture rules
- `.claude/commands/` — Custom slash commands for phase checks and adversarial testing
