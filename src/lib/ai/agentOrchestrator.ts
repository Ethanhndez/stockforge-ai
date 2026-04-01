import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import {
  FUNDAMENTAL_AGENT_SYSTEM_PROMPT,
  SENTIMENT_AGENT_SYSTEM_PROMPT,
  SYNTHESIS_AGENT_SYSTEM_PROMPT,
  TECHNICAL_AGENT_SYSTEM_PROMPT,
} from '@/lib/ai/agentPrompts'
import type { AnalysisExecutionMetadata } from '@/lib/ai/analysis-contract'
import {
  fundamentalAnalysisSchema,
  sentimentAnalysisSchema,
  synthesisPayloadSchema,
  technicalAnalysisSchema,
} from '@/lib/ai/schemas'
import type {
  FundamentalAnalysis,
  SentimentAnalysis,
  SynthesisPayload,
  TechnicalAnalysis,
} from '@/lib/ai/schemas'
import type {
  ResearchSummary,
  ResearchTickerStageDurations,
} from '@/lib/portfolio/agentTypes'
import type {
  CompanyProfileResult,
  FinancialsResult,
  FundamentalsResult,
  NewsItem,
  QuoteResult,
} from '@/lib/tools'

interface AnthropicClientLike {
  messages: {
    create: (args: {
      model: string
      max_tokens: number
      system: string
      messages: Array<{ role: 'user'; content: string }>
    }) => Promise<Anthropic.Message>
  }
}

function createAnthropicClient(): AnthropicClientLike {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
}

let anthropicClient: AnthropicClientLike = createAnthropicClient()

export interface StockFundamentalsContext {
  companyProfile: CompanyProfileResult
  company: FundamentalsResult | null
  financials: FinancialsResult | null
  quote: QuoteResult | null
  derived: {
    peRatio: number | null
    debtRatio: number | null
  }
}

export interface StockPriceHistoryContext {
  latestQuote: QuoteResult | null
  bars: Array<{
    date: string
    open: number
    high: number
    low: number
    close: number
    volume: number
  }>
  indicators: {
    sma20: number | null
    sma50: number | null
    rsi14: number | null
    macd: number | null
    macdSignal: number | null
    macdHistogram: number | null
    averageVolume20: number | null
    latestVolume: number | null
  }
}

export interface StockNewsContext {
  headlines: NewsItem[]
  secFilings: Array<{
    form: string
    filingDate: string
    accessionNumber: string
    description: string
    excerpt: string
    source: string
  }>
}

export interface StockContext {
  companyName: string
  ticker: string
  analysisDate: string
  fetchedAt: string
  researchContext: string
  fundamentals: StockFundamentalsContext
  priceHistory: StockPriceHistoryContext
  news: StockNewsContext
  dataSources: string[]
  executionMetadata?: AnalysisExecutionMetadata
}

export interface StockAnalysis {
  fundamental: FundamentalAnalysis
  technical: TechnicalAnalysis
  sentiment: SentimentAnalysis
  synthesis: string
  synthesisPayload: SynthesisPayload
  tokensUsed: { haiku: number; sonnet: number }
  durationMs: number
  stageDurations: Omit<ResearchTickerStageDurations, 'contextMs'>
}

type AgentUsage = {
  input_tokens?: number
  output_tokens?: number
}

type ResearchAgentStage = 'fundamental' | 'technical' | 'sentiment' | 'synthesis'

const JSON_RETRY_INSTRUCTION =
  'Your previous response was not valid JSON. Respond with valid JSON only.'

const JSON_SCHEMA_RETRY_PREFIX =
  'Your previous response had the correct JSON structure but failed schema validation.'

class AgentJsonParseError extends Error {
  stage: ResearchAgentStage
  ticker: string
  rawOutput: string
  durationMs: number

  constructor(args: {
    stage: ResearchAgentStage
    ticker: string
    rawOutput: string
    durationMs: number
    cause: Error
  }) {
    super(
      `Malformed JSON from ${args.stage} agent for ${args.ticker}: ${args.cause.message}`
    )
    this.name = 'AgentJsonParseError'
    this.stage = args.stage
    this.ticker = args.ticker
    this.rawOutput = args.rawOutput
    this.durationMs = args.durationMs
    this.cause = args.cause
  }
}

class AgentSchemaValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AgentSchemaValidationError'
  }
}

class StockAnalysisError extends Error {
  summary: ResearchSummary
  stageDurations: Omit<ResearchTickerStageDurations, 'contextMs'>

  constructor(args: {
    message: string
    summary: ResearchSummary
    stageDurations: Omit<ResearchTickerStageDurations, 'contextMs'>
    cause?: Error
  }) {
    super(args.message)
    this.name = 'StockAnalysisError'
    this.summary = args.summary
    this.stageDurations = args.stageDurations
    this.cause = args.cause
  }
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

function parseJsonWithRecovery<T>(text: string): T {
  const cleaned = stripJsonEnvelope(text)
  let directParseError: Error | null = null

  try {
    return JSON.parse(cleaned) as T
  } catch (error) {
    directParseError = error instanceof Error ? error : new Error(String(error))
  }

  const extractedObject = cleaned.match(/\{[\s\S]*\}/)?.[0]
  if (!extractedObject) {
    throw directParseError ?? new Error('Claude response did not contain a JSON object')
  }

  try {
    return JSON.parse(extractedObject) as T
  } catch (error) {
    const extractionError = error instanceof Error ? error : new Error(String(error))
    throw new Error(
      `Direct parse failed: ${directParseError?.message ?? 'unknown error'}; extracted object parse failed: ${extractionError.message}`
    )
  }
}

function usageTotal(usage?: AgentUsage): number {
  return (usage?.input_tokens ?? 0) + (usage?.output_tokens ?? 0)
}

function nowIso(): string {
  return new Date().toISOString()
}

function elapsedMs(startedAt: number): number {
  return Date.now() - startedAt
}

function buildDataSourceList(args: {
  ticker: string
  contextDataSources: string[]
  synthesisDataSources: string[]
  ragSources: string[]
}): string[] {
  const combined = Array.from(
    new Set([
      ...args.contextDataSources,
      ...args.synthesisDataSources,
      ...args.ragSources,
    ].filter((source) => source.trim().length > 0))
  )

  return combined.length > 0
    ? combined
    : [`Source attribution missing for ${args.ticker}; investigation required.`]
}

function buildResearchSummary(
  ticker: string,
  context: StockContext,
  result: StockAnalysis
): ResearchSummary {
  const synthesis = result.synthesisPayload
  const posture = synthesis.researchPosture
  const quote = context.priceHistory.latestQuote ?? null
  const fundamentals = context.fundamentals.company ?? null
  const news = context.news.headlines.slice(0, 10)
  const dataSources = buildDataSourceList({
    ticker,
    contextDataSources: context.dataSources,
    synthesisDataSources: synthesis.data_sources,
    ragSources: posture.rag_sources,
  })
  const dataGaps = Array.from(
    new Set([
      ...result.fundamental.dataGaps,
      ...result.technical.dataGaps,
      ...result.sentiment.dataGaps,
      ...(posture.data_gaps ?? []),
      ...(dataSources.some((source) => source.startsWith('Source attribution missing for '))
        ? ['Source attribution had to be repaired because no explicit data sources were returned.']
        : []),
    ])
  )

  return {
    ticker,
    summary: synthesis.executiveSummary ?? result.fundamental.summary,
    quote,
    fundamentals,
    news,
    bull_case:
      posture.bull_case ??
      synthesis.bullCase.plainEnglish ??
      result.fundamental.summary,
    bear_case:
      posture.bear_case ??
      synthesis.bearCase.plainEnglish ??
      result.sentiment.summary,
    key_risks:
      posture.key_risks ??
      (synthesis.keyRisks ?? [
        ...result.fundamental.risks,
        ...result.technical.risks,
        ...result.sentiment.risks,
      ]).slice(0, 5),
    dataGaps,
    fetchedAt: context.fetchedAt,
    dataSources,
  }
}

function buildMalformedJsonFallback(
  ticker: string,
  context: StockContext,
  stage: ResearchAgentStage
): ResearchSummary {
  const summary = 'Research agent returned malformed JSON. Raw output logged.'

  return {
    ticker,
    summary,
    quote: context.priceHistory.latestQuote ?? null,
    fundamentals: context.fundamentals.company ?? null,
    news: context.news.headlines.slice(0, 10),
    bull_case: summary,
    bear_case: `Research output from the ${stage} stage could not be parsed into valid JSON.`,
    key_risks: ['Research agent JSON parse failure blocked structured analysis for this ticker.'],
    dataGaps: ['JSON parse failure — raw response unavailable for analysis'],
    fetchedAt: context.fetchedAt,
    dataSources:
      context.dataSources.length > 0
        ? context.dataSources
        : [`Context build attempted for ${ticker}`],
    parseError: true,
  }
}

function summarizeSchemaIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join('.') : 'root'
      return `${path}: ${issue.message}`
    })
    .join('; ')
}

