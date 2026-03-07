import { cache } from "react";
import { cacheTag, cacheLife } from "next/cache";
import { Prisma } from "@/generated/prisma";
import { db } from "@/lib/db";
import type { ElectionType } from "@/types";

// ============================================
// Types
// ============================================

export interface Municipales2020Stats {
  totalCandidacies: number;
  totalCommunes: number;
  totalLists: number;
  electedMayorsCount: number;
}

export interface ElectionRoundData {
  round: number;
  date: Date;
  registeredVoters: number | null;
  actualVoters: number | null;
  participationRate: number | null;
  blankVotes: number | null;
  nullVotes: number | null;
}

export interface DepartmentResult2020 {
  departmentCode: string;
  departmentName: string;
  communeCount: number;
  candidacyCount: number;
  listCount: number;
}

export interface CommuneListResult2020 {
  listName: string;
  partyLabel: string | null;
  candidateName: string;
  round1Votes: number | null;
  round1Pct: number | null;
  round1Qualified: boolean | null;
  round2Votes: number | null;
  round2Pct: number | null;
  isElected: boolean;
  candidateCount: number;
}

export interface CommuneResult2020 {
  inseeCode: string;
  communeName: string;
  departmentCode: string;
  departmentName: string;
  population: number | null;
  totalSeats: number | null;
  lists: CommuneListResult2020[];
}

// ============================================
// Helper: resolve election ID for municipales-2020
// ============================================

const getElectionId = cache(async function getElectionId(): Promise<string | null> {
  const election = await db.election.findUnique({
    where: { slug: "municipales-2020" },
    select: { id: true },
  });
  return election?.id ?? null;
});

// ============================================
// 1. getMunicipales2020Stats
// ============================================

export const getMunicipales2020Stats = cache(
  async function getMunicipales2020Stats(): Promise<Municipales2020Stats | null> {
    const electionId = await getElectionId();
    if (!electionId) return null;

    const [totalCandidacies, communeGroups, listGroups, electedMayorsCount] = await Promise.all([
      db.candidacy.count({
        where: { electionId },
      }),

      db.candidacy.groupBy({
        by: ["communeId"],
        where: { electionId, communeId: { not: null } },
      }),

      db.candidacy.groupBy({
        by: ["listName", "communeId"],
        where: { electionId, listName: { not: null }, communeId: { not: null } },
      }),

      db.candidacy.count({
        where: {
          electionId,
          isElected: true,
          listPosition: 1,
        },
      }),
    ]);

    return {
      totalCandidacies,
      totalCommunes: communeGroups.length,
      totalLists: listGroups.length,
      electedMayorsCount,
    };
  }
);

// ============================================
// 2. getMunicipales2020Rounds
// ============================================

export const getMunicipales2020Rounds = cache(async function getMunicipales2020Rounds(): Promise<
  ElectionRoundData[]
> {
  const electionId = await getElectionId();
  if (!electionId) return [];

  const rounds = await db.electionRound.findMany({
    where: { electionId },
    orderBy: { round: "asc" },
  });

  return rounds.map((r) => ({
    round: r.round,
    date: r.date,
    registeredVoters: r.registeredVoters,
    actualVoters: r.actualVoters,
    participationRate: r.participationRate ? Number(r.participationRate) : null,
    blankVotes: r.blankVotes,
    nullVotes: r.nullVotes,
  }));
});

// ============================================
// 3. getDepartmentResults2020
// ============================================

export const getDepartmentResults2020 = cache(async function getDepartmentResults2020(): Promise<
  DepartmentResult2020[]
> {
  const electionId = await getElectionId();
  if (!electionId) return [];

  const rows = await db.$queryRaw<DepartmentResult2020[]>(Prisma.sql`
      SELECT
        co."departmentCode" AS "departmentCode",
        co."departmentName" AS "departmentName",
        COUNT(DISTINCT co.id)::int AS "communeCount",
        COUNT(c.id)::int AS "candidacyCount",
        COUNT(DISTINCT (c."listName", co.id))::int AS "listCount"
      FROM "Candidacy" c
      JOIN "Commune" co ON c."communeId" = co.id
      WHERE c."electionId" = ${electionId}
      GROUP BY co."departmentCode", co."departmentName"
      ORDER BY co."departmentCode" ASC
    `);

  return rows;
});

// ============================================
// 4. getCommuneResults2020
// ============================================

