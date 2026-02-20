/**
 * Sync script: AI moderation of DRAFT affairs
 *
 * Runs the full moderation pipeline:
 *   Phase 1 — Duplicate detection: auto-merge CERTAIN/HIGH, flag POSSIBLE for review
 *   Phase 2 — AI moderation: analyze DRAFT affairs with Claude Sonnet 4.5
 *
 * Usage:
 *   npm run sync:moderate                         # Run full pipeline
 *   npm run sync:moderate -- --dry-run            # Preview without writing to DB
 *   npm run sync:moderate -- --stats              # Show moderation statistics
 *   npm run sync:moderate -- --verbose            # Detailed output
 *   npm run sync:moderate -- --dry-run --verbose  # Full preview with details
 */

import "dotenv/config";
import { db } from "../src/lib/db";
import {
  moderateAffair,
  getAIRateLimitMs,
  type ModerationInput,
  type ModerationResult,
} from "../src/services/affair-moderation";
import {
  findPotentialDuplicates,
  mergeAffairs,
  type PotentialDuplicate,
} from "../src/services/affairs/reconciliation";
import { enrichAffair } from "../src/services/affair-enrichment";
import { BRAVE_SEARCH_RATE_LIMIT_MS } from "../src/config/rate-limits";

// ============================================
// CLI ARGUMENTS
// ============================================

const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const isStats = args.includes("--stats");
const isVerbose = args.includes("--verbose");
const skipEnrich = args.includes("--skip-enrich");
const limitArg = args.find((a) => a.startsWith("--limit="));
const limit = limitArg ? parseInt(limitArg.split("=")[1], 10) : 0;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================
// STATS MODE
// ============================================

async function showStats(): Promise<void> {
  console.log("\n=== Statistiques de moderation ===\n");

  const draftCount = await db.affair.count({
    where: { publicationStatus: "DRAFT" },
  });
  console.log(`Affaires DRAFT : ${draftCount}`);

  const totalReviews = await db.moderationReview.count();
  console.log(`ModerationReview total : ${totalReviews}`);

  const pendingByRecommendation = await db.moderationReview.groupBy({
    by: ["recommendation"],
    where: { appliedAt: null },
    _count: true,
  });

  console.log("\nRevisions en attente (non appliquees) :");
  if (pendingByRecommendation.length === 0) {
    console.log("  Aucune");
  } else {
    for (const group of pendingByRecommendation) {
      console.log(`  ${group.recommendation} : ${group._count}`);
    }
  }

  const appliedCount = await db.moderationReview.count({
    where: { appliedAt: { not: null } },
  });
  console.log(`\nRevisions appliquees : ${appliedCount}`);

  console.log();
}

// ============================================
// FEATURE FLAG CHECK
// ============================================

async function isFeatureEnabled(): Promise<boolean> {
  // In dry-run mode, skip feature flag check
  if (isDryRun) return true;

  try {
    const flag = await db.featureFlag.findUnique({
      where: { name: "auto-moderate-affairs" },
    });

    if (flag) {
      const now = new Date();
      let enabled = flag.enabled;
      if (flag.startDate && now < flag.startDate) enabled = false;
      if (flag.endDate && now > flag.endDate) enabled = false;

      if (!enabled) {
        console.log(
          'Feature flag "auto-moderate-affairs" est desactivee. Utilisez --dry-run pour tester sans le flag.'
        );
        return false;
      }
      return true;
    }

    // Flag doesn't exist yet — fallback to API key check
    console.log(
      'Feature flag "auto-moderate-affairs" non trouvee en base. Fallback: verification ANTHROPIC_API_KEY.'
    );
  } catch {
    // DB query failed (table might not exist yet)
    console.log(
      "Impossible de verifier le feature flag. Fallback: verification ANTHROPIC_API_KEY."
    );
  }

  // Fallback: if ANTHROPIC_API_KEY is set, proceed
  if (process.env.ANTHROPIC_API_KEY) {
    return true;
  }

  console.log("ANTHROPIC_API_KEY non definie. Arret.");
  return false;
}

// ============================================
// PHASE 1: DUPLICATE DETECTION
// ============================================

interface DedupStats {
  duplicatesFound: number;
  autoMerged: number;
  flaggedForReview: number;
  errors: number;
}

