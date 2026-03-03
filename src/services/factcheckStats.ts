import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma";
import { FACTCHECK_ALLOWED_SOURCES, VERDICT_GROUPS } from "@/config/labels";
import { bayesianScore } from "@/lib/bayesianScore";

// ============================================
// Types
// ============================================

export interface FactCheckStatsResult {
  global: {
    totalFactChecks: number;
    byVerdict: Record<string, number>;
  };
  byParty: Array<{
    partyId: string;
    partyName: string;
    partyShortName: string;
    partyColor: string | null;
    partySlug: string | null;
    totalMentions: number;
    byVerdict: Record<string, number>;
  }>;
  byPolitician: Array<{
    politicianId: string;
    fullName: string;
    slug: string;
    partyShortName: string | null;
    totalMentions: number;
    byVerdict: Record<string, number>;
  }>;
  bySource: Array<{
    source: string;
    total: number;
    byVerdict: Record<string, number>;
  }>;
}

/** Shape returned by getPageStats() — consumed by factchecks/page.tsx */
export interface FactCheckPageStats {
  totalFactChecks: number;
  byRating: Record<string, number>;
  bySource: Array<{ source: string; count: number }>;
  topPoliticians: Array<{ fullName: string; slug: string; count: bigint }>;
}

/** Verdict breakdown used in statistics rankings */
export interface VerdictBreakdown {
  vrai: number;
  trompeur: number;
  faux: number;
  inverifiable: number;
}

export interface RankedPolitician {
  fullName: string;
  slug: string;
  photoUrl: string | null;
  party: string | null;
  partyColor: string | null;
  totalMentions: number;
  breakdown: VerdictBreakdown;
  scoreVrai: number;
  scoreFaux: number;
}

export interface RankedParty {
  name: string;
  shortName: string | null;
  color: string | null;
  slug: string | null;
  totalMentions: number;
  breakdown: VerdictBreakdown;
  scoreVrai: number;
  scoreFaux: number;
}

/** Shape returned by getStatisticsData() — consumed by statistiques/page.tsx */
export interface FactCheckStatisticsData {
  total: number;
  groups: VerdictBreakdown;
  bySource: Array<{ source: string; count: number }>;
  mostReliablePoliticians: RankedPolitician[];
  leastReliablePoliticians: RankedPolitician[];
  mostReliableParties: RankedParty[];
  leastReliableParties: RankedParty[];
}

// ============================================
// Service
// ============================================

/** Full stats used by the public API (/api/factchecks/stats) */
async function getFactCheckStats(options?: { limit?: number }): Promise<FactCheckStatsResult> {
  const limit = options?.limit ?? 15;

  const [globalRows, partyRows, politicianRows, sourceRows] = await Promise.all([
    getGlobalByVerdict(),
    getByParty(),
    getByPolitician(limit),
    getBySource(),
  ]);

  // Aggregate global
  let totalFactChecks = 0;
  const globalByVerdict: Record<string, number> = {};
  for (const row of globalRows) {
    const count = Number(row.count);
    totalFactChecks += count;
    if (row.verdictRating) {
      globalByVerdict[row.verdictRating] = count;
    }
  }

  // Aggregate by party
  const byParty = aggregateByParty(partyRows, limit);

  // Aggregate by politician
  const byPolitician = aggregateByPolitician(politicianRows);

  // Aggregate by source
  const bySource = aggregateBySource(sourceRows);

  return {
    global: { totalFactChecks, byVerdict: globalByVerdict },
    byParty,
    byPolitician,
    bySource,
  };
}

/**
 * Lightweight stats for factchecks/page.tsx listing page.
 * Returns total count, per-rating counts, per-source counts, and top 10 politicians.
 * Applies FACTCHECK_ALLOWED_SOURCES filter.
 */
