import { db } from "@/lib/db";
import { Chamber } from "@/generated/prisma";

// ============================================
// Types
// ============================================

export interface PartyVoteStats {
  partyId: string;
  partyName: string;
  partyShortName: string;
  partyColor: string | null;
  partySlug: string | null;
  totalVotes: number;
  pour: number;
  contre: number;
  abstention: number;
  nonVotant: number;
  absent: number;
  cohesionRate: number;
  participationRate: number;
}

export interface DivisiveScrutin {
  id: string;
  slug: string | null;
  title: string;
  votingDate: Date;
  chamber: Chamber;
  votesFor: number;
  votesAgainst: number;
  votesAbstain: number;
  divisionScore: number;
}

export interface VoteStatsResult {
  global: {
    totalScrutins: number;
    totalVotesFor: number;
    totalVotesAgainst: number;
    totalVotesAbstain: number;
    participationRate: number;
    anScrutins: number;
    senatScrutins: number;
    adoptes: number;
    rejetes: number;
  };
  parties: PartyVoteStats[];
  divisiveScrutins: DivisiveScrutin[];
}

// ============================================
// Service
// ============================================

/**
 * Get comprehensive vote statistics.
 * Replaces the N+1 query pattern (165 queries) with a single raw SQL query.
 */
async function getVoteStats(
  chamber?: Chamber,
  options?: { partyLimit?: number; divisiveLimit?: number }
): Promise<VoteStatsResult> {
  const partyLimit = options?.partyLimit ?? 15;
  const divisiveLimit = options?.divisiveLimit ?? 10;

  const [partyRows, divisiveScrutins, globalStats, participationRow, chamberCounts] =
    await Promise.all([
      // 1. Party vote stats — single query replaces 165 N+1 queries
      getPartyVoteRows(chamber),

      // 2. Divisive scrutins
      getDivisiveScrutins(chamber, divisiveLimit),

      // 3. Global aggregate stats
      db.scrutin.aggregate({
        where: chamber ? { chamber } : {},
        _count: true,
        _sum: {
          votesFor: true,
          votesAgainst: true,
          votesAbstain: true,
        },
      }),

      // 4. Global participation rate
      getGlobalParticipation(chamber),

      // 5. Chamber breakdown + adopted/rejected
      getChamberCounts(chamber),
    ]);

  // Aggregate party rows into stats
  const parties = aggregatePartyStats(partyRows, partyLimit);

  return {
    global: {
      totalScrutins: globalStats._count,
      totalVotesFor: globalStats._sum.votesFor || 0,
      totalVotesAgainst: globalStats._sum.votesAgainst || 0,
      totalVotesAbstain: globalStats._sum.votesAbstain || 0,
      participationRate: participationRow.total > 0
        ? Math.round((participationRow.participating / participationRow.total) * 100)
        : 0,
      anScrutins: chamberCounts.an,
      senatScrutins: chamberCounts.senat,
      adoptes: chamberCounts.adoptes,
      rejetes: chamberCounts.rejetes,
    },
    parties,
    divisiveScrutins,
  };
}

// ============================================
// Internal queries
// ============================================

interface PartyVoteRow {
  partyId: string;
  partyName: string;
  partyShortName: string;
  partyColor: string | null;
  partySlug: string | null;
  position: string;
  count: bigint;
}

async function getPartyVoteRows(chamber?: Chamber): Promise<PartyVoteRow[]> {
  if (chamber) {
    return db.$queryRaw<PartyVoteRow[]>`
      SELECT
        p.id as "partyId",
        p.name as "partyName",
        p."shortName" as "partyShortName",
        p.color as "partyColor",
        p.slug as "partySlug",
        v.position,
        COUNT(v.id) as count
      FROM "Vote" v
      JOIN "Politician" pol ON v."politicianId" = pol.id
      JOIN "Party" p ON pol."currentPartyId" = p.id
      JOIN "Scrutin" s ON v."scrutinId" = s.id
      WHERE s.chamber = ${chamber}::"Chamber"
      GROUP BY p.id, p.name, p."shortName", p.color, p.slug, v.position
      ORDER BY COUNT(v.id) DESC
    `;
  }

  return db.$queryRaw<PartyVoteRow[]>`
    SELECT
      p.id as "partyId",
      p.name as "partyName",
      p."shortName" as "partyShortName",
      p.color as "partyColor",
      p.slug as "partySlug",
      v.position,
      COUNT(v.id) as count
    FROM "Vote" v
    JOIN "Politician" pol ON v."politicianId" = pol.id
    JOIN "Party" p ON pol."currentPartyId" = p.id
    JOIN "Scrutin" s ON v."scrutinId" = s.id
    GROUP BY p.id, p.name, p."shortName", p.color, p.slug, v.position
    ORDER BY COUNT(v.id) DESC
  `;
}

