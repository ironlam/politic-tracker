/**
 * Judilibre Sync Service
 *
 * Searches Cour de cassation criminal decisions for politicians:
 * - Enriches existing affairs with ECLI/pourvoi identifiers
 * - Creates new affairs for confirmed convictions (prefixed [À VÉRIFIER])
 * - Filters homonymes via birth date and name-in-text checks
 */

import { db } from "@/lib/db";
import { AffairStatus } from "@/generated/prisma";
import { generateSlug } from "@/lib/utils";
import {
  JudilibreClient,
  createJudilibreClient,
  type JudilibreDecision,
  type JudilibreDecisionSummary,
} from "@/lib/api/judilibre";
import { findMatchingAffairs } from "@/services/affairs/matching";
import {
  mapSolutionToStatus,
  mapJudilibreToCategory,
  analyzeIfConviction,
  buildTitleFromDecision,
} from "@/services/affairs/judilibre-mapping";
import { syncMetadata } from "@/lib/sync";
import { trackStatusChange } from "@/services/affairs/status-tracking";

// ============================================
// TYPES
// ============================================

export interface JudilibreSyncOptions {
  dryRun?: boolean;
  force?: boolean;
  limit?: number;
  politicianSlug?: string;
  verbose?: boolean;
}

export interface JudilibreSyncStats {
  politiciansSearched: number;
  decisionsFound: number;
  decisionsRelevant: number;
  affairsEnriched: number;
  affairsCreated: number;
  decisionsSkipped: number;
  errors: number;
}

interface PoliticianForSearch {
  id: string;
  fullName: string;
  slug: string;
  birthDate: Date | null;
  hasAffairs: boolean;
}

// ============================================
// CONSTANTS
// ============================================

const SYNC_SOURCE_KEY = "judilibre";
const MIN_SYNC_INTERVAL_MS = 8 * 60 * 60 * 1000; // 8 hours (daily sync runs 3x/day)
const MIN_AGE_AT_DECISION = 18; // Skip if politician was < 18 at time of decision

// ============================================
// HOMONYME FILTERING
// ============================================

/**
 * Check if a text likely refers to a politician (not just a common word).
 *
 * Requires BOTH firstName and lastName to appear in the text, OR
 * lastName preceded by a legal title (M., Mme, sieur, dame, prévenu, condamné).
 * This prevents false positives for surnames that are common French words
 * (Portes, Blanc, Petit, Bureau, Faure, etc.).
 */
function textRefersToPersonByName(text: string, fullName: string): boolean {
  const parts = fullName.toLowerCase().split(/\s+/);
  const firstName = parts[0];
  const lastName = parts[parts.length - 1];
  const textLower = text.toLowerCase();

  // Best case: full name appears together
  if (textLower.includes(fullName.toLowerCase())) return true;

  // Both firstName and lastName appear independently
  if (textLower.includes(firstName) && textLower.includes(lastName)) return true;

  // lastName preceded by a legal title (case-insensitive on original text)
  const escapedLastName = lastName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const titlePattern = new RegExp(
    `(?:M\\.|Mme|Mr|Sieur|Dame|Prévenu[e]?|Condamné[e]?|Appelant[e]?|Demandeur|Défendeur)\\s+${escapedLastName}`,
    "i"
  );
  if (titlePattern.test(text)) return true;

  return false;
}

/**
 * Check if a politician could plausibly be involved in a decision.
 * Filters out homonymes by verifying:
 * 1. The politician was at least 18 at the time of the decision
 * 2. The politician's name (not just surname) appears in the text
 */
function isRelevantDecision(
  decision: JudilibreDecisionSummary,
  politician: PoliticianForSearch
): boolean {
  // Check age at decision date
  if (politician.birthDate) {
    const decisionDate = new Date(decision.decision_date);
    const ageAtDecision =
      (decisionDate.getTime() - politician.birthDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);

    if (ageAtDecision < MIN_AGE_AT_DECISION) {
      return false;
    }
  }

  // Check if the person's name (not just surname) appears in the summary
  const summary = decision.summary || "";
  if (!textRefersToPersonByName(summary, politician.fullName)) {
    return false;
  }

  return true;
}

/**
 * Enhanced relevance check using full decision text.
 * Called after fetching the full decision.
 */
function isRelevantFullDecision(
  decision: JudilibreDecision,
  politician: PoliticianForSearch
): boolean {
  return textRefersToPersonByName(decision.text, politician.fullName);
}

// ============================================
// SEARCH
// ============================================

/**
 * Search Judilibre for a politician's criminal decisions
 */
