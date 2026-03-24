// ============================================================
// src/lib/agent-loop.ts
// Non-streaming agentic loop for server-side use.
// Use this for batch analysis or testing — for user-facing
// streaming use /api/analysis/stream (ReadableStream SSE).
// ============================================================

import Anthropic from '@anthropic-ai/sdk'
import { STOCK_TOOLS } from './claude-tools'
import { executeTool } from './tool-executor'
import { getResearchContext } from './rag'
import type { ResearchPosture } from './tools'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const MAX_ITERATIONS = 10

export async function runStockAnalysisAgent(
  ticker: string,
  userQuery: string
): Promise<{ text: string; posture: ResearchPosture | null }> {
  const ragContext = await getResearchContext(
    `stock analysis ${ticker} investment research fundamentals risk`,
    { matchThreshold: 0.65, matchCount: 4, intent: 'market_analysis' }
  )

  const systemPrompt = buildAgentSystemPrompt(ragContext)

  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: `Please analyze ${ticker}. ${userQuery}` },
  ]

  let iterationCount = 0
  let finalText = ''

  while (iterationCount < MAX_ITERATIONS) {
    iterationCount++
    console.log(`[AgentLoop] Iteration ${iterationCount}, messages: ${messages.length}`)

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8000,
      system: systemPrompt,
      tools: STOCK_TOOLS,
      messages,
    })

    console.log(`[AgentLoop] stop_reason: ${response.stop_reason}`)
    messages.push({ role: 'assistant', content: response.content })

    if (response.stop_reason === 'end_turn') {
      for (const block of response.content) {
        if (block.type === 'text') finalText = block.text
      }
      break
    }

    if (response.stop_reason === 'tool_use') {
      const toolUseBlocks = response.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
      )
      console.log(`[AgentLoop] Tools: ${toolUseBlocks.map((b) => b.name).join(', ')}`)

      const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
        toolUseBlocks.map(async (toolBlock) => {
          try {
            const result = await executeTool(
              toolBlock.name,
              toolBlock.input as Record<string, string | number | undefined>
            )
            return {
              type: 'tool_result' as const,
              tool_use_id: toolBlock.id,
              content: JSON.stringify(result),
            }
          } catch (error) {
            return {
              type: 'tool_result' as const,
              tool_use_id: toolBlock.id,
              content: `ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`,
              is_error: true,
            }
          }
        })
      )

      messages.push({ role: 'user', content: toolResults })
      continue
    }

    console.warn(`[AgentLoop] Unexpected stop_reason: ${response.stop_reason}`)
    break
  }

  // Parse structured posture from Claude's final JSON text
  let posture: ResearchPosture | null = null
  try {
    const cleaned = finalText
      .replace(/^```json\s*/m, '')
      .replace(/^```\s*/m, '')
      .replace(/```\s*$/m, '')
      .trim()
    const jsonStart = cleaned.indexOf('{')
    const jsonEnd = cleaned.lastIndexOf('}')
    if (jsonStart !== -1 && jsonEnd > jsonStart) {
      posture = JSON.parse(cleaned.slice(jsonStart, jsonEnd + 1))
    }
  } catch {
    console.warn('[AgentLoop] Could not parse structured posture from response')
  }

  return { text: finalText, posture }
}

function buildAgentSystemPrompt(ragContext: string): string {
  return `You are a PhD-level equity research analyst for StockForge AI. Produce rigorous, data-driven research briefings.

CONSTRAINTS:
- NEVER use the words "buy", "sell", or "hold" in any form
- NEVER make forward-looking return estimates or numerical forecasts
- NEVER speculate — only use data returned by your tools
- If a tool returns an error, note it in data_gaps and continue
- Always cite data sources with their fetchedAt timestamps
${ragContext ? `\nRESEARCH CONTEXT (from proprietary database):\n${ragContext}` : ''}
OUTPUT FORMAT — return exactly this JSON shape when done:
{
  "ticker": "AAPL",
  "bull_case": "...",
  "bear_case": "...",
  "key_risks": ["risk 1", "risk 2", "risk 3"],
  "data_gaps": ["gap 1"],
  "rag_sources": ["doc title 1"],
  "fetchedAt": "<ISO timestamp>"
}`.trim()
}
