import { z } from 'zod'

export const analysisMetricSchema = z.object({
  name: z.string().min(1),
  value: z.string().min(1),
  interpretation: z.string().min(1),
})

export const fundamentalAnalysisSchema = z.object({
  summary: z.string().min(1),
  valuationView: z.string().min(1),
  qualityView: z.string().min(1),
  metrics: z.array(analysisMetricSchema).default([]),
  strengths: z.array(z.string().min(1)).default([]),
  risks: z.array(z.string().min(1)).default([]),
  dataGaps: z.array(z.string().min(1)).default([]),
})

export const technicalAnalysisSchema = z.object({
  summary: z.string().min(1),
  trendView: z.string().min(1),
  momentumView: z.string().min(1),
  metrics: z.array(analysisMetricSchema).default([]),
  strengths: z.array(z.string().min(1)).default([]),
  risks: z.array(z.string().min(1)).default([]),
  dataGaps: z.array(z.string().min(1)).default([]),
})

export const sentimentAnalysisSchema = z.object({
  summary: z.string().min(1),
  sentimentView: z.string().min(1),
  filingsView: z.string().min(1),
  metrics: z.array(analysisMetricSchema).default([]),
  strengths: z.array(z.string().min(1)).default([]),
  risks: z.array(z.string().min(1)).default([]),
  dataGaps: z.array(z.string().min(1)).default([]),
})

const synthesisCaseSchema = z.object({
  headline: z.string().min(1),
  points: z.array(z.string().min(1)).default([]),
  plainEnglish: z.string().min(1),
})

const researchPostureSchema = z.object({
  ticker: z.string().min(1),
  bull_case: z.string().min(1),
  bear_case: z.string().min(1),
  key_risks: z.array(z.string().min(1)).default([]),
  data_gaps: z.array(z.string().min(1)).default([]),
  rag_sources: z.array(z.string().min(1)).default([]),
  fetchedAt: z.string().min(1),
})

export const synthesisPayloadSchema = z.object({
  companyName: z.string().min(1),
  ticker: z.string().min(1),
  analysisDate: z.string().min(1),
  executiveSummary: z.string().min(1),
  analystBrief: z.string().min(1),
  industryContext: z.string().min(1),
  financialSnapshot: z.object({
    revenue: z.string().min(1),
    netIncome: z.string().min(1),
    operatingMargin: z.string().min(1),
    totalAssets: z.string().min(1),
    debtLoad: z.string().min(1),
    cashPosition: z.string().min(1),
    revenueGrowthNote: z.string().min(1),
    epsNote: z.string().min(1),
  }),
  bullCase: synthesisCaseSchema,
  bearCase: synthesisCaseSchema,
  keyRisks: z.array(z.string().min(1)).default([]),
  recentNewsImpact: z.string().min(1),
  earningsQuality: z.string().min(1),
  data_sources: z.array(z.string().min(1)).default([]),
  researchPosture: researchPostureSchema,
})

export type AnalysisMetric = z.infer<typeof analysisMetricSchema>
export type FundamentalAnalysis = z.infer<typeof fundamentalAnalysisSchema>
export type TechnicalAnalysis = z.infer<typeof technicalAnalysisSchema>
export type SentimentAnalysis = z.infer<typeof sentimentAnalysisSchema>
export type SynthesisPayload = z.infer<typeof synthesisPayloadSchema>
