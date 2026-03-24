/**
 * scripts/preview-research-doc.ts
 *
 * Prints stored research document chunks from Supabase for a matching title.
 * Useful for verifying that a specific page was ingested correctly.
 *
 * Run:
 *   npx tsx scripts/preview-research-doc.ts "Affaan"
 *   npx tsx scripts/preview-research-doc.ts "Research Overview" 2
 */

import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error(
    'Missing required env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY'
  )
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

type ResearchDocPreviewRow = {
  id: string
  title: string
  type: string
  source_url: string | null
  chunk_index: number | null
  metadata?: {
    provenance_class?: string
    source_kind?: string
    visibility?: string
    author?: string
    notion_page_id?: string
  } | null
  content: string
  created_at: string
}

async function main() {
  const titleFilter = process.argv[2]?.trim()
  const limit = Number.parseInt(process.argv[3] ?? '5', 10)

  if (!titleFilter) {
    throw new Error('Usage: npx tsx scripts/preview-research-doc.ts "<title filter>" [limit]')
  }

  const safeLimit = Number.isNaN(limit) ? 5 : Math.min(Math.max(limit, 1), 20)

  const { data, error } = await supabase
    .from('research_documents')
    .select('id, title, type, source_url, chunk_index, metadata, content, created_at')
    .ilike('title', `%${titleFilter}%`)
    .order('title', { ascending: true })
    .order('chunk_index', { ascending: true })
    .limit(safeLimit)

  if (error) {
    throw new Error(`Supabase query failed: ${error.message}`)
  }

  const rows = (data ?? []) as ResearchDocPreviewRow[]

  console.log('StockForge AI — Research Document Preview')
  console.log('='.repeat(46))
  console.log(`Title filter: "${titleFilter}"`)
  console.log(`Rows: ${rows.length}`)
  console.log('')

  if (rows.length === 0) {
    console.log('No matching research chunks found.')
    return
  }

  for (const row of rows) {
    console.log(`Title: ${row.title}`)
    console.log(`Type: ${row.type}`)
    console.log(`Chunk: ${row.chunk_index ?? 'n/a'}`)
    if (row.metadata?.provenance_class) {
      console.log(`Provenance: ${row.metadata.provenance_class}`)
    }
    if (row.metadata?.source_kind) {
      console.log(`Source Kind: ${row.metadata.source_kind}`)
    }
    if (row.metadata?.visibility) {
      console.log(`Visibility: ${row.metadata.visibility}`)
    }
    if (row.metadata?.author) {
      console.log(`Author: ${row.metadata.author}`)
    }
    console.log(`Source: ${row.source_url ?? 'n/a'}`)
    console.log(`Created: ${row.created_at}`)
    console.log(`ID: ${row.id}`)
    console.log('Preview:')
    console.log(row.content.slice(0, 1200))
    if (row.content.length > 1200) {
      console.log('\n[truncated]')
    }
    console.log('\n' + '-'.repeat(46) + '\n')
  }
}

main().catch((err) => {
  console.error('Preview failed:', err)
  process.exit(1)
})