function buildSchemaRetryInstruction(errorSummary: string): string {
  return `${JSON_RETRY_INSTRUCTION}\n${JSON_SCHEMA_RETRY_PREFIX} Missing or invalid fields: ${errorSummary}. Return the corrected JSON only.`
}

function createAgentMessage(
  payload: Record<string, unknown>,
  retryInstruction?: string
): string {
  return retryInstruction
    ? `${JSON.stringify(payload)}\n\n${retryInstruction}`
    : JSON.stringify(payload)
}

async function requestJsonFromAgent<T>(
  model: string,
  systemPrompt: string,
  payload: Record<string, unknown>,
  stage: ResearchAgentStage,
  ticker: string,
  maxTokens: number,
  schema?: z.ZodSchema<T>
): Promise<{ result: T; usage: number; rawOutput: string }> {
  let totalUsage = 0
  let retryInstruction: string | undefined

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const attemptStartedAt = Date.now()
    const response = await anthropicClient.messages.create({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: createAgentMessage(payload, retryInstruction) }],
    })
    const rawOutput = extractText(response)
    totalUsage += usageTotal(response.usage)

    try {
      const parsed = parseJsonWithRecovery<unknown>(rawOutput)

      if (schema) {
        const validated = schema.safeParse(parsed)

        if (!validated.success) {
          const errorSummary = summarizeSchemaIssues(validated.error)

          console.error('Research agent schema validation failed.', {
            ticker,
            stage,
            retryAttempted: attempt === 1,
            durationMs: elapsedMs(attemptStartedAt),
            validationErrors: validated.error.flatten(),
            rawOutput,
          })

          if (attempt === 0) {
            retryInstruction = buildSchemaRetryInstruction(errorSummary)
            continue
          }

          throw new AgentSchemaValidationError(`Schema validation failed: ${errorSummary}`)
        }

        return {
          result: validated.data,
          usage: totalUsage,
          rawOutput,
        }
      }

      return {
        result: parsed as T,
        usage: totalUsage,
        rawOutput,
      }
    } catch (error) {
      const parseError = error instanceof Error ? error : new Error(String(error))

      if (parseError instanceof AgentSchemaValidationError) {
        throw new AgentJsonParseError({
          stage,
          ticker,
          rawOutput,
          durationMs: elapsedMs(attemptStartedAt),
          cause: parseError,
        })
      }

      console.error('Research agent returned malformed JSON.', {
        ticker,
        stage,
        retryAttempted: Boolean(retryInstruction),
        durationMs: elapsedMs(attemptStartedAt),
        parseError: parseError.message,
        rawOutput,
      })

      if (attempt === 0) {
        retryInstruction = JSON_RETRY_INSTRUCTION
        continue
      }

      throw new AgentJsonParseError({
        stage,
        ticker,
        rawOutput,
        durationMs: elapsedMs(attemptStartedAt),
        cause: parseError,
      })
    }
  }

  throw new Error(`Unexpected JSON retry flow for ${stage} agent on ${ticker}`)
}

