// ============================================================
// src/lib/claude-tools.ts
// Anthropic tool definitions — passed to every claude.messages.create() call.
// Tool names MUST exactly match the switch cases in tool-executor.ts.
// ============================================================

import Anthropic from '@anthropic-ai/sdk'

export const STOCK_TOOLS: Anthropic.Tool[] = [
  {
    name: 'getCompanyProfile',
    description:
      'Look up a company by ticker to get their SEC CIK number and company metadata. ' +
      'The CIK is required for SEC EDGAR filing calls. Call this first.',
    input_schema: {
      type: 'object' as const,
      properties: {
        ticker: {
          type: 'string',
          description: 'The stock ticker symbol, e.g. AAPL or MSFT',
        },
      },
      required: ['ticker'],
    },
  },
  {
    name: 'getFundamentals',
    description:
      'Fetch company fundamentals from Polygon.io: market cap, employee count, ' +
      'sector, industry, and company description. Any field not returned by ' +
      'Polygon will be null — record nulls as data_gaps, never estimate.',
    input_schema: {
      type: 'object' as const,
      properties: {
        ticker: { type: 'string', description: 'Stock ticker symbol' },
      },
      required: ['ticker'],
    },
  },
  {
    name: 'getFinancials',
    description:
      'Fetch annual financial statement data from Polygon.io. ' +
      'Returns income statement (revenue, net income, operating income, diluted EPS), ' +
      'balance sheet (total assets, long-term debt, cash), and cash flow data. ' +
      'Call this AFTER getFundamentals. Any field not returned must be a data_gap.',
    input_schema: {
      type: 'object' as const,
      properties: {
        ticker: { type: 'string', description: 'Stock ticker symbol' },
      },
      required: ['ticker'],
    },
  },
  {
    name: 'get_recent_filings',
    description:
      'Get the most recent SEC filings for this company — 10-K, 10-Q, 8-K, and proxy filings. ' +
      'Requires a CIK — call getCompanyProfile first.',
    input_schema: {
      type: 'object' as const,
      properties: {
        cik: { type: 'string', description: '10-digit zero-padded CIK from getCompanyProfile' },
      },
      required: ['cik'],
    },
  },
  {
    name: 'getNews',
    description:
      'Fetch recent news articles about this stock from Polygon.io. ' +
      'Use this to understand current sentiment, earnings announcements, and macro headwinds.',
    input_schema: {
      type: 'object' as const,
      properties: {
        ticker: { type: 'string', description: 'Stock ticker symbol' },
        limit: {
          type: 'integer',
          description: 'Number of news items to return. Min 1, max 10. Defaults to 5.',
        },
      },
      required: ['ticker'],
    },
  },
  {
    name: 'getQuote',
    description:
      'Get the latest stock price data including closing price, open, high, low, and volume ' +
      'from the previous trading session.',
    input_schema: {
      type: 'object' as const,
      properties: {
        ticker: { type: 'string', description: 'Stock ticker symbol' },
      },
      required: ['ticker'],
    },
  },
  {
    name: 'compareStocks',
    description:
      'Fetch quote and profile for two tickers in parallel for side-by-side comparison. ' +
      'Use when the user asks to compare two companies.',
    input_schema: {
      type: 'object' as const,
      properties: {
        tickerA: { type: 'string', description: 'First ticker symbol' },
        tickerB: { type: 'string', description: 'Second ticker symbol' },
      },
      required: ['tickerA', 'tickerB'],
    },
  },
  {
    name: 'getFilingContent',
    description:
      'Fetch the text content of a recent SEC EDGAR filing using CIK and accession number. ' +
      'Use after get_recent_filings when you need the actual filing body.',
    input_schema: {
      type: 'object' as const,
      properties: {
        cik: {
          type: 'string',
          description: '10-digit zero-padded CIK from getCompanyProfile',
        },
        accessionNumber: {
          type: 'string',
          description: 'Accession number from get_recent_filings, including dashes',
        },
      },
      required: ['cik', 'accessionNumber'],
    },
  },
]
