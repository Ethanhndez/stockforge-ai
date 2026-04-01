import type {
  AnalysisClaim,
  AnalysisExecutionPath,
  AnalysisMetric,
  AnalysisResponse,
  AnalysisToolError,
  CanonicalAnalysisOutput,
  ResearchPosture,
} from '@/lib/ai/analysis-contract'

export interface AnalysisValidationResult {
  ok: boolean
  errors: string[]
  warnings: string[]
}

const RECOMMENDATION_LANGUAGE_PATTERNS = [
  /\bstrong buy\b/i,
  /\bstrong sell\b/i,
  /\bbuy\b/i,
  /\bsell\b/i,
  /\bhold\b/i,
  /\bprice target\b/i,
  /\btarget price\b/i,
  /\bshould purchase\b/i,
  /\bshould exit\b/i,
  /\baccumulate\b/i,
  /\badd to (?:your |the )?position\b/i,
  /\btrim (?:your |the )?position\b/i,
  /\benter (?:the )?position\b/i,
  /\bexit (?:the )?position\b/i,
]

const VALID_EXECUTION_PATHS: AnalysisExecutionPath[] = ['parallel', 'fallback']

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function validateClaimArray(
  claims: unknown,
  label: string,
  errors: string[],
  warnings: string[]
): void {
  if (!Array.isArray(claims)) {
    errors.push(`${label} must be an array.`)
    return
  }

  if (claims.length === 0) {
    errors.push(`${label} must contain at least one claim.`)
    return
  }

  claims.forEach((claim, index) => {
    if (!isPlainObject(claim)) {
      errors.push(`${label}[${index}] must be an object.`)
      return
    }

    if (!isNonEmptyString(claim.statement)) {
      errors.push(`${label}[${index}].statement must be a non-empty string.`)
    }

    if (!Array.isArray(claim.sources)) {
      errors.push(`${label}[${index}].sources must be an array.`)
      return
    }

    if (claim.sources.length === 0) {
      warnings.push(`${label}[${index}] has no explicit sources.`)
      return
    }

    if (
      claim.sources.some((source) => typeof source !== 'string' || source.trim().length === 0)
    ) {
      errors.push(`${label}[${index}].sources must only contain non-empty strings.`)
    }
  })
}

function validateMetricArray(metrics: unknown, errors: string[]): void {
  if (!Array.isArray(metrics)) {
    errors.push('keyMetrics must be an array.')
    return
  }

  metrics.forEach((metric, index) => {
    if (!isPlainObject(metric)) {
      errors.push(`keyMetrics[${index}] must be an object.`)
      return
    }

    if (!isNonEmptyString(metric.name)) {
      errors.push(`keyMetrics[${index}].name must be a non-empty string.`)
    }

    if (!isNonEmptyString(metric.value)) {
      errors.push(`keyMetrics[${index}].value must be a non-empty string.`)
    }

    if (!isNonEmptyString(metric.source)) {
      warningsPushUnique(errors, `keyMetrics[${index}].source must be a non-empty string.`)
    }
  })
}

function warningsPushUnique(list: string[], message: string): void {
  if (!list.includes(message)) {
    list.push(message)
  }
}

function validateToolErrors(toolErrors: unknown, errors: string[]): void {
  if (!Array.isArray(toolErrors)) {
    errors.push('toolErrors must be an array.')
    return
  }

  toolErrors.forEach((toolError, index) => {
    if (!isPlainObject(toolError)) {
      errors.push(`toolErrors[${index}] must be an object.`)
      return
    }

    if (!isNonEmptyString(toolError.tool)) {
      errors.push(`toolErrors[${index}].tool must be a non-empty string.`)
    }

    if (!isNonEmptyString(toolError.source)) {
      errors.push(`toolErrors[${index}].source must be a non-empty string.`)
    }

    if (!isNonEmptyString(toolError.error)) {
      errors.push(`toolErrors[${index}].error must be a non-empty string.`)
    }
  })
}

function validateStringArray(
  value: unknown,
  label: string,
  errors: string[],
  warnings: string[],
  options?: { warnIfEmpty?: boolean }
): void {
  if (!Array.isArray(value)) {
    errors.push(`${label} must be an array.`)
    return
  }

  if (value.some((item) => typeof item !== 'string')) {
    errors.push(`${label} must only contain strings.`)
  }

  if (options?.warnIfEmpty && value.length === 0) {
    warnings.push(`${label} is empty; source attribution is incomplete.`)
  }
}

function collectRecommendationText(analysis: CanonicalAnalysisOutput): string[] {
  return [
    analysis.symbol,
    analysis.companyName,
    ...analysis.bullCase.map((claim) => claim.statement),
    ...analysis.bearCase.map((claim) => claim.statement),
    ...analysis.risks.map((claim) => claim.statement),
    ...analysis.keyMetrics.map((metric) => `${metric.name} ${metric.value}`),
    ...analysis.missingData,
    ...analysis.toolErrors.map((toolError) => toolError.error),
    ...analysis.dataSourcesUsed,
  ]
}

