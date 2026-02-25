/**
 * Clamp and normalize a confidence score to the 0-100 range.
 * AI models can return values outside this range — this is the safety net.
 */
export function clampConfidenceScore(score: number): number {
  if (Number.isNaN(score)) return 0;
  return Math.round(Math.max(0, Math.min(100, score)));
}
