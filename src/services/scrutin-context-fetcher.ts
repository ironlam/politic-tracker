/**
 * Enriched context fetcher for scrutin citizen impact generation.
 *
 * Gathers context from two sources:
 * 1. LegislativeDossier DB matching (fast, reliable) — extracts law name from scrutin title
 * 2. SourceUrl scraping (slow, optional) — fetches HTML from AN/Sénat pages via Readability
 */

import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import { HTTPClient } from "@/lib/api/http-client";

const SCRAPE_MAX_CHARS = 2000;
const SCRAPE_TIMEOUT_MS = 10_000;
const SCRAPE_RATE_LIMIT_MS = 2000;

export interface ScrutinEnrichedContext {
  dossierTitle: string | null;
  dossierSummary: string | null;
  dossierSlug: string | null;
  sourcePageText: string | null;
}

// Reusable HTTP client for source page scraping
const scrapeClient = new HTTPClient({
  rateLimitMs: SCRAPE_RATE_LIMIT_MS,
  timeout: SCRAPE_TIMEOUT_MS,
  retries: 1,
  headers: {
    Accept: "text/html,application/xhtml+xml",
  },
  sourceName: "Scrutin sourceUrl scraper",
});

/**
 * Fetch enriched context for a scrutin from multiple sources.
 */
export async function fetchScrutinContext(
  title: string,
  sourceUrl: string | null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  options?: { skipScrape?: boolean; dossierLegislatifId?: string | null }
): Promise<ScrutinEnrichedContext> {
  const result: ScrutinEnrichedContext = {
    dossierTitle: null,
    dossierSummary: null,
    dossierSlug: null,
    sourcePageText: null,
  };

  // 1. Prefer FK-linked dossier (reliable), fallback to title matching (fuzzy)
  if (options?.dossierLegislatifId) {
    const dossier = await db.legislativeDossier.findUnique({
      where: { id: options.dossierLegislatifId },
      select: { title: true, summary: true, slug: true },
    });
    if (dossier) {
      result.dossierTitle = dossier.title;
      result.dossierSummary = dossier.summary;
      result.dossierSlug = dossier.slug;
    }
  } else {
    const lawFragment = extractLawFragment(title);
    if (lawFragment) {
      const dossier = await findDossierByTitle(db, lawFragment);
      if (dossier) {
        result.dossierTitle = dossier.title;
        result.dossierSummary = dossier.summary;
        result.dossierSlug = dossier.slug;
      }
    }
  }

  // 2. Scrape sourceUrl (optional, slow)
  if (!options?.skipScrape && sourceUrl) {
    result.sourcePageText = await scrapeSourceUrl(sourceUrl);
  }

  return result;
}

/**
 * Extract the law/bill name fragment from a scrutin title.
 *
 * Examples:
 *   "l'amendement n° 36 ... du projet de loi relatif à la lutte contre les fraudes"
 *   → "projet de loi relatif à la lutte contre les fraudes"
 *
 *   "l'ensemble du projet de loi de finances pour 2025"
 *   → "projet de loi de finances pour 2025"
 *
 *   "la motion de rejet préalable du texte de la proposition de loi visant à..."
 *   → "proposition de loi visant à..."
 */
export function extractLawFragment(title: string): string | null {
  // Match the law/bill reference pattern
  const patterns = [
    // "du projet de loi ..." / "de la proposition de loi ..."
    /(?:du |de la |de l['']\s*)((?:projet de loi|proposition de loi|texte)(?:\s+(?:organique|constitutionnel(?:le)?|de finances|de programmation))?\s+(?:relatif|portant|visant|tendant|pour|autorisant|habilitant|de\s).+)/i,
    // "l'ensemble du projet de loi ..." (article/whole text votes)
    /(?:l['']\s*ensemble\s+(?:du |de la |de l['']\s*))((?:projet de loi|proposition de loi).+)/i,
    // Direct match: "projet de loi ..."
    /^((?:projet de loi|proposition de loi)\s+(?:relatif|portant|visant|tendant|pour|de\s).+)/i,
  ];

  for (const pattern of patterns) {
    const match = title.match(pattern);
    if (match?.[1]) {
      // Clean up: remove trailing parentheticals, extra whitespace
      let fragment = match[1].trim();
      fragment = fragment.replace(/\s*\([^)]*\)\s*$/, "").trim();
      // Truncate very long fragments (take first meaningful chunk)
      if (fragment.length > 150) {
        fragment = fragment.slice(0, 150);
      }
      return fragment;
    }
  }

  return null;
}

/**
 * Find a LegislativeDossier matching a law title fragment.
 */
async function findDossierByTitle(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  fragment: string
): Promise<{ title: string; summary: string | null; slug: string | null } | null> {
  // Extract keywords (skip very short/common words)
  const keywords = fragment
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .filter(
      (w) =>
        ![
          "projet",
          "proposition",
          "relatif",
          "relatifs",
          "relative",
          "relatives",
          "portant",
          "visant",
          "tendant",
          "pour",
          "dans",
          "avec",
          "article",
          "texte",
          "code",
          "titre",
          "chapitre",
          "lutte",
          "lutter",
          "contre",
          "entre",
          "cette",
          "leurs",
          "toute",
          "tout",
          "plus",
          "aussi",
        ].includes(w)
    )
    .slice(0, 5); // Take first 5 meaningful keywords

  if (keywords.length === 0) return null;

  // Use the longest keyword for the DB query (most discriminating)
  const searchKeyword = keywords.sort((a, b) => b.length - a.length)[0]!;

  const dossiers = await db.legislativeDossier.findMany({
    where: {
      title: { contains: searchKeyword, mode: "insensitive" },
      summary: { not: null },
    },
    select: { title: true, summary: true, slug: true },
    take: 10,
  });

  // Score matches by keyword overlap — require majority match
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let bestMatch: any = null;
  let bestScore = 0;
  const minScore = Math.max(2, Math.ceil(keywords.length * 0.5));

  for (const dossier of dossiers) {
    const titleLower = dossier.title.toLowerCase();
    const score = keywords.filter((kw) => titleLower.includes(kw)).length;
    if (score > bestScore && score >= minScore) {
      bestScore = score;
      bestMatch = dossier;
    }
  }

  return bestMatch;
}

/**
 * Scrape sourceUrl and extract text content via Readability.
 */
async function scrapeSourceUrl(url: string): Promise<string | null> {
  try {
    const response = await scrapeClient.getText(url);
    if (!response.ok || !response.data) return null;

    const dom = new JSDOM(response.data, { url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();

    if (!article?.textContent || article.textContent.trim().length < 50) {
      return null;
    }

    return article.textContent.replace(/\s+/g, " ").trim().slice(0, SCRAPE_MAX_CHARS);
  } catch {
    // Silently fail — scraping is optional context
    return null;
  }
}
