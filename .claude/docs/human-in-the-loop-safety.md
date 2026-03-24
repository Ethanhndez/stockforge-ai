# Human-in-the-Loop Safety Model

**Last updated:** 2026-03-22
**Status:** Safety architecture for Phase 3 and beyond.

---

## Why HITL Comes Before Autonomous Execution

The instinct when building an automation product is to maximize autonomy as quickly as possible. That instinct is wrong here.

Trust in an AI system that handles money is not established by the system having good intentions. It is established by the user having evidence that the system behaves correctly over time, that they understand why it makes decisions, and that they have experienced being able to stop it.

Human-in-the-loop (HITL) approval is not a stepping stone to be crossed quickly. It is the phase where:
- You discover every failure mode of the agent layer before it costs real money
- Users build the mental model of how the system reasons
- You validate that the approval UX is clear enough for users to make informed decisions
- The audit trail proves it works before anyone is asked to trust it autonomously

**The paper mode (Phase 2) proves the logic. HITL (Phase 3) proves the safety controls. Only after both are proven does autonomous execution (Phase 4) earn the right to exist.**

---

## HITL Architecture

### The Approval Flow

Every agent proposal goes through a mandatory approval gate before execution:

```
Agent produces RebalanceProposal
  → Pre-approval risk gate runs (automated)
  → If gate fails: proposal is flagged, user is notified, proposal is NOT presented for approval
  → If gate passes: proposal is presented to user with full justification
  → User reviews proposal, justification, expected outcome, and risks
  → User takes one of: Approve / Reject / Modify / Defer
  → If Approve: execution is queued, user action is recorded
  → If Reject: rejection reason is optionally captured, decision is logged
  → If Modify: modified proposal goes through approval gate again
  → If Defer: proposal is saved for later review with expiry date
  → Execution outcome is logged and linked to the approval record
```

No trade can execute without a corresponding approval record. This is enforced at the database level, not just the application level.

### Pre-Approval Risk Gate

Before a proposal reaches the user, it must pass an automated risk gate:

| Check | Failure action |
|---|---|
| Any proposed trade creates a policy violation | Block proposal, flag the violation |
| Proposal concentration exceeds hard limit | Block, require human review |
| Data gap in any research summary used in reasoning | Block, require data refresh |
| Proposal total value exceeds user-set single-action limit | Block, escalate to explicit override confirmation |
| Market is closed and proposal requires immediate execution | Defer, notify user |

Failures are logged. A pattern of failures indicates either an agent quality problem or a policy misconfiguration — both need attention.

---

## Approval UI Requirements

The approval interface is where the user makes a financial decision. It must be designed to support genuine, informed decision-making — not to make it easy to click through without reading.

**Every approval view must include:**
- What is being proposed (specific trades in plain language)
- Why the agent is proposing it (reasoning summary, not just "portfolio rebalance")
- What the portfolio looks like before and after
- What data the agent used (with source attribution)
- What the risks are, including risks of the proposal failing or underperforming
- What happens if the user does nothing (portfolio drift, policy violation timeline)

**What the approval view must not do:**
- Present the proposal as a recommendation the user should follow
- Omit risks to make approval feel more comfortable
- Default to "approve" in any way (no pre-checked boxes, no approval on timer expiry)
- Use language that implies the AI's judgment is more reliable than the user's

---

## The Four User Actions

**Approve:** User confirms the proposal as presented. System queues execution, records approval, and notifies user of execution outcome.

**Reject:** User declines the proposal. System logs rejection (with optional reason). Agent notes the rejection in memory and may adjust future proposals accordingly.

**Modify:** User changes one or more parameters (trade size, which positions to include/exclude). Modified proposal goes through the approval gate again before execution.

**Defer:** User wants to consider the proposal but not decide now. Proposal is saved with a configurable expiry (default 48 hours). If not actioned by expiry, it is automatically rejected and logged.

---

## Override and Pause Controls

These controls must work at any time, with immediate effect:

| Control | What it does | Where it lives |
|---|---|---|
| Pause all agent activity | Stops pipeline from running new analyses or producing proposals | Portfolio dashboard, always visible |
| Cancel queued execution | Cancels an approved trade before it executes | Approval history view |
| Hard stop | Immediately halts all pending and queued execution | `/lab` control room, also accessible from user settings |
| Revoke policy | Removes a previously set automation constraint | Policy settings |

A user who cannot pause the system with one action should not be using the system. This is a product trust requirement, not a feature request.

---

## Audit Trail Requirements

Every action that touches a portfolio or produces a proposal must be recorded in the audit trail. The audit trail is immutable — records can be added but not modified or deleted.

| Event | Required fields |
|---|---|
| Proposal created | timestamp, agent version, inputs (portfolio snapshot, research summaries), output (proposal object) |
| Risk gate evaluated | timestamp, checks run, pass/fail results |
| Proposal presented to user | timestamp, proposal ID |
| User action | timestamp, user ID, action type (approve/reject/modify/defer), optional reason |
| Execution queued | timestamp, proposal ID, approved trade details |
| Execution completed | timestamp, broker confirmation, actual trade details (may differ from proposed) |
| Execution failed | timestamp, error detail, notification sent to user |

**If an execution happens without a corresponding approval record, that is a critical bug, not a logging omission.**

---

## HITL Phase Exit Criteria

Phase 3 is complete and Phase 4 can be scoped when:

1. At least 10 real users have used the approval workflow for at least 10 approved trades each
2. The audit trail has been reviewed and is complete for every execution
3. No execution has occurred without a matching approval record
4. The risk gate has caught at least one proposal before it reached the user
5. The override/pause controls have been tested and confirmed to work
6. Legal and compliance review of the HITL execution model has been completed
7. User feedback on the approval UX has been gathered and addressed

Skipping this exit criteria to reach Phase 4 faster is a product risk, not a schedule optimization.
