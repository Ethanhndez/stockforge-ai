import type {
  AnalysisExecutionMetadata,
  AnalysisExecutionPath,
  AnalysisFallbackReason,
} from '@/lib/ai/analysis-contract'

export function createExecutionMetadata(
  path: AnalysisExecutionPath
): AnalysisExecutionMetadata {
  return {
    path,
    toolsUsed: [],
    toolsFailed: [],
    hadGaps: false,
    validationPassed: false,
  }
}

export function recordToolUsed(
  metadata: AnalysisExecutionMetadata,
  toolName: string
): void {
  if (!metadata.toolsUsed.includes(toolName)) {
    metadata.toolsUsed.push(toolName)
  }
}

export function recordToolFailure(
  metadata: AnalysisExecutionMetadata,
  toolName: string,
  sourceOrError?: string,
  error?: string
): void {
  recordToolUsed(metadata, toolName)
  const detail = sourceOrError && error
    ? `${toolName} (${sourceOrError}): ${error}`
    : sourceOrError
      ? `${toolName}: ${sourceOrError}`
      : toolName

  if (!metadata.toolsFailed.includes(detail)) {
    metadata.toolsFailed.push(detail)
  }
}

export function recordGaps(
  metadata: AnalysisExecutionMetadata,
  gaps: string[] | undefined
): void {
  if ((gaps ?? []).length > 0) {
    metadata.hadGaps = true
  }
}

export function recordValidation(
  metadata: AnalysisExecutionMetadata,
  passed: boolean
): void {
  metadata.validationPassed = passed
}

export function setFallbackReason(
  metadata: AnalysisExecutionMetadata,
  reason: AnalysisFallbackReason
): void {
  metadata.fallbackReason = reason
}

export function mergeExecutionMetadata(
  base: AnalysisExecutionMetadata,
  incoming: Partial<AnalysisExecutionMetadata> | undefined
): AnalysisExecutionMetadata {
  if (!incoming) return base

  return {
    path: incoming.path ?? base.path,
    fallbackReason: incoming.fallbackReason ?? base.fallbackReason,
    toolsUsed: Array.from(new Set([...base.toolsUsed, ...(incoming.toolsUsed ?? [])])),
    toolsFailed: Array.from(new Set([...base.toolsFailed, ...(incoming.toolsFailed ?? [])])),
    hadGaps: base.hadGaps || Boolean(incoming.hadGaps),
    validationPassed: incoming.validationPassed ?? base.validationPassed,
  }
}

export function detectFallbackReason(error: unknown): AnalysisFallbackReason {
  const message = error instanceof Error ? error.message : String(error)

  if (/validation failed/i.test(message)) {
    return 'validation_failed'
  }

  if (/timeout/i.test(message)) {
    return 'timeout'
  }

  if (/lookup failed|fetch failed|HTTP|No .* data|SEC returned|Polygon returned/i.test(message)) {
    return 'tool_failure'
  }

  return 'parallel_error'
}

export function logExecutionMetadata(
  label: string,
  metadata: AnalysisExecutionMetadata
): void {
  console.info(`[${label}] execution`, JSON.stringify(metadata))
}
