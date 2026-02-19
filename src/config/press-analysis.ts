/**
 * Press analysis configuration constants.
 */

/**
 * Minimum confidence score (0-100) for creating a new affair from press analysis.
 * Detections below this threshold are rejected and logged to PressAnalysisRejection.
 *
 * Score guide (from AI prompt):
 * - 90-100: politician explicitly named as defendant/convicted
 * - 70-89: strongly linked but role not 100% explicit
 * - 50-69: ambiguous mention
 * - 0-49: likely just mentioned, not involved
 */
export const MIN_CONFIDENCE_THRESHOLD = 50;
