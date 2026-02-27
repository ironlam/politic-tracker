import { db } from "@/lib/db";
import { Chamber, Prisma } from "@/generated/prisma";

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
      participationRate:
        participationRow.total > 0
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
      countedForParticipation > 0 ? Math.round((participating / countedForParticipation) * 100) : 0;

    const maxPosition = Math.max(stats.pour, stats.contre, stats.abstention);
    stats.cohesionRate = participating > 0 ? Math.round((maxPosition / participating) * 100) : 0;
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
      100 - (Math.abs(s.votesFor - s.votesAgainst) / (s.votesFor + s.votesAgainst)) * 100
    ),
  }));
}

async function getGlobalParticipation(
  chamber?: Chamber
): Promise<{ participating: number; total: number }> {
  const chamberFilter = chamber ? Prisma.sql`AND s.chamber = ${chamber}::"Chamber"` : Prisma.sql``;
  const mandateTypeFilter = chamber
    ? chamber === "AN"
      ? Prisma.sql`AND m.type = 'DEPUTE'::"MandateType"`
      : Prisma.sql`AND m.type = 'SENATEUR'::"MandateType"`
    : Prisma.sql`AND m.type IN ('DEPUTE'::"MandateType", 'SENATEUR'::"MandateType")`;

  // Use eligible scrutins as denominator (same methodology as per-politician stats)
  const rows = await db.$queryRaw<[{ participating: bigint; total: bigint }]>`
    SELECT
      COALESCE(SUM(vote_count), 0) as "participating",
      COALESCE(SUM(eligible_count), 0) as "total"
    FROM (
      SELECT
        COUNT(DISTINCT v.id)::bigint as vote_count,
        COUNT(DISTINCT s.id)::bigint as eligible_count
      FROM "Politician" pol
      JOIN "Mandate" m ON m."politicianId" = pol.id
        AND m."isCurrent" = true
        ${mandateTypeFilter}
      JOIN "Scrutin" s ON s.chamber = (CASE WHEN m.type = 'DEPUTE'::"MandateType" THEN 'AN'::"Chamber" ELSE 'SENAT'::"Chamber" END)
        AND s."votingDate" >= m."startDate"
        AND (m."endDate" IS NULL OR s."votingDate" <= m."endDate")
        ${chamberFilter}
      LEFT JOIN "Vote" v ON v."scrutinId" = s.id AND v."politicianId" = pol.id
      WHERE pol."publicationStatus" = 'PUBLISHED'
      GROUP BY pol.id, m.type
    ) sub
  `;

  const row = rows[0];
  return {
    participating: Number(row?.participating ?? 0),
    total: Number(row?.total ?? 0),
  };
}

async function getChamberCounts(chamber?: Chamber) {
  const rows = await db.$queryRaw<
    [{ an: number; senat: number; adoptes: number; rejetes: number }]
  >`
    SELECT
      COUNT(*) FILTER (WHERE chamber = 'AN'::"Chamber")::int as an,
      COUNT(*) FILTER (WHERE chamber = 'SENAT'::"Chamber")::int as senat,
      COUNT(*) FILTER (WHERE result = 'ADOPTED' ${chamber ? Prisma.sql`AND chamber = ${chamber}::"Chamber"` : Prisma.sql``})::int as adoptes,
      COUNT(*) FILTER (WHERE result = 'REJECTED' ${chamber ? Prisma.sql`AND chamber = ${chamber}::"Chamber"` : Prisma.sql``})::int as rejetes
    FROM "Scrutin"
  `;

  return rows[0];
}

// ============================================
// Per-politician voting stats
// ============================================

export interface PoliticianVotingStats {
  total: number;
  pour: number;
  contre: number;
  abstention: number;
  nonVotant: number;
  absent: number;
  participationRate: number;
}

/**
 * Compute voting stats for a single politician.
 * Shared by politician profile, votes subpage, and API route.
 */