async function searchPoliticianDecisions(
  client: JudilibreClient,
  politician: PoliticianForSearch,
  verbose?: boolean
): Promise<JudilibreDecisionSummary[]> {
  const results = await client.searchDecisions(politician.fullName, {
    chamber: "cr", // Criminelle uniquement
    page_size: 25,
  });

  if (verbose && results.total > 0) {
    console.log(`  ${results.total} décision(s) trouvée(s) pour ${politician.fullName}`);
  }

  return results.results;
}

/**
 * Filter decisions to only relevant ones for this politician
 */
function filterRelevantDecisions(
  decisions: JudilibreDecisionSummary[],
  politician: PoliticianForSearch
): JudilibreDecisionSummary[] {
  return decisions.filter((d) => isRelevantDecision(d, politician));
}

// ============================================
// ENRICHMENT & CREATION
// ============================================

/**
 * Enrich an existing affair with Judilibre data (ECLI, pourvoi, source)
 */
async function enrichAffairFromJudilibre(
  affairId: string,
  decision: JudilibreDecisionSummary,
  dryRun: boolean,
  verbose?: boolean
): Promise<boolean> {
  if (dryRun) {
    if (verbose) {
      console.log(`  [DRY-RUN] Enrichirait affaire ${affairId} avec ECLI ${decision.ecli}`);
    }
    return true;
  }

  try {
    // Update affair with judicial identifiers
    const updateData: Record<string, unknown> = {};

    if (decision.ecli) {
      updateData.ecli = decision.ecli;
    }
    if (decision.number) {
      updateData.pourvoiNumber = decision.number;
    }
    if (decision.numbers && decision.numbers.length > 0) {
      // Merge with existing caseNumbers
      const existing = await db.affair.findUnique({
        where: { id: affairId },
        select: { caseNumbers: true },
      });
      const existingNumbers = new Set(existing?.caseNumbers ?? []);
      for (const num of decision.numbers) {
        existingNumbers.add(num);
      }
      updateData.caseNumbers = Array.from(existingNumbers);
    }

    // Map solution to status (only upgrade, never downgrade)
    const newStatus = mapSolutionToStatus(decision.solution);
    const currentAffair = await db.affair.findUnique({
      where: { id: affairId },
      select: { status: true },
    });
    if (currentAffair && shouldUpgradeStatus(currentAffair.status, newStatus)) {
      updateData.status = newStatus;
      // Track status change in affair timeline
      await trackStatusChange(affairId, currentAffair.status, newStatus, {
        type: "JUDILIBRE",
        url: `https://www.courdecassation.fr/decision/${decision.id}`,
        title: `Cour de cassation - ${decision.solution} (${decision.number})`,
      });
    }

    if (Object.keys(updateData).length > 0) {
      await db.affair.update({
        where: { id: affairId },
        data: updateData,
      });
    }

    // Add Judilibre source if not already present
    const existingSource = await db.source.findFirst({
      where: {
        affairId,
        sourceType: "JUDILIBRE",
      },
    });

    if (!existingSource) {
      await db.source.create({
        data: {
          affairId,
          url: `https://www.courdecassation.fr/decision/${decision.id}`,
          title: `Cour de cassation - ${decision.solution} (${decision.number})`,
          publisher: "Cour de cassation",
          publishedAt: new Date(decision.decision_date),
          sourceType: "JUDILIBRE",
        },
      });
    }

    if (verbose) {
      console.log(`  ✓ Affaire ${affairId} enrichie avec ECLI ${decision.ecli}`);
    }

    return true;
  } catch (error) {
    console.error(`  ✗ Erreur enrichissement affaire ${affairId}:`, error);
    return false;
  }
}

/**
 * Create a new affair from a Judilibre decision.
 * Prefixed [À VÉRIFIER] since it hasn't been manually validated.
 */