function aggregatePartyStats(rows: PartyVoteRow[], limit: number): PartyVoteStats[] {
  const partyMap = new Map<string, PartyVoteStats>();

  for (const row of rows) {
    if (!partyMap.has(row.partyId)) {
      partyMap.set(row.partyId, {
        partyId: row.partyId,
        partyName: row.partyName,
        partyShortName: row.partyShortName,
        partyColor: row.partyColor,
        partySlug: row.partySlug,
        totalVotes: 0,
        pour: 0,
        contre: 0,
        abstention: 0,
        nonVotant: 0,
        absent: 0,
        cohesionRate: 0,
        participationRate: 0,
      });
    }

    const stats = partyMap.get(row.partyId)!;
    const count = Number(row.count);
    stats.totalVotes += count;

    switch (row.position) {
      case "POUR":
        stats.pour = count;
        break;
      case "CONTRE":
        stats.contre = count;
        break;
      case "ABSTENTION":
        stats.abstention = count;
        break;
      case "NON_VOTANT":
        stats.nonVotant = count;
        break;
      case "ABSENT":
        stats.absent = count;
        break;
    }
  }

  // Calculate rates
  for (const stats of partyMap.values()) {
    const participating = stats.pour + stats.contre + stats.abstention;
    const countedForParticipation = stats.totalVotes - stats.nonVotant;
    stats.participationRate =
      countedForParticipation > 0
        ? Math.round((participating / countedForParticipation) * 100)
        : 0;

    const maxPosition = Math.max(stats.pour, stats.contre, stats.abstention);
    stats.cohesionRate =
      participating > 0 ? Math.round((maxPosition / participating) * 100) : 0;
  }

  return Array.from(partyMap.values())
    .filter((p) => p.totalVotes >= 100)
    .sort((a, b) => b.totalVotes - a.totalVotes)
    .slice(0, limit);
}

async function getDivisiveScrutins(
  chamber?: Chamber,
  limit: number = 10
): Promise<DivisiveScrutin[]> {
  let rows: {
    id: string;
    slug: string | null;
    title: string;
    votingDate: Date;
    chamber: Chamber;
    votesFor: number;
    votesAgainst: number;
    votesAbstain: number;
  }[];

  if (chamber) {
    rows = await db.$queryRaw`
      SELECT
        s.id,
        s.slug,
        s.title,
        s."votingDate",
        s.chamber,
        s."votesFor",
        s."votesAgainst",
        s."votesAbstain"
      FROM "Scrutin" s
      WHERE s."votesFor" > 10 AND s."votesAgainst" > 10
        AND s.chamber = ${chamber}::"Chamber"
      ORDER BY
        ABS(s."votesFor" - s."votesAgainst")::float / NULLIF(s."votesFor" + s."votesAgainst", 0) ASC,
        s."votingDate" DESC
      LIMIT ${limit}
    `;
  } else {
    rows = await db.$queryRaw`
      SELECT
        s.id,
        s.slug,
        s.title,
        s."votingDate",
        s.chamber,
        s."votesFor",
        s."votesAgainst",
        s."votesAbstain"
      FROM "Scrutin" s
      WHERE s."votesFor" > 10 AND s."votesAgainst" > 10
      ORDER BY
        ABS(s."votesFor" - s."votesAgainst")::float / NULLIF(s."votesFor" + s."votesAgainst", 0) ASC,
        s."votingDate" DESC
      LIMIT ${limit}
    `;
  }

  return rows.map((s) => ({
    ...s,
    divisionScore: Math.round(
      100 -
        (Math.abs(s.votesFor - s.votesAgainst) /
          (s.votesFor + s.votesAgainst)) *
          100
    ),
  }));
}

async function getGlobalParticipation(
  chamber?: Chamber
): Promise<{ participating: number; total: number }> {
  let rows: { participating: bigint; total: bigint }[];

  if (chamber) {
    rows = await db.$queryRaw`
      SELECT
        COUNT(CASE WHEN v.position IN ('POUR', 'CONTRE', 'ABSTENTION') THEN 1 END) as "participating",
        COUNT(v.id) as "total"
      FROM "Vote" v
      JOIN "Scrutin" s ON v."scrutinId" = s.id
      WHERE s.chamber = ${chamber}::"Chamber"
    `;
  } else {
    rows = await db.$queryRaw`
      SELECT
        COUNT(CASE WHEN v.position IN ('POUR', 'CONTRE', 'ABSTENTION') THEN 1 END) as "participating",
        COUNT(v.id) as "total"
      FROM "Vote" v
    `;
  }

  const row = rows[0];
  return {
    participating: Number(row?.participating ?? 0),
    total: Number(row?.total ?? 0),
  };
}

async function getChamberCounts(chamber?: Chamber) {
  const where = chamber ? { chamber } : {};

  const [an, senat, adoptes, rejetes] = await Promise.all([
    db.scrutin.count({ where: { chamber: "AN" } }),
    db.scrutin.count({ where: { chamber: "SENAT" } }),
    db.scrutin.count({ where: { ...where, result: "ADOPTED" } }),
    db.scrutin.count({ where: { ...where, result: "REJECTED" } }),
  ]);

  return { an, senat, adoptes, rejetes };
}

// ============================================
// Export
// ============================================

export const voteStatsService = {
  getVoteStats,
};