export async function getPoliticianVotingStats(
  politicianId: string
): Promise<PoliticianVotingStats> {
  const stats = await db.vote.groupBy({
    by: ["position"],
    where: { politicianId },
    _count: true,
  });

  const votingStats: PoliticianVotingStats = {
    total: 0,
    pour: 0,
    contre: 0,
    abstention: 0,
    nonVotant: 0,
    absent: 0,
    participationRate: 0,
  };

  for (const s of stats) {
    votingStats.total += s._count;
    switch (s.position) {
      case "POUR":
        votingStats.pour = s._count;
        break;
      case "CONTRE":
        votingStats.contre = s._count;
        break;
      case "ABSTENTION":
        votingStats.abstention = s._count;
        break;
      case "NON_VOTANT":
        votingStats.nonVotant = s._count;
        break;
      case "ABSENT":
        votingStats.absent = s._count;
        break;
    }
  }

  // Compute real participation based on eligible scrutins during mandate period
  const mandate = await db.mandate.findFirst({
    where: {
      politicianId,
      isCurrent: true,
      type: { in: ["DEPUTE", "SENATEUR"] },
    },
    select: { startDate: true, endDate: true, type: true },
  });

  if (mandate) {
    const chamber = mandate.type === "DEPUTE" ? "AN" : "SENAT";
    const eligibleRows = await db.$queryRaw<[{ count: number }]>`
      SELECT COUNT(*)::int as "count"
      FROM "Scrutin" s
      WHERE s.chamber = ${chamber}::"Chamber"
        AND s."votingDate" >= ${mandate.startDate}
        AND (${mandate.endDate}::timestamp IS NULL OR s."votingDate" <= ${mandate.endDate})
    `;
    const eligibleScrutins = eligibleRows[0]?.count ?? 0;

    if (eligibleScrutins > 0) {
      votingStats.absent = Math.max(0, eligibleScrutins - votingStats.total);
      votingStats.participationRate = Math.round((votingStats.total / eligibleScrutins) * 100);
    }
  } else {
    // Fallback: no active parliamentary mandate — use old ratio
    const expressed = votingStats.pour + votingStats.contre + votingStats.abstention;
    const countedForParticipation = votingStats.total - votingStats.nonVotant;
    votingStats.participationRate =
      countedForParticipation > 0 ? Math.round((expressed / countedForParticipation) * 100) : 0;
  }

  return votingStats;
}

// ============================================
// Participation ranking
// ============================================

export interface ParticipationRankingEntry {
  politicianId: string;
  firstName: string;
  lastName: string;
  slug: string;
  photoUrl: string | null;
  partyId: string | null;
  partyShortName: string | null;
  partyColor: string | null;
  partySlug: string | null;
  groupCode: string | null;
  groupName: string | null;
  groupColor: string | null;
  mandateType: string;
  votesCount: number;
  eligibleScrutins: number;
  participationRate: number;
}

export interface ParticipationRankingResult {
  entries: ParticipationRankingEntry[];
  total: number;
}

/**
 * Get participation ranking: compare each politician's vote count
 * against the total number of eligible scrutins during their active mandate.
 */