async function getPageStats(): Promise<FactCheckPageStats> {
  const [totalFactChecks, byRatingRaw, bySourceRaw, topPoliticians] = await Promise.all([
    db.factCheck.count({ where: { source: { in: FACTCHECK_ALLOWED_SOURCES } } }),
    db.factCheck.groupBy({
      by: ["verdictRating"],
      where: { source: { in: FACTCHECK_ALLOWED_SOURCES } },
      _count: true,
      orderBy: { _count: { verdictRating: "desc" } },
    }),
    db.factCheck.groupBy({
      by: ["source"],
      where: { source: { in: FACTCHECK_ALLOWED_SOURCES } },
      _count: true,
      orderBy: { _count: { source: "desc" } },
    }),
    db.$queryRaw<Array<{ fullName: string; slug: string; count: bigint }>>`
      SELECT p."fullName", p.slug, COUNT(*) as count
      FROM "FactCheckMention" m
      JOIN "FactCheck" fc ON m."factCheckId" = fc.id
      JOIN "Politician" p ON m."politicianId" = p.id
      WHERE fc.source IN (${Prisma.join(FACTCHECK_ALLOWED_SOURCES)})
      GROUP BY p.id, p."fullName", p.slug
      ORDER BY count DESC
      LIMIT 10
    `,
  ]);

  const byRating = byRatingRaw.reduce(
    (acc, r) => {
      acc[r.verdictRating] = r._count;
      return acc;
    },
    {} as Record<string, number>
  );

  return {
    totalFactChecks,
    byRating,
    bySource: bySourceRaw.map((s) => ({ source: s.source, count: s._count })),
    topPoliticians,
  };
}

/** Minimum fact-check mentions required to include a politician/party in rankings */
const MIN_MENTIONS = 3;

function classifyRating(rating: string): keyof VerdictBreakdown {
  if ((VERDICT_GROUPS.vrai as readonly string[]).includes(rating)) return "vrai";
  if ((VERDICT_GROUPS.trompeur as readonly string[]).includes(rating)) return "trompeur";
  if ((VERDICT_GROUPS.faux as readonly string[]).includes(rating)) return "faux";
  return "inverifiable";
}

/**
 * Rich statistics for statistiques/page.tsx.
 * Returns global verdict groups, per-source counts, and Bayesian-ranked politicians and parties.
 * Applies FACTCHECK_ALLOWED_SOURCES filter and only counts isClaimant=true mentions.
 */
