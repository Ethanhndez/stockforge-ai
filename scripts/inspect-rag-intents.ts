/**
 * scripts/inspect-rag-intents.ts
 *
 * Compare how the same query retrieves context under different RAG intent modes.
 *
 * Run:
 *   npx tsx scripts/inspect-rag-intents.ts "portfolio agent memory architecture"
 *   npx tsx scripts/inspect-rag-intents.ts "AAPL investment research" market_analysis
 */

import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { getResearchContext, inferResearchIntent, type ResearchIntent } from '../src/lib/rag'

const VALID_INTENTS: ResearchIntent[] = [
  'market_analysis',
  'product_strategy',
  'architecture',
  'agent_memory',
  'general',
]

function isResearchIntent(value: string): value is ResearchIntent {
  return VALID_INTENTS.includes(value as ResearchIntent)
}

async function runForIntent(query: string, intent: ResearchIntent) {
  console.log(`Intent: ${intent}`)
  const context = await getResearchContext(query, {
    intent,
    matchThreshold: 0.5,
    matchCount: 3,
  })

  if (!context) {
    console.log('  No results\n')
    return
  }

  console.log(context.slice(0, 900).trim())
  if (context.length > 900) {
    console.log('\n[truncated]')
  }
  console.log('\n' + '-'.repeat(72) + '\n')
}

async function main() {
  const query = process.argv[2]?.trim()
  const requestedIntent = process.argv[3]?.trim()

  if (!query) {
    throw new Error(
      'Usage: npx tsx scripts/inspect-rag-intents.ts "<query>" [market_analysis|product_strategy|architecture|agent_memory|general]'
    )
  }

  console.log('StockForge AI — RAG Intent Inspector')
  console.log('='.repeat(40))
  console.log(`Query: ${query}`)
  console.log(`Inferred intent: ${inferResearchIntent(query)}`)
  console.log('')

  if (requestedIntent) {
    if (!isResearchIntent(requestedIntent)) {
      throw new Error(`Invalid intent "${requestedIntent}". Valid intents: ${VALID_INTENTS.join(', ')}`)
    }

    await runForIntent(query, requestedIntent)
    return
  }

  for (const intent of VALID_INTENTS) {
    await runForIntent(query, intent)
  }
}

main().catch((err) => {
  console.error('Inspector failed:', err)
  process.exit(1)
})