async function getParticipationRanking(
  chamber?: Chamber,
  partyId?: string,
  page: number = 1,
  pageSize: number = 50,
  sortDirection: "ASC" | "DESC" = "ASC"
): Promise<ParticipationRankingResult> {
  const offset = (page - 1) * pageSize;

  // Build conditional WHERE fragments
  const chamberFilter = chamber ? Prisma.sql`AND s.chamber = ${chamber}::"Chamber"` : Prisma.sql``;
  const mandateTypeFilter = chamber
    ? chamber === "AN"
      ? Prisma.sql`AND m.type = 'DEPUTE'::"MandateType"`
      : Prisma.sql`AND m.type = 'SENATEUR'::"MandateType"`
    : Prisma.sql`AND m.type IN ('DEPUTE'::"MandateType", 'SENATEUR'::"MandateType")`;
  const partyFilter = partyId ? Prisma.sql`AND pol."currentPartyId" = ${partyId}` : Prisma.sql``;
  const orderDirection = sortDirection === "DESC" ? Prisma.sql`DESC` : Prisma.sql`ASC`;

  const entries = await db.$queryRaw<ParticipationRankingEntry[]>`
    WITH eligible AS (
      SELECT
        pol.id as "politicianId",
        pol."firstName",
        pol."lastName",
        pol.slug,
        COALESCE(pol."blobPhotoUrl", pol."photoUrl") as "photoUrl",
        pol."currentPartyId" as "partyId",
        p."shortName" as "partyShortName",
        p.color as "partyColor",
        p.slug as "partySlug",
        pg.code as "groupCode",
        pg.name as "groupName",
        pg.color as "groupColor",
        m.type::text as "mandateType",
        COUNT(DISTINCT v.id)::int as "votesCount",
        COUNT(DISTINCT s.id)::int as "eligibleScrutins"
      FROM "Politician" pol
      JOIN "Mandate" m ON m."politicianId" = pol.id
        AND m."isCurrent" = true
        ${mandateTypeFilter}
      JOIN "Scrutin" s ON s.chamber = (CASE WHEN m.type = 'DEPUTE'::"MandateType" THEN 'AN'::"Chamber" ELSE 'SENAT'::"Chamber" END)
        AND s."votingDate" >= m."startDate"
        AND (m."endDate" IS NULL OR s."votingDate" <= m."endDate")
        ${chamberFilter}
      LEFT JOIN "Vote" v ON v."scrutinId" = s.id AND v."politicianId" = pol.id
      LEFT JOIN "Party" p ON p.id = pol."currentPartyId"
      LEFT JOIN "ParliamentaryGroup" pg ON pg.id = m."parliamentaryGroupId"
      WHERE pol."publicationStatus" = 'PUBLISHED'
        ${partyFilter}
      GROUP BY pol.id, pol."firstName", pol."lastName", pol.slug, pol."blobPhotoUrl", pol."photoUrl",
               pol."currentPartyId", p."shortName", p.color, p.slug, pg.code, pg.name, pg.color, m.type
      HAVING COUNT(DISTINCT s.id) > 0
    )
    SELECT
      "politicianId",
      "firstName",
      "lastName",
      slug,
      "photoUrl",
      "partyId",
      "partyShortName",
      "partyColor",
      "partySlug",
      "groupCode",
      "groupName",
      "groupColor",
      "mandateType",
      "votesCount",
      "eligibleScrutins",
      ROUND(("votesCount"::numeric / "eligibleScrutins"::numeric) * 100, 1)::float as "participationRate"
    FROM eligible
    ORDER BY "participationRate" ${orderDirection}, "eligibleScrutins" DESC
    LIMIT ${pageSize} OFFSET ${offset}
  `;

  const countResult = await db.$queryRaw<[{ count: number }]>`
    SELECT COUNT(*)::int as "count"
    FROM (
      SELECT pol.id
      FROM "Politician" pol
      JOIN "Mandate" m ON m."politicianId" = pol.id
        AND m."isCurrent" = true
        ${mandateTypeFilter}
      JOIN "Scrutin" s ON s.chamber = (CASE WHEN m.type = 'DEPUTE'::"MandateType" THEN 'AN'::"Chamber" ELSE 'SENAT'::"Chamber" END)
        AND s."votingDate" >= m."startDate"
        AND (m."endDate" IS NULL OR s."votingDate" <= m."endDate")
        ${chamberFilter}
      WHERE pol."publicationStatus" = 'PUBLISHED'
        ${partyFilter}
      GROUP BY pol.id, m.type
      HAVING COUNT(DISTINCT s.id) > 0
    ) sub
  `;

  return {
    entries,
    total: countResult[0]?.count ?? 0,
  };
}

// ============================================
// Party participation stats
// ============================================

export interface PartyParticipationStats {
  partyId: string;
  partyName: string;
  partyShortName: string;
  partyColor: string | null;
  partySlug: string | null;
  avgParticipationRate: number;
  memberCount: number;
}

/**
 * Get average participation rate per party, based on individual mandate-eligible scrutins.
 */