async function phaseDuplicateDetection(): Promise<DedupStats> {
  console.log("\n=== Phase 1 : Detection de doublons ===\n");

  const stats: DedupStats = {
    duplicatesFound: 0,
    autoMerged: 0,
    flaggedForReview: 0,
    errors: 0,
  };

  let duplicates: PotentialDuplicate[];
  try {
    duplicates = await findPotentialDuplicates();
  } catch (error) {
    console.error("Erreur lors de la detection de doublons:", error);
    stats.errors++;
    return stats;
  }

  stats.duplicatesFound = duplicates.length;
  console.log(`${duplicates.length} paire(s) de doublons potentiels trouvee(s)`);

  if (duplicates.length === 0) return stats;

  for (const dup of duplicates) {
    const confidenceLabel = dup.confidence;
    const logPrefix = `[${confidenceLabel}] "${dup.affairA.title}" <-> "${dup.affairB.title}"`;

    if (isVerbose) {
      console.log(`\n${logPrefix}`);
      console.log(`  Score: ${dup.score}, Match: ${dup.matchedBy}`);
      console.log(`  A: ${dup.affairA.sources.join(", ")} | B: ${dup.affairB.sources.join(", ")}`);
    }

    if (dup.confidence === "CERTAIN" || dup.confidence === "HIGH") {
      // Auto-merge: keep the affair with more sources
      const keepA = dup.affairA.sources.length >= dup.affairB.sources.length;
      const keepId = keepA ? dup.affairA.id : dup.affairB.id;
      const removeId = keepA ? dup.affairB.id : dup.affairA.id;

      if (isDryRun) {
        console.log(`  [DRY-RUN] Auto-merge: garder ${keepId}, supprimer ${removeId}`);
        stats.autoMerged++;
      } else {
        try {
          await mergeAffairs(keepId, removeId);
          console.log(`  Merge effectue: garder ${keepId}, supprime ${removeId}`);
          stats.autoMerged++;
        } catch (error) {
          console.error(`  Erreur merge ${keepId}/${removeId}:`, error);
          stats.errors++;
        }
      }
    } else {
      // POSSIBLE: flag for manual review
      if (isDryRun) {
        console.log(`  [DRY-RUN] Flagge pour revision manuelle (duplicateOfId: ${dup.affairA.id})`);
        stats.flaggedForReview++;
      } else {
        try {
          // Check if a pending review for this pair already exists
          const existingReview = await db.moderationReview.findFirst({
            where: {
              affairId: dup.affairB.id,
              duplicateOfId: dup.affairA.id,
              appliedAt: null,
            },
          });

          if (existingReview) {
            if (isVerbose) {
              console.log("  Revision doublon deja existante, ignoree");
            }
          } else {
            await db.moderationReview.create({
              data: {
                affairId: dup.affairB.id,
                recommendation: "NEEDS_REVIEW",
                confidence: Math.round(dup.score * 100),
                reasoning: `Doublon potentiel detecte (${dup.confidence}, score: ${dup.score}, methode: ${dup.matchedBy}). Affaire similaire : "${dup.affairA.title}" (${dup.affairA.id}).`,
                duplicateOfId: dup.affairA.id,
                model: "dedup-algorithm",
                issues: [
                  {
                    type: "POSSIBLE_DUPLICATE",
                    detail: `Similaire a "${dup.affairA.title}" (confiance: ${dup.confidence}, score: ${dup.score})`,
                  },
                ],
              },
            });
            console.log(
              `  ModerationReview creee pour ${dup.affairB.id} (doublon de ${dup.affairA.id})`
            );
            stats.flaggedForReview++;
          }
        } catch (error) {
          console.error(`  Erreur creation review doublon pour ${dup.affairB.id}:`, error);
          stats.errors++;
        }
      }
    }
  }

  return stats;
}

// ============================================
// PHASE 2: AI MODERATION
// ============================================

interface ModerationStats {
  analyzed: number;
  recommendPublish: number;
  recommendReject: number;
  recommendReview: number;
  errors: number;
}

