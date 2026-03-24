import { config } from 'dotenv'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

config({ path: resolve(process.cwd(), '.env.local') })

type NotionRichText = {
  plain_text?: string
}

type NotionBlock = {
  id: string
  type: string
  has_children?: boolean
  paragraph?: { rich_text?: NotionRichText[] }
  heading_1?: { rich_text?: NotionRichText[] }
  heading_2?: { rich_text?: NotionRichText[] }
  heading_3?: { rich_text?: NotionRichText[] }
  bulleted_list_item?: { rich_text?: NotionRichText[] }
  numbered_list_item?: { rich_text?: NotionRichText[] }
  to_do?: { rich_text?: NotionRichText[]; checked?: boolean }
  toggle?: { rich_text?: NotionRichText[] }
  quote?: { rich_text?: NotionRichText[] }
  callout?: { rich_text?: NotionRichText[] }
  code?: { rich_text?: NotionRichText[] }
}

type NotionPageResponse = {
  id: string
  url?: string
  properties?: Record<
    string,
    {
      type?: string
      title?: NotionRichText[]
    }
  >
}

type NotionSearchResult = {
  id: string
  url?: string
  object: string
  properties?: Record<
    string,
    {
      type?: string
      title?: NotionRichText[]
    }
  >
}

const NOTION_API_KEY = process.env.NOTION_API_KEY
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const OPENAI_API_KEY = process.env.OPENAI_API_KEY

if (!NOTION_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY || !OPENAI_API_KEY) {
  throw new Error(
    'Missing required env vars: NOTION_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY'
  )
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
const openai = new OpenAI({ apiKey: OPENAI_API_KEY })

export function normalizePageId(id: string): string {
  return id.replace(/-/g, '')
}

function richTextToPlainText(richText?: NotionRichText[]): string {
  return (richText ?? []).map((part) => part.plain_text ?? '').join('').trim()
}

export async function notionFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`https://api.notion.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${NOTION_API_KEY}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Notion API error ${response.status}: ${text}`)
  }

  return response.json() as Promise<T>
}

export async function fetchPageMeta(pageId: string): Promise<{ title: string; url: string | null }> {
  const page = await notionFetch<NotionPageResponse>(`/pages/${pageId}`)

  const titleProperty = Object.values(page.properties ?? {}).find(
    (property) => property.type === 'title'
  )
  const title = richTextToPlainText(titleProperty?.title) || `Notion Page ${page.id}`

  return {
    title,
    url: page.url ?? null,
  }
}

async function fetchBlockChildren(blockId: string): Promise<NotionBlock[]> {
  let hasMore = true
  let startCursor: string | undefined
  const results: NotionBlock[] = []

  while (hasMore) {
    const query = new URLSearchParams()
    if (startCursor) query.set('start_cursor', startCursor)
    query.set('page_size', '100')

    const response = await notionFetch<{
      results: NotionBlock[]
      has_more: boolean
      next_cursor: string | null
    }>(`/blocks/${blockId}/children?${query.toString()}`)

    results.push(...response.results)
    hasMore = response.has_more
    startCursor = response.next_cursor ?? undefined
  }

  return results
}

async function flattenBlocks(blockId: string, depth = 0): Promise<string[]> {
  const blocks = await fetchBlockChildren(blockId)
  const lines: string[] = []

  for (const block of blocks) {
    let text = ''

    switch (block.type) {
      case 'paragraph':
        text = richTextToPlainText(block.paragraph?.rich_text)
        break
      case 'heading_1':
        text = `# ${richTextToPlainText(block.heading_1?.rich_text)}`
        break
      case 'heading_2':
        text = `## ${richTextToPlainText(block.heading_2?.rich_text)}`
        break
      case 'heading_3':
        text = `### ${richTextToPlainText(block.heading_3?.rich_text)}`
        break
      case 'bulleted_list_item':
        text = `${'  '.repeat(depth)}- ${richTextToPlainText(block.bulleted_list_item?.rich_text)}`
        break
      case 'numbered_list_item':
        text = `${'  '.repeat(depth)}1. ${richTextToPlainText(block.numbered_list_item?.rich_text)}`
        break
      case 'to_do':
        text = `${'  '.repeat(depth)}- [${block.to_do?.checked ? 'x' : ' '}] ${richTextToPlainText(block.to_do?.rich_text)}`
        break
      case 'toggle':
        text = `${'  '.repeat(depth)}> ${richTextToPlainText(block.toggle?.rich_text)}`
        break
      case 'quote':
        text = `> ${richTextToPlainText(block.quote?.rich_text)}`
        break
      case 'callout':
        text = `Callout: ${richTextToPlainText(block.callout?.rich_text)}`
        break
      case 'code':
        text = `Code: ${richTextToPlainText(block.code?.rich_text)}`
        break
      default:
        break
    }

    if (text) lines.push(text)

    if (block.has_children) {
      const children = await flattenBlocks(block.id, depth + 1)
      lines.push(...children)
    }
  }

  return lines
}

