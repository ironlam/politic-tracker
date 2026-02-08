import { Metadata } from "next";
import { Suspense } from "react";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import {
  StatsTabs,
  AffairsTab,
  VotesTab,
  PressTab,
  GeoTab,
  type StatsTabType,
} from "@/components/stats";
import { CATEGORY_TO_SUPER, type AffairSuperCategory } from "@/config/labels";
import type { AffairStatus, AffairCategory } from "@/types";
import { voteStatsService } from "@/services/voteStats";
import type { Chamber } from "@/generated/prisma";

export const metadata: Metadata = {
  title: "Statistiques",
  description:
    "Statistiques sur les représentants politiques français : affaires judiciaires, votes parlementaires, revue de presse, géographie",
};

// Affairs data fetchers
async function getAffairsGlobalStats() {
  const [totalPoliticians, totalAffairs, totalParties, politiciansWithAffairs, condamnations] =
    await Promise.all([
      db.politician.count(),
      db.affair.count(),
      db.party.count({ where: { politicians: { some: {} } } }),
      db.politician.count({ where: { affairs: { some: {} } } }),
      db.affair.count({
        where: {
          status: {
            in: ["CONDAMNATION_PREMIERE_INSTANCE", "CONDAMNATION_DEFINITIVE"],
          },
        },
      }),
    ]);

  return {
    totalPoliticians,
    totalAffairs,
    totalParties,
    politiciansWithAffairs,
    condamnations,
    percentWithAffairs:
      totalPoliticians > 0 ? ((politiciansWithAffairs / totalPoliticians) * 100).toFixed(1) : "0",
  };
}

async function getAffairsByStatus() {
  const affairs = await db.affair.groupBy({
    by: ["status"],
    _count: { status: true },
    orderBy: { _count: { status: "desc" } },
  });

  return affairs.map((a) => ({
    status: a.status as AffairStatus,
    count: a._count.status,
  }));
}

async function getAffairsByCategory() {
  const affairs = await db.affair.groupBy({
    by: ["category"],
    _count: { category: true },
    orderBy: { _count: { category: "desc" } },
  });

  const superCategories: Record<AffairSuperCategory, number> = {
    PROBITE: 0,
    FINANCES: 0,
    PERSONNES: 0,
    EXPRESSION: 0,
    AUTRE: 0,
  };

  affairs.forEach((a) => {
    const superCat = CATEGORY_TO_SUPER[a.category as AffairCategory];
    superCategories[superCat] += a._count.category;
  });

  return Object.entries(superCategories)
    .filter(([, count]) => count > 0)
    .sort(([, a], [, b]) => b - a)
    .map(([category, count]) => ({
      category: category as AffairSuperCategory,
      count,
    }));
}

async function getAffairsByParty() {
  const parties = await db.party.findMany({
    where: {
      politicians: {
        some: {
          affairs: { some: {} },
        },
      },
    },
    select: {
      id: true,
      name: true,
      shortName: true,
      color: true,
      slug: true,
      _count: {
        select: {
          politicians: {
            where: { affairs: { some: {} } },
          },
        },
      },
      politicians: {
        where: { affairs: { some: {} } },
        select: {
          _count: { select: { affairs: true } },
        },
      },
    },
  });

  return parties
    .map((p) => ({
      id: p.id,
      name: p.name,
      shortName: p.shortName,
      color: p.color,
      slug: p.slug,
      politiciansWithAffairs: p._count.politicians,
      totalAffairs: p.politicians.reduce((sum, pol) => sum + pol._count.affairs, 0),
    }))
    .sort((a, b) => b.totalAffairs - a.totalAffairs)
    .slice(0, 10);
}

async function getTopPoliticiansWithAffairs() {
  const politicians = await db.politician.findMany({
    where: { affairs: { some: {} } },
    select: {
      id: true,
      slug: true,
      fullName: true,
      currentParty: {
        select: { name: true, shortName: true, color: true },
      },
      _count: { select: { affairs: true } },
      affairs: {
        where: {
          status: {
            in: ["CONDAMNATION_PREMIERE_INSTANCE", "CONDAMNATION_DEFINITIVE"],
          },
        },
        select: { id: true },
      },
    },
    orderBy: { affairs: { _count: "desc" } },
    take: 10,
  });

  return politicians.map((p) => ({
    ...p,
    condamnations: p.affairs.length,
  }));
}

