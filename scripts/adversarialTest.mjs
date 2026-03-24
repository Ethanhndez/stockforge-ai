#!/usr/bin/env node

import assert from 'node:assert/strict'

import {
  analyzePortfolioWithTelemetry,
  setAnthropicClientForTests,
} from '../src/lib/ai/agentOrchestrator.ts'
import { SYNTHESIS_AGENT_SYSTEM_PROMPT } from '../src/lib/ai/agentPrompts.ts'
import { runPortfolioAnalysisPipeline } from '../src/lib/portfolio/portfolioAnalysisPipeline.ts'

let passed = 0
let failed = 0

function pass(label) {
  console.log(`PASS ${label}`)
  passed += 1
}

function fail(label, error) {
  console.error(`FAIL ${label}`)
  console.error(error instanceof Error ? error.message : String(error))
  failed += 1
}

async function runCase(label, fn) {
  try {
    await fn()
    pass(label)
  } catch (error) {
    fail(label, error)
  }
}

function buildMockResponse(text) {
  return {
    content: [{ type: 'text', text }],
    usage: { input_tokens: 32, output_tokens: 48 },
  }
}

function buildValidAgentClient({ synthesisDataSources = ['Polygon.io /v2/aggs/ticker/AAPL/prev'] } = {}) {
  return {
    messages: {
      async create(args) {
        if (args.system.includes('lead synthesis analyst')) {
          return buildMockResponse(
            JSON.stringify({
              companyName: 'Apple Inc.',
              ticker: 'AAPL',
              analysisDate: '2026-03-23',
              executiveSummary: 'Apple remains a high-quality business with mixed near-term tradeoffs.',
              analystBrief: 'Research remains balanced across bull and bear evidence.',
              industryContext: 'Large-cap platform companies remain exposed to product-cycle and regulatory pressure.',
              financialSnapshot: {
                revenue: 'Revenue available',
                netIncome: 'Net income available',
                operatingMargin: 'Operating margin available',
                totalAssets: 'Assets available',
                debtLoad: 'Debt available',
                cashPosition: 'Cash available',
                revenueGrowthNote: 'Growth is moderating.',
                epsNote: 'EPS remains positive.',
              },
              bullCase: {
                headline: 'Ecosystem durability supports resilience.',
                points: ['Installed base remains sticky.'],
                plainEnglish: 'The bull case is grounded in recurring ecosystem strength.',
              },
              bearCase: {
                headline: 'Growth could slow.',
                points: ['Hardware cycles can remain uneven.'],
                plainEnglish: 'The bear case is grounded in slower growth and margin pressure.',
              },
              keyRisks: ['Growth deceleration.'],
              recentNewsImpact: 'Recent news is mixed.',
              earningsQuality: 'Earnings quality remains acceptable.',
              data_sources: synthesisDataSources,
              researchPosture: {
                ticker: 'AAPL',
                bull_case: 'Recurring revenue and ecosystem retention help stability.',
                bear_case: 'Growth and margin compression remain real risks.',
                key_risks: ['Demand softness.'],
                data_gaps: [],
                rag_sources: [],
                fetchedAt: '2026-03-23T00:00:00.000Z',
              },
            })
          )
        }

        if (args.system.includes('fundamental analyst')) {
          return buildMockResponse(
            JSON.stringify({
              summary: 'Fundamentals are stable.',
              valuationView: 'Valuation looks reasonable against available earnings context.',
              qualityView: 'Balance-sheet quality is acceptable.',
              metrics: [],
              strengths: ['Cash generation remains resilient.'],
              risks: ['Margin pressure remains possible.'],
              dataGaps: [],
            })
          )
        }

        if (args.system.includes('technical analyst')) {
          return buildMockResponse(
            JSON.stringify({
              summary: 'Trend is mixed but orderly.',
              trendView: 'Price remains above key averages.',
              momentumView: 'Momentum is positive but not extreme.',
              metrics: [],
              strengths: ['Trend confirmation is constructive.'],
              risks: ['Momentum could fade quickly.'],
              dataGaps: [],
            })
          )
        }

        if (args.system.includes('sentiment and disclosures analyst')) {
          return buildMockResponse(
            JSON.stringify({
              summary: 'Headline tone is balanced.',
              sentimentView: 'Sentiment is constructive but not euphoric.',
              filingsView: 'Recent filings do not change the core thesis.',
              metrics: [],
              strengths: ['Disclosure cadence is routine.'],
              risks: ['News flow could reverse quickly.'],
              dataGaps: [],
            })
          )
        }

        throw new Error(`Unexpected mock agent prompt: ${args.system.slice(0, 80)}`)
      },
    },
  }
}

const malformedJsonClient = {
  messages: {
    async create() {
      return buildMockResponse('{"summary":"broken"')
    },
  },
}

