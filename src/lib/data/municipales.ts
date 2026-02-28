import { cache } from "react";
import { Prisma } from "@/generated/prisma";
import { db } from "@/lib/db";

export const getCommune = cache(async function getCommune(inseeCode: string) {
  // Get commune
  const commune = await db.commune.findUnique({
    where: { id: inseeCode },
  });

  if (!commune) return null;

  // Get election for municipales 2026 (sequential to respect pool limit of 2)
  const election = await db.election.findUnique({
    where: { slug: "municipales-2026" },
    select: { id: true, round1Date: true },
  });

  if (!election) {
    return {
      ...commune,
      electionId: null,
      round1Date: null,
      lists: [],
      stats: {
        listCount: 0,
        candidateCount: 0,
        femaleRate: 0,
        nationalPoliticiansCount: 0,
      },
    };
  }

  // Get all candidacies for this commune in this election, with candidate + politician data
  const candidacies = await db.candidacy.findMany({
    where: { electionId: election.id, communeId: inseeCode },
    include: {
      candidate: true,
      politician: {
        select: {
          id: true,
          slug: true,
          fullName: true,
          photoUrl: true,
          currentParty: { select: { shortName: true, color: true } },
          mandates: {
            where: { isCurrent: true },
            select: { type: true },
            take: 1,
          },
        },
      },
    },
    orderBy: [{ listName: "asc" }, { listPosition: "asc" }],
  });

  // After candidacies fetch, load participation stats for linked politicians
  const politicianIds = candidacies
    .filter((c) => c.politicianId != null)
    .map((c) => c.politicianId!);

  const participationMap = new Map<string, number>();
  const affairsCountMap = new Map<string, number>();

  if (politicianIds.length > 0) {
    const participations = await db.politicianParticipation.findMany({
      where: { politicianId: { in: politicianIds } },
      select: { politicianId: true, participationRate: true },
    });
    for (const p of participations) {
      participationMap.set(p.politicianId, p.participationRate);
    }

    // Count affairs per politician
    const affairsCounts = await db.affair.groupBy({
      by: ["politicianId"],
      where: { politicianId: { in: politicianIds } },
      _count: true,
    });
    for (const a of affairsCounts) {
      affairsCountMap.set(a.politicianId, a._count);
    }
  }

  // Group candidacies by list
  type EnrichedCandidacy = (typeof candidacies)[number] & {
    participationRate?: number | null;
    affairsCount?: number;
  };

  const listsMap = new Map<string, EnrichedCandidacy[]>();
  for (const c of candidacies) {
    const key = c.listName || "Sans liste";
    const list = listsMap.get(key) || [];
    const enriched: EnrichedCandidacy = {
      ...c,
      participationRate: c.politicianId ? (participationMap.get(c.politicianId) ?? null) : null,
      affairsCount: c.politicianId ? (affairsCountMap.get(c.politicianId) ?? 0) : 0,
    };
    list.push(enriched);
    listsMap.set(key, list);
  }

  const lists = Array.from(listsMap.entries()).map(([name, members]) => ({
    name,
    partyLabel: members[0]?.partyLabel || null,
    candidateCount: members.length,
    femaleCount: members.filter((m) => m.candidate?.gender === "F").length,
    teteDeListe: members.find((m) => m.listPosition === 1) || members[0],
    members,
  }));

  const totalCandidates = candidacies.length;
  const femaleCount = candidacies.filter((c) => c.candidate?.gender === "F").length;
  const femaleRate = totalCandidates > 0 ? femaleCount / totalCandidates : 0;
  const nationalPoliticiansCount = candidacies.filter((c) => c.politicianId != null).length;

  return {
    ...commune,
    electionId: election.id,
    round1Date: election.round1Date,
    lists,
    stats: {
      listCount: lists.length,
      candidateCount: totalCandidates,
      femaleRate,
      nationalPoliticiansCount,
    },
  };
});

