# StockForge AI — Project Codex

## What Is This?

StockForge AI is an AI-powered equity research platform that generates institutional-grade stock analysis. It combines Claude's reasoning with real-time financial data from Polygon.io and SEC EDGAR to produce balanced bull/bear research briefings — never investment advice.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) + React 19 |
| Language | TypeScript 5 (strict mode) |
| Styling | Tailwind CSS v4 |
| AI | Anthropic Claude (claude-sonnet-4-6) via agentic tool-calling loop |
| Market Data | Polygon.io (quotes, fundamentals, financials, news) |
| SEC Filings | SEC EDGAR (10-K, 10-Q, 8-K, company metadata) |
| Embeddings | OpenAI text-embedding-3-small (for RAG) |
| Database | Supabase PostgreSQL + pgvector |
| Deployment | Vercel-ready |

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  Browser                                            │
│  /stock/[ticker]                                    │
│  ┌──────────────┐  ┌─────────────────────────────┐  │
│  │ Quote Card   │  │ AnalysisSection (client)     │  │
│  │ (server SSR) │  │ → streams SSE from API       │  │
│  └──────────────┘  └─────────────────────────────┘  │
└────────────┬────────────────────┬───────────────────┘
             │                    │
        GET /api/quote      POST /api/analysis/stream
             │                    │
             ▼                    ▼
┌────────────────┐   ┌───────────────────────────────┐
│ Polygon.io     │   │ Agentic Loop (max 6 rounds)   │
│ prev-day OHLCV │   │                               │
└────────────────┘   │  Claude ←→ Tool Executor      │
                     │    ├─ getCompanyProfile (SEC)  │
                     │    ├─ getFundamentals (Polygon)│
                     │    ├─ getFinancials (Polygon)  │
                     │    ├─ get_recent_filings (SEC) │
                     │    ├─ getNews (Polygon)        │
                     │    ├─ getQuote (Polygon)       │
                     │    └─ compareStocks (Polygon)  │
                     │                               │
                     │  RAG context from Supabase     │
                     │  (pgvector cosine similarity)  │
                     └───────────────────────────────┘
```

### Request Lifecycle

1. **User visits `/stock/AAPL`** — server component fetches quote instantly (~200ms)
2. **Client mounts** — `AnalysisSection` POSTs to `/api/analysis/stream`
3. **Server builds context** — RAG retrieval injects relevant research into system prompt
4. **Agentic loop starts** — Claude calls tools in parallel via `Promise.all()`, processes results, decides if more data is needed (up to 6 iterations)
5. **SSE streams back** — Named events (`status`, `tool_call`, `token`, `done`) update the UI in real-time
6. **Final output** — Structured JSON with executive summary, bull case, bear case, key risks, data gaps, and source attribution

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── quote/route.ts              # GET  — Polygon prev-day quote
│   │   └── analysis/
│   │       ├── route.ts                # POST — Full analysis (complete JSON)
│   │       └── stream/route.ts         # POST — Streaming analysis (SSE)
│   ├── stock/[ticker]/page.tsx         # Stock detail page (server component)
│   ├── layout.tsx                      # Root layout
│   └── page.tsx                        # Home page
├── components/
│   ├── AnalysisSection.tsx             # Client: manages analysis lifecycle
│   ├── AnalysisOutput.tsx              # Renders tool-calling → streaming → done
│   ├── ResearchPostureCard.tsx         # Bull/bear/risks/gaps card
│   ├── Navbar.tsx                      # Navigation header
│   ├── PolygonBadge.tsx                # Data attribution badge
│   └── WatchlistButton.tsx             # Watchlist toggle
└── lib/
    ├── claude-tools.ts                 # Tool definitions (JSON schemas for Claude)
    ├── tool-executor.ts                # Dispatches tool calls to Polygon/SEC/OpenAI
    ├── tools.ts                        # TypeScript types for tool I/O
    ├── rag.ts                          # RAG retrieval (embed → pgvector search)
    ├── useStockAnalysis.ts             # React hook for SSE consumption
    └── agent-loop.ts                   # Non-streaming agentic loop (batch/test)

supabase/migrations/                    # pgvector schema + match_research_documents RPC
scripts/                                # ingest-research.ts, test-rag.ts
```

## Key Design Decisions

1. **Server/Client Split** — Quote loads server-side in <1s; AI analysis runs client-side async (20-40s) behind a loading skeleton. User sees useful data immediately.

2. **Dual API Endpoints** — `/api/analysis` returns complete JSON on finish; `/api/analysis/stream` sends named SSE events for real-time token streaming. Both share the same tool layer.

3. **Parallel Tool Execution** — All tool calls in an agentic iteration run via `Promise.all()`. One network round-trip per iteration, not per tool.

4. **Graceful Degradation** — Tools return error objects instead of throwing. Missing data → null fields. RAG failure → empty context. Analysis always completes with whatever data is available.

5. **TypeScript End-to-End** — Strict mode, no implicit any. Tool definitions in `claude-tools.ts` and executor switch cases in `tool-executor.ts` are compiler-linked.

## Financial Guardrails (Non-Negotiable)

These rules are enforced at the system prompt level, in pre-commit hooks, and in pre-push compliance gates:

- **No predictions** — Never generates forward-looking performance estimates of any kind
- **No recommendations** — Never says buy, sell, or hold
- **No fabrication** — Missing data is reported as "data unavailable", never filled with estimates
- **Mandatory attribution** — Every response includes `data_sources` tracing claims to specific API endpoints
- **Balanced analysis** — Every response presents both bull and bear cases
- **Ticker disambiguation** — Ambiguous queries prompt clarification before any data fetch
- **Error transparency** — API failures are surfaced to users, never hidden

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `POLYGON_API_KEY` | Polygon.io market data |
| `ANTHROPIC_API_KEY` | Claude AI |
| `OPENAI_API_KEY` | RAG embeddings |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase write access |
| `NEXT_PUBLIC_BASE_URL` | Server URL for SSR fetches |

## Running Locally

```bash
nvm use 20           # Node 20.x required
npm install
npm run dev          # http://localhost:3000
```

## Quality Gates

| Gate | When | What |
|------|------|------|
| `tsc --noEmit` | Pre-commit (Husky) | TypeScript type check |
| Compliance gate | Pre-push (Husky) | Financial guardrail enforcement |
| ESLint | `npm run lint` | Next.js + TypeScript rules |
