/**
 * Fact-check sync service.
 *
 * Searches for fact-checked claims about French politicians using the
 * Google Fact Check Tools API (ClaimReview standard).
 */

import { db } from "@/lib/db";
import { searchClaims, mapTextualRating, fetchPageTitle } from "@/lib/api";
import { FACTCHECK_RATE_LIMIT_MS } from "@/config/rate-limits";
import { normalizeText, buildPoliticianIndex, findMentions } from "@/lib/name-matching";
import { generateDateSlug } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FactcheckSyncOptions {
  dryRun?: boolean;
  force?: boolean;
  limit?: number;
  politician?: string;
  all?: boolean;
}

export interface FactcheckSyncStats {
  politiciansSearched: number;
  claimsFound: number;
  factChecksCreated: number;
  factChecksSkipped: number;
  mentionsCreated: number;
  apiErrors: number;
  errors: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateUniqueFactCheckSlug(date: Date | null, title: string): Promise<string> {
  const baseSlug = generateDateSlug(date, title);
  let slug = baseSlug;
  let counter = 2;

  while (await db.factCheck.findUnique({ where: { slug } })) {
    const suffix = `-${counter}`;
    const maxBaseLength = 80 - suffix.length;
    const truncatedBase = baseSlug.slice(0, maxBaseLength).replace(/-$/, "");
    slug = `${truncatedBase}${suffix}`;
    counter++;
  }

  return slug;
}

// ---------------------------------------------------------------------------
// Main service
// ---------------------------------------------------------------------------

export async function syncFactchecks(
  options: FactcheckSyncOptions = {}
): Promise<FactcheckSyncStats> {
  const {
    dryRun = false,
    force = false,
    limit,
    politician: politicianFilter,
    all = false,
  } = options;

  const stats: FactcheckSyncStats = {
    politiciansSearched: 0,
    claimsFound: 0,
    factChecksCreated: 0,
    factChecksSkipped: 0,
    mentionsCreated: 0,
    apiErrors: 0,
    errors: [],
  };

  // Build politician index for mention matching
  const allPoliticians = await buildPoliticianIndex();

  // Determine which politicians to search
  let searchTargets: Array<{ id: string; fullName: string }>;

  if (politicianFilter) {
    const normalized = normalizeText(politicianFilter);
    searchTargets = allPoliticians
      .filter(
        (p) =>
          p.normalizedFullName.includes(normalized) || p.normalizedLastName.includes(normalized)
      )
      .map((p) => ({ id: p.id, fullName: p.fullName }));

    if (searchTargets.length === 0) {
      return stats;
    }
  } else if (all) {
    searchTargets = allPoliticians.map((p) => ({ id: p.id, fullName: p.fullName }));
  } else {
    // Default: only politicians with current mandates
    const activePoliticians = await db.politician.findMany({
      where: { mandates: { some: { isCurrent: true } } },
      select: { id: true, fullName: true },
    });
    searchTargets = activePoliticians;
  }

  if (limit) {
    searchTargets = searchTargets.slice(0, limit);
  }

  for (const target of searchTargets) {
    stats.politiciansSearched++;

    try {
      const claims = await searchClaims(target.fullName);
      stats.claimsFound += claims.length;

      for (const claim of claims) {
        for (const review of claim.claimReview) {
          // Check if already exists by URL
          if (!force) {
            const existing = await db.factCheck.findUnique({
              where: { sourceUrl: review.url },
            });
            if (existing) {
              stats.factChecksSkipped++;
              continue;
            }
          }

          // Find all politician mentions in the claim text + title
          const searchText = `${claim.text} ${review.title} ${claim.claimant || ""}`;
          const mentions = findMentions(searchText, allPoliticians);

          // If no politician matched, at least link to the target
          if (mentions.length === 0) {
            mentions.push({
              politicianId: target.id,
              matchedName: target.fullName,
            });
          }

          const verdictRating = mapTextualRating(review.textualRating);
          const reviewDate = review.reviewDate ? new Date(review.reviewDate) : new Date();

          // Fetch full title from source page when Google API truncates it
          let title = review.title;
          if (title.endsWith("...") || title.endsWith("…")) {
            title = await fetchPageTitle(review.url, title);
          }

          if (dryRun) {
            stats.factChecksCreated++;
            stats.mentionsCreated += mentions.length;
          } else {
            try {
              if (force) {
                await db.factCheck.upsert({
                  where: { sourceUrl: review.url },
                  update: {
                    claimText: claim.text,
                    claimant: claim.claimant || null,
                    title,
                    verdict: review.textualRating,
                    verdictRating,
                    source: review.publisher.name,
                    publishedAt: reviewDate,
                    claimDate: claim.claimDate ? new Date(claim.claimDate) : null,
                    languageCode: review.languageCode || null,
                    mentions: {
                      deleteMany: {},
                      create: mentions.map((m) => ({
                        politicianId: m.politicianId,
                        matchedName: m.matchedName,
                      })),
                    },
                  },
                  create: {
                    slug: await generateUniqueFactCheckSlug(reviewDate, title),
                    claimText: claim.text,
                    claimant: claim.claimant || null,
                    title,
                    verdict: review.textualRating,
                    verdictRating,
                    source: review.publisher.name,
                    sourceUrl: review.url,
                    publishedAt: reviewDate,
                    claimDate: claim.claimDate ? new Date(claim.claimDate) : null,
                    languageCode: review.languageCode || null,
                    mentions: {
                      create: mentions.map((m) => ({
                        politicianId: m.politicianId,
                        matchedName: m.matchedName,
                      })),
                    },
                  },
                });
              } else {
                await db.factCheck.create({
                  data: {
                    slug: await generateUniqueFactCheckSlug(reviewDate, title),
                    claimText: claim.text,
                    claimant: claim.claimant || null,
                    title,
                    verdict: review.textualRating,
                    verdictRating,
                    source: review.publisher.name,
                    sourceUrl: review.url,
                    publishedAt: reviewDate,
                    claimDate: claim.claimDate ? new Date(claim.claimDate) : null,
                    languageCode: review.languageCode || null,
                    mentions: {
                      create: mentions.map((m) => ({
                        politicianId: m.politicianId,
                        matchedName: m.matchedName,
                      })),
                    },
                  },
                });
              }

              stats.factChecksCreated++;
              stats.mentionsCreated += mentions.length;
            } catch (error) {
              if (error instanceof Error && error.message.includes("Unique constraint")) {
                stats.factChecksSkipped++;
              } else {
                throw error;
              }
            }
          }
        }
      }
    } catch (error) {
      stats.apiErrors++;
      stats.errors.push(`Error searching "${target.fullName}": ${error}`);
    }

    // Rate limiting between politician searches
    await sleep(FACTCHECK_RATE_LIMIT_MS);
  }

  return stats;
}