export function validateCanonicalAnalysis(
  analysis: CanonicalAnalysisOutput
): AnalysisValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (!isPlainObject(analysis)) {
    return {
      ok: false,
      errors: ['canonical analysis must be an object.'],
      warnings,
    }
  }

  if (!isNonEmptyString(analysis.symbol)) {
    errors.push('symbol is required.')
  }

  if (!isNonEmptyString(analysis.companyName)) {
    errors.push('companyName is required.')
  }

  if (!isNonEmptyString(analysis.executionPath)) {
    errors.push('executionPath is required.')
  } else if (
    !VALID_EXECUTION_PATHS.includes(analysis.executionPath as AnalysisExecutionPath)
  ) {
    errors.push('executionPath must be either "parallel" or "fallback".')
  }

  validateClaimArray(analysis.bullCase, 'bullCase', errors, warnings)
  validateClaimArray(analysis.bearCase, 'bearCase', errors, warnings)
  validateClaimArray(analysis.risks, 'risks', errors, warnings)
  validateMetricArray(analysis.keyMetrics, errors)
  validateStringArray(analysis.missingData, 'missingData', errors, warnings)
  validateToolErrors(analysis.toolErrors, errors)
  validateStringArray(analysis.dataSourcesUsed, 'dataSourcesUsed', errors, warnings, {
    warnIfEmpty: true,
  })

  const recommendationHit = collectRecommendationText(analysis).find((text) =>
    RECOMMENDATION_LANGUAGE_PATTERNS.some((pattern) => pattern.test(text))
  )

  if (recommendationHit) {
    errors.push('Recommendation language detected in canonical analysis output.')
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
  }
}

function uniqueStrings(values: Array<string | undefined | null>): string[] {
  return Array.from(
    new Set(values.filter((value): value is string => Boolean(value && value.trim().length > 0)))
  )
}

function claim(statement: string, sources: string[]): AnalysisClaim {
  return {
    statement,
    sources,
  }
}

function metric(name: string, value: string, source: string): AnalysisMetric {
  return { name, value, source }
}

export function buildCanonicalAnalysisFromResponse(args: {
  analysis: AnalysisResponse
  executionPath: AnalysisExecutionPath
  toolErrors?: AnalysisToolError[]
}): CanonicalAnalysisOutput {
  const { analysis, executionPath, toolErrors = [] } = args
  const sources = analysis.data_sources ?? []
  const snapshot = analysis.financialSnapshot
  const metricSource = sources[0] ?? 'Source attribution unavailable'
  const missingData = uniqueStrings([
    ...(analysis.researchPosture?.data_gaps ?? []),
    ...Object.entries(snapshot)
      .filter(([, value]) => typeof value === 'string' && /data unavailable|not available/i.test(value))
      .map(([key]) => `Missing metric: ${key}`),
  ])

  return {
    symbol: analysis.ticker,
    companyName: analysis.companyName,
    dataSourcesUsed: sources,
    bullCase: uniqueStrings([
      analysis.bullCase.headline,
      ...analysis.bullCase.points,
      analysis.bullCase.plainEnglish,
      analysis.researchPosture?.bull_case,
    ]).map((statement) => claim(statement, sources)),
    bearCase: uniqueStrings([
      analysis.bearCase.headline,
      ...analysis.bearCase.points,
      analysis.bearCase.plainEnglish,
      analysis.researchPosture?.bear_case,
    ]).map((statement) => claim(statement, sources)),
    keyMetrics: uniqueStrings([
      snapshot.revenue ? `Revenue|${snapshot.revenue}` : undefined,
      snapshot.netIncome ? `Net Income|${snapshot.netIncome}` : undefined,
      snapshot.operatingMargin ? `Operating Margin|${snapshot.operatingMargin}` : undefined,
      snapshot.totalAssets ? `Total Assets|${snapshot.totalAssets}` : undefined,
      snapshot.cashPosition ? `Cash Position|${snapshot.cashPosition}` : undefined,
      snapshot.epsNote ? `EPS|${snapshot.epsNote}` : undefined,
    ]).map((entry) => {
      const [name, value] = entry.split('|')
      return metric(name, value, metricSource)
    }),
    risks: uniqueStrings([
      ...analysis.keyRisks,
      ...(analysis.researchPosture?.key_risks ?? []),
    ]).map((statement) => claim(statement, sources)),
    missingData,
    toolErrors,
    executionPath,
  }
}

export function buildCanonicalAnalysisFromPosture(args: {
  ticker: string
  companyName: string
  posture: ResearchPosture
  executionPath: AnalysisExecutionPath
  dataSourcesUsed?: string[]
  toolErrors?: AnalysisToolError[]
}): CanonicalAnalysisOutput {
  const dataSourcesUsed = args.dataSourcesUsed ?? []
  const toolErrors = args.toolErrors ?? []

  return {
    symbol: args.ticker,
    companyName: args.companyName,
    dataSourcesUsed,
    bullCase: [claim(args.posture.bull_case, dataSourcesUsed)],
    bearCase: [claim(args.posture.bear_case, dataSourcesUsed)],
    keyMetrics: [],
    risks: (args.posture.key_risks ?? []).map((statement) => claim(statement, dataSourcesUsed)),
    missingData: args.posture.data_gaps ?? [],
    toolErrors,
    executionPath: args.executionPath,
  }
}

export function appendValidationIssuesToAnalysis(args: {
  analysis: AnalysisResponse
  validation: AnalysisValidationResult
}): AnalysisResponse {
  const { analysis, validation } = args
  const validationMessages = [
    ...validation.errors.map((error) => `Canonical validation error: ${error}`),
    ...validation.warnings.map((warning) => `Canonical validation warning: ${warning}`),
  ]

  return {
    ...analysis,
    data_sources: uniqueStrings([...analysis.data_sources, ...validationMessages]),
    researchPosture: {
      ...analysis.researchPosture,
      data_gaps: uniqueStrings([
        ...(analysis.researchPosture?.data_gaps ?? []),
        ...validationMessages,
      ]),
    },
  }
}
