---
name: session-status
description: Reads session-log.md and outputs current phase, last action taken, and next action.
allowed_tools: ["Read"]
---

# /session-status

Read `.claude/memory/session-log.md` and output a structured summary:

1. **Current Phase** — which phase is active (Phase 2: Data Layer / Phase 3: AI Layer / etc.)
2. **Last Action** — what was built or decided in the most recent session
3. **Next Action** — the specific next concrete step recorded

If session-log.md is empty or missing, output:
```
No session history found. Starting fresh.
Current Phase: Phase 2 — Data Layer
Next Action: Verify /api/quote route has typed response, fetchedAt timestamp, and bad ticker handling.
```
