/**
 * Sync script: Enrich REJECT affairs with web search
 *
 * Standalone script that enriches affairs rejected by AI moderation
 * due to thin data (MISSING_SOURCE, POOR_DESCRIPTION).
 *
 * Uses Brave Search to find press sources, then Sonnet 4.5 to extract
 * structured data. Enriched affairs are upgraded to NEEDS_REVIEW.
 *
 * Usage:
 *   npm run sync:enrich                          # Run enrichment
 *   npm run sync:enrich -- --dry-run             # Preview without writing
 *   npm run sync:enrich -- --limit=10            # Limit to 10 affairs
 *   npm run sync:enrich -- --verbose             # Detailed output
 *   npm run sync:enrich -- --stats               # Show statistics
 */

import "dotenv/config";
import { db } from "../src/lib/db";
import { enrichAffair } from "../src/services/affair-enrichment";
import { BRAVE_SEARCH_RATE_LIMIT_MS } from "../src/config/rate-limits";

// ============================================
// CLI ARGUMENTS
// ============================================

const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const isStats = args.includes("--stats");
const isVerbose = args.includes("--verbose");
const limitArg = args.find((a) => a.startsWith("--limit="));
const limit = limitArg ? parseInt(limitArg.split("=")[1]!, 10) : 0;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================
// STATS MODE
// ============================================

async function showStats(): Promise<void> {
  console.log("\n=== Statistiques d'enrichissement ===\n");

  const rejectCount = await db.moderationReview.count({
    where: { recommendation: "REJECT", appliedAt: null },
  });
  console.log(`Reviews REJECT en attente : ${rejectCount}`);

  const enrichedCount = await db.moderationReview.count({
    where: {
      reasoning: { startsWith: "[ENRICHI]" },
    },
  });
  console.log(`Affaires enrichies (total) : ${enrichedCount}`);

  const needsReviewEnriched = await db.moderationReview.count({
    where: {
      recommendation: "NEEDS_REVIEW",
      reasoning: { startsWith: "[ENRICHI]" },
      appliedAt: null,
    },
  });
  console.log(`Enrichies en attente de validation : ${needsReviewEnriched}`);

  console.log();
}

// ============================================
// MAIN
// ============================================

async function main() {
  console.log("Poligraph - Enrichissement des affaires REJECT");
  console.log("================================================");

  if (isDryRun) {
    console.log("[MODE DRY-RUN] Aucune ecriture en base\n");
  }

  if (isStats) {
    await showStats();
    return;
  }

  if (!process.env.BRAVE_API_KEY) {
    console.log("BRAVE_API_KEY non definie. Arret.");
    return;
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.log("ANTHROPIC_API_KEY non definie. Arret.");
    return;
  }

  // Find REJECT reviews that haven't been enriched yet
  const rejectReviews = await db.moderationReview.findMany({
    where: {
      recommendation: "REJECT",
      appliedAt: null,
      reasoning: { not: { startsWith: "[ENRICHI]" } },
    },
    include: {
      affair: {
        select: {
          id: true,
          title: true,
          politician: { select: { fullName: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const reviews = limit > 0 ? rejectReviews.slice(0, limit) : rejectReviews;
  console.log(
    `${rejectReviews.length} affaire(s) REJECT a enrichir${limit > 0 ? `, limitee a ${reviews.length}` : ""}\n`
  );

  if (reviews.length === 0) {
    console.log("Rien a enrichir.");
    return;
  }

  let enriched = 0;
  let notFound = 0;
  let errors = 0;

  for (let i = 0; i < reviews.length; i++) {
    const review = reviews[i];
    const affair = review!.affair;
    const label = `[${i + 1}/${reviews.length}] "${affair.title}" (${affair.politician.fullName})`;

    try {
      if (isDryRun) {
        console.log(`${label} [DRY-RUN] Enrichissement ignore`);
        continue;
      }

      if (isVerbose) {
        console.log(`\n${label}`);
      }

      const result = await enrichAffair(affair.id);

      if (result.enriched) {
        enriched++;
        if (isVerbose) {
          console.log(
            `  ENRICHI (${result.sourcesAdded} sources, ${result.changes.length} changements)`
          );
          for (const change of result.changes) {
            console.log(`    ${change}`);
          }
        } else {
          console.log(`${label} -> ENRICHI (${result.sourcesAdded} sources)`);
        }
      } else {
        notFound++;
        if (isVerbose) {
          console.log(`  Pas de source: ${result.reasoning}`);
        } else {
          console.log(`${label} -> Pas de source`);
        }
      }

      // Rate limit between Brave Search calls
      if (i < reviews.length - 1) {
        await sleep(BRAVE_SEARCH_RATE_LIMIT_MS);
      }
    } catch (error) {
      console.error(`${label} Erreur:`, error);
      errors++;
    }
  }

  // Summary
  console.log("\n=== Resume ===\n");
  console.log(`Traitees : ${reviews.length}`);
  console.log(`Enrichies : ${enriched}`);
  console.log(`Sans source : ${notFound}`);
  console.log(`Erreurs : ${errors}`);

  if (errors > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
