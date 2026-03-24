/**
 * scripts/list-research-docs.ts
 *
 * Lists research documents currently stored in Supabase.
 * Useful for verifying whether a specific research page or corpus was ingested.
 *
 * Run:
 *   npx tsx scripts/list-research-docs.ts
 *   npx tsx scripts/list-research-docs.ts Affaan
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

type ResearchDocRow = {
  id: string
  title: string
  type: string
  source_url: string | null
  chunk_index: number | null
  metadata?: {
    provenance_class?: string
    source_kind?: string
    visibility?: string
  } | null
  created_at: string
}

async function main() {
  const filter = process.argv[2]?.trim().toLowerCase() || ''

  let query = supabase
    .from('research_documents')
    .select('id, title, type, source_url, chunk_index, metadata, created_at')
    .order('created_at', { ascending: false })
    .limit(200)

  if (filter) {
    query = query.ilike('title', `%${filter}%`)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(`Supabase query failed: ${error.message}`)
  }

  const rows = (data ?? []) as ResearchDocRow[]

  console.log('StockForge AI — Research Documents')
  console.log('='.repeat(42))
  console.log(`Rows: ${rows.length}`)
  if (filter) console.log(`Title filter: "${filter}"`)
  console.log('')

  if (rows.length === 0) {
    console.log('No research documents found.')
    return
  }

  for (const row of rows) {
    console.log(`- ${row.title}`)
    console.log(`  type: ${row.type}`)
    console.log(`  chunk: ${row.chunk_index ?? 'n/a'}`)
    if (row.metadata?.provenance_class) {
      console.log(`  provenance: ${row.metadata.provenance_class}`)
    }
    if (row.metadata?.source_kind) {
      console.log(`  source kind: ${row.metadata.source_kind}`)
    }
    if (row.metadata?.visibility) {
      console.log(`  visibility: ${row.metadata.visibility}`)
    }
    console.log(`  source: ${row.source_url ?? 'n/a'}`)
    console.log(`  created: ${row.created_at}`)
    console.log(`  id: ${row.id}`)
    console.log('')
  }
}

main().catch((err) => {
  console.error('List failed:', err)
  process.exit(1)
})
