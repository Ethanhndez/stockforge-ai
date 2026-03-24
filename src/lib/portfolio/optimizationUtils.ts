export interface PriceBar {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

function mean(values: number[]): number {
  if (values.length === 0) {
    return 0
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length
}

export function computeReturnsFromBars(bars: PriceBar[]): number[] {
  if (bars.length < 2) {
    return []
  }

  const returns: number[] = []

  for (let index = 1; index < bars.length; index += 1) {
    const previousClose = bars[index - 1]?.close
    const currentClose = bars[index]?.close

    if (
      typeof previousClose !== 'number' ||
      typeof currentClose !== 'number' ||
      previousClose <= 0 ||
      currentClose <= 0
    ) {
      continue
    }

    returns.push(Math.log(currentClose / previousClose))
  }

  return returns
}

export function computeCovarianceMatrix(returnSeries: number[][]): number[][] {
  const normalizedSeries = returnSeries.map((series) => series.filter((value) => Number.isFinite(value)))
  const sampleLength = Math.min(...normalizedSeries.map((series) => series.length))

  if (!Number.isFinite(sampleLength) || sampleLength <= 1) {
    return normalizedSeries.map(() => normalizedSeries.map(() => 0))
  }

  const alignedSeries = normalizedSeries.map((series) => series.slice(series.length - sampleLength))
  const means = alignedSeries.map((series) => mean(series))

  return alignedSeries.map((leftSeries, leftIndex) =>
    alignedSeries.map((rightSeries, rightIndex) => {
      let covariance = 0

      for (let index = 0; index < sampleLength; index += 1) {
        covariance +=
          (leftSeries[index] - means[leftIndex]) *
          (rightSeries[index] - means[rightIndex])
      }

      return covariance / (sampleLength - 1)
    })
  )
}

export function computeExpectedReturns(returnSeries: number[][]): number[] {
  const tradingDaysPerYear = 252

  return returnSeries.map((series) => {
    const normalizedSeries = series.filter((value) => Number.isFinite(value))

    if (normalizedSeries.length === 0) {
      return 0
    }

    return mean(normalizedSeries) * tradingDaysPerYear
  })
}
