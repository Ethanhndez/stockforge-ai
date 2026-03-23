import Anthropic from '@anthropic-ai/sdk'
import {
  FUNDAMENTAL_AGENT_SYSTEM_PROMPT,
  SENTIMENT_AGENT_SYSTEM_PROMPT,
  SYNTHESIS_AGENT_SYSTEM_PROMPT,
  TECHNICAL_AGENT_SYSTEM_PROMPT,
} from '@/lib/ai/agentPrompts'
import type { ResearchSummary } from '@/lib/portfolio/agentTypes'
import type { FundamentalsResult, NewsItem, QuoteResult } from '@/lib/tools'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export interface AnalysisMetric {
  name: string
  value: string
  interpretation: string
}

export interface FundamentalAnalysis {
  summary: string
  valuationView: string
  qualityView: string
  metrics: AnalysisMetric[]
  strengths: string[]
  risks: string[]
  dataGaps: string[]
}

export interface TechnicalAnalysis {
  summary: string
  trendView: string
  momentumView: string
  metrics: AnalysisMetric[]
  strengths: string[]
  risks: string[]
  dataGaps: string[]
}

export interface SentimentAnalysis {
  summary: string
  sentimentView: string
  filingsView: string
  metrics: AnalysisMetric[]
  strengths: string[]
  risks: string[]
  dataGaps: string[]
}

export interface StockContext {
  companyName: string
  ticker: string
  analysisDate: string
  researchContext: string
  fundamentals: Record<string, unknown>
  priceHistory: Record<string, unknown>
  news: Record<string, unknown>
  dataSources: string[]
}

export interface StockAnalysis {
  fundamental: FundamentalAnalysis
  technical: TechnicalAnalysis
  sentiment: SentimentAnalysis
  synthesis: string
  tokensUsed: { haiku: number; sonnet: number }
  durationMs: number
}

type AgentUsage = {
  input_tokens?: number
  output_tokens?: number
}

function extractText(response: Anthropic.Message): string {
  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim()

  if (!text) {
    throw new Error('Anthropic response did not include a text block')
  }

  return text
}

function stripJsonEnvelope(text: string): string {
  return text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
}

function parseJson<T>(text: string): T {
  const cleaned = stripJsonEnvelope(text)
  const jsonStart = cleaned.indexOf('{')
  const jsonEnd = cleaned.lastIndexOf('}')

  if (jsonStart === -1 || jsonEnd <= jsonStart) {
    throw new Error('Claude response did not contain a JSON object')
  }

  return JSON.parse(cleaned.slice(jsonStart, jsonEnd + 1)) as T
}

function usageTotal(usage?: AgentUsage): number {
  return (usage?.input_tokens ?? 0) + (usage?.output_tokens ?? 0)
}

function nowIso(): string {
  return new Date().toISOString()
}

function parseSynthesisPayload(text: string): Record<string, unknown> {
  return parseJson<Record<string, unknown>>(text)
}

function buildResearchSummary(
  ticker: string,
  context: StockContext,
  result: StockAnalysis
): ResearchSummary {
  const synthesis = parseSynthesisPayload(result.synthesis)
  const posture =
    (synthesis.researchPosture as
      | {
          bull_case?: string
          bear_case?: string
          key_risks?: string[]
          data_gaps?: string[]
        }
      | undefined) ?? {}
  const quote = (context.priceHistory.latestQuote ?? null) as QuoteResult | null
  const fundamentals = (context.fundamentals.company ?? null) as FundamentalsResult | null
  const news = ((context.news.headlines ?? []) as NewsItem[]).slice(0, 10)

  return {
    ticker,
    quote,
    fundamentals,
    news,
    bull_case:
      posture.bull_case ??
      (synthesis.bullCase as { plainEnglish?: string } | undefined)?.plainEnglish ??
      result.fundamental.summary,
    bear_case:
      posture.bear_case ??
      (synthesis.bearCase as { plainEnglish?: string } | undefined)?.plainEnglish ??
      result.sentiment.summary,
    key_risks:
      posture.key_risks ??
      ((synthesis.keyRisks as string[] | undefined) ?? [
        ...result.fundamental.risks,
        ...result.technical.risks,
        ...result.sentiment.risks,
      ]).slice(0, 5),
    dataGaps: Array.from(
      new Set([
        ...result.fundamental.dataGaps,
        ...result.technical.dataGaps,
        ...result.sentiment.dataGaps,
        ...((posture.data_gaps as string[] | undefined) ?? []),
      ])
    ),
    fetchedAt: nowIso(),
    dataSources: context.dataSources,
  }
}

