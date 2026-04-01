import type { ProofScenarioFixture } from '@/lib/proof/types'

function buildEquityCurve(args: {
  dates: string[]
  portfolioValues: number[]
  benchmarkValues: number[]
  cashValues: number[]
  grossExposureValues: number[]
}) {
  return args.dates.map((date, index) => ({
    date,
    portfolioValue: args.portfolioValues[index],
    benchmarkValue: args.benchmarkValues[index],
    cash: args.cashValues[index],
    grossExposure: args.grossExposureValues[index],
  }))
}

export const PROOF_SCENARIO_FIXTURES: ProofScenarioFixture[] = [
  {
    window: {
      id: 'bear-2022-stress',
      label: '2022 Drawdown Stress Window',
      marketRegime: 'bear',
      startDate: '2022-01-03',
      endDate: '2022-12-30',
      benchmarkTicker: 'SPY',
      thesis:
        'The agent should defend capital better than passive SPY exposure during a rate-driven drawdown without collapsing proposal quality.',
    },
    methodology: {
      noLookaheadEnforced: true,
      benchmarkTicker: 'SPY',
      rebalanceCadence: 'event_driven',
      riskFreeRateAnnual: 0.02,
      priceSource: 'Polygon.io historical daily aggregates',
      notes: [
        'Fixture is deterministic and internal-only.',
        'Proposal snapshots represent accepted paper actions only.',
        'Window is intended to validate drawdown control before any live proof claims exist.',
      ],
    },
    equityCurve: buildEquityCurve({
      dates: [
        '2022-01-03',
        '2022-02-01',
        '2022-03-01',
        '2022-04-01',
        '2022-05-02',
        '2022-06-01',
        '2022-07-01',
        '2022-08-01',
        '2022-09-01',
        '2022-10-03',
        '2022-11-01',
        '2022-12-01',
        '2022-12-30',
      ],
      portfolioValues: [100000, 99500, 98800, 97800, 96500, 95100, 95900, 96800, 95600, 97200, 98800, 100100, 102400],
      benchmarkValues: [100000, 97200, 95500, 94200, 91500, 89600, 92400, 93300, 90100, 91800, 94400, 96300, 98100],
      cashValues: [12000, 11800, 12100, 12600, 13100, 13700, 12900, 12400, 13200, 12500, 11900, 11300, 10800],
      grossExposureValues: [88000, 87700, 86700, 85200, 83400, 81400, 83000, 84400, 82400, 84700, 86900, 88800, 91600],
    }),
    decisions: [
      {
        date: '2022-03-01',
        decisionId: 'proof-bear-001',
        proposalProduced: true,
        holdings: ['AAPL', 'MSFT', 'CASH'],
        notes: ['Reduced gross exposure after deterioration in risk posture.'],
      },
      {
        date: '2022-06-01',
        decisionId: 'proof-bear-002',
        proposalProduced: true,
        holdings: ['AAPL', 'MSFT', 'XLE', 'CASH'],
        notes: ['Rotated part of growth allocation into relative-strength energy exposure.'],
      },
      {
        date: '2022-10-03',
        decisionId: 'proof-bear-003',
        proposalProduced: true,
        holdings: ['AAPL', 'MSFT', 'XLE', 'NVDA', 'CASH'],
        notes: ['Added risk selectively after drawdown stabilized.'],
      },
      {
        date: '2022-12-01',
        decisionId: 'proof-bear-004',
        proposalProduced: false,
        holdings: ['AAPL', 'MSFT', 'XLE', 'NVDA', 'CASH'],
        notes: ['No action; portfolio remained inside risk thresholds.'],
      },
    ],
  },
  {
    window: {
      id: 'bull-2023-2024-validation',
      label: '2023-2024 Bull Recovery Window',
      marketRegime: 'bull',
      startDate: '2023-01-03',
      endDate: '2024-12-31',
      benchmarkTicker: 'SPY',
      thesis:
        'The agent should participate in upside with positive alpha and strong risk-adjusted returns, not just outperform by sitting in cash.',
    },
    methodology: {
      noLookaheadEnforced: true,
      benchmarkTicker: 'SPY',
      rebalanceCadence: 'event_driven',
      riskFreeRateAnnual: 0.03,
      priceSource: 'Polygon.io historical daily aggregates',
      notes: [
        'Fixture is deterministic and intended to validate upside capture and proposal quality.',
        'Bull window complements the 2022 stress fixture so both market regimes are represented from day one.',
      ],
    },
    equityCurve: buildEquityCurve({
      dates: [
        '2023-01-03',
        '2023-03-01',
        '2023-05-01',
        '2023-07-03',
        '2023-09-01',
        '2023-11-01',
        '2024-01-02',
        '2024-03-01',
        '2024-05-01',
        '2024-07-01',
        '2024-09-03',
        '2024-11-01',
        '2024-12-31',
      ],
      portfolioValues: [100000, 106500, 111800, 118900, 116700, 124100, 130800, 138600, 145900, 152400, 149600, 158700, 166400],
      benchmarkValues: [100000, 104100, 108400, 113600, 112000, 118400, 124600, 130200, 136100, 141900, 139800, 147100, 153600],
      cashValues: [9000, 8600, 8200, 7800, 8000, 7600, 7200, 6900, 6600, 6400, 6600, 6200, 5900],
      grossExposureValues: [91000, 97900, 103600, 111100, 108700, 116500, 123600, 131700, 139300, 146000, 143000, 152500, 160500],
    }),
    decisions: [
      {
        date: '2023-03-01',
        decisionId: 'proof-bull-001',
        proposalProduced: true,
        holdings: ['AAPL', 'MSFT', 'NVDA', 'CASH'],
        notes: ['Added high-conviction AI infrastructure exposure after research strength improved.'],
      },
      {
        date: '2023-11-01',
        decisionId: 'proof-bull-002',
        proposalProduced: false,
        holdings: ['AAPL', 'MSFT', 'NVDA', 'CASH'],
        notes: ['No action; concentration remained inside policy bounds.'],
      },
      {
        date: '2024-03-01',
        decisionId: 'proof-bull-003',
        proposalProduced: true,
        holdings: ['AAPL', 'MSFT', 'NVDA', 'AMZN', 'CASH'],
        notes: ['Expanded portfolio breadth after fundamentals and sentiment both improved.'],
      },
      {
        date: '2024-09-03',
        decisionId: 'proof-bull-004',
        proposalProduced: true,
        holdings: ['AAPL', 'MSFT', 'NVDA', 'AMZN', 'META', 'CASH'],
        notes: ['Trimmed cash and rotated into software/platform exposure on positive breadth.'],
      },
    ],
  },
]