async function getStatisticsData(): Promise<FactCheckStatisticsData> {
  const [total, byRatingRaw, bySourceRaw, allMentions] = await Promise.all([
    db.factCheck.count({ where: { source: { in: FACTCHECK_ALLOWED_SOURCES } } }),
    db.factCheck.groupBy({
      by: ["verdictRating"],
      where: { source: { in: FACTCHECK_ALLOWED_SOURCES } },
      _count: true,
      orderBy: { _count: { verdictRating: "desc" } },
    }),
    db.factCheck.groupBy({
      by: ["source"],
      where: { source: { in: FACTCHECK_ALLOWED_SOURCES } },
      _count: true,
      orderBy: { _count: { source: "desc" } },
    }),
    // Fetch only claimant mentions (politician actually made the claim)
    db.factCheckMention.findMany({
      where: {
        isClaimant: true,
        factCheck: { source: { in: FACTCHECK_ALLOWED_SOURCES } },
      },
      select: {
        factCheck: { select: { verdictRating: true } },
        politician: {
          select: {
            id: true,
            fullName: true,
            slug: true,
            photoUrl: true,
            currentParty: {
              select: { name: true, shortName: true, color: true, slug: true },
            },
          },
        },
      },
    }),
  ]);

  // Global verdict groups
  const ratingMap: Record<string, number> = {};
  byRatingRaw.forEach((r) => {
    ratingMap[r.verdictRating] = r._count;
  });

  const groups: VerdictBreakdown = {
    vrai: VERDICT_GROUPS.vrai.reduce((sum, r) => sum + (ratingMap[r] || 0), 0),
    trompeur: VERDICT_GROUPS.trompeur.reduce((sum, r) => sum + (ratingMap[r] || 0), 0),
    faux: VERDICT_GROUPS.faux.reduce((sum, r) => sum + (ratingMap[r] || 0), 0),
    inverifiable: ratingMap["UNVERIFIABLE"] || 0,
  };

  // Aggregate mentions by politician and party
  const politicianMap = new Map<
    string,
    {
      fullName: string;
      slug: string;
      photoUrl: string | null;
      party: string | null;
      partyColor: string | null;
      breakdown: VerdictBreakdown;
      total: number;
    }
  >();
  const partyMap = new Map<
    string,
    {
      name: string;
      shortName: string | null;
      color: string | null;
      slug: string | null;
      breakdown: VerdictBreakdown;
      total: number;
    }
  >();

  for (const mention of allMentions) {
    const pol = mention.politician;
    const verdict = classifyRating(mention.factCheck.verdictRating);
    const partyKey = pol.currentParty?.slug || null;
    const partyDisplayName = pol.currentParty?.name || pol.currentParty?.shortName || null;

    // By politician
    if (!politicianMap.has(pol.id)) {
      politicianMap.set(pol.id, {
        fullName: pol.fullName,
        slug: pol.slug,
        photoUrl: pol.photoUrl,
        party: partyDisplayName,
        partyColor: pol.currentParty?.color || null,
        breakdown: { vrai: 0, trompeur: 0, faux: 0, inverifiable: 0 },
        total: 0,
      });
    }
    const polEntry = politicianMap.get(pol.id)!;
    polEntry.breakdown[verdict]++;
    polEntry.total++;

    // By party
    if (partyKey) {
      if (!partyMap.has(partyKey)) {
        partyMap.set(partyKey, {
          name: partyDisplayName!,
          shortName: pol.currentParty!.shortName,
          color: pol.currentParty!.color,
          slug: pol.currentParty!.slug,
          breakdown: { vrai: 0, trompeur: 0, faux: 0, inverifiable: 0 },
          total: 0,
        });
      }
      const partyEntry = partyMap.get(partyKey)!;
      partyEntry.breakdown[verdict]++;
      partyEntry.total++;
    }
  }

  // Compute global means for Bayesian scoring (excluding inverifiable)
  const allPols = [...politicianMap.values()].filter((p) => p.total >= MIN_MENTIONS);
  const totalScorable = allPols.reduce((sum, p) => sum + p.total - p.breakdown.inverifiable, 0);
  const totalVrai = allPols.reduce((sum, p) => sum + p.breakdown.vrai, 0);
  const totalFaux = allPols.reduce((sum, p) => sum + p.breakdown.faux, 0);
  const globalMeanVrai = totalScorable > 0 ? totalVrai / totalScorable : 0;
  const globalMeanFaux = totalScorable > 0 ? totalFaux / totalScorable : 0;

  // Score and rank politicians
  const scorePolitician = (p: (typeof allPols)[number]): RankedPolitician => {
    const scorable = p.total - p.breakdown.inverifiable;
    const pVrai = scorable > 0 ? p.breakdown.vrai / scorable : 0;
    const pFaux = scorable > 0 ? p.breakdown.faux / scorable : 0;
    return {
      fullName: p.fullName,
      slug: p.slug,
      photoUrl: p.photoUrl,
      party: p.party,
      partyColor: p.partyColor,
      totalMentions: p.total,
      breakdown: p.breakdown,
      scoreVrai: bayesianScore(pVrai, scorable, globalMeanVrai),
      scoreFaux: bayesianScore(pFaux, scorable, globalMeanFaux),
    };
  };

  const rankedPoliticians = allPols.map(scorePolitician);
  const mostReliablePoliticians = [...rankedPoliticians]
    .sort((a, b) => b.scoreVrai - a.scoreVrai)
    .slice(0, 5);
  const mostReliableSlugs = new Set(mostReliablePoliticians.map((p) => p.slug));
  const leastReliablePoliticians = [...rankedPoliticians]
    .filter((p) => !mostReliableSlugs.has(p.slug))
    .sort((a, b) => b.scoreFaux - a.scoreFaux)
    .slice(0, 5);

  // Score and rank parties
  const allParties = [...partyMap.values()].filter((p) => p.total >= MIN_MENTIONS);

  // Compute party-level global means
  const partyTotalScorable = allParties.reduce(
    (sum, p) => sum + p.total - p.breakdown.inverifiable,
    0
  );
  const partyTotalVrai = allParties.reduce((sum, p) => sum + p.breakdown.vrai, 0);
  const partyTotalFaux = allParties.reduce((sum, p) => sum + p.breakdown.faux, 0);
  const partyGlobalMeanVrai = partyTotalScorable > 0 ? partyTotalVrai / partyTotalScorable : 0;
  const partyGlobalMeanFaux = partyTotalScorable > 0 ? partyTotalFaux / partyTotalScorable : 0;

  const scoreParty = (p: (typeof allParties)[number]): RankedParty => {
    const scorable = p.total - p.breakdown.inverifiable;
    const pVrai = scorable > 0 ? p.breakdown.vrai / scorable : 0;
    const pFaux = scorable > 0 ? p.breakdown.faux / scorable : 0;
    return {
      name: p.name,
      shortName: p.shortName,
      color: p.color,
      slug: p.slug,
      totalMentions: p.total,
      breakdown: p.breakdown,
      scoreVrai: bayesianScore(pVrai, scorable, partyGlobalMeanVrai),
      scoreFaux: bayesianScore(pFaux, scorable, partyGlobalMeanFaux),
    };
  };

  const rankedParties = allParties.map(scoreParty);
  const mostReliableParties = [...rankedParties]
    .sort((a, b) => b.scoreVrai - a.scoreVrai)
    .slice(0, 5);
  const mostReliablePartyNames = new Set(mostReliableParties.map((p) => p.name));
  const leastReliableParties = [...rankedParties]
    .filter((p) => !mostReliablePartyNames.has(p.name))
    .sort((a, b) => b.scoreFaux - a.scoreFaux)
    .slice(0, 5);

  return {
    total,
    groups,
    bySource: bySourceRaw.map((s) => ({ source: s.source, count: s._count })),
    mostReliablePoliticians,
    leastReliablePoliticians,
    mostReliableParties,
    leastReliableParties,
  };
}

