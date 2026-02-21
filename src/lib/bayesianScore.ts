/**
 * Bayesian average (IMDb-style weighted score).
 *
 * Blends an individual's observed proportion with the global average,
 * weighted by sample size. With few observations, the score tends toward
 * the global mean; with many, it tends toward the observed proportion.
 *
 * @param observed - The individual's observed proportion (0-1)
 * @param sampleSize - Number of observations (fact-checks)
 * @param globalMean - Global average proportion across all entities
 * @param prior - Weight of the prior (default 10). Higher = more smoothing.
 * @returns Weighted score (0-1)
 */
export function bayesianScore(
  observed: number,
  sampleSize: number,
  globalMean: number,
  prior: number = 10
): number {
  if (sampleSize + prior === 0) return 0;
  return (prior * globalMean + sampleSize * observed) / (prior + sampleSize);
}
