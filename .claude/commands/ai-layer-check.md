---
name: ai-layer-check
description: Runs a checklist against Phase 3 (AI Layer) state. Use to verify the tool-calling loop, streaming, and structured output are complete.
allowed_tools: ["Bash", "Read", "Grep", "Glob"]
---

# /ai-layer-check

Run this checklist to verify Phase 3 (AI Layer) is complete and hardened.

## Prerequisites

Phase 2 must pass `/data-layer-check` before this checklist is meaningful.

## Checklist

- [ ] Tool-calling loop implemented end to end (Claude → Polygon routes → Claude → user)
- [ ] Streaming responses working — no blank screen while waiting for Claude
- [ ] Structured JSON output matches `AnalysisOutput` interface: `{ summary, bull_case, bear_case, risks, data_sources }`
- [ ] System prompt includes: "Only use data returned by tools. Never speculate. Never give buy/sell/hold recommendations."
- [ ] Every AI claim has a `data_sources` attribution — `data_sources` array is never empty
- [ ] Tool definitions in the Anthropic API call exactly match the Phase 2 route signatures

## How to Verify Structured Output

Confirm the Claude response handler validates against this shape before rendering:
```ts
interface AnalysisOutput {
  summary: string
  bull_case: string
  bear_case: string
  risks: string[]
  data_sources: string[]
}
```

## How to Verify Streaming

Test with a simulated slow connection. The UI should show a loading/streaming state immediately — the user must never see a blank screen.

## Pass Criteria

All items checked. Run `/adversarial-test` after this passes.
