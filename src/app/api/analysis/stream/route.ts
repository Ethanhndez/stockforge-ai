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
import { analyzeStock } from '@/lib/ai/agentOrchestrator'
import type { AnalysisResponse, AnalysisToolError, ResearchPosture } from '@/lib/ai/analysis-contract'
import {
  buildCanonicalAnalysisFromPosture,
  buildCanonicalAnalysisFromResponse,
  validateCanonicalAnalysis,
} from '@/lib/ai/analysis-validator'
import {
  createExecutionMetadata,
  detectFallbackReason,
  logExecutionMetadata,
  mergeExecutionMetadata,
  recordGaps,
  recordToolFailure,
  recordToolUsed,
  recordValidation,
  setFallbackReason,
} from '@/lib/ai/execution-observability'
import { buildStockContext } from '@/lib/ai/contextBuilder'
import { STOCK_TOOLS } from '@/lib/claude-tools'
import { executeTool } from '@/lib/tool-executor'
import { getResearchContext } from '@/lib/rag'
import fs from 'fs'
import path from 'path'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const MAX_ITERATIONS = 10
const FIXTURE_COMPANIES: Record<string, {
  companyName: string
  description: string
  industryContext: string
  price: number
}> = {
  AAPL: {
    companyName: 'Apple Inc.',
    description: 'Apple designs consumer electronics, software, and services across a tightly integrated hardware-software ecosystem.',
    industryContext: 'Consumer electronics and digital services face a maturing upgrade cycle, with monetization increasingly driven by ecosystem lock-in and recurring services.',
    price: 227.48,
  },
  NVDA: {
    companyName: 'NVIDIA Corporation',
    description: 'NVIDIA designs GPUs, AI accelerators, and data-center platforms used across training, inference, gaming, and high-performance computing.',
    industryContext: 'Semiconductor demand is increasingly driven by AI infrastructure spending, cloud capex cycles, and competition around accelerator performance and supply.',
    price: 912.35,
  },
  TSLA: {
    companyName: 'Tesla, Inc.',
    description: 'Tesla manufactures electric vehicles, battery systems, and energy products while positioning software and autonomy as long-term margin drivers.',
    industryContext: 'Electric vehicle adoption remains sensitive to pricing, rates, subsidies, and manufacturing efficiency, with margin pressure rising as competition intensifies.',
    price: 176.82,
  },
  MSFT: {
    companyName: 'Microsoft Corporation',
    description: 'Microsoft sells enterprise software, cloud infrastructure, developer tools, and productivity products with Azure and Copilot central to current growth.',
    industryContext: 'Enterprise software and cloud markets remain anchored by recurring revenue, vendor lock-in, and AI monetization across installed customer bases.',
    price: 438.62,
  },
  AMZN: {
    companyName: 'Amazon.com, Inc.',
    description: 'Amazon operates global e-commerce, cloud infrastructure, logistics, advertising, and subscription businesses with AWS and ads driving profitability.',
    industryContext: 'E-commerce and cloud remain scale markets where logistics efficiency, cloud optimization trends, and advertising monetization heavily influence profitability.',
    price: 182.14,
  },
}

function parseJsonObject<T>(raw: string): T {
  const cleaned = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()

  const jsonStart = cleaned.indexOf('{')
  const jsonEnd = cleaned.lastIndexOf('}')

  if (jsonStart === -1 || jsonEnd <= jsonStart) {
    throw new Error('Claude did not return a JSON object')
  }

  return JSON.parse(cleaned.slice(jsonStart, jsonEnd + 1)) as T
}

function assertValidCanonicalPosture(args: {
  ticker: string
  companyName: string
  posture: ResearchPosture
  executionPath: 'parallel' | 'fallback'
  executionMetadata: import('@/lib/ai/analysis-contract').AnalysisExecutionMetadata
  dataSourcesUsed?: string[]
  toolErrors?: AnalysisToolError[]
}): void {
  const validation = validateCanonicalAnalysis(
    buildCanonicalAnalysisFromPosture({
      ticker: args.ticker,
      companyName: args.companyName,
      posture: args.posture,
      executionPath: args.executionPath,
      dataSourcesUsed: args.dataSourcesUsed,
      toolErrors: args.toolErrors,
    })
  )
  recordValidation(args.executionMetadata, validation.ok)
  recordGaps(args.executionMetadata, args.posture.data_gaps)

  if (!validation.ok) {
    throw new Error(`Canonical analysis validation failed: ${validation.errors.join('; ')}`)
  }
}

