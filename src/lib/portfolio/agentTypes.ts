import type {
  FundamentalsResult as FundamentalsData,
  NewsItem,
  QuoteResult as QuoteData,
} from '@/lib/tools'

export interface ResearchSummary {
  ticker: string
  quote: QuoteData | null
  fundamentals: FundamentalsData | null
  news: NewsItem[]
  bull_case: string
  bear_case: string
  key_risks: string[]
  dataGaps: string[]
  fetchedAt: string
  dataSources: string[]
}

export interface DriftItem {
  ticker: string
  currentWeight: number
  targetWeight: number
  driftAmount: number
}

export interface PolicyViolation {
  rule: string
  description: string
  severity: 'hard' | 'soft'
}

export interface QualityFlag {
  ticker: string
  flag: string
  source: string
}

export interface PolicyAssessment {
  allocationDrift: DriftItem[]
  policyViolations: PolicyViolation[]
  qualityFlags: QualityFlag[]
  overallStatus: 'healthy' | 'attention_needed' | 'action_required'
  assessedAt: string
}

export interface ConcentrationRisk {
  ticker: string
  weight: number
  threshold: number
  description: string
}

export interface SectorRisk {
  sector: string
  weight: number
  threshold: number
  description: string
}

export interface PortfolioRiskReport {
  concentrationRisks: ConcentrationRisk[]
  sectorRisks: SectorRisk[]
  cashDriftWarning: boolean
  overallRiskLevel: 'low' | 'moderate' | 'elevated' | 'high'
  riskNotes: string[]
  assessedAt: string
}

export interface ProposedTrade {
  ticker: string
  action: 'buy' | 'sell'
  targetShares: number
  targetValue: number
  reason: string
  dataSource: string
}

export interface RebalanceProposal {
  proposedTrades: ProposedTrade[]
  justification: string
  expectedOutcome: string
  risks: string[]
  dataSources: string[]
  confidenceLevel: 'high' | 'moderate' | 'low'
  confidenceNotes: string
  proposedAt: string
}

export interface DecisionLogEntry {
  userId: string
  portfolioId: string
  holdingsSnapshot: object[]
  policiesSnapshot: object[]
  researchSummaries: ResearchSummary[] | null
  policyAssessment: PolicyAssessment | null
  riskReport: PortfolioRiskReport | null
  proposal: RebalanceProposal | null
  proposalStatus: 'pending' | 'accepted' | 'rejected' | 'expired'
  agentMode: string
  errorLog: object[] | null
}