async function phaseAIModeration(): Promise<ModerationStats> {
  console.log("\n=== Phase 2 : Moderation IA ===\n");

  const stats: ModerationStats = {
    analyzed: 0,
    recommendPublish: 0,
    recommendReject: 0,
    recommendReview: 0,
    errors: 0,
  };

  if (!process.env.ANTHROPIC_API_KEY) {
    console.log("ANTHROPIC_API_KEY non definie. Phase 2 ignoree.");
    return stats;
  }

  // Fetch DRAFT affairs that don't already have a pending (unapplied) ModerationReview
  const allAffairs = await db.affair.findMany({
    where: {
      publicationStatus: "DRAFT",
      moderationReviews: {
        none: {
          appliedAt: null,
        },
      },
    },
    include: {
      politician: {
        select: { fullName: true, slug: true },
      },
      sources: {
        select: {
          url: true,
          title: true,
          publisher: true,
          publishedAt: true,
          sourceType: true,
        },
      },
    },
  });

  const affairs = limit > 0 ? allAffairs.slice(0, limit) : allAffairs;

  console.log(
    `${allAffairs.length} affaire(s) DRAFT trouvee(s)${limit > 0 ? `, limitee a ${affairs.length}` : ""}`
  );

  if (affairs.length === 0) return stats;

  // Fetch existing affair titles per politician for duplicate detection hint
  const politicianIds = [...new Set(affairs.map((a) => a.politicianId))];
  const existingAffairs = await db.affair.findMany({
    where: {
      politicianId: { in: politicianIds },
      publicationStatus: { not: "DRAFT" },
    },
    select: { politicianId: true, title: true },
  });

  const existingTitlesByPolitician = new Map<string, string[]>();
  for (const a of existingAffairs) {
    const titles = existingTitlesByPolitician.get(a.politicianId) ?? [];
    titles.push(a.title);
    existingTitlesByPolitician.set(a.politicianId, titles);
  }

  const rateLimitMs = getAIRateLimitMs();

  for (let i = 0; i < affairs.length; i++) {
    const affair = affairs[i];
    const label = `[${i + 1}/${affairs.length}] "${affair.title}"`;

    try {
      if (isVerbose) {
        console.log(`\n${label}`);
        console.log(`  Politicien: ${affair.politician.fullName}`);
        console.log(`  Sources: ${affair.sources.length}`);
        console.log(`  Categorie: ${affair.category}, Statut: ${affair.status}`);
      }

      const input: ModerationInput = {
        affairId: affair.id,
        title: affair.title,
        description: affair.description,
        status: affair.status,
        category: affair.category,
        involvement: affair.involvement,
        politicianName: affair.politician.fullName,
        politicianSlug: affair.politician.slug,
        sources: affair.sources.map((s) => ({
          url: s.url,
          title: s.title,
          publisher: s.publisher,
          publishedAt: s.publishedAt.toISOString().split("T")[0],
        })),
        factsDate: affair.factsDate?.toISOString().split("T")[0] ?? null,
        startDate: affair.startDate?.toISOString().split("T")[0] ?? null,
        verdictDate: affair.verdictDate?.toISOString().split("T")[0] ?? null,
        court: affair.court ?? null,
        sentence: affair.sentence ?? null,
        existingAffairTitles: existingTitlesByPolitician.get(affair.politicianId) ?? [],
      };

      let result: ModerationResult;

      if (isDryRun) {
        console.log(`  [DRY-RUN] Appel moderateAffair() ignore`);
        stats.analyzed++;
        continue;
      }

      result = await moderateAffair(input);
      stats.analyzed++;

      // Track recommendation
      switch (result.recommendation) {
        case "PUBLISH":
          stats.recommendPublish++;
          break;
        case "REJECT":
          stats.recommendReject++;
          break;
        case "NEEDS_REVIEW":
          stats.recommendReview++;
          break;
      }

      if (isVerbose) {
        console.log(`  Resultat: ${result.recommendation} (confiance: ${result.confidence}%)`);
        if (result.correctedTitle) {
          console.log(`  Titre corrige: "${result.correctedTitle}"`);
        }
        if (result.correctedStatus) {
          console.log(`  Statut corrige: ${result.correctedStatus}`);
        }
        if (result.correctedCategory) {
          console.log(`  Categorie corrigee: ${result.correctedCategory}`);
        }
        if (result.issues.length > 0) {
          console.log(`  Issues: ${result.issues.map((i) => i.type).join(", ")}`);
        }
      } else {
        console.log(`${label} -> ${result.recommendation} (${result.confidence}%)`);
      }

      // Store as ModerationReview
      await db.moderationReview.create({
        data: {
          affairId: affair.id,
          recommendation: result.recommendation as never,
          confidence: result.confidence,
          reasoning: result.reasoning,
          suggestedTitle: result.correctedTitle,
          suggestedDescription: result.correctedDescription,
          suggestedStatus: result.correctedStatus ? (result.correctedStatus as never) : null,
          suggestedCategory: result.correctedCategory ? (result.correctedCategory as never) : null,
          issues:
            result.issues.length > 0
              ? result.issues.map((i) => ({ type: i.type, detail: i.detail }))
              : undefined,
          model: result.model,
        },
      });

      // Rate limit between AI calls
      if (i < affairs.length - 1) {
        await sleep(rateLimitMs);
      }
    } catch (error) {
      console.error(`  Erreur pour ${label}:`, error);
      stats.errors++;
      // Continue to next affair
    }
  }

  return stats;
}

// ============================================
// PHASE 3: WEB ENRICHMENT
// ============================================

interface EnrichmentStats {
  processed: number;
  enriched: number;
  notFound: number;
  errors: number;
}

