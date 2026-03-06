import { cacheTag, cacheLife } from "next/cache";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma";
import { FACTCHECK_ALLOWED_SOURCES } from "@/config/labels";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TopPolitician {
  slug: string;
  fullName: string;
  photoUrl: string | null;
  partyShortName: string | null;
  partyColor: string | null;
  count: number;
}

interface WeeklyScrutin {
  slug: string | null;
  title: string;
  chamber: string;
  result: string;
  votesFor: number;
  votesAgainst: number;
  votesAbstain: number;
  votingDate: Date;
}

interface WeeklyAffair {
  slug: string;
  title: string;
  severity: string;
  politicianName: string;
  politicianSlug: string;
}

export interface WeeklyRecapData {
  weekStart: Date;
  weekEnd: Date;
  votes: {
    scrutins: WeeklyScrutin[];
    adopted: number;
    rejected: number;
    total: number;
  };
  activity: {
    topVoters: TopPolitician[];
  };
  affairs: {
    newAffairs: WeeklyAffair[];
    total: number;
  };
  factChecks: {
    total: number;
    trueCount: number;
    falseCount: number;
    mixedCount: number;
    topPoliticians: TopPolitician[];
  };
  press: {
    articleCount: number;
    topPoliticians: TopPolitician[];
  };
}

// ---------------------------------------------------------------------------
// Week utilities
// ---------------------------------------------------------------------------

/** Get Monday 00:00 UTC of the week containing the given date */
export function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday = 1
  d.setUTCDate(d.getUTCDate() + diff);
  return new Date(d.toISOString().split("T")[0] + "T00:00:00Z");
}

/** Get Sunday 23:59:59 UTC (end = next Monday 00:00) */
export function getWeekEnd(weekStart: Date): Date {
  const end = new Date(weekStart);
  end.setUTCDate(end.getUTCDate() + 7);
  return end;
}

/** ISO week number */
export function getISOWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