async function getPartyParticipationStats(chamber?: Chamber): Promise<PartyParticipationStats[]> {
  const chamberFilter = chamber ? Prisma.sql`AND s.chamber = ${chamber}::"Chamber"` : Prisma.sql``;
  const mandateTypeFilter = chamber
    ? chamber === "AN"
      ? Prisma.sql`AND m.type = 'DEPUTE'::"MandateType"`
      : Prisma.sql`AND m.type = 'SENATEUR'::"MandateType"`
    : Prisma.sql`AND m.type IN ('DEPUTE'::"MandateType", 'SENATEUR'::"MandateType")`;

  const rows = await db.$queryRaw<PartyParticipationStats[]>`
    WITH individual AS (
      SELECT
        pol."currentPartyId" as "partyId",
        COUNT(DISTINCT v.id)::numeric / NULLIF(COUNT(DISTINCT s.id)::numeric, 0) * 100 as rate
      FROM "Politician" pol
      JOIN "Mandate" m ON m."politicianId" = pol.id
        AND m."isCurrent" = true
        ${mandateTypeFilter}
      JOIN "Scrutin" s ON s.chamber = (CASE WHEN m.type = 'DEPUTE'::"MandateType" THEN 'AN'::"Chamber" ELSE 'SENAT'::"Chamber" END)
        AND s."votingDate" >= m."startDate"
        AND (m."endDate" IS NULL OR s."votingDate" <= m."endDate")
        ${chamberFilter}
      LEFT JOIN "Vote" v ON v."scrutinId" = s.id AND v."politicianId" = pol.id
      WHERE pol."currentPartyId" IS NOT NULL
        AND pol."publicationStatus" = 'PUBLISHED'
      GROUP BY pol.id, pol."currentPartyId", m.type
      HAVING COUNT(DISTINCT s.id) > 0
    )
    SELECT
      i."partyId",
      p.name as "partyName",
      p."shortName" as "partyShortName",
      p.color as "partyColor",
      p.slug as "partySlug",
      ROUND(AVG(i.rate), 1)::float as "avgParticipationRate",
      COUNT(*)::int as "memberCount"
    FROM individual i
    JOIN "Party" p ON p.id = i."partyId"
    GROUP BY i."partyId", p.name, p."shortName", p.color, p.slug
    HAVING COUNT(*) >= 3
    ORDER BY "avgParticipationRate" ASC
  `;

  return rows;
}

// ============================================
// Group participation stats (by parliamentary group)
// ============================================

export interface GroupParticipationStats {
  groupId: string;
  groupName: string;
  groupCode: string;
  groupColor: string | null;
  groupChamber: string;
  avgParticipationRate: number;
  memberCount: number;
}

async function getGroupParticipationStats(chamber?: Chamber): Promise<GroupParticipationStats[]> {
  const chamberFilter = chamber ? Prisma.sql`AND s.chamber = ${chamber}::"Chamber"` : Prisma.sql``;
  const mandateTypeFilter = chamber
    ? chamber === "AN"
      ? Prisma.sql`AND m.type = 'DEPUTE'::"MandateType"`
      : Prisma.sql`AND m.type = 'SENATEUR'::"MandateType"`
    : Prisma.sql`AND m.type IN ('DEPUTE'::"MandateType", 'SENATEUR'::"MandateType")`;

  return db.$queryRaw<GroupParticipationStats[]>`
    WITH individual AS (
      SELECT
        pg.id as "groupId",
        COUNT(DISTINCT v.id)::numeric / NULLIF(COUNT(DISTINCT s.id)::numeric, 0) * 100 as rate
      FROM "Politician" pol
      JOIN "Mandate" m ON m."politicianId" = pol.id
        AND m."isCurrent" = true
        ${mandateTypeFilter}
      JOIN "Scrutin" s ON s.chamber = (CASE WHEN m.type = 'DEPUTE'::"MandateType" THEN 'AN'::"Chamber" ELSE 'SENAT'::"Chamber" END)
        AND s."votingDate" >= m."startDate"
        AND (m."endDate" IS NULL OR s."votingDate" <= m."endDate")
        ${chamberFilter}
      LEFT JOIN "Vote" v ON v."scrutinId" = s.id AND v."politicianId" = pol.id
      JOIN "ParliamentaryGroup" pg ON pg.id = m."parliamentaryGroupId"
      WHERE pol."publicationStatus" = 'PUBLISHED'
      GROUP BY pol.id, pg.id, m.type
      HAVING COUNT(DISTINCT s.id) > 0
    )
    SELECT
      i."groupId",
      pg.name as "groupName",
      pg.code as "groupCode",
      pg.color as "groupColor",
      pg.chamber::text as "groupChamber",
      ROUND(AVG(i.rate), 1)::float as "avgParticipationRate",
      COUNT(*)::int as "memberCount"
    FROM individual i
    JOIN "ParliamentaryGroup" pg ON pg.id = i."groupId"
    GROUP BY i."groupId", pg.name, pg.code, pg.color, pg.chamber
    HAVING COUNT(*) >= 3
    ORDER BY "avgParticipationRate" ASC
  `;
}