async function createAffairFromJudilibre(
  politicianId: string,
  decision: JudilibreDecisionSummary,
  dryRun: boolean,
  verbose?: boolean
): Promise<boolean> {
  const title = `[À VÉRIFIER] ${buildTitleFromDecision(decision)}`;
  const category = mapJudilibreToCategory(decision.themes, decision.summary);
  const status = mapSolutionToStatus(decision.solution);

  if (dryRun) {
    console.log(`  [DRY-RUN] Créerait affaire: ${title} (${decision.ecli})`);
    return true;
  }

  try {
    const baseSlug = generateSlug(title);
    let slug = baseSlug;

    // Ensure unique slug
    let counter = 1;
    while (await db.affair.findUnique({ where: { slug }, select: { id: true } })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    await db.affair.create({
      data: {
        politicianId,
        title,
        slug,
        description: decision.summary || `Décision de la Cour de cassation : ${decision.solution}.`,
        status,
        category,
        publicationStatus: "DRAFT",
        verdictDate: new Date(decision.decision_date),
        ecli: decision.ecli || null,
        pourvoiNumber: decision.number || null,
        caseNumbers: decision.numbers || [],
        verifiedAt: null,
        sources: {
          create: {
            url: `https://www.courdecassation.fr/decision/${decision.id}`,
            title: `Cour de cassation - ${decision.solution} (${decision.number})`,
            publisher: "Cour de cassation",
            publishedAt: new Date(decision.decision_date),
            sourceType: "JUDILIBRE",
          },
        },
      },
    });

    if (verbose) {
      console.log(`  ✓ Nouvelle affaire créée: ${title}`);
    }

    return true;
  } catch (error) {
    // Handle unique constraint violation (ECLI already exists)
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      if (verbose) {
        console.log(`  - Affaire déjà existante (ECLI ${decision.ecli}), ignorée`);
      }
      return false;
    }
    console.error(`  ✗ Erreur création affaire:`, error);
    return false;
  }
}

// ============================================
// STATUS ORDERING
// ============================================

/** Status severity order (higher = more definitive) */
const STATUS_ORDER: Record<string, number> = {
  ENQUETE_PRELIMINAIRE: 1,
  INSTRUCTION: 2,
  MISE_EN_EXAMEN: 3,
  RENVOI_TRIBUNAL: 4,
  PROCES_EN_COURS: 5,
  CONDAMNATION_PREMIERE_INSTANCE: 6,
  APPEL_EN_COURS: 7,
  CONDAMNATION_DEFINITIVE: 8,
  RELAXE: 8,
  ACQUITTEMENT: 8,
  NON_LIEU: 8,
  PRESCRIPTION: 8,
  CLASSEMENT_SANS_SUITE: 8,
};

/** Only upgrade status, never downgrade */
function shouldUpgradeStatus(current: AffairStatus, candidate: AffairStatus): boolean {
  return (STATUS_ORDER[candidate] ?? 0) > (STATUS_ORDER[current] ?? 0);
}

// ============================================
// MAIN SYNC
// ============================================

/**
 * Main Judilibre sync orchestrator
 */
export async function syncJudilibre(
  options: JudilibreSyncOptions = {}
): Promise<JudilibreSyncStats> {
  const { dryRun = false, force = false, limit, politicianSlug, verbose } = options;

  const stats: JudilibreSyncStats = {
    politiciansSearched: 0,
    decisionsFound: 0,
    decisionsRelevant: 0,
    affairsEnriched: 0,
    affairsCreated: 0,
    decisionsSkipped: 0,
    errors: 0,
  };

  // Check sync interval (unless forced)
  if (!force && !politicianSlug) {
    const shouldSync = await syncMetadata.shouldSync(SYNC_SOURCE_KEY, MIN_SYNC_INTERVAL_MS);
    if (!shouldSync) {
      console.log("Sync Judilibre déjà effectué récemment. Utilisez --force pour forcer.");
      return stats;
    }
  }

  // Initialize client
  const client = createJudilibreClient();
  if (!client) {
    console.error("Judilibre non configuré. Vérifiez les variables d'environnement.");
    stats.errors++;
    return stats;
  }

  // Get politicians to search
  const politicians = await getPoliticiansToSearch(politicianSlug, limit);
  console.log(`${politicians.length} politicien(s) à rechercher\n`);

  for (const politician of politicians) {
    stats.politiciansSearched++;

    try {
      // Search for criminal decisions
      const decisions = await searchPoliticianDecisions(client, politician, verbose);
      stats.decisionsFound += decisions.length;

      if (decisions.length === 0) continue;

      // Filter relevant decisions (anti-homonymes)
      const relevant = filterRelevantDecisions(decisions, politician);
      stats.decisionsRelevant += relevant.length;

      if (verbose && relevant.length < decisions.length) {
        console.log(`  Filtré ${decisions.length - relevant.length} décision(s) non pertinente(s)`);
      }

      for (const decision of relevant) {
        // Try to match with existing affairs
        const matches = await findMatchingAffairs({
          politicianId: politician.id,
          title: buildTitleFromDecision(decision),
          ecli: decision.ecli,
          pourvoiNumber: decision.number,
          caseNumbers: decision.numbers,
          category: mapJudilibreToCategory(decision.themes, decision.summary),
          verdictDate: new Date(decision.decision_date),
        });

        const bestMatch = matches[0];

        if (bestMatch && (bestMatch.confidence === "CERTAIN" || bestMatch.confidence === "HIGH")) {
          // Enrich existing affair
          const enriched = await enrichAffairFromJudilibre(
            bestMatch.affairId,
            decision,
            dryRun,
            verbose
          );
          if (enriched) stats.affairsEnriched++;
        } else if (analyzeIfConviction(decision)) {
          // Fetch full decision text for enhanced verification
          let shouldCreate = true;

          try {
            const fullDecision = await client.getDecision(decision.id);
            if (!isRelevantFullDecision(fullDecision, politician)) {
              if (verbose) {
                console.log(
                  `  - Décision ${decision.ecli} : nom absent du texte intégral, ignorée`
                );
              }
              shouldCreate = false;
              stats.decisionsSkipped++;
            }
          } catch {
            // If we can't fetch full text, still create with summary-based check
            if (verbose) {
              console.log(`  ⚠ Impossible de récupérer le texte intégral de ${decision.id}`);
            }
          }

          if (shouldCreate) {
            const created = await createAffairFromJudilibre(
              politician.id,
              decision,
              dryRun,
              verbose
            );
            if (created) stats.affairsCreated++;
          }
        } else {
          // No match and not a conviction — skip procedural decision
          stats.decisionsSkipped++;
          if (verbose) {
            console.log(`  - Décision ${decision.ecli || decision.id} : procédurale, ignorée`);
          }
        }
      }
    } catch (error) {
      stats.errors++;
      console.error(`  ✗ Erreur pour ${politician.fullName}:`, error);
    }
  }

  // Update sync metadata
  if (!dryRun) {
    await syncMetadata.markCompleted(SYNC_SOURCE_KEY, {
      itemCount: stats.affairsEnriched + stats.affairsCreated,
    });
  }

  return stats;
}