function buildFixtureAnalysis(ticker: string, fixtureAnalysis: Record<string, unknown>) {
  if (ticker === 'AAPL') {
    return {
      ...fixtureAnalysis,
      analysisDate: new Date().toISOString().split('T')[0],
      fetchedAt: new Date().toISOString(),
    }
  }

  const company = FIXTURE_COMPANIES[ticker]
  const fetchedAt = new Date().toISOString()

  return {
    companyName: company.companyName,
    ticker,
    analysisDate: new Date().toISOString().split('T')[0],
    executiveSummary: `${company.companyName} fixture analysis is enabled for local development. ${company.description}`,
    analystBrief: `Fixture mode is active for ${ticker}, so this report uses deterministic placeholder analysis rather than live market or filing data. The current seeded reference price is $${company.price.toFixed(2)} and the response shape matches production output for UI verification.`,
    industryContext: company.industryContext,
    financialSnapshot: {
      revenue: 'fixture data unavailable',
      netIncome: 'fixture data unavailable',
      operatingMargin: 'fixture data unavailable',
      totalAssets: 'fixture data unavailable',
      debtLoad: 'Fixture mode does not provide company-specific leverage analysis.',
      cashPosition: 'fixture data unavailable',
      revenueGrowthNote: 'Fixture mode does not include live growth data.',
      epsNote: `Fixture reference price $${company.price.toFixed(2)}. EPS data unavailable in fixture mode.`,
    },
    bullCase: {
      headline: 'Fixture Upside Scenario',
      points: [
        `${company.companyName} renders correctly through the full analysis pipeline for ${ticker}.`,
        'The stock detail page, SSE loader, and research cards all receive structured data in the expected shape.',
        'Fixture mode confirms the app can render a complete analysis experience without live provider dependencies.',
      ],
      plainEnglish: `In fixture mode, the main bullish takeaway is that the product flow for ${ticker} works end-to-end.`,
    },
    bearCase: {
      headline: 'Fixture Limitations',
      points: [
        'This is not a live market analysis and should not be interpreted as company-specific research.',
        'Financial metrics, filing summaries, and news synthesis are intentionally stubbed in fixture mode.',
        'Real differentiation between companies requires live Polygon.io, SEC EDGAR, and Claude responses.',
      ],
      plainEnglish: `The downside is simple: this is a local test fixture, not a real investment analysis for ${ticker}.`,
    },
    keyRisks: [
      'Fixture mode does not reflect live fundamentals or filings.',
      'Ticker-specific investment conclusions are unavailable in fixture mode.',
      'Real analysis quality still depends on external API and model availability.',
    ],
    recentNewsImpact: `Fixture mode is active, so no live news interpretation is available for ${ticker}.`,
    earningsQuality: `Fixture mode does not evaluate earnings quality for ${ticker}.`,
    data_sources: [
      `Fixture analysis payload for ${ticker}`,
      `Fixture quote seed for ${ticker} at $${company.price.toFixed(2)}`,
    ],
    researchPosture: {
      bull_case: `UI and backend fixture flow completed successfully for ${ticker}.`,
      bear_case: `The content is placeholder-only until live providers are enabled for ${ticker}.`,
      key_risks: [
        'No live market data in fixture mode',
        'No live filing reads in fixture mode',
        'No live model synthesis in fixture mode',
      ],
      data_gaps: [
        'Revenue unavailable in fixture mode',
        'Net income unavailable in fixture mode',
        'News and filing detail unavailable in fixture mode',
      ],
    },
    fetchedAt,
  }
}

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

  if (!process.env.ANTHROPIC_API_KEY && process.env.NEXT_PUBLIC_USE_FIXTURES !== 'true') {
    return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY is not configured' }), { status: 500 })
  }

  if (process.env.NEXT_PUBLIC_USE_FIXTURES === 'true') {
    const fixtureDir = path.join(process.cwd(), 'src/lib/fixtures')
    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: string, data: unknown) => {
          controller.enqueue(
            new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          )
        }

        const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

        try {
          if (!FIXTURE_COMPANIES[ticker]) {
            const errFixture = JSON.parse(
              fs.readFileSync(path.join(fixtureDir, 'bad-ticker-error.json'), 'utf-8')
            )
            send('error', { message: errFixture.error })
            return
          }

          send('status', { message: 'Research context loaded', stage: 'rag' })

          const fixtureToolCalls = [
            'getCompanyProfile',
            'getFundamentals',
            'getFinancials',
            'get_recent_filings',
            'getFilingContent',
            'getNews',
            'getQuote',
          ]

          for (const toolName of fixtureToolCalls) {
            send('tool_call', { name: toolName, stage: 'calling' })
            await delay(120)
            send('tool_call', { name: toolName, stage: 'executing' })
            await delay(120)
            send('tool_result', { name: toolName, success: true })
          }

          const rawAnalysis = JSON.parse(
            fs.readFileSync(path.join(fixtureDir, 'aapl-analysis.json'), 'utf-8')
          ) as Record<string, unknown>
          const analysis = buildFixtureAnalysis(ticker, rawAnalysis)
          const text = JSON.stringify(analysis)

          send('token', { text })
          send('done', { text })
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

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        )
      }
      const parallelExecution = createExecutionMetadata('parallel')
      let inheritedFallbackMetadata = createExecutionMetadata('fallback')

      try {
        send('status', { message: 'Building stock context', stage: 'context' })
        const context = await buildStockContext(ticker)
        Object.assign(parallelExecution, mergeExecutionMetadata(parallelExecution, context.executionMetadata))
        send('status', { message: 'Parallel agents running', stage: 'parallel' })
        recordToolUsed(parallelExecution, 'fundamentalAgent')
        send('tool_call', { name: 'fundamentalAgent', stage: 'calling' })
        recordToolUsed(parallelExecution, 'technicalAgent')
        send('tool_call', { name: 'technicalAgent', stage: 'calling' })
        recordToolUsed(parallelExecution, 'sentimentAgent')
        send('tool_call', { name: 'sentimentAgent', stage: 'calling' })

        const result = await analyzeStock(ticker, context)
        send('tool_result', { name: 'fundamentalAgent', success: true })
        send('tool_result', { name: 'technicalAgent', success: true })
        send('tool_result', { name: 'sentimentAgent', success: true })
        recordToolUsed(parallelExecution, 'synthesisAgent')
        send('tool_call', { name: 'synthesisAgent', stage: 'executing' })

        const fullAnalysis = parseJsonObject<AnalysisResponse>(result.synthesis)
        const posture = fullAnalysis.researchPosture ?? {
          ticker,
          bull_case: '',
          bear_case: '',
          key_risks: [],
          data_gaps: [],
          rag_sources: [],
          fetchedAt: new Date().toISOString(),
        }

        const fullAnalysisValidation = validateCanonicalAnalysis(
          buildCanonicalAnalysisFromResponse({
            analysis: fullAnalysis,
            executionPath: 'parallel',
          })
        )
        recordValidation(parallelExecution, fullAnalysisValidation.ok)
        recordGaps(parallelExecution, posture.data_gaps)
        if (!fullAnalysisValidation.ok) {
          setFallbackReason(parallelExecution, 'validation_failed')
          logExecutionMetadata('/api/analysis/stream parallel->fallback', parallelExecution)
          throw new Error(
            `Canonical analysis validation failed: ${fullAnalysisValidation.errors.join('; ')}`
          )
        }
        assertValidCanonicalPosture({
          ticker,
          companyName: fullAnalysis.companyName,
          posture,
          executionPath: 'parallel',
          executionMetadata: parallelExecution,
          dataSourcesUsed: fullAnalysis.data_sources,
        })
        logExecutionMetadata('/api/analysis/stream parallel', parallelExecution)

        const postureText = JSON.stringify(posture)

        send('token', { text: postureText })
        send('done', { text: postureText })
        return
      } catch (parallelError) {
        setFallbackReason(parallelExecution, detectFallbackReason(parallelError))
        inheritedFallbackMetadata = mergeExecutionMetadata(inheritedFallbackMetadata, {
          fallbackReason: parallelExecution.fallbackReason,
          hadGaps: parallelExecution.hadGaps,
          toolsUsed: parallelExecution.toolsUsed,
          toolsFailed: parallelExecution.toolsFailed,
        })
        logExecutionMetadata('/api/analysis/stream parallel-failed', parallelExecution)
        send('status', {
          message: `Parallel agents failed, using legacy stream fallback: ${String(parallelError)}`,
          stage: 'fallback',
        })
      }

      try {
        const ragContext = await getResearchContext(
          `stock analysis ${ticker} investment research fundamentals risk`,
          { matchThreshold: 0.65, matchCount: 4, intent: 'market_analysis' }
        )
        send('status', { message: 'Research context loaded', stage: 'rag' })

        const systemPrompt = buildStreamSystemPrompt(ragContext)
        const messages: Anthropic.MessageParam[] = [
          { role: 'user', content: `Analyze ${ticker}. ${query || 'Provide a comprehensive research briefing.'}` },
        ]
        const fallbackExecution = mergeExecutionMetadata(createExecutionMetadata('fallback'), {
          fallbackReason: inheritedFallbackMetadata.fallbackReason,
          hadGaps: inheritedFallbackMetadata.hadGaps,
          toolsUsed: inheritedFallbackMetadata.toolsUsed,
          toolsFailed: inheritedFallbackMetadata.toolsFailed,
        })

        let iterationCount = 0
        const toolErrors: AnalysisToolError[] = []

        while (iterationCount < MAX_ITERATIONS) {
          iterationCount++

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
            const posture = parseJsonObject<ResearchPosture>(fullText)
            assertValidCanonicalPosture({
              ticker,
              companyName: ticker,
              posture,
              executionPath: 'fallback',
              executionMetadata: fallbackExecution,
              toolErrors,
            })
            logExecutionMetadata('/api/analysis/stream fallback', fallbackExecution)
            send('done', { text: fullText })
            break
          }

          if (stopReason === 'tool_use') {
            const toolUseBlocks = contentBlocks.filter(
              (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
            )

            const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
              toolUseBlocks.map(async (block) => {
                recordToolUsed(fallbackExecution, block.name)
                send('tool_call', { name: block.name, stage: 'executing' })
                try {
                  const result = await executeTool(
                    block.name,
                    block.input as Record<string, string | number | undefined>
                  )
                  if (
                    typeof result === 'object' &&
                    result !== null &&
                    'error' in result &&
                    typeof result.error === 'string' &&
                    result.error.trim().length > 0
                  ) {
                    toolErrors.push({
                      tool: block.name,
                      source: 'legacy-stream-tool-loop',
                      error: result.error,
                    })
                    recordToolFailure(
                      fallbackExecution,
                      block.name,
                      'legacy-stream-tool-loop',
                      result.error
                    )
                  }
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
        logExecutionMetadata('/api/analysis/stream failed', inheritedFallbackMetadata)
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
        'X-Agent-Mode': 'parallel',
      },
    })
  }

function buildStreamSystemPrompt(ragContext: string): string {
  return `You are a PhD-level equity research analyst for StockForge AI. Never use "buy", "sell", or "hold". Never make numerical return forecasts.

OUTPUT: Return a JSON object with exactly: { "ticker", "bull_case", "bear_case", "key_risks": [], "data_gaps": [], "rag_sources": [], "fetchedAt" }

RESEARCH CONTEXT:
${ragContext || 'No prior research context available.'}`.trim()
}
