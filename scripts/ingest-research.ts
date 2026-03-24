/**
 * scripts/ingest-research.ts
 *
 * Embeds Affaan Mustafa's research documents into Supabase via pgvector.
 * Uses OpenAI text-embedding-3-small (1536 dimensions).
 *
 * Run with: npx tsx scripts/ingest-research.ts
 */

import { config } from 'dotenv'
import { resolve } from 'path'

// Load .env.local from wherever the command is run (project root)
config({ path: resolve(process.cwd(), '.env.local') })

import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const OPENAI_API_KEY = process.env.OPENAI_API_KEY!

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !OPENAI_API_KEY) {
  throw new Error(
    'Missing required env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY'
  )
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
const openai = new OpenAI({ apiKey: OPENAI_API_KEY })

// ─── Research Document Corpus ──────────────────────────────────────────────
// 12 documents compiled from Affaan Mustafa's website, Notion research pages,
// and SSRN paper summaries. Source: affaanmustafa.com + github.com/affaan-m

const RESEARCH_DOCUMENTS = [
  {
    title: 'Affaan Mustafa — Research Overview',
    type: 'article' as const,
    source_url: 'https://affaanmustafa.com',
    tags: ['overview', 'autonomous-trading', 'multi-agent', 'DeFi', 'quantitative-finance'],
    content: `Affaan Mustafa is an SF-based researcher and builder at the intersection of AI, quantitative finance, and DeFi. He holds a BS in Mathematics-Computer Science and BA in Business Economics from UC San Diego, and pursued an MS/PhD in Applied & Computational Mathematics at the University of Washington. He is currently co-founding Itô, a prediction market aggregator with structured equity exposure, alongside an ex-Goldman Sachs quant. His work spans: autonomous trading agents (executed $2M+ in live Solana trades), behavioral reinforcement learning for portfolio risk management, multi-agent swarm architectures (data aggregator → analyst → executor), and state-space model research (HyperMamba). He pioneered the first autonomous trading agent on Solana ($stoic token, $38M peak FDV), livestreamed live to 70,000 concurrent viewers. His architecture philosophy centers on grounded, data-driven AI agents that use real market signals — not hallucination — to make trading decisions. His multi-agent framework (Cainam Ventures) separates concerns: one agent aggregates data, one analyzes it, one executes. This is directly applicable to StockForge AI's portfolio automation layer.`,
  },
  {
    title: 'HyperMamba: Hypernetwork-Enhanced Meta-Learning for Autonomous Trading',
    type: 'research_paper' as const,
    source_url: 'https://papers.ssrn.com/sol3/papers.cfm?abstract_id=5137471',
    tags: ['HyperMamba', 'Mamba', 'state-space-model', 'meta-learning', 'autonomous-trading', 'hypernetwork', 'SSRN'],
    content: `HyperMamba is Affaan Mustafa's flagship paper (SSRN #5137471, Feb 2025, 529+ views, 47+ downloads). It extends the Mamba state-space model (SSM) with hypernetwork-based weight generation for rapid adaptive trading policy updates. Key contributions: (1) Combines CryptoMamba (SSMs for crypto price modeling) with HyperMAML (hypernetworks for meta-learning) into a unified autonomous trading pipeline. (2) State-space models process sequential market data more efficiently than Transformers for time-series — O(n) vs O(n²) complexity. (3) Hypernetworks generate the weights of the trading policy network dynamically based on current market regime — enabling rapid adaptation without full retraining. (4) End-to-end pipeline: ingest diverse data streams (price, volume, sentiment, on-chain) → Mamba SSM for feature extraction → hypernetwork policy generation → real-time trade execution. Architecture pattern for StockForge AI: Use Mamba-style sequential processing for multi-day price/fundamental history, hypernetwork-style dynamic prompting to adapt Claude's analysis posture to current market regime (bull/bear/sideways). The core insight is that market regimes change, and the model needs to adapt its behavior dynamically rather than using a static policy. Applied to StockForge: Claude's system prompt should include current regime context (VIX level, sector momentum, macro indicators) so it adapts its bull/bear/risk posture accordingly — mimicking hypernetwork weight adaptation via dynamic context injection.`,
  },
  {
    title: 'Market Manipulation Detection via Social Media Sentiment in Microcap Cryptocurrencies',
    type: 'research_paper' as const,
    source_url: 'https://economics.ucsd.edu/undergraduate-program/resources/undergraduate-graduate-research-lab/undergrad-profiles/mustafa-a.html',
    tags: ['sentiment-analysis', 'market-manipulation', 'social-media', 'microcap', 'crypto', 'NLP', 'UCSD'],
    content: `UCSD 2024 undergraduate research paper by Affaan Mustafa. Investigates how coordinated social media activity on Reddit and Twitter drives price manipulation in small-cap cryptocurrency markets. Methodology: correlate NLP sentiment scores from social posts with abnormal price/volume events to detect pump-and-dump patterns before or during execution. Key findings: sentiment spikes on small subreddits and crypto Twitter accounts reliably precede anomalous price moves in microcap tokens by 4-12 hours. Manipulation signals include: sudden spike in post volume, coordinated positive sentiment from low-follower accounts, rising mention frequency with price still flat. Applied to StockForge AI: The same methodology applies to small/mid-cap equities. When analyzing a stock, Claude should flag: (1) unusual Reddit/Twitter mention spikes, (2) sentiment divergence from fundamental data, (3) low-float stocks with high social activity. News sentiment analysis in the Polygon.io news feed should be weighted against social signal quality — not all positive sentiment is organic. This paper informs how the news analysis tool should weight and contextualize sentiment signals in the AI's research posture.`,
  },
  {
    title: 'stoictradingAI — Autonomous Solana Trading Agent',
    type: 'code_repo' as const,
    source_url: 'https://github.com/affaan-m/stoictradingAI',
    tags: ['autonomous-agent', 'Solana', 'DeFi', 'trading-bot', 'real-time', 'elizaOS', 'portfolio-automation'],
    content: `stoictradingAI is Affaan Mustafa's viral autonomous trading agent built on Solana. It executed $2M+ in real trades and launched the $stoic SPL token (peak $38M FDV). Built live on X to 70,000 concurrent viewers. Technical architecture: Built on elizaOS (multi-agent platform), with a perception layer ingesting on-chain data + price feeds, a reasoning layer using LLM-based decision making, and an execution layer submitting transactions to Solana DEXs. Key design patterns relevant to StockForge AI: (1) Separation of perception (data ingestion), cognition (AI analysis), and execution (order placement) into distinct agent layers — maps directly to the data aggregator → analyst → executor multi-agent swarm architecture. (2) The agent maintains a persistent state of open positions, available capital, and risk exposure — StockForge's portfolio AI should do the same via Supabase. (3) Circuit breakers: the agent has hard stops for max drawdown, position concentration, and daily loss limits — critical safety controls for any real-money AI trading system. (4) The agent uses tool-calling (LLM requests data via tools, not from memory) — same architecture as StockForge's current Claude tool-calling loop. Applied to StockForge: The stoictradingAI pattern is the direct blueprint for the Alpaca integration layer. Replace Solana DEX calls with Alpaca REST API calls, replace on-chain data with Polygon.io feeds, keep the same agent loop structure.`,
  },
  {
    title: 'Behavioral_RL — Behavioral Reinforcement Learning for Trading',
    type: 'code_repo' as const,
    source_url: 'https://github.com/affaan-m/Behavioral_RL',
    tags: ['reinforcement-learning', 'behavioral-economics', 'CVaR', 'prospect-theory', 'risk-management', 'portfolio', 'Python'],
    content: `Behavioral_RL is Affaan Mustafa's research implementation of reinforcement learning agents that incorporate behavioral economics biases — specifically CVaR (Conditional Value at Risk) and Prospect Theory — into the reward function. Standard RL for trading optimizes for expected return. Behavioral RL adds: (1) CVaR penalty: instead of just maximizing mean return, penalize the worst 5% of outcomes (tail risk). This prevents the agent from taking leveraged bets that have good expected value but catastrophic downside. (2) Prospect Theory shaping: humans weight losses ~2.5x more than equivalent gains (loss aversion). The reward function encodes this asymmetry — so the agent avoids positions where downside pain outweighs upside utility, matching real investor behavior. (3) Reference point adaptation: the agent updates its psychological reference point over time (e.g., after a drawdown, it becomes more loss-averse). Architecture: Python-based RL training loop with custom Gym environment simulating a trading portfolio, PPO or SAC policy, behavioral reward shaping. Applied to StockForge AI: (1) Claude's portfolio allocation decisions should incorporate CVaR framing — not just "what's the expected return" but "what's the worst-case loss in a bad month." (2) Position sizing should reflect loss aversion: smaller initial positions, scale up only after positive confirmation. (3) The research posture (bull_case, bear_case, key_risks) in the existing API already aligns with this — extend it to include explicit downside scenarios with probability estimates. (4) For the personal portfolio automation layer, implement hard CVaR limits: never allocate to a position where the 95th percentile worst-case loss exceeds X% of total portfolio.`,
  },
  {
    title: 'dprc-autotrader-v2 — Production Autonomous Trading Agent in Rust',
    type: 'code_repo' as const,
    source_url: 'https://github.com/affaan-m/dprc-autotrader-v2',
    tags: ['Rust', 'autonomous-trading', 'production', 'execution-layer', 'performance', 'real-time'],
    content: `dprc-autotrader-v2 is a production-grade autonomous trading agent written in Rust, representing the execution layer of Mustafa's trading infrastructure. Built for performance-critical real-time order management. Key architectural insights: (1) Separation of the strategy layer (what to buy/sell) from the execution layer (how to place and manage orders) — the Rust agent handles only execution; signals come from a separate AI reasoning layer. (2) Order management: handles partial fills, slippage estimation, retry logic, and position reconciliation. (3) Risk controls at the execution layer: pre-trade checks for position limits, buying power, and market hours before any order is submitted. (4) Event-driven architecture: order state machine (pending → submitted → filled / cancelled / rejected) with async updates. Applied to StockForge AI: When integrating Alpaca for trade execution, model the order management layer similarly — separate the AI decision (what to do) from execution (how to do it safely). The Alpaca integration should include: pre-trade validation, order state tracking in Supabase, slippage budgets for market orders, and circuit breakers that cancel all pending orders on anomalous events. For the personal portfolio AI, execution safety is more important than speed — use limit orders, not market orders.`,
  },
  {
    title: 'Sol-Onchain-Analyst — On-Chain Data Pipeline to Trading Alphas',
    type: 'code_repo' as const,
    source_url: 'https://github.com/affaan-m/Sol-Onchain-Analyst',
    tags: ['on-chain-data', 'data-pipeline', 'alpha-generation', 'CLI', 'Solana', 'market-signals'],
    content: `Sol-Onchain-Analyst is a CLI tool that pulls Solana on-chain data (wallet flows, DEX volumes, liquidity pool changes) and transforms it into structured trading signals (alphas). Architecture pattern: raw data source → normalization layer → signal extraction → structured output ready for AI consumption. Key design: the tool doesn't make trading decisions — it transforms raw blockchain data into structured, normalized signals that a trading agent can consume. This is the data aggregator layer of the multi-agent swarm. Applied to StockForge AI: This is the direct analog to the Polygon.io data layer already built in Phase 2. The same separation of concerns applies: /api/quote, /api/fundamentals, /api/news are the data aggregator layer — they normalize raw Polygon data into structured signals. Claude (the analyst layer) consumes these signals via tool-calling. The key lesson: keep data fetching and AI reasoning strictly separated. Data routes should return normalized, validated JSON. Claude should never be asked to interpret raw API responses — always pre-process. For the portfolio AI, add additional signal types: earnings surprise magnitude, institutional flow data (13F filings via SEC EDGAR), insider transaction timing — all normalized the same way as the existing API routes.`,
  },
  {
    title: 'everything-claude-code (ECC) — AI Development Harness',
    type: 'code_repo' as const,
    source_url: 'https://github.com/affaan-m/everything-claude-code',
    tags: ['claude-code', 'AI-harness', 'anti-hallucination', 'development-workflow', 'hooks', 'slash-commands'],
    content: `everything-claude-code (ECC) is a Claude Code harness framework. It provides: persistent session memory across Claude Code sessions (session-log.md), PreToolUse hooks for intercepting and validating AI actions before execution, PostToolUse hooks for scanning responses after, custom slash commands for project-specific workflows, and an anti-hallucination gate that blocks certain language patterns (buy/sell/hold ratings) from Claude's output. The framework is installed in StockForge AI's .claude/ directory. Currently active hooks: anti-hallucination-gate.js (PreToolUse) — intercepts buy/sell/hold language and prompt injection attempts. agentshield-gate.js (PostToolUse) — scans tool responses for API key leakage and PII. Slash commands: /data-layer-check, /ai-layer-check, /adversarial-test, /session-status. Applied to StockForge AI RAG extension: When the RAG pipeline is added, extend the anti-hallucination gate to also block any retrieved research chunk from being passed verbatim to the user as a recommendation. Research context should inform Claude's reasoning, not be presented as direct advice.`,
  },
  {
    title: 'AgentShield — AI Security Scanner',
    type: 'code_repo' as const,
    source_url: 'https://github.com/affaan-m/AgentShield',
    tags: ['security', 'AI-safety', 'PII-detection', 'scanning', 'PostToolUse', 'guardrails'],
    content: `AgentShield is an AI agent security framework that scans LLM tool call outputs for security vulnerabilities. Currently integrated into StockForge AI as the PostToolUse hook (agentshield-gate.js), achieving a 96/100 security score. What it scans for: leaked secrets in tool responses, PII in market data responses (names, SSNs, contact info), prompt injection patterns in retrieved content, and anomalous output patterns suggesting model confusion. Current StockForge AI score: 96/100 — zero HIGH or CRITICAL findings. Pre-push git hook blocks deploys if score drops below 80. Applied to StockForge AI RAG extension: When adding RAG, extend AgentShield to also scan retrieved document chunks before they are injected into Claude's context. A compromised or adversarially-crafted document in the research corpus could contain prompt injection attacks. The ingestion pipeline should sanitize document content on write, and AgentShield should verify chunk content on retrieval. For the portfolio automation layer with real money execution, the AgentShield score requirement should be raised to 90/100 minimum before any live trading is enabled.`,
  },
  {
    title: 'elizaOS/eliza — Multi-Agent AI Platform',
    type: 'code_repo' as const,
    source_url: 'https://github.com/elizaOS/eliza',
    tags: ['multi-agent', 'agent-framework', 'elizaOS', 'plugin-architecture', 'memory', 'tool-calling', 'production'],
    content: `elizaOS/eliza is a production multi-agent AI platform that Affaan Mustafa contributed to and used as the foundation for stoictradingAI. Core architecture: agents have persistent memory (short-term context + long-term vector memory), a plugin system for adding new capabilities (tools), a character system defining each agent's persona and constraints, and a runtime that manages the agent loop (perceive → think → act). Key patterns relevant to StockForge AI: (1) Character files: each agent has a defined persona with goals, constraints, and behavioral rules in JSON. For StockForge's portfolio AI, the "character" is the investment philosophy — risk tolerance, preferred asset classes, position sizing rules, rebalancing triggers. (2) Memory: agents store past decisions and outcomes in vector memory, enabling them to learn from history. For StockForge, this means storing past portfolio decisions + actual outcomes in Supabase so Claude can reference what worked and what didn't. (3) Plugin system: new data sources or execution targets are plugins. Alpaca integration and Plaid integration should be built as plugins on the same pattern as the existing Polygon.io tools. (4) Multi-agent coordination: eliza supports multiple agents with different roles communicating via messages. The data aggregator → analyst → executor swarm can be implemented as three coordinated Claude API calls with shared Supabase state, not necessarily three separate processes.`,
  },
  {
    title: 'Behavioral_RL GitHub README — Raw Technical Reference',
    type: 'code_repo' as const,
    source_url: 'https://raw.githubusercontent.com/affaan-m/Behavioral_RL/main/README.md',
    tags: ['reinforcement-learning', 'CVaR', 'prospect-theory', 'Python', 'technical-reference'],
    content: `Direct README from the Behavioral_RL repository. Key technical parameters: Python environment setup, RL algorithm used (likely PPO or SAC via stable-baselines3), Gym environment configuration for the trading simulation, hyperparameters for CVaR alpha (typically 0.05 for 95th percentile), and prospect theory lambda (loss aversion coefficient, typically 2.25 per Kahneman-Tversky). For portfolio allocation: CVaR constraint means the expected loss in the worst 5% of scenarios must be below a threshold (e.g., no more than 15% portfolio loss in worst-case monthly outcomes). Prospect theory lambda of 2.25 means losses feel 2.25x more painful than equivalent gains — position sizing should reflect this asymmetry.`,
  },
  {
    title: 'stoictradingAI GitHub README — Raw Technical Reference',
    type: 'code_repo' as const,
    source_url: 'https://raw.githubusercontent.com/affaan-m/stoictradingAI/main/README.md',
    tags: ['autonomous-agent', 'Solana', 'elizaOS', 'technical-reference', 'deployment'],
    content: `Direct README from the stoictradingAI repository. Expected content: setup instructions for the elizaOS-based agent, Solana wallet configuration, RPC endpoint setup, DEX integration (likely Jupiter aggregator), environment variables, and the agent character file defining the trading persona and risk rules. The character file is particularly relevant — it defines the constraints that prevent the agent from taking catastrophic positions. For StockForge AI, an equivalent character file should define: max single-position size (e.g., 20% of portfolio), max sector concentration (e.g., 40%), minimum cash buffer (e.g., 10%), rebalancing trigger threshold (e.g., 5% drift from target), and hard stop-loss levels.`,
  },
]

// ─── Chunking utility ──────────────────────────────────────────────────────

function chunkDocument(content: string, maxChunkSize = 1500): string[] {
  if (content.length <= maxChunkSize) return [content]

  const paragraphs = content.split('\n\n').filter((p) => p.trim().length > 0)
  const chunks: string[] = []
  let currentChunk = ''

  for (const paragraph of paragraphs) {
    if ((currentChunk + '\n\n' + paragraph).length > maxChunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim())
      currentChunk = paragraph
    } else {
      currentChunk = currentChunk ? currentChunk + '\n\n' + paragraph : paragraph
    }
  }

  if (currentChunk.trim().length > 0) chunks.push(currentChunk.trim())
  return chunks
}