async function runJsonAgent<T>(
  model: string,
  systemPrompt: string,
  payload: Record<string, unknown>
): Promise<{ result: T; usage: number }> {
  const response = await anthropic.messages.create({
    model,
    max_tokens: 1800,
    system: systemPrompt,
    messages: [{ role: 'user', content: JSON.stringify(payload) }],
  })

  return {
    result: parseJson<T>(extractText(response)),
    usage: usageTotal(response.usage),
  }
}

export async function analyzeStock(
  ticker: string,
  context: StockContext
): Promise<StockAnalysis> {
  const startedAt = Date.now()

  const [fundamentalResponse, technicalResponse, sentimentResponse] = await Promise.all([
    runJsonAgent<FundamentalAnalysis>('claude-haiku-4-5', FUNDAMENTAL_AGENT_SYSTEM_PROMPT, {
      ticker,
      companyName: context.companyName,
      analysisDate: context.analysisDate,
      fundamentals: context.fundamentals,
      dataSources: context.dataSources,
    }),
    runJsonAgent<TechnicalAnalysis>('claude-haiku-4-5', TECHNICAL_AGENT_SYSTEM_PROMPT, {
      ticker,
      companyName: context.companyName,
      analysisDate: context.analysisDate,
      priceHistory: context.priceHistory,
      dataSources: context.dataSources,
    }),
    runJsonAgent<SentimentAnalysis>('claude-haiku-4-5', SENTIMENT_AGENT_SYSTEM_PROMPT, {
      ticker,
      companyName: context.companyName,
      analysisDate: context.analysisDate,
      news: context.news,
      dataSources: context.dataSources,
    }),
  ])

  const synthesisResponse = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4000,
    system: SYNTHESIS_AGENT_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: JSON.stringify({
          ticker,
          companyName: context.companyName,
          analysisDate: context.analysisDate,
          researchContext: context.researchContext,
          context,
          agentOutputs: {
            fundamental: fundamentalResponse.result,
            technical: technicalResponse.result,
            sentiment: sentimentResponse.result,
          },
        }),
      },
    ],
  })

  return {
    fundamental: fundamentalResponse.result,
    technical: technicalResponse.result,
    sentiment: sentimentResponse.result,
    synthesis: stripJsonEnvelope(extractText(synthesisResponse)),
    tokensUsed: {
      haiku:
        fundamentalResponse.usage +
        technicalResponse.usage +
        sentimentResponse.usage,
      sonnet: usageTotal(synthesisResponse.usage),
    },
    durationMs: Date.now() - startedAt,
  }
}

export async function analyzePortfolio(
  tickers: string[],
  getContext: (ticker: string) => Promise<StockContext>
): Promise<ResearchSummary[]> {
  const uniqueTickers = [...new Set(tickers.map((ticker) => ticker.toUpperCase().trim()))]

  return Promise.all(
    uniqueTickers.map(async (ticker) => {
      try {
        const context = await getContext(ticker)
        const result = await analyzeStock(ticker, context)
        return buildResearchSummary(ticker, context, result)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return {
          ticker,
          quote: null,
          fundamentals: null,
          news: [],
          bull_case: 'Analysis unavailable due to an upstream research error.',
          bear_case: 'Research coverage is incomplete for this ticker because the portfolio run encountered an error.',
          key_risks: ['Research unavailable for this ticker during the portfolio run.'],
          dataGaps: [`Portfolio research error for ${ticker}: ${message}`],
          fetchedAt: nowIso(),
          dataSources: [],
        } satisfies ResearchSummary
      }
    })
  )
}