async function phaseEnrichment(): Promise<EnrichmentStats> {
  console.log("\n=== Phase 3 : Enrichissement web ===\n");

  const stats: EnrichmentStats = { processed: 0, enriched: 0, notFound: 0, errors: 0 };

  if (!process.env.BRAVE_API_KEY) {
    console.log("BRAVE_API_KEY non definie. Phase 3 ignoree.");
    return stats;
  }

  // Find REJECT reviews — filter for MISSING_SOURCE or POOR_DESCRIPTION in code
  const allRejectReviews = await db.moderationReview.findMany({
    where: {
      recommendation: "REJECT",
      appliedAt: null,
      reasoning: { not: { startsWith: "[ENRICHI]" } },
    },
    select: { affairId: true, id: true, issues: true },
  });

  // Filter for reviews with enrichable issues
  const rejectReviews = allRejectReviews.filter((r) => {
    if (!Array.isArray(r.issues)) return false;
    const issues = r.issues as { type: string }[];
    return issues.some((i) => i.type === "MISSING_SOURCE" || i.type === "POOR_DESCRIPTION");
  });

  const allReviews = limit > 0 ? rejectReviews.slice(0, limit) : rejectReviews;
  console.log(
    `${rejectReviews.length} affaire(s) REJECT eligibles${limit > 0 ? `, limitee a ${allReviews.length}` : ""}`
  );

  if (allReviews.length === 0) return stats;

  for (let i = 0; i < allReviews.length; i++) {
    const review = allReviews[i];
    const label = `[${i + 1}/${allReviews.length}]`;

    try {
      if (isDryRun) {
        console.log(`${label} [DRY-RUN] Enrichissement ignore pour ${review.affairId}`);
        stats.processed++;
        continue;
      }

      const result = await enrichAffair(review.affairId);
      stats.processed++;

      if (result.enriched) {
        stats.enriched++;
        if (isVerbose) {
          console.log(`${label} ENRICHI (${result.sourcesAdded} sources)`);
          for (const change of result.changes) {
            console.log(`  ${change}`);
          }
        } else {
          console.log(`${label} ${review.affairId} -> ENRICHI (${result.sourcesAdded} sources)`);
        }
      } else {
        stats.notFound++;
        if (isVerbose) {
          console.log(`${label} Pas de source: ${result.reasoning}`);
        } else {
          console.log(`${label} ${review.affairId} -> Pas de source`);
        }
      }

      // Rate limit between Brave Search calls
      if (i < allReviews.length - 1) {
        await sleep(BRAVE_SEARCH_RATE_LIMIT_MS);
      }
    } catch (error) {
      console.error(`${label} Erreur enrichissement ${review.affairId}:`, error);
      stats.errors++;
    }
  }

  return stats;
}

// ============================================
// MAIN
// ============================================

async function main() {
  console.log("Poligraph - Moderation automatique des affaires");
  console.log("================================================");

  if (isDryRun) {
    console.log("[MODE DRY-RUN] Aucune ecriture en base");
  }

  // Stats mode: show statistics and exit
  if (isStats) {
    await showStats();
    return;
  }

  // Feature flag check
  const enabled = await isFeatureEnabled();
  if (!enabled) return;

  // Phase 1: Duplicate detection
  const dedupStats = await phaseDuplicateDetection();

  // Phase 2: AI moderation
  const moderationStats = await phaseAIModeration();

  // Phase 3: Web enrichment (optional)
  let enrichStats: EnrichmentStats = { processed: 0, enriched: 0, notFound: 0, errors: 0 };
  if (!skipEnrich) {
    enrichStats = await phaseEnrichment();
  } else {
    console.log("\n=== Phase 3 : Enrichissement web (ignore via --skip-enrich) ===");
  }

  // Summary
  console.log("\n=== Resume ===\n");
  console.log("Phase 1 - Doublons :");
  console.log(`  Detectes : ${dedupStats.duplicatesFound}`);
  console.log(`  Auto-merges : ${dedupStats.autoMerged}`);
  console.log(`  Flags revision : ${dedupStats.flaggedForReview}`);
  console.log(`  Erreurs : ${dedupStats.errors}`);

  console.log("\nPhase 2 - Moderation IA :");
  console.log(`  Analysees : ${moderationStats.analyzed}`);
  console.log(`  PUBLISH : ${moderationStats.recommendPublish}`);
  console.log(`  REJECT : ${moderationStats.recommendReject}`);
  console.log(`  NEEDS_REVIEW : ${moderationStats.recommendReview}`);
  console.log(`  Erreurs : ${moderationStats.errors}`);

  console.log("\nPhase 3 - Enrichissement web :");
  console.log(`  Traitees : ${enrichStats.processed}`);
  console.log(`  Enrichies : ${enrichStats.enriched}`);
  console.log(`  Sans source : ${enrichStats.notFound}`);
  console.log(`  Erreurs : ${enrichStats.errors}`);

  const totalErrors = dedupStats.errors + moderationStats.errors + enrichStats.errors;
  if (totalErrors > 0) {
    console.log(`\n${totalErrors} erreur(s) au total.`);
    process.exitCode = 1;
  } else {
    console.log("\nTermine sans erreur.");
  }
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