// ============================================
// Internal queries (used by getFactCheckStats)
// ============================================

interface GlobalVerdictRow {
  verdictRating: string;
  count: bigint;
}

async function getGlobalByVerdict(): Promise<GlobalVerdictRow[]> {
  return db.$queryRaw<GlobalVerdictRow[]>`
    SELECT "verdictRating", COUNT(*) as count
    FROM "FactCheck"
    WHERE source IN (${Prisma.join(FACTCHECK_ALLOWED_SOURCES)})
    GROUP BY "verdictRating"
  `;
}

interface PartyVerdictRow {
  partyId: string;
  partyName: string;
  partyShortName: string;
  partyColor: string | null;
  partySlug: string | null;
  verdictRating: string;
  count: bigint;
}

async function getByParty(): Promise<PartyVerdictRow[]> {
  return db.$queryRaw<PartyVerdictRow[]>`
    SELECT
      p.id as "partyId",
      p.name as "partyName",
      p."shortName" as "partyShortName",
      p.color as "partyColor",
      p.slug as "partySlug",
      fc."verdictRating",
      COUNT(*) as count
    FROM "FactCheckMention" fcm
    JOIN "FactCheck" fc ON fcm."factCheckId" = fc.id
    JOIN "Politician" pol ON fcm."politicianId" = pol.id
    JOIN "Party" p ON pol."currentPartyId" = p.id
    WHERE fc.source IN (${Prisma.join(FACTCHECK_ALLOWED_SOURCES)})
    GROUP BY p.id, p.name, p."shortName", p.color, p.slug, fc."verdictRating"
    ORDER BY COUNT(*) DESC
  `;
}

interface PoliticianVerdictRow {
  politicianId: string;
  fullName: string;
  slug: string;
  partyShortName: string | null;
  verdictRating: string;
  count: bigint;
}