function buildContext(dataSources = ['Polygon.io /v2/aggs/ticker/AAPL/prev']) {
  return {
    companyName: 'Apple Inc.',
    ticker: 'AAPL',
    analysisDate: '2026-03-23',
    fetchedAt: '2026-03-23T00:00:00.000Z',
    researchContext: 'Test context',
    fundamentals: {
      companyProfile: {
        ticker: 'AAPL',
        companyName: 'Apple Inc.',
        cik: '0000320193',
        secUrl: 'SEC browse-edgar lookup for AAPL',
      },
      company: null,
      financials: null,
      quote: null,
      derived: {
        peRatio: null,
        debtRatio: null,
      },
    },
    priceHistory: {
      latestQuote: {
        ticker: 'AAPL',
        price: 150,
        open: 149,
        high: 151,
        low: 148,
        volume: 1000000,
        fetchedAt: '2026-03-23T00:00:00.000Z',
      },
      bars: [],
      indicators: {
        sma20: null,
        sma50: null,
        rsi14: null,
        macd: null,
        macdSignal: null,
        macdHistogram: null,
        averageVolume20: null,
        latestVolume: null,
      },
    },
    news: {
      headlines: [],
      secFilings: [],
    },
    dataSources,
  }
}

function createMockSupabase() {
  const tables = {
    portfolios: [{ id: 'portfolio-1', user_id: 'user-1', archived_at: null }],
    holdings: [
      {
        id: 'holding-1',
        user_id: 'user-1',
        portfolio_id: 'portfolio-1',
        ticker: 'AAPL',
        shares: 10,
        cost_basis: 120,
        archived_at: null,
      },
    ],
    portfolio_policies: [],
    allocation_targets: [],
    cash_balance: [{ id: 'cash-1', user_id: 'user-1', portfolio_id: 'portfolio-1', amount: 1000 }],
    agent_decisions: [],
  }
  const operations = []

  function matches(row, filters) {
    return filters.every((filter) => {
      if (filter.type === 'eq') {
        return row[filter.field] === filter.value
      }
      if (filter.type === 'is') {
        return row[filter.field] === filter.value
      }
      return true
    })
  }

  class QueryBuilder {
    constructor(tableName) {
      this.tableName = tableName
      this.filters = []
      this.action = 'select'
      this.payload = null
      this.selectedColumns = null
    }

    select(columns) {
      this.selectedColumns = columns
      if (this.action === 'select') {
        this.action = 'select'
      }
      return this
    }

    insert(payload) {
      this.action = 'insert'
      this.payload = payload
      return this
    }

    update(payload) {
      this.action = 'update'
      this.payload = payload
      return this
    }

    eq(field, value) {
      this.filters.push({ type: 'eq', field, value })
      return this
    }

    is(field, value) {
      this.filters.push({ type: 'is', field, value })
      return this
    }

    order() {
      return this
    }

    returns() {
      return this
    }

    maybeSingle() {
      return Promise.resolve(this.execute(true))
    }

    single() {
      return Promise.resolve(this.execute(true))
    }

    then(resolve, reject) {
      return Promise.resolve(this.execute(false)).then(resolve, reject)
    }

    execute(singleResult) {
      const rows = tables[this.tableName]
      if (!rows) {
        return { data: null, error: new Error(`Unknown table: ${this.tableName}`) }
      }

      if (this.action === 'insert') {
        const insertedRow = {
          id: `decision-${rows.length + 1}`,
          run_at: '2026-03-23T00:00:00.000Z',
          ...this.payload,
        }
        rows.push(insertedRow)
        operations.push({ table: this.tableName, action: 'insert', payload: insertedRow })

        if (this.selectedColumns) {
          return {
            data: { id: insertedRow.id, run_at: insertedRow.run_at },
            error: null,
          }
        }

        return { data: insertedRow, error: null }
      }

      if (this.action === 'update') {
        const matchingRows = rows.filter((row) => matches(row, this.filters))
        matchingRows.forEach((row) => Object.assign(row, this.payload))
        operations.push({
          table: this.tableName,
          action: 'update',
          payload: this.payload,
          matchedCount: matchingRows.length,
        })
        return { data: null, error: null }
      }

      const matchingRows = rows.filter((row) => matches(row, this.filters))
      if (singleResult) {
        return { data: matchingRows[0] ?? null, error: null }
      }

      return { data: matchingRows, error: null }
    }
  }

  return {
    tables,
    operations,
    from(tableName) {
      return new QueryBuilder(tableName)
    },
  }
}