// ============================================
// HELPERS
// ============================================

/**
 * Get politicians to search, prioritizing those with existing affairs
 */
async function getPoliticiansToSearch(
  slug?: string,
  limit?: number
): Promise<PoliticianForSearch[]> {
  if (slug) {
    const politician = await db.politician.findUnique({
      where: { slug },
      select: {
        id: true,
        fullName: true,
        slug: true,
        birthDate: true,
        _count: { select: { affairs: true } },
      },
    });
    if (!politician) {
      console.error(`Politicien non trouvé: ${slug}`);
      return [];
    }
    return [
      {
        ...politician,
        hasAffairs: politician._count.affairs > 0,
      },
    ];
  }

  // Fetch all politicians, prioritize those with existing affairs
  const politicians = await db.politician.findMany({
    select: {
      id: true,
      fullName: true,
      slug: true,
      birthDate: true,
      _count: { select: { affairs: true } },
    },
    orderBy: [{ affairs: { _count: "desc" } }, { fullName: "asc" }],
    ...(limit ? { take: limit } : {}),
  });

  return politicians.map((p) => ({
    id: p.id,
    fullName: p.fullName,
    slug: p.slug,
    birthDate: p.birthDate,
    hasAffairs: p._count.affairs > 0,
  }));
}

/**
 * Get Judilibre sync statistics
 */
export async function getJudilibreStats(): Promise<void> {
  const [meta, affairsWithEcli, affairsWithJudilibreSource, totalAffairs, recentJudilibre] =
    await Promise.all([
      syncMetadata.get(SYNC_SOURCE_KEY),
      db.affair.count({ where: { ecli: { not: null } } }),
      db.source.count({ where: { sourceType: "JUDILIBRE" } }),
      db.affair.count(),
      db.affair.findMany({
        where: { sources: { some: { sourceType: "JUDILIBRE" } } },
        select: {
          title: true,
          ecli: true,
          status: true,
          verdictDate: true,
          politician: { select: { fullName: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 5,
      }),
    ]);

  console.log("\n" + "=".repeat(60));
  console.log("Judilibre Sync Stats");
  console.log("=".repeat(60));

  if (meta) {
    console.log(`\nDernier sync: ${meta.lastSyncAt?.toLocaleString("fr-FR") ?? "jamais"}`);
    console.log(`Items traités: ${meta.itemCount ?? 0}`);
  } else {
    console.log("\nAucun sync effectué");
  }

  console.log(`\nAffaires totales: ${totalAffairs}`);
  console.log(`Affaires avec ECLI: ${affairsWithEcli}`);
  console.log(`Sources Judilibre: ${affairsWithJudilibreSource}`);

  if (recentJudilibre.length > 0) {
    console.log("\nDernières affaires Judilibre:");
    for (const a of recentJudilibre) {
      const date = a.verdictDate?.toISOString().split("T")[0] ?? "?";
      console.log(`  [${date}] ${a.politician.fullName} - ${a.title}`);
      if (a.ecli) console.log(`    ECLI: ${a.ecli}`);
    }
  }
}
