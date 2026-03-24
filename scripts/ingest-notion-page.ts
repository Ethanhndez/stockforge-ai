/**
 * scripts/ingest-notion-page.ts
 *
 * Imports a Notion page into Supabase research_documents for RAG.
 *
 * Run:
 *   npx tsx scripts/ingest-notion-page.ts
 *   npx tsx scripts/ingest-notion-page.ts <notion-page-id>
 *
 * Requires:
 *   NOTION_API_KEY
 *   OPENAI_API_KEY
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   NOTION_PAGE_ID (optional if passed as CLI arg)
 */

import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { ingestNotionPage, normalizePageId } from './lib/notion-research'

const NOTION_PAGE_ID = process.argv[2] ?? process.env.NOTION_PAGE_ID

if (!NOTION_PAGE_ID) {
  throw new Error(
    'Missing Notion page ID. Add NOTION_PAGE_ID to .env.local or pass it as an argument.'
  )
}

async function main() {
  const pageId = normalizePageId(NOTION_PAGE_ID)
  console.log('StockForge AI — Notion Page Ingestion')
  console.log('='.repeat(44))
  console.log(`Page ID: ${pageId}`)

  const result = await ingestNotionPage(pageId)

  console.log(`Title: ${result.title}`)
  console.log(`Source: ${result.sourceUrl}`)
  console.log(`Chunks: ${result.chunks}`)

  console.log('Ingestion complete.')
}

main().catch((err) => {
  console.error('Ingestion failed:', err)
  process.exit(1)
})
