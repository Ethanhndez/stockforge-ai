export type AnalysisExecutionPath = 'parallel' | 'fallback'
export type AnalysisFallbackReason =
  | 'validation_failed'
  | 'tool_failure'
  | 'timeout'
  | 'parallel_error'

export interface AnalysisClaim {
  statement: string
  sources: string[]
}

export interface AnalysisMetric {
  name: string
  value: string
  source: string
}

export interface AnalysisToolError {
  tool: string
  source: string
  error: string
}

export interface CanonicalAnalysisOutput {
  symbol: string
  companyName: string
  dataSourcesUsed: string[]
  bullCase: AnalysisClaim[]
  bearCase: AnalysisClaim[]
  keyMetrics: AnalysisMetric[]
  risks: AnalysisClaim[]
  missingData: string[]
  toolErrors: AnalysisToolError[]
  executionPath: AnalysisExecutionPath
}

export interface AnalysisExecutionMetadata {
  path: AnalysisExecutionPath
  fallbackReason?: AnalysisFallbackReason
  toolsUsed: string[]
  toolsFailed: string[]
  hadGaps: boolean
  validationPassed: boolean
}

export type AnalysisQuality = 'complete' | 'degraded' | 'limited'

export interface AnalysisTransparency {
  dataSourcesUsed: string[]
  missingData: string[]
  toolErrors: string[]
  analysisQuality: AnalysisQuality
}

export interface AnalysisDebugPayload {
  execution: AnalysisExecutionMetadata
  transparency: AnalysisTransparency
}

export interface FinancialSnapshot {
  revenue: string
  netIncome: string
  operatingMargin: string
  totalAssets: string
  debtLoad: string
  cashPosition: string
  revenueGrowthNote?: string
  epsNote?: string
}

export interface CaseAnalysis {
  headline: string
  points: string[]
  plainEnglish: string
}

export interface ResearchPosture {
  ticker: string
  bull_case: string
  bear_case: string
  key_risks: string[]
  data_gaps: string[]
  rag_sources?: string[]
  fetchedAt: string
}

export interface AnalysisResponse {
  companyName: string
  ticker: string
  analysisDate: string
  executiveSummary: string
  analystBrief: string
  industryContext: string
  financialSnapshot: FinancialSnapshot
  bullCase: CaseAnalysis
  bearCase: CaseAnalysis
  keyRisks: string[]
  recentNewsImpact: string
  earningsQuality: string
  data_sources: string[]
  researchPosture: ResearchPosture
  canonicalAnalysis?: CanonicalAnalysisOutput
  debug?: AnalysisDebugPayload
}
