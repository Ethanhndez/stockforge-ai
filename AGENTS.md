## Project Overview
StockForge AI is a Next.js App Router application for equity research and portfolio workflows. The current user-facing research experience fetches Polygon.io market data, SEC EDGAR filings, Supabase-backed research context, and Anthropic Claude analysis through server routes under `src/app/api`.

## Stack
- Next.js 16.1.7 with App Router
- React 19.2.3
- TypeScript with `strict: true`
- Supabase via `@supabase/ssr` and `@supabase/supabase-js`
- Anthropic Claude via `@anthropic-ai/sdk`
- Polygon.io market and news APIs

## Directory Map
- `src/app` — App Router pages, layouts, and route handlers
- `src/app/api/analysis/route.ts` — primary SSE stock-analysis endpoint
- `src/app/api/analysis/stream/route.ts` — named-event streaming analysis endpoint
- `src/app/api/quote/route.ts` — previous-session quote data
- `src/app/api/fundamentals/route.ts` — ticker details + financial snapshot
- `src/app/api/news/route.ts` — ticker news
- `src/app/api/market-news/route.ts` — broad market news
- `src/app/api/search/route.ts` — ticker search
- `src/app/api/sectors/route.ts` — sector board data
- `src/lib/tool-executor.ts` — shared Polygon.io and SEC EDGAR tool implementations
- `src/lib/claude-tools.ts` — Anthropic tool definitions for the agent loop
- `src/lib/agent-loop.ts` — non-streaming Claude tool loop
- `src/lib/rag.ts` — Supabase-backed research context retrieval
- `src/lib/supabase/client.ts` — browser Supabase client
- `src/lib/supabase/server.ts` — server Supabase client
- `src/lib/supabase/admin.ts` — admin Supabase client
- `src/lib/portfolio/server.ts` — portfolio server actions with Polygon validation
- `src/components/AnalysisSection.tsx` — client consumer of `/api/analysis`
- `src/lib/useStockAnalysis.ts` — client consumer of `/api/analysis/stream`

## AI Layer Architecture
Current single-route analysis pattern:
```text
Browser
  -> /api/analysis or /api/analysis/stream
     -> Claude Sonnet tool loop
        -> Polygon.io tools
        -> SEC EDGAR tools
        -> Supabase RAG context
     -> SSE JSON payload to client
```

Target parallel-agent pattern:
```text
Browser
  -> /api/analysis or /api/analysis/stream
     -> buildStockContext()
        -> Polygon.io data fetches in parallel
        -> SEC EDGAR filings + excerpts
        -> Supabase RAG context
     -> analyzeStock()
        -> fundamentalAgent  (Claude Haiku 4.5)
        -> technicalAgent    (Claude Haiku 4.5)
        -> sentimentAgent    (Claude Haiku 4.5)
        -> synthesisAgent    (Claude Sonnet 4.6)
     -> SSE JSON payload to client
     -> fallback to legacy Claude tool loop if parallel mode fails
```

## Development Commands
- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run test:types`
- `npm run test:lint`
- `npm run test:smoke`
- `npm run test:fixtures`
- `npm run security-scan`
- `npm run ruflo:start`

## Agent Boundaries
Always do:
- Keep request and response contracts stable for `src/app/api` consumers.
- Use real Polygon.io, SEC EDGAR, and Supabase outputs instead of inferred values.
- Preserve TypeScript strictness and explicit error handling.

Ask first:
- Changes to Supabase schema, migrations, or row-level-security behavior.
- Any modification to component UX, layout, or visual design.
- Any destructive cleanup of existing agent-loop code instead of wrapping it as fallback.

Never do:
- Edit `.env` or `.env.local`.
- Modify `supabase/migrations`.
- Add a new runtime AI dependency when `@anthropic-ai/sdk` already covers the task.
- Return investment advice language such as buy, sell, or hold.

## Ruflo Swarm Configuration
- `planner` — map work into route-safe backend slices and define agent handoff boundaries
- `market-data` — work inside `src/app/api/{quote,fundamentals,news,market-news,sectors}` and `src/lib/tool-executor.ts`
- `ai-orchestrator` — own `src/lib/ai`, prompt management, and Claude route integration
- `supabase-context` — own `src/lib/rag.ts` and `src/lib/supabase/*` reads without schema changes
- `verification` — run `tsc --noEmit`, lint checks, and contract validation after backend changes

## Coding Conventions
- Use the `@/*` path alias for imports from `src`.
- Keep server logic in `src/lib` or route handlers, not in UI components.
- Prefer typed JSON contracts and explicit interface names over loose objects.
- Use SSE response shapes consistently for long-running analysis endpoints.
- Treat missing data as explicit gaps and surface them instead of estimating.
