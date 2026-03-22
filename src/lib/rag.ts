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
  similarity: number
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
  } = {}
): Promise<string> {
  const { matchThreshold = 0.65, matchCount = 4 } = options

  try {
    const embeddingResponse = await getOpenAI().embeddings.create({
      model: 'text-embedding-3-small',
      input: query,
    })
    const queryEmbedding = embeddingResponse.data[0].embedding

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: chunks, error } = await (getSupabase() as any).rpc('match_research_documents', {
      query_embedding: queryEmbedding,
      match_threshold: matchThreshold,
      match_count: matchCount,
    })

    if (error) {
      console.error('[RAG] query error:', error)
      return ''
    }

    if (!chunks || chunks.length === 0) {
      return ''
    }

    const formattedChunks = (chunks as ResearchChunk[])
      .map((chunk, i) => `[Research Reference ${i + 1}: ${chunk.title}]\n${chunk.content}`)
      .join('\n\n---\n\n')

    return `
## Relevant Research Context
The following excerpts from peer-reviewed research and production AI trading systems are provided as grounding for your analysis. Use these frameworks to inform your reasoning — do not cite them as direct advice or present them verbatim to the user.

${formattedChunks}

---
`
  } catch (err) {
    console.error('[RAG] retrieval failed:', err)
    return ''
  }
}
