/**
 * CLI script to sync fact-checks from Google Fact Check Tools API
 *
 * Searches for fact-checked claims mentioning French politicians and stores them.
 *
 * Usage:
 *   npm run sync:factchecks                    # Sync active politicians
 *   npm run sync:factchecks -- --all           # Sync all politicians
 *   npm run sync:factchecks -- --stats         # Show current stats
 *   npm run sync:factchecks -- --dry-run       # Preview without saving
 *   npm run sync:factchecks -- --limit=10      # Limit to N politicians
 *   npm run sync:factchecks -- --politician="Macron"  # Search specific politician
 */

import "dotenv/config";
import { createCLI, ProgressTracker, type SyncHandler, type SyncResult } from "../src/lib/sync";
import { searchClaims, mapTextualRating } from "../src/lib/api";
import type { FactCheckClaim } from "../src/lib/api";
import { FACTCHECK_RATE_LIMIT_MS } from "../src/config/rate-limits";
import { db } from "../src/lib/db";
import { normalizeText, buildPoliticianIndex, findMentions } from "../src/lib/name-matching";
import { generateDateSlug } from "../src/lib/utils";

/**
 * Generate a unique slug for a fact-check, handling collisions.
 */
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

// ============================================
// SYNC HANDLER
// ============================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const handler: SyncHandler = {
  name: "Politic Tracker - Fact-Check Sync (Google API)",
  description: "Syncs fact-checks from Google Fact Check Tools API and matches politicians",

  options: [
    {
      name: "--politician",
      type: "string",
      description: "Search fact-checks for a specific politician name",
    },
    {
      name: "--all",
      type: "boolean",
      description: "Search all politicians (default: only active mandates)",
    },
  ],

  showHelp() {
    console.log(`
Politic Tracker - Fact-Check Sync (Google Fact Check Tools API)

Searches for fact-checked claims about French politicians using the
Google Fact Check Tools API (ClaimReview standard).

Sources include: AFP Factuel, Les Décodeurs, Libération CheckNews, etc.

Options:
  --stats              Show current statistics
  --dry-run            Preview changes without saving
  --limit=N            Limit to N politicians
  --politician="Name"  Search specific politician
  --all                Search all politicians (default: active only)
  --force              Re-import even if already exists
  --help               Show this help message

Environment:
  GOOGLE_FACTCHECK_API_KEY   Required. Google API key with Fact Check API enabled.
    `);
  },

  async showStats() {
    const [
      totalFactChecks,
      factChecksByRating,
      factChecksBySource,
      totalMentions,
      topMentioned,
      recentFactChecks,
    ] = await Promise.all([
      db.factCheck.count(),
      db.factCheck.groupBy({
        by: ["verdictRating"],
        _count: true,
        orderBy: { _count: { verdictRating: "desc" } },
      }),
      db.factCheck.groupBy({
        by: ["source"],
        _count: true,
        orderBy: { _count: { source: "desc" } },
      }),
      db.factCheckMention.count(),
      db.$queryRaw<Array<{ fullName: string; count: bigint }>>`
        SELECT p."fullName", COUNT(*) as count
        FROM "FactCheckMention" m
        JOIN "Politician" p ON m."politicianId" = p.id
        GROUP BY p.id, p."fullName"
        ORDER BY count DESC
        LIMIT 10
      `,
      db.factCheck.findMany({
        orderBy: { publishedAt: "desc" },
        take: 5,
        select: {
          title: true,
          source: true,
          verdictRating: true,
          publishedAt: true,
          _count: { select: { mentions: true } },
        },
      }),
    ]);

    console.log("\n" + "=".repeat(60));
    console.log("Fact-Check Sync Stats");
    console.log("=".repeat(60));
    console.log(`\nTotal fact-checks: ${totalFactChecks}`);
    console.log(`Total politician mentions: ${totalMentions}`);

    console.log("\nBy verdict:");
    for (const { verdictRating, _count } of factChecksByRating) {
      console.log(`  ${verdictRating}: ${_count}`);
    }

    console.log("\nBy source:");
    for (const { source, _count } of factChecksBySource) {
      console.log(`  ${source}: ${_count}`);
    }

    console.log("\nTop 10 mentioned politicians:");
    for (const { fullName, count } of topMentioned) {
      console.log(`  ${fullName}: ${count}`);
    }

    console.log("\nRecent fact-checks:");
    for (const fc of recentFactChecks) {
      const date = fc.publishedAt.toISOString().split("T")[0];
      console.log(`  [${date}] [${fc.verdictRating}] ${fc.title.slice(0, 60)}...`);
      console.log(`    Source: ${fc.source}, Politicians: ${fc._count.mentions}`);
    }
  },

  async sync(options): Promise<SyncResult> {
    const {
      dryRun = false,
      force = false,
      limit,
      politician: politicianFilter,
      all = false,
    } = options as {
      dryRun?: boolean;
      force?: boolean;
      limit?: number;
      politician?: string;
      all?: boolean;
    };

    const stats = {
      politiciansSearched: 0,
      claimsFound: 0,
      factChecksCreated: 0,
      factChecksSkipped: 0,
      mentionsCreated: 0,
      apiErrors: 0,
    };
    const errors: string[] = [];

    // Build politician index for mention matching
    console.log("Building politician name index...");
    const allPoliticians = await buildPoliticianIndex();
    console.log(`Indexed ${allPoliticians.length} politicians\n`);

    // Determine which politicians to search
    let searchTargets: Array<{ id: string; fullName: string }>;

    if (politicianFilter) {
      // Search specific politician(s) by name
      const normalized = normalizeText(politicianFilter);
      searchTargets = allPoliticians
        .filter(
          (p) =>
            p.normalizedFullName.includes(normalized) || p.normalizedLastName.includes(normalized)
        )
        .map((p) => ({ id: p.id, fullName: p.fullName }));

      if (searchTargets.length === 0) {
        console.log(`No politician found matching "${politicianFilter}"`);
        return { success: true, duration: 0, stats, errors };
      }
      console.log(
        `Found ${searchTargets.length} matching politicians: ${searchTargets.map((p) => p.fullName).join(", ")}\n`
      );
    } else if (all) {
      searchTargets = allPoliticians.map((p) => ({ id: p.id, fullName: p.fullName }));
    } else {
      // Default: only politicians with current mandates
      const activePoliticians = await db.politician.findMany({
        where: {
          mandates: { some: { isCurrent: true } },
        },
        select: { id: true, fullName: true },
      });
      searchTargets = activePoliticians;
    }

    if (limit) {
      searchTargets = searchTargets.slice(0, limit);
    }

    console.log(`Searching fact-checks for ${searchTargets.length} politicians\n`);

    const progress = new ProgressTracker({
      total: searchTargets.length,
      label: "Searching fact-checks",
      showBar: true,
      showETA: true,
      logInterval: 10,
    });

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

            if (dryRun) {
              console.log(`\n[DRY-RUN] ${review.title.slice(0, 70)}...`);
              console.log(`  Claim: ${claim.text.slice(0, 80)}...`);
              console.log(`  Verdict: ${review.textualRating} → ${verdictRating}`);
              console.log(`  Source: ${review.publisher.name}`);
              console.log(`  URL: ${review.url}`);
              console.log(`  Politicians: ${mentions.map((m) => m.matchedName).join(", ")}`);
              stats.factChecksCreated++;
              stats.mentionsCreated += mentions.length;
            } else {
              try {
                if (force) {
                  // Upsert when force mode — do NOT overwrite existing slug
                  await db.factCheck.upsert({
                    where: { sourceUrl: review.url },
                    update: {
                      claimText: claim.text,
                      claimant: claim.claimant || null,
                      title: review.title,
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
                      slug: await generateUniqueFactCheckSlug(reviewDate, review.title),
                      claimText: claim.text,
                      claimant: claim.claimant || null,
                      title: review.title,
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
                      slug: await generateUniqueFactCheckSlug(reviewDate, review.title),
                      claimText: claim.text,
                      claimant: claim.claimant || null,
                      title: review.title,
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
                // Skip duplicates silently
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
        const errorMsg = `Error searching "${target.fullName}": ${error}`;
        errors.push(errorMsg);
        console.error(`\n${errorMsg}`);
      }

      // Rate limiting between politician searches
      await sleep(FACTCHECK_RATE_LIMIT_MS);
      progress.tick();
    }

    progress.finish();

    return {
      success: errors.length === 0,
      duration: 0,
      stats,
      errors,
    };
  },
};

createCLI(handler);
