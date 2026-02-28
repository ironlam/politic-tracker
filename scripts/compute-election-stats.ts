/**
 * Pre-compute aggregate election stats for municipales 2026.
 *
 * Computes candidacy, competition, parity, and geographic stats
 * from ~900K Candidacy rows using raw SQL, then stores the result
 * in the StatsSnapshot table for instant serving.
 *
 * Usage:
 *   npm run compute:municipales-stats
 */

import "dotenv/config";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma";

// ============================================
// Types
// ============================================

interface CommuneListCount {
  communeId: string;
  listCount: number;
}

interface MostContestedCommune {
  id: string;
  name: string;
  departmentCode: string;
  population: number | null;
  listCount: number;
}

interface MunicipalesStats {
  totalCandidacies: number;
  totalLists: number;
  totalCommunes: number;
  communesWithCompetition: number;
  communesUncontested: number;
  averageCompetitionIndex: number;
  parityRate: number;
  parityByParty: Record<string, number>;
  nationalPoliticiansCandidates: number;
  mostContestedCommunes: MostContestedCommune[];
}

// ============================================
// Helpers
// ============================================

async function getElectionId(slug: string): Promise<string> {
  const election = await db.election.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!election) {
    throw new Error(`Election not found: ${slug}`);
  }
  return election.id;
}

// ============================================
// Main
// ============================================

