---
name: stockforge-operating-modes
description: StockForge AI operating modes. Hot-load DATA_LAYER when working on API routes, TypeScript interfaces, or Polygon.io wrappers. Hot-load AI_LAYER when working on Claude tool-calling, system prompts, streaming, or structured output.
---

# StockForge AI — Operating Modes

## Mode: DATA_LAYER

**Activate when**: Working on `/api/*` routes, TypeScript interfaces, Polygon.io wrappers, or Supabase schema.

### Rules

1. **Type everything.** Every Polygon.io API response shape must have a corresponding TypeScript `interface`. No `any`, no `unknown` without a comment justifying it.

2. **Handle bad tickers gracefully.** Every route must validate the ticker input and return a clear, user-facing error message. Never let a bad ticker crash the route or return a confusing 500.
   ```ts
   // Expected error shape for bad ticker
   { error: "Ticker 'APPL' not found. Did you mean 'AAPL'?" }
   ```

3. **Include `fetchedAt` on every response.** All data responses must include an ISO 8601 timestamp indicating when the data was fetched.
   ```ts
   { data: ..., fetchedAt: new Date().toISOString() }
   ```

4. **No API keys on the frontend.** All Polygon.io calls must go through `/api/*` routes. The frontend only calls internal Next.js routes — never external APIs directly.

5. **Test every route in isolation** before wiring it to the AI layer. Use the `/data-layer-check` command to verify all routes meet spec before promoting to Phase 3.

### Tool Function Signatures (must match Phase 3 expectations)

```ts
getQuote(ticker: string): Promise<QuoteResponse>
getNews(ticker: string, limit: number): Promise<NewsResponse>
getFundamentals(ticker: string): Promise<FundamentalsResponse>
getCompanyProfile(ticker: string): Promise<CompanyProfileResponse>
compareStocks(tickerA: string, tickerB: string): Promise<ComparisonResponse>
```

---

## Mode: AI_LAYER

**Activate when**: Working on Claude tool-calling, system prompts, streaming responses, or structured output.

### Rules

1. **Tool definitions must exactly match route signatures.** The tool definitions passed to the Anthropic API must match the signatures defined in DATA_LAYER above. Any drift between them will cause silent failures.

2. **System prompt is hardened — do not weaken it.**
   ```
   You are a financial research assistant. Only use data returned by tools.
   If data is missing, say so explicitly. Never speculate about prices or
   future performance. Never give buy, sell, or hold recommendations.
   ```

3. **All AI responses must be structured JSON.**
   ```ts
   interface AnalysisOutput {
     summary: string
     bull_case: string
     bear_case: string
     risks: string[]
     data_sources: string[]
   }
   ```

4. **Streaming is required.** Never show a blank screen while waiting for Claude. Implement streaming with `createStreamableUI` or equivalent Next.js streaming pattern.

5. **Every AI claim must cite a source.** `data_sources` in the output must name the specific Polygon.io endpoint(s) used. Never leave `data_sources` empty or generic.

### Checklist Before Wiring AI Layer

- [ ] All DATA_LAYER routes pass `/data-layer-check`
- [ ] Tool definitions compiled and type-checked against route signatures
- [ ] System prompt committed and reviewed
- [ ] Streaming tested with a slow connection simulation
- [ ] Structured JSON output validated against `AnalysisOutput` interface
- [ ] `/adversarial-test` run and all cases passing