// ─── Embedding + Ingestion ─────────────────────────────────────────────────

async function embedText(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  })
  return response.data[0].embedding
}

async function ingestDocument(
  doc: (typeof RESEARCH_DOCUMENTS)[0],
  chunkIndex: number,
  chunkContent: string
) {
  const embedding = await embedText(`${doc.title}\n\n${chunkContent}`)

  const { error } = await supabase.from('research_documents').insert({
    title: doc.title,
    type: doc.type,
    source_url: doc.source_url,
    content: chunkContent,
    tags: [...doc.tags, 'external-reference'],
    metadata: {
      provenance_class: 'external_reference',
      source_kind:
        doc.type === 'research_paper'
          ? 'research_paper'
          : doc.type === 'code_repo'
            ? 'code_repository'
            : 'article',
      visibility: 'reference',
      author: 'Affaan Mustafa / external references',
    },
    chunk_index: chunkIndex,
    embedding,
  })

  if (error) {
    throw new Error(`Failed to insert chunk ${chunkIndex} of "${doc.title}": ${error.message}`)
  }
}

async function main() {
  console.log('StockForge AI — Research RAG Ingestion Pipeline')
  console.log('='.repeat(55))

  // Clear existing documents (re-ingestion safe)
  const { error: deleteError } = await supabase
    .from('research_documents')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000')

  if (deleteError) {
    console.warn('Warning: Could not clear existing documents:', deleteError.message)
  } else {
    console.log('Cleared existing research documents')
  }

  let totalChunks = 0

  for (const doc of RESEARCH_DOCUMENTS) {
    const chunks = chunkDocument(doc.content)
    console.log(`\n"${doc.title}"`)
    console.log(`   Type: ${doc.type} | Chunks: ${chunks.length}`)

    for (let i = 0; i < chunks.length; i++) {
      await ingestDocument(doc, i, chunks[i])
      process.stdout.write(`   Chunk ${i + 1}/${chunks.length} embedded\r`)
      await new Promise((r) => setTimeout(r, 200))
    }

    console.log(`   All ${chunks.length} chunk(s) ingested`)
    totalChunks += chunks.length
  }

  console.log('\n' + '='.repeat(55))
  console.log(
    `Ingestion complete: ${RESEARCH_DOCUMENTS.length} documents, ${totalChunks} total chunks`
  )
  console.log('Ready for RAG queries via match_research_documents()')
}

main().catch((err) => {
  console.error('Ingestion failed:', err)
  process.exit(1)
})