async function main() {
  const ELECTION_SLUG = "municipales-2026";
  const startTime = Date.now();

  console.log(`Computing aggregate stats for ${ELECTION_SLUG}...\n`);

  // Step 0: Get election ID
  console.log("Step 0: Looking up election ID...");
  const electionId = await getElectionId(ELECTION_SLUG);
  console.log(`  Election ID: ${electionId}\n`);

  // Step 1: Total candidacies
  console.log("Step 1: Counting total candidacies...");
  const [{ count: totalCandidacies }] = await db.$queryRaw<[{ count: number }]>(Prisma.sql`
    SELECT COUNT(*)::int as count
    FROM "Candidacy"
    WHERE "electionId" = ${electionId}
  `);
  console.log(`  Total candidacies: ${totalCandidacies}\n`);

  // Step 2: Lists per commune (for totalLists, competition, mostContested)
  console.log("Step 2: Computing lists per commune...");
  const communeListCounts = await db.$queryRaw<CommuneListCount[]>(Prisma.sql`
    SELECT "communeId", COUNT(DISTINCT "listName")::int as "listCount"
    FROM "Candidacy"
    WHERE "electionId" = ${electionId} AND "communeId" IS NOT NULL
    GROUP BY "communeId"
  `);

  const totalCommunes = communeListCounts.length;
  const totalLists = communeListCounts.reduce((sum, c) => sum + c.listCount, 0);
  const communesWithCompetition = communeListCounts.filter((c) => c.listCount > 1).length;
  const communesUncontested = communeListCounts.filter((c) => c.listCount === 1).length;
  const averageCompetitionIndex =
    totalCommunes > 0 ? Math.round((totalLists / totalCommunes) * 100) / 100 : 0;

  console.log(`  Total communes: ${totalCommunes}`);
  console.log(`  Total lists: ${totalLists}`);
  console.log(`  Communes with competition (>1 list): ${communesWithCompetition}`);
  console.log(`  Communes uncontested (1 list): ${communesUncontested}`);
  console.log(`  Average competition index: ${averageCompetitionIndex}\n`);

  // Step 3: Gender parity (global)
  console.log("Step 3: Computing global gender parity...");
  const genderCounts = await db.$queryRaw<Array<{ gender: string; count: number }>>(Prisma.sql`
    SELECT ca."gender", COUNT(*)::int as count
    FROM "Candidacy" c
    JOIN "Candidate" ca ON c."candidateId" = ca.id
    WHERE c."electionId" = ${electionId} AND ca."gender" IS NOT NULL
    GROUP BY ca."gender"
  `);

  const femaleCount = genderCounts.find((g) => g.gender === "F")?.count ?? 0;
  const maleCount = genderCounts.find((g) => g.gender === "M")?.count ?? 0;
  const totalGendered = femaleCount + maleCount;
  const parityRate =
    totalGendered > 0 ? Math.round((femaleCount / totalGendered) * 1000) / 1000 : 0;

  console.log(`  Female: ${femaleCount}, Male: ${maleCount}`);
  console.log(`  Parity rate (F/(F+M)): ${parityRate}\n`);

  // Step 4: Parity by party (parties with >100 candidates)
  console.log("Step 4: Computing parity by party...");
  const partyParity = await db.$queryRaw<
    Array<{ partyLabel: string; femaleRate: number }>
  >(Prisma.sql`
    SELECT c."partyLabel",
           COUNT(*) FILTER (WHERE ca."gender" = 'F')::float / NULLIF(COUNT(*)::float, 0) as "femaleRate"
    FROM "Candidacy" c
    JOIN "Candidate" ca ON c."candidateId" = ca.id
    WHERE c."electionId" = ${electionId} AND ca."gender" IS NOT NULL AND c."partyLabel" IS NOT NULL
    GROUP BY c."partyLabel"
    HAVING COUNT(*) > 100
    ORDER BY "femaleRate" DESC
  `);

  const parityByParty: Record<string, number> = {};
  for (const row of partyParity) {
    parityByParty[row.partyLabel] = Math.round(row.femaleRate * 1000) / 1000;
  }
  console.log(`  Parties with >100 candidates: ${partyParity.length}`);
  for (const [party, rate] of Object.entries(parityByParty)) {
    console.log(`    ${party}: ${rate}`);
  }
  console.log();

  // Step 5: National politicians as candidates
  console.log("Step 5: Counting national politicians as candidates...");
  const [{ count: nationalPoliticiansCandidates }] = await db.$queryRaw<
    [{ count: number }]
  >(Prisma.sql`
    SELECT COUNT(*)::int as count
    FROM "Candidacy"
    WHERE "electionId" = ${electionId} AND "politicianId" IS NOT NULL
  `);
  console.log(`  National politicians as candidates: ${nationalPoliticiansCandidates}\n`);

  // Step 6: Most contested communes (top 20 by list count)
  console.log("Step 6: Finding most contested communes (top 20)...");

  // Get top 20 commune IDs by list count
  const topCommuneIds = communeListCounts.sort((a, b) => b.listCount - a.listCount).slice(0, 20);

  // Fetch commune details for top 20
  const communeIds = topCommuneIds.map((c) => c.communeId);
  const communes =
    communeIds.length > 0
      ? await db.commune.findMany({
          where: { id: { in: communeIds } },
          select: {
            id: true,
            name: true,
            departmentCode: true,
            population: true,
          },
        })
      : [];

  const communeMap = new Map(communes.map((c) => [c.id, c]));
  const mostContestedCommunes: MostContestedCommune[] = topCommuneIds.map((tc) => {
    const commune = communeMap.get(tc.communeId);
    return {
      id: tc.communeId,
      name: commune?.name ?? "Unknown",
      departmentCode: commune?.departmentCode ?? "??",
      population: commune?.population ?? null,
      listCount: tc.listCount,
    };
  });

  for (const c of mostContestedCommunes) {
    console.log(
      `  ${c.name} (${c.departmentCode}): ${c.listCount} lists, pop: ${c.population ?? "N/A"}`
    );
  }
  console.log();

  // ============================================
  // Assemble and store stats
  // ============================================

  const stats: MunicipalesStats = {
    totalCandidacies,
    totalLists,
    totalCommunes,
    communesWithCompetition,
    communesUncontested,
    averageCompetitionIndex,
    parityRate,
    parityByParty,
    nationalPoliticiansCandidates,
    mostContestedCommunes,
  };

  const durationMs = Date.now() - startTime;

  console.log("Storing stats snapshot...");
  await db.statsSnapshot.upsert({
    where: { key: ELECTION_SLUG },
    create: {
      key: ELECTION_SLUG,
      data: stats as unknown as Prisma.InputJsonValue,
      durationMs,
    },
    update: {
      data: stats as unknown as Prisma.InputJsonValue,
      computedAt: new Date(),
      durationMs,
    },
  });

  console.log(`\nDone in ${durationMs}ms.`);
  console.log("\nFinal stats:");
  console.log(JSON.stringify(stats, null, 2));

  await db.$disconnect();
}

main().catch(async (error) => {
  console.error("Fatal error:", error);
  await db.$disconnect();
  process.exit(1);
});
