/**
 * lib/rag.ts
 *
 * RAG retrieval utility for StockForge AI.
 * Queries the research_documents vector store for context
 * relevant to a given user query, then formats it for
 * injection into Claude's system prompt.
 */

import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

// Lazy singletons — initialized on first call so env vars are always
// available by the time these run (works in both Next.js and scripts).
let _supabase: ReturnType<typeof createClient> | null = null
let _openai: OpenAI | null = null

function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  }
  return _supabase
}

function getOpenAI() {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
  return _openai
}

interface ResearchChunk {
  id: string
  title: string
  type: string
  source_url: string
  content: string
  tags: string[]
  metadata?: {
    provenance_class?: string
    source_kind?: string
    visibility?: string
    author?: string
    notion_page_id?: string
  }
  similarity: number
}

export type ResearchIntent =
  | 'market_analysis'
  | 'product_strategy'
  | 'architecture'
  | 'agent_memory'
  | 'general'

type ResearchFilters = {
  allowedProvenanceClasses?: string[]
  allowedVisibility?: string[]
}

function classifyResearchSource(chunk: Pick<ResearchChunk, 'tags' | 'metadata'>): string {
  const provenanceClass = chunk.metadata?.provenance_class
  const sourceKind = chunk.metadata?.source_kind

  if (provenanceClass === 'founder_note') return 'Founder Notes'
  if (provenanceClass === 'external_reference') return 'External Reference'
  if (sourceKind === 'notion_page') return 'Notion Import'
  if (chunk.tags.includes('founder-notes')) return 'Founder Notes'
  if (chunk.tags.includes('external-reference')) return 'External Reference'
  if (chunk.tags.includes('notion')) return 'Notion Import'
  return 'Research Reference'
}

export function inferResearchIntent(query: string): ResearchIntent {
  const normalized = query.toLowerCase()

  if (
    normalized.includes('architecture') ||
    normalized.includes('codebase') ||
    normalized.includes('data flow') ||
    normalized.includes('agent loop') ||
    normalized.includes('api route')
  ) {
    return 'architecture'
  }

  if (
    normalized.includes('product') ||
    normalized.includes('roadmap') ||
    normalized.includes('strategy') ||
    normalized.includes('vision') ||
    normalized.includes('design')
  ) {
    return 'product_strategy'
  }

  if (
    normalized.includes('memory') ||
    normalized.includes('portfolio agent') ||
    normalized.includes('retrieval') ||
    normalized.includes('rag')
  ) {
    return 'agent_memory'
  }

  if (
    normalized.includes('stock analysis') ||
    normalized.includes('investment') ||
    normalized.includes('fundamentals') ||
    normalized.includes('risk') ||
    normalized.includes('ticker')
  ) {
    return 'market_analysis'
  }

  return 'general'
}

function scoreChunkForIntent(chunk: ResearchChunk, intent: ResearchIntent): number {
  const provenanceClass = chunk.metadata?.provenance_class
  const sourceKind = chunk.metadata?.source_kind
  const isFounderNote =
    provenanceClass === 'founder_note' || chunk.tags?.includes('founder-notes')
  const isExternalReference =
    provenanceClass === 'external_reference' || chunk.tags?.includes('external-reference')

  let score = chunk.similarity

  switch (intent) {
    case 'architecture':
    case 'product_strategy':
    case 'agent_memory':
      if (isFounderNote) score += 0.35
      if (sourceKind === 'notion_page') score += 0.15
      if (isExternalReference) score -= 0.05
      break
    case 'market_analysis':
      if (isExternalReference) score += 0.2
      if (sourceKind === 'research_paper' || sourceKind === 'code_repository') score += 0.05
      if (isFounderNote) score += 0.08
      break
    case 'general':
      if (isFounderNote) score += 0.12
      if (isExternalReference) score += 0.05
      break
  }

  return score
}

