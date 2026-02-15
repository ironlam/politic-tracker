/**
 * Google Fact Check Tools API client
 *
 * Uses the ClaimReview standard to search for fact-checks from recognized sources.
 * API docs: https://developers.google.com/fact-check/tools/api/reference/rest
 */

import type { FactCheckRating } from "@/generated/prisma";
import { FACTCHECK_RATE_LIMIT_MS } from "@/config/rate-limits";

const API_BASE = "https://factchecktools.googleapis.com/v1alpha1/claims:search";

export interface FactCheckClaim {
  text: string;
  claimant?: string;
  claimDate?: string;
  claimReview: FactCheckClaimReview[];
}

export interface FactCheckClaimReview {
  publisher: {
    name: string;
    site?: string;
  };
  url: string;
  title: string;
  reviewDate?: string;
  textualRating: string;
  languageCode?: string;
}

export interface FactCheckSearchResponse {
  claims?: FactCheckClaim[];
  nextPageToken?: string;
}

export interface SearchClaimsOptions {
  languageCode?: string;
  pageSize?: number;
  maxPages?: number;
}

/**
 * Search for fact-checked claims via Google Fact Check Tools API
 */
export async function searchClaims(
  query: string,
  options: SearchClaimsOptions = {}
): Promise<FactCheckClaim[]> {
  const apiKey = process.env.GOOGLE_FACTCHECK_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_FACTCHECK_API_KEY is not set");
  }

  const { languageCode = "fr", pageSize = 100, maxPages = 3 } = options;
  const allClaims: FactCheckClaim[] = [];
  let pageToken: string | undefined;
  let pageCount = 0;

  while (pageCount < maxPages) {
    const params = new URLSearchParams({
      query,
      languageCode,
      pageSize: String(pageSize),
      key: apiKey,
    });
    if (pageToken) {
      params.set("pageToken", pageToken);
    }

    const url = `${API_BASE}?${params.toString()}`;
    const response = await fetch(url);

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Google Fact Check API error ${response.status}: ${text}`);
    }

    const data: FactCheckSearchResponse = await response.json();

    if (data.claims) {
      allClaims.push(...data.claims);
    }

    pageToken = data.nextPageToken;
    pageCount++;

    if (!pageToken) break;

    // Rate limiting between pages
    await sleep(FACTCHECK_RATE_LIMIT_MS);
  }

  return allClaims;
}

/**
 * Map a textual rating from fact-check sources to a normalized FactCheckRating.
 *
 * Sources use various formats: "Faux", "False", "Mostly False", "Plutôt vrai", etc.
 * This function handles French and English ratings.
 */
export function mapTextualRating(text: string): FactCheckRating {
  const lower = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

  // FALSE
  if (
    lower === "faux" ||
    lower === "false" ||
    lower === "fake" ||
    lower === "infonde" ||
    lower === "inexact" ||
    lower === "non" ||
    lower === "totalement faux"
  ) {
    return "FALSE";
  }

  // MOSTLY_FALSE
  if (
    lower.includes("plutot faux") ||
    lower.includes("mostly false") ||
    lower.includes("en grande partie faux") ||
    lower.includes("largely false") ||
    lower === "exagere"
  ) {
    return "MOSTLY_FALSE";
  }

  // MISLEADING
  if (
    lower.includes("trompeur") ||
    lower.includes("misleading") ||
    lower.includes("manipule") ||
    lower.includes("detourne") ||
    lower.includes("deformé")
  ) {
    return "MISLEADING";
  }

  // OUT_OF_CONTEXT
  if (
    lower.includes("hors contexte") ||
    lower.includes("out of context") ||
    lower.includes("sorti de son contexte") ||
    lower.includes("contexte manquant")
  ) {
    return "OUT_OF_CONTEXT";
  }

  // HALF_TRUE
  if (
    lower.includes("partiellement vrai") ||
    lower.includes("half true") ||
    lower.includes("en partie vrai") ||
    lower.includes("partially true") ||
    lower.includes("mixture") ||
    lower.includes("a nuancer") ||
    lower === "imprecis" ||
    lower.includes("pas tout a fait")
  ) {
    return "HALF_TRUE";
  }

  // MOSTLY_TRUE
  if (
    lower.includes("plutot vrai") ||
    lower.includes("mostly true") ||
    lower.includes("en grande partie vrai") ||
    lower.includes("largely true")
  ) {
    return "MOSTLY_TRUE";
  }

  // TRUE
  if (
    lower === "vrai" ||
    lower === "true" ||
    lower === "correct" ||
    lower === "exact" ||
    lower === "oui" ||
    lower === "confirme"
  ) {
    return "TRUE";
  }

  // UNVERIFIABLE (default fallback)
  return "UNVERIFIABLE";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