// Votes data fetcher (uses optimized service)
async function getVotesData(chamber: "all" | "AN" | "SENAT") {
  const chamberParam = chamber === "all" ? undefined : (chamber as Chamber);
  return voteStatsService.getVoteStats(chamberParam);
}

// Press data fetchers
async function getPressStats() {
  const now = new Date();
  const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const lastMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [totalArticles, bySource, lastWeekCount, lastMonthCount] = await Promise.all([
    db.pressArticle.count(),
    db.pressArticle.groupBy({
      by: ["feedSource"],
      _count: { feedSource: true },
      orderBy: { _count: { feedSource: "desc" } },
    }),
    db.pressArticle.count({ where: { publishedAt: { gte: lastWeek } } }),
    db.pressArticle.count({ where: { publishedAt: { gte: lastMonth } } }),
  ]);

  return {
    totalArticles,
    bySource: bySource.map((s) => ({
      source: s.feedSource.toUpperCase(),
      count: s._count.feedSource,
    })),
    lastWeek: lastWeekCount,
    lastMonth: lastMonthCount,
  };
}

async function getTopPoliticiansMentioned() {
  const mentions = await db.pressArticleMention.groupBy({
    by: ["politicianId"],
    _count: { politicianId: true },
    orderBy: { _count: { politicianId: "desc" } },
    take: 10,
  });

  if (mentions.length === 0) return [];

  const politicians = await db.politician.findMany({
    where: { id: { in: mentions.map((m) => m.politicianId).filter(Boolean) as string[] } },
    select: {
      id: true,
      slug: true,
      fullName: true,
      currentParty: { select: { name: true, shortName: true, color: true } },
    },
  });

  return mentions
    .map((m) => {
      const politician = politicians.find((p) => p.id === m.politicianId);
      if (!politician) return null;
      return {
        id: politician.id,
        slug: politician.slug,
        fullName: politician.fullName,
        party: politician.currentParty,
        mentionCount: m._count.politicianId,
      };
    })
    .filter(Boolean) as {
    id: string;
    slug: string;
    fullName: string;
    party: { name: string; shortName: string | null; color: string | null } | null;
    mentionCount: number;
  }[];
}

async function getTopPartiesMentioned() {
  const mentions = await db.pressArticlePartyMention.groupBy({
    by: ["partyId"],
    _count: { partyId: true },
    orderBy: { _count: { partyId: "desc" } },
    take: 5,
  });

  if (mentions.length === 0) return [];

  const parties = await db.party.findMany({
    where: { id: { in: mentions.map((m) => m.partyId) } },
    select: {
      id: true,
      slug: true,
      name: true,
      shortName: true,
      color: true,
    },
  });

  return mentions
    .map((m) => {
      const party = parties.find((p) => p.id === m.partyId);
      if (!party) return null;
      return {
        ...party,
        mentionCount: m._count.partyId,
      };
    })
    .filter(Boolean) as {
    id: string;
    slug: string;
    name: string;
    shortName: string | null;
    color: string | null;
    mentionCount: number;
  }[];
}