export const getCommuneResults2020 = cache(async function getCommuneResults2020(
  inseeCode: string
): Promise<CommuneResult2020 | null> {
  const electionId = await getElectionId();
  if (!electionId) return null;

  // Fetch commune info
  const commune = await db.commune.findUnique({
    where: { id: inseeCode },
    select: {
      id: true,
      name: true,
      departmentCode: true,
      departmentName: true,
      population: true,
      totalSeats: true,
    },
  });
  if (!commune) return null;

  // Fetch all candidacies for this commune
  const candidacies = await db.candidacy.findMany({
    where: { electionId, communeId: inseeCode },
    select: {
      candidateName: true,
      listName: true,
      listPosition: true,
      partyLabel: true,
      round1Votes: true,
      round1Pct: true,
      round1Qualified: true,
      round2Votes: true,
      round2Pct: true,
      isElected: true,
    },
    orderBy: [{ listName: "asc" }, { listPosition: "asc" }],
  });

  if (candidacies.length === 0) {
    return {
      inseeCode: commune.id,
      communeName: commune.name,
      departmentCode: commune.departmentCode,
      departmentName: commune.departmentName,
      population: commune.population,
      totalSeats: commune.totalSeats,
      lists: [],
    };
  }

  // Group candidacies by listName
  const listsMap = new Map<
    string,
    {
      partyLabel: string | null;
      teteDeListe: string;
      round1Votes: number | null;
      round1Pct: number | null;
      round1Qualified: boolean | null;
      round2Votes: number | null;
      round2Pct: number | null;
      isElected: boolean;
      candidateCount: number;
    }
  >();

  for (const c of candidacies) {
    const key = c.listName || c.candidateName;
    const existing = listsMap.get(key);
    if (!existing) {
      // First candidate in this list — use them as tete de liste
      listsMap.set(key, {
        partyLabel: c.partyLabel,
        teteDeListe: c.candidateName,
        round1Votes: c.round1Votes,
        round1Pct: c.round1Pct ? Number(c.round1Pct) : null,
        round1Qualified: c.round1Qualified,
        round2Votes: c.round2Votes,
        round2Pct: c.round2Pct ? Number(c.round2Pct) : null,
        isElected: c.isElected,
        candidateCount: 1,
      });
    } else {
      existing.candidateCount += 1;
      // If this candidate is tete de liste (position 1), use their data
      if (c.listPosition === 1) {
        existing.teteDeListe = c.candidateName;
        existing.round1Votes = c.round1Votes;
        existing.round1Pct = c.round1Pct ? Number(c.round1Pct) : null;
        existing.round1Qualified = c.round1Qualified;
        existing.round2Votes = c.round2Votes;
        existing.round2Pct = c.round2Pct ? Number(c.round2Pct) : null;
        existing.isElected = c.isElected;
      }
      // Propagate isElected = true from any list member
      if (c.isElected) {
        existing.isElected = true;
      }
    }
  }

  // Build lists array and sort: elected first, then by round1Pct desc
  const lists: CommuneListResult2020[] = Array.from(listsMap.entries())
    .map(([listName, data]) => ({
      listName,
      partyLabel: data.partyLabel,
      candidateName: data.teteDeListe,
      round1Votes: data.round1Votes,
      round1Pct: data.round1Pct,
      round1Qualified: data.round1Qualified,
      round2Votes: data.round2Votes,
      round2Pct: data.round2Pct,
      isElected: data.isElected,
      candidateCount: data.candidateCount,
    }))
    .sort((a, b) => {
      // Elected lists first
      if (a.isElected !== b.isElected) return a.isElected ? -1 : 1;
      // Then by round1Pct descending
      return (b.round1Pct ?? 0) - (a.round1Pct ?? 0);
    });

  return {
    inseeCode: commune.id,
    communeName: commune.name,
    departmentCode: commune.departmentCode,
    departmentName: commune.departmentName,
    population: commune.population,
    totalSeats: commune.totalSeats,
    lists,
  };
});

// ============================================
// 5. getUpcomingElections
// ============================================

export async function getUpcomingElections() {
  "use cache";
  cacheTag("elections", "homepage");
  cacheLife("minutes");

  const now = new Date();
  return db.election.findMany({
    where: {
      status: { not: "COMPLETED" },
      round1Date: { gte: now },
    },
    orderBy: { round1Date: "asc" },
    take: 4,
  });
}

// ============================================
// 6. getElections (listing with optional type filter)
// ============================================

export async function getElections(typeFilter?: ElectionType) {
  "use cache";
  cacheTag("elections");
  cacheLife("minutes");

  const where = typeFilter ? { type: typeFilter } : {};

  return db.election.findMany({
    where,
    orderBy: [{ round1Date: { sort: "asc", nulls: "last" } }],
  });
}

// ============================================
// 7. getTypeCounts
// ============================================

export async function getTypeCounts() {
  "use cache";
  cacheTag("elections");
  cacheLife("minutes");

  return db.election.groupBy({
    by: ["type"],
    _count: true,
    orderBy: { _count: { type: "desc" } },
  });
}
