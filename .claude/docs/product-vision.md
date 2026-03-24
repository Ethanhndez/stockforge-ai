# StockForge AI — Product Vision

**Last updated:** 2026-03-22
**Status:** Canonical. Supersedes all prior "stock research app" framing.

---

## What This Product Is

StockForge AI is an account-based AI portfolio management platform. It is not a stock research app.

The user's portfolio — their holdings, goals, risk tolerance, and financial position — is the product. AI agents reason over that portfolio continuously, propose actions, learn from decisions, and ultimately (after controls mature) execute within defined constraints. Research is one input the agents use. It is not what the user is buying.

The distinction matters at every layer:
- The schema centers on portfolio state, not stock data.
- The user interface centers on account and portfolio views, not market surfaces.
- The AI layer centers on portfolio policy agents, not analysis generators.
- The memory layer exists to make agent decisions auditable and trustworthy over time, not to store research notes.

---

## What Problem It Solves

Active portfolio management at any meaningful depth requires either (a) hiring a professional financial adviser, (b) paying for institutional-grade tools, or (c) spending hours on research that most people don't have.

StockForge AI makes sophisticated, data-grounded portfolio reasoning accessible to individuals. It does not replace the human — it provides the human with a reasoning partner that has persistent memory, access to live market data, and the ability to propose well-justified actions.

The product's core promise: **your portfolio gets the quality of attention that institutional investors expect, without requiring institutional resources.**

---

## What This Product Is Not

- Not a trading platform. It does not execute trades on behalf of users without explicit human approval (in current phases).
- Not an investment adviser. It produces research intelligence and portfolio reasoning. It does not provide investment advice as a regulated service.
- Not a robo-adviser in the traditional sense. The agent is transparent about its reasoning; it does not operate as a black box.
- Not a stock screener or market terminal. Those surfaces exist as tools inside the platform, not as the product itself.

---

## Target User

A self-directed investor who:
- Manages their own portfolio (taxable accounts, IRAs, or both)
- Has some financial literacy but is not a full-time analyst
- Values transparency in AI reasoning — wants to understand why, not just what
- Is willing to approve actions before they happen, at least initially
- Eventually wants more automation as trust is established

---

## Core Product Principles

**1. Portfolio state is the source of truth.**
Every agent action, every piece of research, every recommendation is evaluated against the user's actual portfolio position. Generic market analysis has no value here. Personalized, portfolio-relative reasoning does.

**2. Trust is earned through transparency.**
The agent must show its work at every step. Users will not delegate financial decisions to a system they cannot audit. Every proposal must include: what data was used, what the agent's reasoning was, what the expected outcome is, and what the risks are. This is not optional UX polish — it is the product.

**3. Paper before live.**
The product launches in simulation mode. Users build a portfolio, the agent proposes rebalances, and the system tracks simulated performance. Live execution is unlocked only after the user has experienced the agent's reasoning pattern and the system has demonstrated its safety controls.

**4. Research informs the agent; it does not substitute for it.**
The research layer (Polygon.io data, fundamentals, news) exists to provide the agent with grounded, attributable inputs. The agent synthesizes research into portfolio-relative decisions. Showing users raw research data is a fallback, not the default value delivery.

**5. Human override is always available.**
Regardless of automation level, the user can intervene, override, pause, or reset the agent at any point. This is a design constraint, not a feature flag.

---

## Product Layers (Summary)

| Layer | What it is | Why it matters |
|---|---|---|
| Account Layer | Auth, identity, settings, ownership | Every action needs an owner |
| Portfolio Layer | Holdings, cash, targets, history | The subject of every agent decision |
| Agent Layer | Research agent, policy agent, risk agent, rebalance agent | The reasoning engine |
| Memory Layer | Decision logs, research corpus, user preferences, policy records | What makes the agent trustworthy over time |
| Execution Layer | Paper → HITL → live | Controlled, staged path to autonomy |

Full architecture detail: see `canonical-system-architecture.md`

---

## What Was Demoted (and Why)

The following surfaces were previously treated as core product. They are now tools or subsystems:

- **Homepage stock research** — Now an entry point to the authenticated experience, not a standalone product.
- **Stock detail pages** — Now tools the agent surfaces as supporting evidence, not destinations.
- **Compare / Markets / Fundamentals** — Now agent capabilities that can be exposed in context, not primary navigation.
- **AI analysis output** — Now one type of agent response among several (portfolio analysis, risk assessment, rebalance proposal), not the core deliverable.

These surfaces are not wrong to have built. They need to be reframed as intelligence tools inside an account-and-portfolio-centric shell.

---

## The Shift in One Sentence

**Before:** A user comes to StockForge to research stocks they might trade.
**After:** A user comes to StockForge to let an AI manage their portfolio with their oversight.