// Geo data fetchers
async function getGeoStats() {
  const [deputes, senateurs, meps, gouvernement] = await Promise.all([
    db.mandate.count({ where: { type: "DEPUTE", isCurrent: true } }),
    db.mandate.count({ where: { type: "SENATEUR", isCurrent: true } }),
    db.mandate.count({ where: { type: "DEPUTE_EUROPEEN", isCurrent: true } }),
    db.mandate.count({
      where: {
        type: {
          in: ["MINISTRE", "PREMIER_MINISTRE", "MINISTRE_DELEGUE", "SECRETAIRE_ETAT"],
        },
        isCurrent: true,
      },
    }),
  ]);

  // Get top departments
  const departments = await db.mandate.groupBy({
    by: ["departmentCode"],
    where: {
      isCurrent: true,
      type: { in: ["DEPUTE", "SENATEUR"] },
      departmentCode: { not: null },
    },
    _count: { departmentCode: true },
    orderBy: { _count: { departmentCode: "desc" } },
    take: 15,
  });

  // Get counts by type for each department
  const topDepartments = await Promise.all(
    departments.map(async (d) => {
      const [deputeCount, senateurCount] = await Promise.all([
        db.mandate.count({
          where: {
            departmentCode: d.departmentCode,
            type: "DEPUTE",
            isCurrent: true,
          },
        }),
        db.mandate.count({
          where: {
            departmentCode: d.departmentCode,
            type: "SENATEUR",
            isCurrent: true,
          },
        }),
      ]);

      return {
        code: d.departmentCode || "",
        name: d.departmentCode || "",
        deputes: deputeCount,
        senateurs: senateurCount,
        total: deputeCount + senateurCount,
      };
    })
  );

  // Simple region mapping (simplified)
  const regionMapping: Record<string, string> = {
    "75": "Île-de-France",
    "77": "Île-de-France",
    "78": "Île-de-France",
    "91": "Île-de-France",
    "92": "Île-de-France",
    "93": "Île-de-France",
    "94": "Île-de-France",
    "95": "Île-de-France",
    "13": "Provence-Alpes-Côte d'Azur",
    "69": "Auvergne-Rhône-Alpes",
    "31": "Occitanie",
    "33": "Nouvelle-Aquitaine",
    "59": "Hauts-de-France",
    "44": "Pays de la Loire",
    "67": "Grand Est",
    "35": "Bretagne",
    "06": "Provence-Alpes-Côte d'Azur",
  };

  // Aggregate by region (simplified)
  const byRegion: Record<string, { total: number; deputes: number; senateurs: number }> = {};
  topDepartments.forEach((d) => {
    const region = regionMapping[d.code] || "Autre";
    if (!byRegion[region]) {
      byRegion[region] = { total: 0, deputes: 0, senateurs: 0 };
    }
    byRegion[region].total += d.total;
    byRegion[region].deputes += d.deputes;
    byRegion[region].senateurs += d.senateurs;
  });

  return {
    totalByType: { deputes, senateurs, meps, gouvernement },
    topDepartments,
    byRegion: Object.entries(byRegion)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.total - a.total),
  };
}

interface PageProps {
  searchParams: Promise<{ tab?: string; chamber?: string }>;
}

export default async function StatistiquesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const tab = (params.tab as StatsTabType) || "affaires";
  const chamber = (params.chamber as "all" | "AN" | "SENAT") || "all";

  // Fetch data based on active tab
  let content;

  if (tab === "affaires") {
    const [globalStats, byStatus, byCategory, byParty, topPoliticians] = await Promise.all([
      getAffairsGlobalStats(),
      getAffairsByStatus(),
      getAffairsByCategory(),
      getAffairsByParty(),
      getTopPoliticiansWithAffairs(),
    ]);

    content = (
      <AffairsTab
        globalStats={globalStats}
        byStatus={byStatus}
        byCategory={byCategory}
        byParty={byParty}
        topPoliticians={topPoliticians}
      />
    );
  } else if (tab === "votes") {
    const voteStats = await getVotesData(chamber);

    content = <VotesTab data={voteStats} chamberFilter={chamber} />;
  } else if (tab === "presse") {
    const [stats, topPoliticians, topParties] = await Promise.all([
      getPressStats(),
      getTopPoliticiansMentioned(),
      getTopPartiesMentioned(),
    ]);

    content = <PressTab stats={stats} topPoliticians={topPoliticians} topParties={topParties} />;
  } else if (tab === "geo") {
    const stats = await getGeoStats();
    content = <GeoTab stats={stats} />;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Statistiques</h1>
        <p className="text-muted-foreground">
          Vue d&apos;ensemble des données sur les représentants politiques
        </p>
      </div>

      <Suspense fallback={<div className="h-12 bg-muted/50 rounded-lg animate-pulse w-96" />}>
        <StatsTabs activeTab={tab} />
      </Suspense>

      {content}

      {/* Disclaimer */}
      <Card className="mt-8 bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
        <CardContent className="pt-6">
          <h2 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
            Note méthodologique
          </h2>
          <p className="text-sm text-blue-800 dark:text-blue-200">
            Ces statistiques reflètent uniquement les données documentées dans notre base. Une
            affaire en cours ne préjuge pas de la culpabilité (présomption d&apos;innocence). Les
            données sont issues de sources publiques et journalistiques vérifiables.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