// ============================================
// Per-politician participation card data
// ============================================

export interface PoliticianParliamentaryCardData {
  chamber: "AN" | "SENAT";
  mandateType: "DEPUTE" | "SENATEUR";
  votesCount: number;
  eligibleScrutins: number;
  participationRate: number;
  rank: number;
  totalPeers: number;
}

/**
 * Get participation rank and stats for a single politician.
 * Uses a window function to compute rank in a single query.
 */
export async function getPoliticianParliamentaryCard(
  politicianId: string,
  mandateType: "DEPUTE" | "SENATEUR"
): Promise<PoliticianParliamentaryCardData | null> {
  const chamber = mandateType === "DEPUTE" ? "AN" : "SENAT";

  const rows = await db.$queryRaw<
    {
      votesCount: number;
      eligibleScrutins: number;
      participationRate: number;
      rank: number;
      totalPeers: number;
    }[]
  >`
    WITH rates AS (
      SELECT
        pol.id as "politicianId",
        COUNT(v.id)::int as "votesCount",
        COUNT(DISTINCT s.id)::int as "eligibleScrutins",
        CASE WHEN COUNT(DISTINCT s.id) > 0
          THEN ROUND(COUNT(v.id)::numeric / COUNT(DISTINCT s.id) * 100, 1)
          ELSE 0 END::float as rate,
        RANK() OVER (ORDER BY
          CASE WHEN COUNT(DISTINCT s.id) > 0
            THEN COUNT(v.id)::float / COUNT(DISTINCT s.id)
            ELSE 0 END DESC) as rank,
        COUNT(*) OVER ()::int as "totalPeers"
      FROM "Politician" pol
      JOIN "Mandate" m ON m."politicianId" = pol.id
        AND m."isCurrent" = true
        AND m.type = ${mandateType}::"MandateType"
      JOIN "Scrutin" s ON s.chamber = ${chamber}::"Chamber"
        AND s."votingDate" >= m."startDate"
        AND (m."endDate" IS NULL OR s."votingDate" <= m."endDate")
      LEFT JOIN "Vote" v ON v."scrutinId" = s.id AND v."politicianId" = pol.id
      WHERE pol."publicationStatus" = 'PUBLISHED'
      GROUP BY pol.id
      HAVING COUNT(DISTINCT s.id) > 0
    )
    SELECT
      "votesCount",
      "eligibleScrutins",
      rate as "participationRate",
      rank::int,
      "totalPeers"
    FROM rates
    WHERE "politicianId" = ${politicianId}
  `;

  if (rows.length === 0) return null;

  return {
    chamber,
    mandateType,
    ...rows[0],
  };
}

// ============================================
// Export
// ============================================

export const voteStatsService = {
  getVoteStats,
  getPoliticianVotingStats,
  getParticipationRanking,
  getPartyParticipationStats,
  getGroupParticipationStats,
  getPoliticianParliamentaryCard,
};
