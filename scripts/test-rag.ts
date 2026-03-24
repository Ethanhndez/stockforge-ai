/**
 * scripts/test-rag.ts
 *
 * Verifies RAG retrieval works before wiring into production.
 * Run with:
 *   npx tsx scripts/test-rag.ts
 *   npx tsx scripts/test-rag.ts architecture
 */

import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { getResearchContext, type ResearchIntent } from '../src/lib/rag'

const VALID_INTENTS: ResearchIntent[] = [
  'market_analysis',
  'product_strategy',
  'architecture',
  'agent_memory',
  'general',
]

async function test() {
  const requestedIntent = process.argv[2]?.trim() as ResearchIntent | undefined

  if (requestedIntent && !VALID_INTENTS.includes(requestedIntent)) {
    throw new Error(`Invalid intent "${requestedIntent}". Valid intents: ${VALID_INTENTS.join(', ')}`)
  }

  console.log('StockForge AI — RAG Retrieval Test')
  console.log('='.repeat(40))
  if (requestedIntent) {
    console.log(`Intent override: ${requestedIntent}`)
  }

  const queries = [
    'portfolio risk management CVaR behavioral finance',
    'multi-agent trading architecture data aggregator executor',
    'market manipulation sentiment analysis social media',
  ]

  for (const query of queries) {
    console.log(`\nQuery: "${query}"`)
    const context = await getResearchContext(query, {
      matchThreshold: 0.5,
      matchCount: 2,
      ...(requestedIntent ? { intent: requestedIntent } : {}),
    })
    if (!context) {
      console.log('  No results (check embeddings exist in Supabase)')
    } else {
      // Print first 300 chars of retrieved context
      console.log('  Retrieved:', context.slice(0, 300).replace(/\n/g, ' ') + '...')
    }
  }

  console.log('\n' + '='.repeat(40))
  console.log('Test complete')
}

test().catch((err) => {
  console.error('Test failed:', err)
  process.exit(1)
})
