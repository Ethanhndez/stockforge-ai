import type {
  AnalysisDebugPayload,
  AnalysisExecutionMetadata,
  AnalysisQuality,
  AnalysisTransparency,
  CanonicalAnalysisOutput,
} from '@/lib/ai/analysis-contract'

function uniqueStrings(values: Array<string | undefined | null>): string[] {
  return Array.from(
    new Set(values.filter((value): value is string => Boolean(value && value.trim().length > 0)))
  )
}

function sanitizeDetail(detail: string): string {
  const firstLine = detail
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0) ?? ''

  return firstLine.replace(/\s+/g, ' ').slice(0, 240)
}

export function sanitizeExecutionMetadata(
  metadata: AnalysisExecutionMetadata
): AnalysisExecutionMetadata {
  return {
    ...metadata,
    toolsUsed: [...metadata.toolsUsed],
    toolsFailed: uniqueStrings(metadata.toolsFailed.map(sanitizeDetail)),
  }
}

export function deriveAnalysisQuality(args: {
  canonicalAnalysis: CanonicalAnalysisOutput
  executionMetadata: AnalysisExecutionMetadata
}): AnalysisQuality {
  const { canonicalAnalysis, executionMetadata } = args
  const hasFailures =
    executionMetadata.toolsFailed.length > 0 || canonicalAnalysis.toolErrors.length > 0
  const hasGaps = executionMetadata.hadGaps || canonicalAnalysis.missingData.length > 0

  if (!executionMetadata.validationPassed) {
    return 'limited'
  }

  if (executionMetadata.path === 'fallback' && (hasFailures || hasGaps || executionMetadata.fallbackReason)) {
    return 'limited'
  }

  if (hasFailures || hasGaps || executionMetadata.path === 'fallback') {
    return 'degraded'
  }

  return 'complete'
}

export function buildTransparencySummary(args: {
  canonicalAnalysis: CanonicalAnalysisOutput
  executionMetadata: AnalysisExecutionMetadata
}): AnalysisTransparency {
  const { canonicalAnalysis, executionMetadata } = args

  return {
    dataSourcesUsed: uniqueStrings(canonicalAnalysis.dataSourcesUsed),
    missingData: uniqueStrings(canonicalAnalysis.missingData),
    toolErrors: uniqueStrings([
      ...canonicalAnalysis.toolErrors.map((toolError) =>
        sanitizeDetail(`${toolError.tool} (${toolError.source}): ${toolError.error}`)
      ),
      ...executionMetadata.toolsFailed.map(sanitizeDetail),
    ]),
    analysisQuality: deriveAnalysisQuality({ canonicalAnalysis, executionMetadata }),
  }
}

export function buildAnalysisDebugPayload(args: {
  canonicalAnalysis: CanonicalAnalysisOutput
  executionMetadata: AnalysisExecutionMetadata
}): AnalysisDebugPayload {
  const execution = sanitizeExecutionMetadata(args.executionMetadata)

  return {
    execution,
    transparency: buildTransparencySummary({
      canonicalAnalysis: args.canonicalAnalysis,
      executionMetadata: execution,
    }),
  }
}
