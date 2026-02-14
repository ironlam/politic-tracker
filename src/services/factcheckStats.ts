import { db } from "@/lib/db";

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

// ============================================
// Service
// ============================================

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

// ============================================
// Internal queries
// ============================================

interface GlobalVerdictRow {
  verdictRating: string;
  count: bigint;
}

async function getGlobalByVerdict(): Promise<GlobalVerdictRow[]> {
  return db.$queryRaw<GlobalVerdictRow[]>`
    SELECT "verdictRating", COUNT(*) as count
    FROM "FactCheck"
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
    WHERE sub."politicianId" IN (
      SELECT fcm2."politicianId"
      FROM "FactCheckMention" fcm2
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
};
