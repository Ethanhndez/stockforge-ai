/**
 * scripts/list-notion-pages.ts
 *
 * Lists Notion pages visible to the configured integration.
 *
 * Run:
 *   npx tsx scripts/list-notion-pages.ts
 *   npx tsx scripts/list-notion-pages.ts Affaan
 */

import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { listNotionPages } from './lib/notion-research'

async function main() {
  const filter = process.argv[2]?.trim().toLowerCase() || ''
  const pages = await listNotionPages(filter)

  console.log('StockForge AI — Notion Pages')
  console.log('='.repeat(34))
  console.log(`Pages: ${pages.length}`)
  if (filter) console.log(`Filter: "${filter}"`)
  console.log('')

  if (pages.length === 0) {
    console.log('No visible pages found for this integration.')
    return
  }

  for (const page of pages) {
    console.log(`- ${page.title}`)
    console.log(`  id: ${page.id}`)
    console.log(`  url: ${page.url}`)
    console.log('')
  }
}

main().catch((err) => {
  console.error('List failed:', err)
  process.exit(1)
})