async function getByPolitician(limit: number): Promise<PoliticianVerdictRow[]> {
  return db.$queryRaw<PoliticianVerdictRow[]>`
    SELECT
      sub."politicianId",
      sub."fullName",
      sub.slug,
      sub."partyShortName",
      fc."verdictRating",
      COUNT(*) as count
    FROM (
      SELECT DISTINCT pol.id as "politicianId", pol."fullName", pol.slug,
        p."shortName" as "partyShortName", fcm."factCheckId"
      FROM "FactCheckMention" fcm
      JOIN "Politician" pol ON fcm."politicianId" = pol.id
      LEFT JOIN "Party" p ON pol."currentPartyId" = p.id
    ) sub
    JOIN "FactCheck" fc ON sub."factCheckId" = fc.id
    WHERE fc.source IN (${Prisma.join(FACTCHECK_ALLOWED_SOURCES)})
      AND sub."politicianId" IN (
        SELECT fcm2."politicianId"
        FROM "FactCheckMention" fcm2
        JOIN "FactCheck" fc2 ON fcm2."factCheckId" = fc2.id
        WHERE fc2.source IN (${Prisma.join(FACTCHECK_ALLOWED_SOURCES)})
        GROUP BY fcm2."politicianId"
        ORDER BY COUNT(*) DESC
        LIMIT ${limit}
      )
    GROUP BY sub."politicianId", sub."fullName", sub.slug, sub."partyShortName", fc."verdictRating"
  `;
}

interface SourceVerdictRow {
  source: string;
  verdictRating: string;
  count: bigint;
}

async function getBySource(): Promise<SourceVerdictRow[]> {
  return db.$queryRaw<SourceVerdictRow[]>`
    SELECT source, "verdictRating", COUNT(*) as count
    FROM "FactCheck"
    WHERE source IN (${Prisma.join(FACTCHECK_ALLOWED_SOURCES)})
    GROUP BY source, "verdictRating"
    ORDER BY COUNT(*) DESC
  `;
}

// ============================================
// Aggregation helpers
// ============================================

function aggregateByParty(rows: PartyVerdictRow[], limit: number) {
  const map = new Map<
    string,
    {
      partyId: string;
      partyName: string;
      partyShortName: string;
      partyColor: string | null;
      partySlug: string | null;
      totalMentions: number;
      byVerdict: Record<string, number>;
    }
  >();

  for (const row of rows) {
    if (!map.has(row.partyId)) {
      map.set(row.partyId, {
        partyId: row.partyId,
        partyName: row.partyName,
        partyShortName: row.partyShortName,
        partyColor: row.partyColor,
        partySlug: row.partySlug,
        totalMentions: 0,
        byVerdict: {},
      });
    }
    const entry = map.get(row.partyId)!;
    const count = Number(row.count);
    entry.totalMentions += count;
    if (row.verdictRating) {
      entry.byVerdict[row.verdictRating] = count;
    }
  }

  return Array.from(map.values())
    .sort((a, b) => b.totalMentions - a.totalMentions)
    .slice(0, limit);
}

function aggregateByPolitician(rows: PoliticianVerdictRow[]) {
  const map = new Map<
    string,
    {
      politicianId: string;
      fullName: string;
      slug: string;
      partyShortName: string | null;
      totalMentions: number;
      byVerdict: Record<string, number>;
    }
  >();

  for (const row of rows) {
    if (!map.has(row.politicianId)) {
      map.set(row.politicianId, {
        politicianId: row.politicianId,
        fullName: row.fullName,
        slug: row.slug,
        partyShortName: row.partyShortName,
        totalMentions: 0,
        byVerdict: {},
      });
    }
    const entry = map.get(row.politicianId)!;
    const count = Number(row.count);
    entry.totalMentions += count;
    if (row.verdictRating) {
      entry.byVerdict[row.verdictRating] = count;
    }
  }

  return Array.from(map.values()).sort((a, b) => b.totalMentions - a.totalMentions);
}

function aggregateBySource(rows: SourceVerdictRow[]) {
  const map = new Map<
    string,
    {
      source: string;
      total: number;
      byVerdict: Record<string, number>;
    }
  >();

  for (const row of rows) {
    if (!map.has(row.source)) {
      map.set(row.source, {
        source: row.source,
        total: 0,
        byVerdict: {},
      });
    }
    const entry = map.get(row.source)!;
    const count = Number(row.count);
    entry.total += count;
    if (row.verdictRating) {
      entry.byVerdict[row.verdictRating] = count;
    }
  }

  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

// ============================================
// Export
// ============================================

export const factcheckStatsService = {
  getFactCheckStats,
  getPageStats,
  getStatisticsData,
};
