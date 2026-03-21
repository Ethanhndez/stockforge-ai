---
name: data-layer-check
description: Runs a checklist against the current Phase 2 (Data Layer) state. Use before promoting any work to Phase 3.
allowed_tools: ["Bash", "Read", "Grep", "Glob"]
---

# /data-layer-check

Run this checklist to verify Phase 2 (Data Layer) is complete before moving to Phase 3.

## Checklist

- [ ] `/api/quote` route exists and returns a typed `QuoteResponse`
- [ ] `/api/news` route exists and returns a typed `NewsResponse`
- [ ] `/api/fundamentals` route exists and returns a typed `FundamentalsResponse`
- [ ] `/api/search` route exists and returns a typed search result
- [ ] Bad ticker input returns a user-friendly error on all routes (never a 500 or crash)
- [ ] All responses include `fetchedAt` as an ISO 8601 timestamp
- [ ] No API keys (POLYGON_API_KEY, NEXT_PUBLIC_*) are visible in any frontend file
- [ ] All tool function definitions match expected signatures: `getQuote`, `getNews`, `getFundamentals`, `getCompanyProfile`, `compareStocks`
- [ ] All routes tested in isolation (not dependent on AI layer being wired)

## How to Run

1. Check each item by reading the relevant source file
2. For API key leakage: `grep -r "POLYGON" src/app --include="*.tsx" --include="*.ts"` — only `/api/*` routes should appear
3. For `fetchedAt`: `grep -r "fetchedAt" src/app/api` — must appear in every route response
4. For error handling: confirm each route has a try/catch that returns `{ error: string }` on bad ticker

## Pass Criteria

All items checked. Any unchecked item blocks Phase 3.