export async function analyzeStock(
  ticker: string,
  context: StockContext
): Promise<StockAnalysis> {
  const startedAt = Date.now()
  const agentStageDurations = {
    fundamentalMs: 0,
    technicalMs: 0,
    sentimentMs: 0,
    synthesisMs: 0,
    totalMs: 0,
  } satisfies Omit<ResearchTickerStageDurations, 'contextMs'>

  const stageResults = (await Promise.allSettled([
    (async () => {
      const stageStartedAt = Date.now()
      try {
        const response = await requestJsonFromAgent<FundamentalAnalysis>(
          'claude-haiku-4-5',
          FUNDAMENTAL_AGENT_SYSTEM_PROMPT,
          {
            ticker,
            companyName: context.companyName,
            analysisDate: context.analysisDate,
            fundamentals: context.fundamentals,
            dataSources: context.dataSources,
          },
          'fundamental',
          ticker,
          1800,
          fundamentalAnalysisSchema
        )

        return { ...response, durationMs: elapsedMs(stageStartedAt) }
      } finally {
        agentStageDurations.fundamentalMs = elapsedMs(stageStartedAt)
      }
    })(),
    (async () => {
      const stageStartedAt = Date.now()
      try {
        const response = await requestJsonFromAgent<TechnicalAnalysis>(
          'claude-haiku-4-5',
          TECHNICAL_AGENT_SYSTEM_PROMPT,
          {
            ticker,
            companyName: context.companyName,
            analysisDate: context.analysisDate,
            priceHistory: context.priceHistory,
            dataSources: context.dataSources,
          },
          'technical',
          ticker,
          1800,
          technicalAnalysisSchema
        )

        return { ...response, durationMs: elapsedMs(stageStartedAt) }
      } finally {
        agentStageDurations.technicalMs = elapsedMs(stageStartedAt)
      }
    })(),
    (async () => {
      const stageStartedAt = Date.now()
      try {
        const response = await requestJsonFromAgent<SentimentAnalysis>(
          'claude-haiku-4-5',
          SENTIMENT_AGENT_SYSTEM_PROMPT,
          {
            ticker,
            companyName: context.companyName,
            analysisDate: context.analysisDate,
            news: context.news,
            dataSources: context.dataSources,
          },
          'sentiment',
          ticker,
          1800,
          sentimentAnalysisSchema
        )

        return { ...response, durationMs: elapsedMs(stageStartedAt) }
      } finally {
        agentStageDurations.sentimentMs = elapsedMs(stageStartedAt)
      }
    })(),
  ])) as [
    PromiseSettledResult<{
      result: FundamentalAnalysis
      usage: number
      rawOutput: string
      durationMs: number
    }>,
    PromiseSettledResult<{
      result: TechnicalAnalysis
      usage: number
      rawOutput: string
      durationMs: number
    }>,
    PromiseSettledResult<{
      result: SentimentAnalysis
      usage: number
      rawOutput: string
      durationMs: number
    }>,
  ]

  const stageFailure = stageResults.find(
    (result): result is PromiseRejectedResult => result.status === 'rejected'
  )

  if (stageFailure) {
    const cause =
      stageFailure.reason instanceof Error
        ? stageFailure.reason
        : new Error(String(stageFailure.reason))

    agentStageDurations.totalMs = elapsedMs(startedAt)

    throw new StockAnalysisError({
      message: cause.message,
      summary:
        cause instanceof AgentJsonParseError
          ? buildMalformedJsonFallback(ticker, context, cause.stage)
          : {
              ticker,
              quote: context.priceHistory.latestQuote ?? null,
              fundamentals: context.fundamentals.company ?? null,
              news: context.news.headlines.slice(0, 10),
              bull_case: 'Analysis unavailable due to an upstream research error.',
              bear_case:
                'Research coverage is incomplete for this ticker because the portfolio run encountered an error.',
              key_risks: ['Research unavailable for this ticker during the portfolio run.'],
              dataGaps: [`Portfolio research error for ${ticker}: ${cause.message}`],
              fetchedAt: context.fetchedAt,
              dataSources: [`Context build attempted for ${ticker}`],
            },
      stageDurations: agentStageDurations,
      cause,
    })
  }

  const [fundamentalStageResult, technicalStageResult, sentimentStageResult] = stageResults

  if (fundamentalStageResult.status !== 'fulfilled') {
    throw new Error('Expected fulfilled fundamental stage result after rejection handling')
  }

  if (technicalStageResult.status !== 'fulfilled') {
    throw new Error('Expected fulfilled technical stage result after rejection handling')
  }

  if (sentimentStageResult.status !== 'fulfilled') {
    throw new Error('Expected fulfilled sentiment stage result after rejection handling')
  }

  const fundamentalResponse = fundamentalStageResult.value
  const technicalResponse = technicalStageResult.value
  const sentimentResponse = sentimentStageResult.value

  const synthesisStartedAt = Date.now()
  let synthesisResponse: {
    result: SynthesisPayload
    usage: number
    rawOutput: string
  }

  try {
    synthesisResponse = await requestJsonFromAgent<SynthesisPayload>(
      'claude-sonnet-4-6',
      SYNTHESIS_AGENT_SYSTEM_PROMPT,
      {
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
      },
      'synthesis',
      ticker,
      8000,
      synthesisPayloadSchema
    )
  } catch (error) {
    agentStageDurations.synthesisMs = elapsedMs(synthesisStartedAt)
    agentStageDurations.totalMs = elapsedMs(startedAt)

    if (error instanceof AgentJsonParseError) {
      throw new StockAnalysisError({
        message: error.message,
        summary: buildMalformedJsonFallback(ticker, context, error.stage),
        stageDurations: agentStageDurations,
        cause: error,
      })
    }

    throw error
  }

  agentStageDurations.synthesisMs = elapsedMs(synthesisStartedAt)
  agentStageDurations.totalMs = elapsedMs(startedAt)

  return {
    fundamental: fundamentalResponse.result,
    technical: technicalResponse.result,
    sentiment: sentimentResponse.result,
    synthesis: synthesisResponse.rawOutput,
    synthesisPayload: synthesisResponse.result,
    tokensUsed: {
      haiku:
        fundamentalResponse.usage +
        technicalResponse.usage +
        sentimentResponse.usage,
      sonnet: synthesisResponse.usage,
    },
    durationMs: elapsedMs(startedAt),
    stageDurations: agentStageDurations,
  }
}