export const getDepartmentPartyData = cache(async function getDepartmentPartyData() {
  const election = await db.election.findUnique({
    where: { slug: "municipales-2026" },
    select: { id: true },
  });
  if (!election) return [];

  // Raw SQL: for each department, count distinct lists per partyLabel
  const rows = await db.$queryRaw<
    Array<{
      departmentCode: string;
      departmentName: string;
      partyLabel: string;
      listCount: number;
    }>
  >(Prisma.sql`
    SELECT co."departmentCode", co."departmentName", c."partyLabel", COUNT(DISTINCT c."listName")::int as "listCount"
    FROM "Candidacy" c
    JOIN "Commune" co ON c."communeId" = co.id
    WHERE c."electionId" = ${election.id} AND c."partyLabel" IS NOT NULL
    GROUP BY co."departmentCode", co."departmentName", c."partyLabel"
    ORDER BY co."departmentCode", "listCount" DESC
  `);

  // Aggregate: for each department, find the dominant party and build parties list
  const deptMap = new Map<
    string,
    {
      code: string;
      name: string;
      parties: Array<{ label: string; listCount: number }>;
      totalLists: number;
    }
  >();
  for (const row of rows) {
    const existing = deptMap.get(row.departmentCode) || {
      code: row.departmentCode,
      name: row.departmentName,
      parties: [],
      totalLists: 0,
    };
    existing.parties.push({ label: row.partyLabel, listCount: row.listCount });
    existing.totalLists += row.listCount;
    deptMap.set(row.departmentCode, existing);
  }

  return Array.from(deptMap.values()).map((dept) => ({
    ...dept,
    dominantParty: dept.parties[0]?.label ?? null, // Already sorted by listCount DESC
  }));
});

export const getParityBySize = cache(async function getParityBySize() {
  const election = await db.election.findUnique({
    where: { slug: "municipales-2026" },
    select: { id: true },
  });
  if (!election) return [];

  const rows = await db.$queryRaw<
    Array<{
      bracket: string;
      femaleCount: number;
      totalCount: number;
    }>
  >(Prisma.sql`
    SELECT
      CASE
        WHEN co.population < 1000 THEN '< 1 000 hab.'
        WHEN co.population < 10000 THEN '1 000 - 10 000 hab.'
        WHEN co.population < 50000 THEN '10 000 - 50 000 hab.'
        ELSE '50 000+ hab.'
      END as bracket,
      COUNT(*) FILTER (WHERE ca."gender" = 'F')::int as "femaleCount",
      COUNT(*)::int as "totalCount"
    FROM "Candidacy" c
    JOIN "Commune" co ON c."communeId" = co.id
    JOIN "Candidate" ca ON c."candidateId" = ca.id
    WHERE c."electionId" = ${election.id} AND ca."gender" IS NOT NULL AND co.population IS NOT NULL
    GROUP BY bracket
    ORDER BY MIN(co.population)
  `);

  return rows.map((r) => ({
    bracket: r.bracket,
    femaleRate: r.totalCount > 0 ? r.femaleCount / r.totalCount : 0,
    femaleCount: r.femaleCount,
    maleCount: r.totalCount - r.femaleCount,
    totalCount: r.totalCount,
  }));
});

export const getCumulCandidates = cache(async function getCumulCandidates() {
  const election = await db.election.findUnique({
    where: { slug: "municipales-2026" },
    select: { id: true },
  });
  if (!election) return [];

  // Get candidacies with linked politicians who have active national mandates
  const candidacies = await db.candidacy.findMany({
    where: {
      electionId: election.id,
      politicianId: { not: null },
      politician: {
        mandates: {
          some: {
            isCurrent: true,
            type: {
              in: [
                "DEPUTE",
                "SENATEUR",
                "DEPUTE_EUROPEEN",
                "MINISTRE",
                "SECRETAIRE_ETAT",
                "PREMIER_MINISTRE",
              ],
            },
          },
        },
      },
    },
    select: {
      id: true,
      candidateName: true,
      listName: true,
      listPosition: true,
      communeId: true,
      commune: { select: { name: true, departmentCode: true } },
      politician: {
        select: {
          id: true,
          slug: true,
          fullName: true,
          photoUrl: true,
          currentParty: { select: { shortName: true, color: true } },
          mandates: {
            where: { isCurrent: true },
            select: { type: true },
          },
        },
      },
    },
    orderBy: { candidateName: "asc" },
  });

  return candidacies;
});

