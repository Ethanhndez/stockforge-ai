# /lab — Private Internal Control Room

**Last updated:** 2026-03-22
**Status:** Architecture definition for the /lab route and its evolution.

---

## What /lab Is

`/lab` is the internal operating layer of StockForge AI. It is not a user-facing feature. It is the founder's and eventually the operator's — interface for understanding, inspecting, and controlling the system.

Its current implementation is a private workspace for memory inspection and research corpus browsing. Its future role is the place where the portfolio agent's state, policy rules, decision history, and risk constraints are visible and controllable.

Think of `/lab` as the mission control room that sits behind the product. The product (the portfolio dashboard and agent workflow) is what users see. `/lab` is how the people building and operating the system see and manage the machine itself.

---

## Why /lab Exists as a Separate Route

The information needed to operate an AI portfolio system is not the same as the information a user needs to manage their portfolio. Operators need to see:

- What data is in the memory layer and where it came from
- How the retrieval system is classifying and ranking documents
- What the agent's reasoning traces look like in raw form
- Whether any policy violations or anomalies have been flagged
- What the decision log contains and whether it is complete
- How the system is performing against its own stated logic

This is too technical and too sensitive to surface in the main user interface. It belongs in a separate, access-controlled layer.

---

## Current /lab Capabilities

The existing `/lab` route includes:

| Capability | Description |
|---|---|
| Corpus browser | View ingested documents (founder notes, external references) by source |
| Memory inspection | Query the retrieval system to see how it ranks documents for a given intent |
| Provenance viewer | See the source, ingestion date, and visibility tier of each document |
| SQL-level filtering | Inspect how visibility rules affect what the retrieval system surfaces |

These are valuable. They should be preserved and extended as the agent layer is built.

---

## /lab Evolution Roadmap

### Phase 1 additions (alongside Portfolio OS)
- Portfolio schema inspector: view the raw state of any portfolio (for debugging, not for general use)
- Auth state viewer: see active sessions, user accounts, RLS policy validation

### Phase 2 additions (alongside Paper Agent)
- Decision log viewer: browse all agent proposals, their inputs, reasoning traces, and outcomes
- Agent reasoning inspector: see the raw chain-of-thought for any past decision
- Research corpus live query: test retrieval behavior with a given query before deploying changes
- Policy rule editor: set and modify portfolio constraints (position limits, sector limits, prohibited tickers) without touching code

### Phase 3 additions (alongside HITL)
- Approval audit trail: see every approval action, the user who took it, and the execution outcome
- Risk flag history: see every time the risk agent raised a flag and what happened next
- Performance attribution: which agent decisions contributed to portfolio outcomes

### Phase 4 additions (alongside Live Execution)
- Execution monitoring: real-time view of pending and completed executions
- Circuit breaker controls: pause or halt autonomous execution from the control room
- Compliance export: generate audit-ready transaction records

---

## Access Control

`/lab` must always be protected. No unauthenticated access. In the current phase, it is restricted to the founder (you). As the product matures, access can be extended to internal operators via a role system, but it should never be accessible to general users.

Supabase RLS should enforce this: `/lab` API routes should check for an `is_operator` or `is_admin` flag on the user record before returning any data.

---

## /lab and the Memory Layer

`/lab` is the primary interface for the memory layer. The memory layer stores data; `/lab` makes that data inspectable, queryable, and actionable. The value of a rich memory layer is only realized if someone can see inside it.

This relationship means: every time the memory layer is extended (new document types, new decision log fields, new policy record structures), `/lab` should be updated to expose the new data. They should evolve together.

---

## The Longer-Term Vision

As the product reaches Phase 3 and Phase 4, `/lab` becomes increasingly important. When the agent is executing real trades, the operator needs a real-time view of system state, the ability to intervene instantly, and a complete audit trail. `/lab` is where that control lives.

Eventually, a simplified version of `/lab` becomes the "advanced settings" or "portfolio intelligence" view for power users — a place where technically sophisticated users can see what the agent is doing and why. But that is a future decision. For now, `/lab` belongs to the operator.