export interface AnalyzePortfolioTelemetryResult {
  summaries: ResearchSummary[]
  stageDurations: Record<string, ResearchTickerStageDurations>
}

export async function analyzePortfolioWithTelemetry(
  tickers: string[],
  getContext: (ticker: string) => Promise<StockContext>
): Promise<AnalyzePortfolioTelemetryResult> {
  const uniqueTickers = [...new Set(tickers.map((ticker) => ticker.toUpperCase().trim()))]

  const results = await Promise.all(
    uniqueTickers.map(async (ticker) => {
      const tickerStartedAt = Date.now()
      let contextMs = 0

      try {
        const contextStartedAt = Date.now()
        const context = await getContext(ticker)
        contextMs = elapsedMs(contextStartedAt)
        const result = await analyzeStock(ticker, context)

        return {
          summary: buildResearchSummary(ticker, context, result),
          stageDurations: {
            contextMs,
            ...result.stageDurations,
          } satisfies ResearchTickerStageDurations,
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)

        if (error instanceof StockAnalysisError) {
          return {
            summary: error.summary,
            stageDurations: {
              contextMs,
              ...error.stageDurations,
            } satisfies ResearchTickerStageDurations,
          }
        }

        return {
          summary: {
            ticker,
            quote: null,
            fundamentals: null,
            news: [],
            bull_case: 'Analysis unavailable due to an upstream research error.',
            bear_case:
              'Research coverage is incomplete for this ticker because the portfolio run encountered an error.',
            key_risks: ['Research unavailable for this ticker during the portfolio run.'],
            dataGaps: [`Portfolio research error for ${ticker}: ${message}`],
            fetchedAt: nowIso(),
            dataSources: [`Context build attempted for ${ticker}`],
          } satisfies ResearchSummary,
          stageDurations: {
            contextMs: 0,
            fundamentalMs: 0,
            technicalMs: 0,
            sentimentMs: 0,
            synthesisMs: 0,
            totalMs: elapsedMs(tickerStartedAt),
          } satisfies ResearchTickerStageDurations,
        }
      }
    })
  )

  return {
    summaries: results.map((result) => result.summary),
    stageDurations: Object.fromEntries(
      results.map((result) => [result.summary.ticker, result.stageDurations])
    ),
  }
}

export async function analyzePortfolio(
  tickers: string[],
  getContext: (ticker: string) => Promise<StockContext>
): Promise<ResearchSummary[]> {
  const result = await analyzePortfolioWithTelemetry(tickers, getContext)
  return result.summaries
}

export function setAnthropicClientForTests(client: AnthropicClientLike | null): void {
  anthropicClient = client ?? createAnthropicClient()
}
