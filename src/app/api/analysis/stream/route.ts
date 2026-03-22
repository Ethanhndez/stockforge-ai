// ============================================================
// src/app/api/analysis/stream/route.ts
// Streaming SSE endpoint using named events for client-side
// progress display. Uses anthropic.messages.stream() so tokens
// arrive in real time during the final synthesis phase.
//
// Event types emitted:
//   event: status      { message, stage }
//   event: tool_call   { name, stage: 'calling' | 'executing' }
//   event: tool_result { name, success }
//   event: token       { text }          ← streams during final text
//   event: done        { text }          ← full final text
//   event: error       { message }
// ============================================================

import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { STOCK_TOOLS } from '@/lib/claude-tools'
import { executeTool } from '@/lib/tool-executor'
import { getResearchContext } from '@/lib/rag'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const MAX_ITERATIONS = 10

export async function POST(req: NextRequest) {
  let ticker: string
  let query: string | undefined

  try {
    const body = await req.json()
    ticker = (body.ticker || '').toUpperCase().trim()
    query = body.query
  } catch {
    return new Response(JSON.stringify({ error: 'ticker required' }), { status: 400 })
  }

  if (!ticker) {
    return new Response(JSON.stringify({ error: 'ticker required' }), { status: 400 })
  }

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        )
      }

      try {
        // ── RAG context ─────────────────────────────────────
        const ragContext = await getResearchContext(
          `stock analysis ${ticker} investment research fundamentals risk`,
          { matchThreshold: 0.65, matchCount: 4 }
        )
        send('status', { message: 'Research context loaded', stage: 'rag' })

        const systemPrompt = buildStreamSystemPrompt(ragContext)
        const messages: Anthropic.MessageParam[] = [
          { role: 'user', content: `Analyze ${ticker}. ${query || 'Provide a comprehensive research briefing.'}` },
        ]

        let iterationCount = 0

        while (iterationCount < MAX_ITERATIONS) {
          iterationCount++

          // ── Stream the response ────────────────────────────
          const streamResponse = await anthropic.messages.stream({
            model: 'claude-sonnet-4-6',
            max_tokens: 8000,
            system: systemPrompt,
            tools: STOCK_TOOLS,
            messages,
          })

          let fullText = ''
          const contentBlocks: Anthropic.ContentBlock[] = []
          let currentBlockIndex = -1
          let stopReason: string | null = null
          const inputJsonMap: Record<number, string> = {}

          for await (const event of streamResponse) {
            if (event.type === 'content_block_start') {
              currentBlockIndex++
              const block = event.content_block
              if (block.type === 'text') {
                contentBlocks[currentBlockIndex] = { type: 'text', text: '' } as Anthropic.TextBlock
              } else if (block.type === 'tool_use') {
                contentBlocks[currentBlockIndex] = {
                  type: 'tool_use',
                  id: block.id,
                  name: block.name,
                  input: {},
                } as Anthropic.ToolUseBlock
                inputJsonMap[currentBlockIndex] = ''
                send('tool_call', { name: block.name, stage: 'calling' })
              }
            }

            if (event.type === 'content_block_delta') {
              const block = contentBlocks[currentBlockIndex]
              if (event.delta.type === 'text_delta' && block?.type === 'text') {
                (block as Anthropic.TextBlock).text += event.delta.text
                fullText += event.delta.text
                send('token', { text: event.delta.text })
              }
              if (event.delta.type === 'input_json_delta' && block?.type === 'tool_use') {
                inputJsonMap[currentBlockIndex] = (inputJsonMap[currentBlockIndex] ?? '') + event.delta.partial_json
              }
            }

            if (event.type === 'content_block_stop') {
              const block = contentBlocks[currentBlockIndex]
              if (block?.type === 'tool_use' && inputJsonMap[currentBlockIndex]) {
                try {
                  (block as Anthropic.ToolUseBlock).input = JSON.parse(inputJsonMap[currentBlockIndex])
                } catch { /* malformed input — leave as {} */ }
              }
            }

            if (event.type === 'message_delta') {
              stopReason = event.delta.stop_reason ?? null
            }
          }

          messages.push({ role: 'assistant', content: contentBlocks })

          if (stopReason === 'end_turn') {
            send('done', { text: fullText })
            break
          }

          if (stopReason === 'tool_use') {
            const toolUseBlocks = contentBlocks.filter(
              (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
            )

            const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
              toolUseBlocks.map(async (block) => {
                send('tool_call', { name: block.name, stage: 'executing' })
                try {
                  const result = await executeTool(
                    block.name,
                    block.input as Record<string, string | number | undefined>
                  )
                  send('tool_result', { name: block.name, success: true })
                  return {
                    type: 'tool_result' as const,
                    tool_use_id: block.id,
                    content: JSON.stringify(result),
                  }
                } catch (error) {
                  send('tool_result', { name: block.name, success: false })
                  return {
                    type: 'tool_result' as const,
                    tool_use_id: block.id,
                    content: `ERROR: ${String(error)}`,
                    is_error: true,
                  }
                }
              })
            )

            messages.push({ role: 'user', content: toolResults })
          }
        }
      } catch (error) {
        send('error', { message: String(error) })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}

function buildStreamSystemPrompt(ragContext: string): string {
  return `You are a PhD-level equity research analyst for StockForge AI. Never use "buy", "sell", or "hold". Never make numerical return forecasts.

OUTPUT: Return a JSON object with exactly: { "ticker", "bull_case", "bear_case", "key_risks": [], "data_gaps": [], "rag_sources": [], "fetchedAt" }

RESEARCH CONTEXT:
${ragContext || 'No prior research context available.'}`.trim()
}