async function main() {
  console.log(`ADVERSARIAL TEST RESULTS — ${new Date().toISOString().slice(0, 10)}`)

  await runCase('1. Hallucination Trigger Guardrails', async () => {
    assert.match(SYNTHESIS_AGENT_SYSTEM_PROMPT, /Never provide buy, sell, or hold recommendations\./)
    assert.match(SYNTHESIS_AGENT_SYSTEM_PROMPT, /Never predict future prices, returns, or timing\./)
    assert.match(SYNTHESIS_AGENT_SYSTEM_PROMPT, /Present both bull and bear cases\./)
  })

  await runCase('2. Malformed JSON Injection -> parseError propagation', async () => {
    setAnthropicClientForTests(malformedJsonClient)
    const result = await analyzePortfolioWithTelemetry(['AAPL'], async () => buildContext())
    const summary = result.summaries[0]

    assert.equal(summary.parseError, true)
    assert.ok(summary.dataSources.length > 0)
    assert.match(summary.dataGaps.join(' '), /JSON parse failure/i)
  })

  await runCase('3. Empty data_sources array detection', async () => {
    setAnthropicClientForTests(buildValidAgentClient({ synthesisDataSources: [] }))
    const result = await analyzePortfolioWithTelemetry(['AAPL'], async () => buildContext([]))
    const summary = result.summaries[0]

    assert.ok(summary.dataSources.length > 0)
    assert.match(summary.dataSources[0], /Source attribution missing for AAPL/i)
    assert.match(summary.dataGaps.join(' '), /Source attribution had to be repaired/i)
  })

  await runCase('4. Bearer-auth threading', async () => {
    await assert.rejects(
      () => runPortfolioAnalysisPipeline('user-1', 'portfolio-1'),
      /Authenticated Supabase client is required/i
    )
  })

  await runCase('5. Write-first invariant + stage_durations persistence', async () => {
    const supabase = createMockSupabase()
    let analyzeCalled = false

    const result = await runPortfolioAnalysisPipeline('user-1', 'portfolio-1', supabase, {
      analyzePortfolioWithTelemetry: async () => {
        analyzeCalled = true
        assert.equal(supabase.tables.agent_decisions.length, 1)
        assert.equal(supabase.tables.agent_decisions[0].research_summaries, null)

        return {
          summaries: [
            {
              ticker: 'AAPL',
              summary: 'Research completed.',
              quote: {
                ticker: 'AAPL',
                price: 150,
                open: 149,
                high: 151,
                low: 148,
                volume: 1000000,
                fetchedAt: '2026-03-23T00:00:00.000Z',
              },
              fundamentals: {
                ticker: 'AAPL',
                name: 'Apple Inc.',
                marketCap: 100,
                market_cap: 100,
                locale: 'us',
                primary_exchange: 'XNAS',
                type: 'CS',
                active: true,
                currency_name: 'usd',
                cik: '0000320193',
                composite_figi: null,
                share_class_figi: null,
                market: 'stocks',
                phone_number: null,
                address: null,
                description: null,
                sic_code: null,
                sic_description: null,
                ticker_root: 'AAPL',
                homepage_url: null,
                total_employees: null,
                list_date: null,
                branding: null,
                share_class_shares_outstanding: null,
                weighted_shares_outstanding: null,
                round_lot: null,
                sector: 'Technology',
                industry: 'Consumer Electronics',
                fetchedAt: '2026-03-23T00:00:00.000Z',
              },
              news: [],
              bull_case: 'Bull case present.',
              bear_case: 'Bear case present.',
              key_risks: ['Concentration risk remains high.'],
              dataGaps: [],
              fetchedAt: '2026-03-23T00:00:00.000Z',
              dataSources: ['Polygon.io /v2/aggs/ticker/AAPL/prev'],
            },
          ],
          stageDurations: {
            AAPL: {
              contextMs: 5,
              fundamentalMs: 10,
              technicalMs: 10,
              sentimentMs: 10,
              synthesisMs: 10,
              totalMs: 45,
            },
          },
        }
      },
    })

    assert.equal(analyzeCalled, true)
    assert.ok(result.stageDurations.totalMs >= 0)
    assert.ok(result.stageDurations.perTicker.AAPL.totalMs === 45)
    assert.ok(supabase.tables.agent_decisions[0].stage_durations)
    const firstInsertIndex = supabase.operations.findIndex(
      (operation) => operation.table === 'agent_decisions' && operation.action === 'insert'
    )
    const firstResearchUpdateIndex = supabase.operations.findIndex(
      (operation) =>
        operation.table === 'agent_decisions' &&
        operation.action === 'update' &&
        Object.prototype.hasOwnProperty.call(operation.payload, 'research_summaries')
    )
    assert.ok(firstInsertIndex > -1)
    assert.ok(firstResearchUpdateIndex > firstInsertIndex)
  })

  setAnthropicClientForTests(null)

  console.log('')
  console.log(`${passed} passed, ${failed} failed`)
  console.log(`OVERALL: ${failed === 0 ? 'PASS' : 'FAIL'}`)

  if (failed > 0) {
    process.exit(1)
  }
}

main().catch((error) => {
  setAnthropicClientForTests(null)
  console.error('FAIL uncaught')
  console.error(error instanceof Error ? error.stack : String(error))
  process.exit(1)
})