function chunkDocument(content: string, maxChunkSize = 1500): string[] {
  if (content.length <= maxChunkSize) return [content]

  const paragraphs = content.split('\n\n').filter((paragraph) => paragraph.trim().length > 0)
  const chunks: string[] = []
  let currentChunk = ''

  for (const paragraph of paragraphs) {
    if ((currentChunk + '\n\n' + paragraph).length > maxChunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim())
      currentChunk = paragraph
    } else {
      currentChunk = currentChunk ? `${currentChunk}\n\n${paragraph}` : paragraph
    }
  }

  if (currentChunk.trim().length > 0) chunks.push(currentChunk.trim())
  return chunks
}

async function embedText(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  })
  return response.data[0].embedding
}

export function titleFromProperties(
  properties?: Record<string, { type?: string; title?: NotionRichText[] }>
) {
  const titleProp = Object.values(properties ?? {}).find((prop) => prop.type === 'title')
  return (titleProp?.title ?? []).map((part) => part.plain_text ?? '').join('').trim()
}

export async function listNotionPages(filter = ''): Promise<Array<{ id: string; title: string; url: string }>> {
  const normalizedFilter = filter.trim().toLowerCase()
  let hasMore = true
  let startCursor: string | undefined
  const pages: Array<{ id: string; title: string; url: string }> = []

  while (hasMore) {
    const response = await notionFetch<{
      results?: NotionSearchResult[]
      has_more?: boolean
      next_cursor?: string | null
    }>('/search', {
      method: 'POST',
      body: JSON.stringify({
        page_size: 100,
        start_cursor: startCursor,
        filter: {
          property: 'object',
          value: 'page',
        },
      }),
    })

    const batch = (response.results ?? [])
      .map((result) => ({
        id: result.id,
        title: titleFromProperties(result.properties) || '(Untitled)',
        url: result.url ?? '',
      }))
      .filter((page) => (normalizedFilter ? page.title.toLowerCase().includes(normalizedFilter) : true))

    pages.push(...batch)
    hasMore = response.has_more ?? false
    startCursor = response.next_cursor ?? undefined
  }

  return pages
}

export async function ingestNotionPage(pageId: string): Promise<{
  pageId: string
  title: string
  sourceUrl: string
  chunks: number
}> {
  const normalizedPageId = normalizePageId(pageId)
  const meta = await fetchPageMeta(normalizedPageId)
  const lines = await flattenBlocks(normalizedPageId)
  const content = lines.filter(Boolean).join('\n\n').trim()

  if (!content) {
    throw new Error(`No readable content found on Notion page ${normalizedPageId}.`)
  }

  const chunks = chunkDocument(content)
  const sourceUrl = meta.url ?? `notion://page/${normalizedPageId}`

  const { error: deleteError } = await supabase
    .from('research_documents')
    .delete()
    .eq('source_url', sourceUrl)

  if (deleteError) {
    throw new Error(`Failed to clear prior Notion chunks: ${deleteError.message}`)
  }

  for (let i = 0; i < chunks.length; i++) {
    const embedding = await embedText(`${meta.title}\n\n${chunks[i]}`)
    const { error } = await supabase.from('research_documents').insert({
      title: meta.title,
      type: 'article',
      source_url: sourceUrl,
      content: chunks[i],
      tags: ['notion', 'founder-notes', `notion-page-id:${normalizedPageId}`],
      metadata: {
        provenance_class: 'founder_note',
        source_kind: 'notion_page',
        visibility: 'internal',
        author: 'Ethan Hernandez',
        notion_page_id: normalizedPageId,
      },
      chunk_index: i,
      embedding,
    })

    if (error) {
      throw new Error(`Failed to insert chunk ${i}: ${error.message}`)
    }
  }

  return {
    pageId: normalizedPageId,
    title: meta.title,
    sourceUrl,
    chunks: chunks.length,
  }
}