async function queryWeeklyRecap(weekStart: Date, weekEnd: Date): Promise<WeeklyRecapData> {
  const [scrutins, topVoters, affairs, factCheckData, pressData] = await Promise.all([
    // 1. Weekly scrutins
    db.scrutin.findMany({
      where: { votingDate: { gte: weekStart, lt: weekEnd } },
      select: {
        slug: true,
        title: true,
        chamber: true,
        result: true,
        votesFor: true,
        votesAgainst: true,
        votesAbstain: true,
        votingDate: true,
      },
      orderBy: { votingDate: "desc" },
    }),

    // 2. Most active voters this week
    db.$queryRaw<
      Array<{
        slug: string;
        fullName: string;
        photoUrl: string | null;
        partyShortName: string | null;
        partyColor: string | null;
        count: bigint;
      }>
    >`
      SELECT
        p.slug,
        p."fullName" as "fullName",
        p."photoUrl" as "photoUrl",
        par."shortName" as "partyShortName",
        par.color as "partyColor",
        COUNT(v.id) as count
      FROM "Vote" v
      JOIN "Politician" p ON v."politicianId" = p.id
      LEFT JOIN "Party" par ON p."currentPartyId" = par.id
      JOIN "Scrutin" s ON v."scrutinId" = s.id
      WHERE s."votingDate" >= ${weekStart}
        AND s."votingDate" < ${weekEnd}
        AND v.position IN ('POUR', 'CONTRE', 'ABSTENTION')
      GROUP BY p.id, p.slug, p."fullName", p."photoUrl", par."shortName", par.color
      ORDER BY count DESC
      LIMIT 5
    `,

    // 3. New affairs this week
    db.affair.findMany({
      where: {
        publicationStatus: "PUBLISHED",
        createdAt: { gte: weekStart, lt: weekEnd },
      },
      select: {
        slug: true,
        title: true,
        severity: true,
        politician: {
          select: { fullName: true, slug: true },
        },
      },
      orderBy: { severity: "desc" },
      take: 10,
    }),

    // 4. Fact-checks this week
    Promise.all([
      db.factCheck.groupBy({
        by: ["verdictRating"],
        where: {
          publishedAt: { gte: weekStart, lt: weekEnd },
          source: { in: FACTCHECK_ALLOWED_SOURCES },
        },
        _count: true,
      }),
      db.$queryRaw<
        Array<{
          slug: string;
          fullName: string;
          photoUrl: string | null;
          partyShortName: string | null;
          partyColor: string | null;
          count: bigint;
        }>
      >`
        SELECT
          p.slug,
          p."fullName" as "fullName",
          p."photoUrl" as "photoUrl",
          par."shortName" as "partyShortName",
          par.color as "partyColor",
          COUNT(m.id) as count
        FROM "FactCheckMention" m
        JOIN "FactCheck" fc ON m."factCheckId" = fc.id
        JOIN "Politician" p ON m."politicianId" = p.id
        LEFT JOIN "Party" par ON p."currentPartyId" = par.id
        WHERE fc."publishedAt" >= ${weekStart}
          AND fc."publishedAt" < ${weekEnd}
          AND fc.source IN (${Prisma.join(FACTCHECK_ALLOWED_SOURCES)})
          AND m."isClaimant" = true
        GROUP BY p.id, p.slug, p."fullName", p."photoUrl", par."shortName", par.color
        ORDER BY count DESC
        LIMIT 5
      `,
    ]),

    // 5. Press mentions this week
    Promise.all([
      db.pressArticle.count({
        where: { publishedAt: { gte: weekStart, lt: weekEnd } },
      }),
      db.$queryRaw<
        Array<{
          slug: string;
          fullName: string;
          photoUrl: string | null;
          partyShortName: string | null;
          partyColor: string | null;
          count: bigint;
        }>
      >`
        SELECT
          p.slug,
          p."fullName" as "fullName",
          p."photoUrl" as "photoUrl",
          par."shortName" as "partyShortName",
          par.color as "partyColor",
          COUNT(m."articleId") as count
        FROM "PressArticleMention" m
        JOIN "PressArticle" a ON m."articleId" = a.id
        JOIN "Politician" p ON m."politicianId" = p.id
        LEFT JOIN "Party" par ON p."currentPartyId" = par.id
        WHERE a."publishedAt" >= ${weekStart}
          AND a."publishedAt" < ${weekEnd}
        GROUP BY p.id, p.slug, p."fullName", p."photoUrl", par."shortName", par.color
        ORDER BY count DESC
        LIMIT 5
      `,
    ]),
  ]);

  // Process fact-check verdicts
  const [verdictGroups, fcTopPoliticians] = factCheckData;
  let trueCount = 0;
  let falseCount = 0;
  let mixedCount = 0;
  let fcTotal = 0;
  for (const g of verdictGroups) {
    fcTotal += g._count;
    if (g.verdictRating === "TRUE" || g.verdictRating === "MOSTLY_TRUE") {
      trueCount += g._count;
    } else if (g.verdictRating === "FALSE" || g.verdictRating === "MOSTLY_FALSE") {
      falseCount += g._count;
    } else {
      mixedCount += g._count;
    }
  }

  const [articleCount, pressTopPoliticians] = pressData;

  const toBigintSafe = (
    rows: Array<{
      slug: string;
      fullName: string;
      photoUrl: string | null;
      partyShortName: string | null;
      partyColor: string | null;
      count: bigint;
    }>
  ): TopPolitician[] => rows.map((r) => ({ ...r, count: Number(r.count) }));

  return {
    weekStart,
    weekEnd,
    votes: {
      scrutins,
      adopted: scrutins.filter((s) => s.result === "ADOPTED").length,
      rejected: scrutins.filter((s) => s.result === "REJECTED").length,
      total: scrutins.length,
    },
    activity: {
      topVoters: toBigintSafe(topVoters),
    },
    affairs: {
      newAffairs: affairs.map((a) => ({
        slug: a.slug,
        title: a.title,
        severity: a.severity,
        politicianName: a.politician.fullName,
        politicianSlug: a.politician.slug,
      })),
      total: affairs.length,
    },
    factChecks: {
      total: fcTotal,
      trueCount,
      falseCount,
      mixedCount,
      topPoliticians: toBigintSafe(fcTopPoliticians),
    },
    press: {
      articleCount,
      topPoliticians: toBigintSafe(pressTopPoliticians),
    },
  };
}

// ---------------------------------------------------------------------------
// Cached public API
// ---------------------------------------------------------------------------

export async function getWeeklyRecap(weekStart: Date): Promise<WeeklyRecapData> {
  "use cache";
  cacheTag("weekly-recap", "votes", "affairs", "politicians");
  cacheLife("minutes");

  const weekEnd = getWeekEnd(weekStart);
  return queryWeeklyRecap(weekStart, weekEnd);
}
