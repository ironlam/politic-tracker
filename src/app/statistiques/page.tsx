import { Metadata } from "next";
import { notFound } from "next/navigation";
import { cacheTag, cacheLife } from "next/cache";
import { db } from "@/lib/db";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { voteStatsService } from "@/services/voteStats";
import { CATEGORY_TO_SUPER, type AffairSuperCategory } from "@/config/labels";
import type { AffairStatus, AffairCategory, FactCheckRating } from "@/types";
import type { Chamber } from "@/generated/prisma";
import { HeroKPIs } from "@/components/stats/HeroKPIs";
import { LegislativeSection } from "@/components/stats/LegislativeSection";
import { JudicialSection } from "@/components/stats/JudicialSection";
import { FactCheckSection } from "@/components/stats/FactCheckSection";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Statistiques",
  description:
    "Statistiques sur la vie politique française : travail législatif, transparence judiciaire, fact-checking",
};

// ── KPI fetcher ──────────────────────────────────────────────

async function getKPIs() {
  "use cache";
  cacheTag("statistics");
  cacheLife("minutes");

  const [scrutins, affaires, factChecks, partis] = await Promise.all([
    db.scrutin.count(),
    db.affair.count({
      where: { publicationStatus: "PUBLISHED", involvement: "DIRECT" },
    }),
    db.factCheck.count(),
    db.party.count({
      where: { politicians: { some: { publicationStatus: "PUBLISHED" } } },
    }),
  ]);

  return { scrutins, affaires, factChecks, partis };
}

// ── Legislative data ─────────────────────────────────────────

async function getLegislativeData() {
  "use cache";
  cacheTag("statistics", "votes");
  cacheLife("minutes");

  const [all, an, senat] = await Promise.all([
    voteStatsService.getVoteStats(),
    voteStatsService.getVoteStats("AN" as Chamber),
    voteStatsService.getVoteStats("SENAT" as Chamber),
  ]);

  return { all, an, senat };
}

// ── Judicial data (DIRECT involvement only, normalized) ──────

async function getJudicialData() {
  "use cache";
  cacheTag("statistics", "affairs");
  cacheLife("minutes");

  const directFilter = {
    publicationStatus: "PUBLISHED" as const,
    involvement: "DIRECT" as const,
  };

  const [totalDirect, byStatusRaw, byCategoryRaw] = await Promise.all([
    db.affair.count({ where: directFilter }),
    db.affair.groupBy({
      by: ["status"],
      where: directFilter,
      _count: { status: true },
      orderBy: { _count: { status: "desc" } },
    }),
    db.affair.groupBy({
      by: ["category"],
      where: directFilter,
      _count: { category: true },
      orderBy: { _count: { category: "desc" } },
    }),
  ]);

  const byStatus = byStatusRaw.map((a) => ({
    status: a.status as AffairStatus,
    count: a._count.status,
  }));

  // Aggregate categories into super-categories
  const superCategories: Record<AffairSuperCategory, number> = {
    PROBITE: 0,
    FINANCES: 0,
    PERSONNES: 0,
    EXPRESSION: 0,
    AUTRE: 0,
  };
  byCategoryRaw.forEach((a) => {
    const superCat = CATEGORY_TO_SUPER[a.category as AffairCategory];
    superCategories[superCat] += a._count.category;
  });
  const byCategory = Object.entries(superCategories)
    .filter(([, count]) => count > 0)
    .sort(([, a], [, b]) => b - a)
    .map(([category, count]) => ({
      category: category as AffairSuperCategory,
      count,
    }));

  // Per-party stats normalized per 100 elected
  const partiesWithAffairs = await db.party.findMany({
    where: {
      politicians: {
        some: { affairs: { some: directFilter } },
      },
    },
    select: {
      name: true,
      shortName: true,
      color: true,
      slug: true,
      _count: {
        select: {
          politicians: { where: { publicationStatus: "PUBLISHED" } },
        },
      },
      politicians: {
        where: { affairs: { some: directFilter } },
        select: {
          _count: { select: { affairs: { where: directFilter } } },
        },
      },
    },
  });

  const byParty = partiesWithAffairs
    .map((p) => {
      const totalElected = p._count.politicians;
      const directAffairs = p.politicians.reduce((sum, pol) => sum + pol._count.affairs, 0);
      return {
        name: p.name,
        shortName: p.shortName,
        color: p.color,
        slug: p.slug,
        directAffairs,
        totalElected,
        ratePer100: totalElected > 0 ? (directAffairs / totalElected) * 100 : 0,
      };
    })
    .filter((p) => p.totalElected >= 5)
    .sort((a, b) => b.ratePer100 - a.ratePer100)
    .slice(0, 12);

  return { totalDirect, byStatus, byCategory, byParty };
}

// ── Fact-check data ──────────────────────────────────────────

const FAUX_RATINGS: FactCheckRating[] = ["FALSE", "MOSTLY_FALSE", "MISLEADING", "OUT_OF_CONTEXT"];
const MITIGE_RATINGS: FactCheckRating[] = ["HALF_TRUE"];
const VRAI_RATINGS: FactCheckRating[] = ["TRUE", "MOSTLY_TRUE"];

async function getFactCheckData() {
  "use cache";
  cacheTag("statistics", "factchecks");
  cacheLife("minutes");

  const [total, byRating, bySource] = await Promise.all([
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
  ]);

  const ratingMap: Record<string, number> = {};
  byRating.forEach((r) => {
    ratingMap[r.verdictRating] = r._count;
  });

  const groups = {
    vrai: VRAI_RATINGS.reduce((sum, r) => sum + (ratingMap[r] || 0), 0),
    mitige: MITIGE_RATINGS.reduce((sum, r) => sum + (ratingMap[r] || 0), 0),
    faux: FAUX_RATINGS.reduce((sum, r) => sum + (ratingMap[r] || 0), 0),
    inverifiable: ratingMap["UNVERIFIABLE"] || 0,
  };

  return {
    total,
    groups,
    byRating: byRating.map((r) => ({
      rating: r.verdictRating as FactCheckRating,
      count: r._count,
    })),
    bySource: bySource.map((s) => ({ source: s.source, count: s._count })),
  };
}

// ── Page ─────────────────────────────────────────────────────

export default async function StatistiquesPage() {
  if (!(await isFeatureEnabled("STATISTIQUES_SECTION"))) notFound();

  const [kpis, legislativeData, judicialData, factCheckData] = await Promise.all([
    getKPIs(),
    getLegislativeData(),
    getJudicialData(),
    getFactCheckData(),
  ]);

  return (
    <div className="container mx-auto px-4 py-8">
      <HeroKPIs
        scrutins={kpis.scrutins}
        affaires={kpis.affaires}
        factChecks={kpis.factChecks}
        partis={kpis.partis}
      />

      <hr className="my-8" />

      <LegislativeSection
        allData={legislativeData.all}
        anData={legislativeData.an}
        senatData={legislativeData.senat}
      />

      <hr className="my-8" />

      <JudicialSection
        totalDirect={judicialData.totalDirect}
        byStatus={judicialData.byStatus}
        byCategory={judicialData.byCategory}
        byParty={judicialData.byParty}
      />

      <hr className="my-8" />

      <FactCheckSection
        total={factCheckData.total}
        groups={factCheckData.groups}
        byRating={factCheckData.byRating}
        bySource={factCheckData.bySource}
      />
    </div>
  );
}
