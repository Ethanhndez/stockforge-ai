/**
 * scripts/ingest-notion-pages.ts
 *
 * Imports every Notion page visible to the configured integration into
 * Supabase research_documents for RAG.
 *
 * Run:
 *   npx tsx scripts/ingest-notion-pages.ts
 *   npx tsx scripts/ingest-notion-pages.ts Affaan
 */

import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { ingestNotionPage, listNotionPages } from './lib/notion-research'

async function main() {
  const filter = process.argv[2]?.trim() ?? ''
  const pages = await listNotionPages(filter)

  console.log('StockForge AI — Notion Workspace Ingestion')
  console.log('='.repeat(49))
  console.log(`Pages: ${pages.length}`)
  if (filter) console.log(`Filter: "${filter}"`)
  console.log('')

  if (pages.length === 0) {
    console.log('No visible Notion pages matched the current filter.')
    return
  }

  let successCount = 0

  for (const [index, page] of pages.entries()) {
    console.log(`[${index + 1}/${pages.length}] ${page.title}`)

    try {
      const result = await ingestNotionPage(page.id)
      console.log(`  imported ${result.chunks} chunks`)
      console.log(`  source ${result.sourceUrl}`)
      successCount += 1
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.log(`  failed ${message}`)
    }

    console.log('')
  }

  console.log(`Completed ${successCount}/${pages.length} page imports.`)
}

main().catch((err) => {
  console.error('Bulk ingestion failed:', err)
  process.exit(1)
})
