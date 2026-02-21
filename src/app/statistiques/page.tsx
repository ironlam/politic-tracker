import { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { cacheTag, cacheLife } from "next/cache";
import { db } from "@/lib/db";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { BetaDisclaimer } from "@/components/BetaDisclaimer";
import { StatsContent } from "@/components/stats";
import { CATEGORY_TO_SUPER, type AffairSuperCategory } from "@/config/labels";
import { DEPARTMENTS } from "@/config/departments";
import type { AffairStatus, AffairCategory, FactCheckRating } from "@/types";
import { voteStatsService } from "@/services/voteStats";
import type { Chamber } from "@/generated/prisma";

export const metadata: Metadata = {
  title: "Statistiques",
  description:
    "Statistiques sur les représentants politiques français : affaires judiciaires, votes parlementaires, fact-checks, géographie",
};

// Affairs data fetchers
async function getAffairsGlobalStats() {
  "use cache";
  cacheTag("statistics", "politicians", "affairs", "parties");
  cacheLife("minutes");

  const [totalPoliticians, totalAffairs, totalParties, politiciansWithAffairs, condamnations] =
    await Promise.all([
      db.politician.count(),
      db.affair.count({ where: { publicationStatus: "PUBLISHED" } }),
      db.party.count({ where: { politicians: { some: {} } } }),
      db.politician.count({ where: { affairs: { some: { publicationStatus: "PUBLISHED" } } } }),
      db.affair.count({
        where: {
          publicationStatus: "PUBLISHED",
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
  "use cache";
  cacheTag("statistics", "affairs");
  cacheLife("minutes");

  const affairs = await db.affair.groupBy({
    by: ["status"],
    where: { publicationStatus: "PUBLISHED" },
    _count: { status: true },
    orderBy: { _count: { status: "desc" } },
  });

  return affairs.map((a) => ({
    status: a.status as AffairStatus,
    count: a._count.status,
  }));
}

async function getAffairsByCategory() {
  "use cache";
  cacheTag("statistics", "affairs");
  cacheLife("minutes");

  const affairs = await db.affair.groupBy({
    by: ["category"],
    where: { publicationStatus: "PUBLISHED" },
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
  "use cache";
  cacheTag("statistics", "parties", "affairs");
  cacheLife("minutes");

  const parties = await db.party.findMany({
    where: {
      politicians: {
        some: {
          affairs: { some: { publicationStatus: "PUBLISHED" } },
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
            where: { affairs: { some: { publicationStatus: "PUBLISHED" } } },
          },
        },
      },
      politicians: {
        where: { affairs: { some: { publicationStatus: "PUBLISHED" } } },
        select: {
          _count: { select: { affairs: { where: { publicationStatus: "PUBLISHED" } } } },
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
  "use cache";
  cacheTag("statistics", "politicians", "affairs");
  cacheLife("minutes");

  const politicians = await db.politician.findMany({
    where: { affairs: { some: { publicationStatus: "PUBLISHED" } } },
    select: {
      id: true,
      slug: true,
      fullName: true,
      currentParty: {
        select: { name: true, shortName: true, color: true },
      },
      _count: { select: { affairs: { where: { publicationStatus: "PUBLISHED" } } } },
      affairs: {
        where: {
          publicationStatus: "PUBLISHED",
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
  "use cache";
  cacheTag("statistics", "votes");
  cacheLife("minutes");

  const chamberParam = chamber === "all" ? undefined : (chamber as Chamber);
  return voteStatsService.getVoteStats(chamberParam);
}

// Fact-checks data fetcher
const FAUX_RATINGS: FactCheckRating[] = ["FALSE", "MOSTLY_FALSE", "MISLEADING", "OUT_OF_CONTEXT"];
const MITIGE_RATINGS: FactCheckRating[] = ["HALF_TRUE"];
const VRAI_RATINGS: FactCheckRating[] = ["TRUE", "MOSTLY_TRUE"];

async function getFactCheckStats() {
  "use cache";
  cacheTag("statistics");
  cacheLife("minutes");

  const [total, byRating, bySource, topPoliticiansRaw] = await Promise.all([
    db.factCheck.count(),
    db.factCheck.groupBy({
      by: ["verdictRating"],
      _count: true,
      orderBy: { _count: { verdictRating: "desc" } },
    }),
    db.factCheck.groupBy({
      by: ["source"],
      _count: true,
      orderBy: { _count: { source: "desc" } },
    }),
    db.$queryRaw<
      Array<{
        id: string;
        slug: string;
        fullName: string;
        count: bigint;
      }>
    >`
      SELECT p.id, p."fullName", p.slug, COUNT(*) as count
      FROM "FactCheckMention" m
      JOIN "Politician" p ON m."politicianId" = p.id
      GROUP BY p.id, p."fullName", p.slug
      ORDER BY count DESC
      LIMIT 10
    `,
  ]);

  // Build rating map
  const ratingMap: Record<string, number> = {};
  byRating.forEach((r) => {
    ratingMap[r.verdictRating] = r._count;
  });

  // Group ratings
  const groups = {
    vrai: VRAI_RATINGS.reduce((sum, r) => sum + (ratingMap[r] || 0), 0),
    mitige: MITIGE_RATINGS.reduce((sum, r) => sum + (ratingMap[r] || 0), 0),
    faux: FAUX_RATINGS.reduce((sum, r) => sum + (ratingMap[r] || 0), 0),
    inverifiable: ratingMap["UNVERIFIABLE"] || 0,
  };

  // Get party info for top politicians
  const politicianIds = topPoliticiansRaw.map((p) => p.id);
  let politicianParties: Record<
    string,
    { name: string; shortName: string | null; color: string | null } | null
  > = {};

  if (politicianIds.length > 0) {
    const politicians = await db.politician.findMany({
      where: { id: { in: politicianIds } },
      select: {
        id: true,
        currentParty: { select: { name: true, shortName: true, color: true } },
      },
    });
    politicianParties = Object.fromEntries(politicians.map((p) => [p.id, p.currentParty]));
  }

  // Get per-politician verdict breakdown
  const topPoliticians = await Promise.all(
    topPoliticiansRaw.map(async (p) => {
      const verdicts = await db.factCheck.groupBy({
        by: ["verdictRating"],
        where: {
          mentions: { some: { politicianId: p.id } },
        },
        _count: true,
      });

      const verdictMap: Record<string, number> = {};
      verdicts.forEach((v) => {
        verdictMap[v.verdictRating] = v._count;
      });

      return {
        id: p.id,
        slug: p.slug,
        fullName: p.fullName,
        party: politicianParties[p.id] || null,
        total: Number(p.count),
        vrai: VRAI_RATINGS.reduce((sum, r) => sum + (verdictMap[r] || 0), 0),
        mitige: MITIGE_RATINGS.reduce((sum, r) => sum + (verdictMap[r] || 0), 0),
        faux: FAUX_RATINGS.reduce((sum, r) => sum + (verdictMap[r] || 0), 0),
      };
    })
  );

  return {
    total,
    groups,
    byRating: byRating.map((r) => ({
      rating: r.verdictRating as FactCheckRating,
      count: r._count,
    })),
    bySource: bySource.map((s) => ({ source: s.source, count: s._count })),
    topPoliticians,
  };
}

// Geo data fetchers
async function getGeoStats() {
  "use cache";
  cacheTag("statistics");
  cacheLife("minutes");

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

  const codes = departments.map((d) => d.departmentCode).filter(Boolean) as string[];

  // Fix N+1: 2 grouped queries instead of 15 × 2
  const [deputeCounts, senateurCounts] = await Promise.all([
    db.mandate.groupBy({
      by: ["departmentCode"],
      where: { type: "DEPUTE", isCurrent: true, departmentCode: { in: codes } },
      _count: true,
    }),
    db.mandate.groupBy({
      by: ["departmentCode"],
      where: { type: "SENATEUR", isCurrent: true, departmentCode: { in: codes } },
      _count: true,
    }),
  ]);

  const deputeMap = Object.fromEntries(deputeCounts.map((d) => [d.departmentCode, d._count]));
  const senateurMap = Object.fromEntries(senateurCounts.map((d) => [d.departmentCode, d._count]));

  const topDepartments = departments.map((d) => {
    const code = d.departmentCode || "";
    const dep = deputeMap[code] || 0;
    const sen = senateurMap[code] || 0;
    return {
      code,
      name: DEPARTMENTS[code]?.name || code,
      deputes: dep,
      senateurs: sen,
      total: dep + sen,
    };
  });

  // Use complete DEPARTMENTS mapping for regions
  const byRegion: Record<string, { total: number; deputes: number; senateurs: number }> = {};
  topDepartments.forEach((d) => {
    const region = DEPARTMENTS[d.code]?.region || "Autre";
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

export default async function StatistiquesPage() {
  if (!(await isFeatureEnabled("STATISTIQUES_SECTION"))) notFound();

  const [
    globalStats,
    byStatus,
    byCategory,
    byParty,
    topPoliticians,
    votesAll,
    votesAN,
    votesSENAT,
    factChecksData,
    geoData,
  ] = await Promise.all([
    getAffairsGlobalStats(),
    getAffairsByStatus(),
    getAffairsByCategory(),
    getAffairsByParty(),
    getTopPoliticiansWithAffairs(),
    getVotesData("all"),
    getVotesData("AN"),
    getVotesData("SENAT"),
    getFactCheckStats(),
    getGeoStats(),
  ]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Statistiques</h1>
        <p className="text-muted-foreground">
          Vue d&apos;ensemble des données sur les représentants politiques
        </p>
      </div>

      <Suspense fallback={<div className="h-12 bg-muted/50 rounded-lg animate-pulse w-96 mb-8" />}>
        <StatsContent
          affairsData={{ globalStats, byStatus, byCategory, byParty, topPoliticians }}
          votesData={{ all: votesAll, an: votesAN, senat: votesSENAT }}
          factChecksData={factChecksData}
          geoData={geoData}
        />
      </Suspense>

      {/* Disclaimer */}
      <div className="mt-8 space-y-4">
        <BetaDisclaimer variant="stats" />
        <p className="text-xs text-muted-foreground pl-4">
          Une affaire en cours ne préjuge pas de la culpabilité (présomption d&apos;innocence). Les
          données sont issues de sources publiques et journalistiques vérifiables.
        </p>
      </div>
    </div>
  );
}