export const getMissingMayors = cache(async function getMissingMayors() {
  const election = await db.election.findUnique({
    where: { slug: "municipales-2026" },
    select: { id: true },
  });
  if (!election) return [];

  // Politicians with MAIRE mandate who are NOT in the candidacy list
  const rows = await db.$queryRaw<
    Array<{
      id: string;
      slug: string;
      fullName: string;
      photoUrl: string | null;
      partyShortName: string | null;
      partyColor: string | null;
      mandateStartDate: string | null;
    }>
  >(Prisma.sql`
    SELECT p.id, p.slug, p."fullName", p."photoUrl",
           pa."shortName" as "partyShortName", pa.color as "partyColor",
           m."startDate"::text as "mandateStartDate"
    FROM "Politician" p
    JOIN "Mandate" m ON m."politicianId" = p.id AND m."isCurrent" = true AND m.type = 'MAIRE'
    LEFT JOIN "Party" pa ON pa.id = p."currentPartyId"
    WHERE NOT EXISTS (
      SELECT 1 FROM "Candidacy" c WHERE c."politicianId" = p.id AND c."electionId" = ${election.id}
    )
    ORDER BY p."fullName" ASC
  `);

  return rows;
});

export const getParityOutliers = cache(async function getParityOutliers() {
  const election = await db.election.findUnique({
    where: { slug: "municipales-2026" },
    select: { id: true },
  });
  if (!election) return { best: [], worst: [] };

  // Best parity lists (closest to 50%)
  const best = await db.$queryRaw<
    Array<{
      listName: string;
      communeId: string;
      communeName: string;
      departmentCode: string;
      femaleRate: number;
      candidateCount: number;
    }>
  >(Prisma.sql`
    SELECT
      c."listName",
      co.id as "communeId",
      co.name as "communeName",
      co."departmentCode",
      COUNT(*) FILTER (WHERE ca."gender" = 'F')::float / NULLIF(COUNT(*)::float, 0) as "femaleRate",
      COUNT(*)::int as "candidateCount"
    FROM "Candidacy" c
    JOIN "Commune" co ON c."communeId" = co.id
    JOIN "Candidate" ca ON c."candidateId" = ca.id
    WHERE c."electionId" = ${election.id} AND ca."gender" IS NOT NULL AND c."listName" IS NOT NULL
    GROUP BY c."listName", co.id, co.name, co."departmentCode"
    HAVING COUNT(*) >= 10
    ORDER BY ABS(0.5 - COUNT(*) FILTER (WHERE ca."gender" = 'F')::float / NULLIF(COUNT(*)::float, 0)) ASC
    LIMIT 10
  `);

  // Worst parity lists (furthest from 50%)
  const worst = await db.$queryRaw<
    Array<{
      listName: string;
      communeId: string;
      communeName: string;
      departmentCode: string;
      femaleRate: number;
      candidateCount: number;
    }>
  >(Prisma.sql`
    SELECT
      c."listName",
      co.id as "communeId",
      co.name as "communeName",
      co."departmentCode",
      COUNT(*) FILTER (WHERE ca."gender" = 'F')::float / NULLIF(COUNT(*)::float, 0) as "femaleRate",
      COUNT(*)::int as "candidateCount"
    FROM "Candidacy" c
    JOIN "Commune" co ON c."communeId" = co.id
    JOIN "Candidate" ca ON c."candidateId" = ca.id
    WHERE c."electionId" = ${election.id} AND ca."gender" IS NOT NULL AND c."listName" IS NOT NULL
    GROUP BY c."listName", co.id, co.name, co."departmentCode"
    HAVING COUNT(*) >= 10
    ORDER BY ABS(0.5 - COUNT(*) FILTER (WHERE ca."gender" = 'F')::float / NULLIF(COUNT(*)::float, 0)) DESC
    LIMIT 10
  `);

  return { best, worst };
});