function buildIntentGuidance(intent: ResearchIntent): string {
  switch (intent) {
    case 'architecture':
      return 'Prioritize founder-authored architecture notes and internal system design pages. Use external references only as secondary supporting context.'
    case 'product_strategy':
      return 'Prioritize founder-authored product, roadmap, and design strategy notes. Treat external references as inspiration, not decision authority.'
    case 'agent_memory':
      return 'Prioritize founder-authored notes about RAG, memory, workflow, and autonomous-agent structure. Use external references only to support implementation patterns.'
    case 'market_analysis':
      return 'Blend external market and technical references with founder notes cautiously. Founder notes are internal strategy context only and must not be surfaced as user-facing investment claims.'
    case 'general':
      return 'Use the highest-similarity grounded research while respecting provenance and visibility.'
  }
}

function buildFiltersForIntent(intent: ResearchIntent): ResearchFilters {
  switch (intent) {
    case 'market_analysis':
      return {
        allowedProvenanceClasses: ['external_reference', 'reference'],
        allowedVisibility: ['reference'],
      }
    case 'architecture':
    case 'product_strategy':
    case 'agent_memory':
      return {
        allowedProvenanceClasses: ['founder_note', 'external_reference', 'reference'],
        allowedVisibility: ['internal', 'reference'],
      }
    case 'general':
      return {
        allowedProvenanceClasses: ['founder_note', 'external_reference', 'reference'],
        allowedVisibility: ['internal', 'reference'],
      }
  }
}

function selectChunksForIntent(chunks: ResearchChunk[], intent: ResearchIntent, matchCount: number) {
  const scoredChunks = chunks
    .map((chunk) => ({
      chunk,
      score: scoreChunkForIntent(chunk, intent),
    }))
    .sort((a, b) => b.score - a.score)

  return scoredChunks.slice(0, matchCount).map(({ chunk }) => chunk)
}

/**
 * Retrieves relevant research context for a given query.
 * Returns formatted text ready for injection into Claude's system prompt.
 * Always fails gracefully — never throws, returns '' on any error.
 */
export async function getResearchContext(
  query: string,
  options: {
    matchThreshold?: number
    matchCount?: number
    intent?: ResearchIntent
  } = {}
): Promise<string> {
  const { matchThreshold = 0.65, matchCount = 4, intent = inferResearchIntent(query) } = options

  try {
    const embeddingResponse = await getOpenAI().embeddings.create({
      model: 'text-embedding-3-small',
      input: query,
    })
    const queryEmbedding = embeddingResponse.data[0].embedding
    const filters = buildFiltersForIntent(intent)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: chunks, error } = await (getSupabase() as any).rpc('match_research_documents', {
      query_embedding: queryEmbedding,
      match_threshold: matchThreshold,
      match_count: matchCount,
      allowed_provenance_classes: filters.allowedProvenanceClasses ?? null,
      allowed_visibility: filters.allowedVisibility ?? null,
    })

    if (error) {
      console.error('[RAG] query error:', error)
      return ''
    }

    if (!chunks || chunks.length === 0) {
      return ''
    }

    const prioritizedChunks = selectChunksForIntent(chunks as ResearchChunk[], intent, matchCount)

    const formattedChunks = prioritizedChunks
      .map((chunk, i) => {
        const sourceClass = classifyResearchSource(chunk)
        const sourceKind = chunk.metadata?.source_kind ? ` | ${chunk.metadata.source_kind}` : ''
        const visibility = chunk.metadata?.visibility ? ` | ${chunk.metadata.visibility}` : ''
        return `[Research Reference ${i + 1}: ${chunk.title} | ${sourceClass}${sourceKind}${visibility} | similarity ${chunk.similarity.toFixed(2)}]\n${chunk.content}`
      })
      .join('\n\n---\n\n')

    return `
## Relevant Research Context
The following excerpts are provided as grounding for your analysis. Some are founder-authored Notion notes and some are external technical references. Treat founder notes as internal strategic context and external references as supporting frameworks. Do not cite any of them as direct advice or present them verbatim to the user.
Intent mode: ${intent}. ${buildIntentGuidance(intent)}

${formattedChunks}

---
`
  } catch (err) {
    console.error('[RAG] retrieval failed:', err)
    return ''
  }
}
