import { Metadata } from "next";
import { notFound } from "next/navigation";
import { cacheTag, cacheLife } from "next/cache";
import { db } from "@/lib/db";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { voteStatsService } from "@/services/voteStats";
import {
  CATEGORY_TO_SUPER,
  GRAVE_CATEGORIES,
  AFFAIR_CATEGORY_LABELS,
  type AffairSuperCategory,
} from "@/config/labels";
import type { AffairStatus, AffairCategory, FactCheckRating } from "@/types";
import type { Chamber } from "@/generated/prisma";
import { StatsTabs } from "@/components/stats/StatsTabs";
import { LegislativeSection } from "@/components/stats/LegislativeSection";
import { JudicialSection } from "@/components/stats/JudicialSection";
import { FactCheckSection } from "@/components/stats/FactCheckSection";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Statistiques",
  description:
    "Statistiques sur la vie politique française : travail législatif, transparence judiciaire, fact-checking",
};

// ── Judicial data ────────────────────────────────────────────

async function getJudicialData() {
  "use cache";
  cacheTag("statistics", "affairs");
  cacheLife("minutes");

  const directFilter = {
    publicationStatus: "PUBLISHED" as const,
    involvement: "DIRECT" as const,
  };

  // Single batch: counts + status breakdown + grave affairs with party info
  const [totalDirect, condamnationsDefinitives, byStatusRaw, byCategoryRaw, graveAffairs] =
    await Promise.all([
      db.affair.count({ where: directFilter }),
      db.affair.count({
        where: { ...directFilter, status: "CONDAMNATION_DEFINITIVE" },
      }),
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
      // One query for all grave affairs — aggregate in JS
      db.affair.findMany({
        where: {
          ...directFilter,
          category: { in: GRAVE_CATEGORIES },
        },
        select: {
          category: true,
          politician: {
            select: {
              currentParty: {
                select: { shortName: true, color: true, slug: true },
              },
            },
          },
        },
      }),
    ]);

  const byStatus = byStatusRaw.map((a) => ({
    status: a.status as AffairStatus,
    count: a._count.status,
  }));

  // Aggregate categories into super-categories (for donut)
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

  // Aggregate grave affairs: category → party → count
  const graveByCategoryParty = new Map<
    string,
    Map<string, { count: number; color: string | null; slug: string | null }>
  >();

  for (const affair of graveAffairs) {
    const party = affair.politician.currentParty;
    if (!party) continue;
    const partyKey = party.shortName || "Autre";

    if (!graveByCategoryParty.has(affair.category)) {
      graveByCategoryParty.set(affair.category, new Map());
    }
    const partyMap = graveByCategoryParty.get(affair.category)!;
    const existing = partyMap.get(partyKey);
    if (existing) {
      existing.count++;
    } else {
      partyMap.set(partyKey, { count: 1, color: party.color, slug: party.slug });
    }
  }

  // Convert to sorted array: categories sorted by total desc, parties sorted by count desc
  const graveByCategory = [...graveByCategoryParty.entries()]
    .map(([category, partyMap]) => {
      const parties = [...partyMap.entries()]
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
      const total = parties.reduce((sum, p) => sum + p.count, 0);
      return {
        category: category as AffairCategory,
        label: AFFAIR_CATEGORY_LABELS[category as AffairCategory],
        total,
        parties,
      };
    })
    .filter((c) => c.total > 0)
    .sort((a, b) => b.total - a.total);

  // Count distinct parties with at least one grave affair
  const partiesWithGrave = new Set(
    graveAffairs.map((a) => a.politician.currentParty?.shortName).filter(Boolean)
  );

  return {
    totalDirect,
    condamnationsDefinitives,
    partiesConcernees: partiesWithGrave.size,
    byStatus,
    byCategory,
    graveByCategory,
  };
}

// ── Fact-check data ──────────────────────────────────────────

const FAUX_RATINGS: FactCheckRating[] = ["FALSE", "MOSTLY_FALSE", "MISLEADING", "OUT_OF_CONTEXT"];
const MITIGE_RATINGS: FactCheckRating[] = ["HALF_TRUE"];
const VRAI_RATINGS: FactCheckRating[] = ["TRUE", "MOSTLY_TRUE"];

async function getFactCheckData() {
  "use cache";
  cacheTag("statistics", "factchecks");
  cacheLife("minutes");

  // One batch: total + ratings + sources + false mentions with politician/party
  const [total, byRating, bySource, falseMentions] = await Promise.all([
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
    // One query: all mentions of "false" fact-checks with politician+party
    db.factCheckMention.findMany({
      where: {
        factCheck: { verdictRating: { in: FAUX_RATINGS } },
      },
      select: {
        politician: {
          select: {
            id: true,
            fullName: true,
            slug: true,
            photoUrl: true,
            currentParty: {
              select: { shortName: true, color: true, slug: true },
            },
          },
        },
      },
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

  // Aggregate false declarations by party
  const partyFalseMap = new Map<
    string,
    { count: number; color: string | null; slug: string | null }
  >();
  // Aggregate by politician
  const politicianFalseMap = new Map<
    string,
    {
      fullName: string;
      slug: string;
      photoUrl: string | null;
      party: string | null;
      partyColor: string | null;
      count: number;
    }
  >();

  for (const mention of falseMentions) {
    const pol = mention.politician;
    const partyName = pol.currentParty?.shortName || null;

    // By party
    if (partyName) {
      const existing = partyFalseMap.get(partyName);
      if (existing) {
        existing.count++;
      } else {
        partyFalseMap.set(partyName, {
          count: 1,
          color: pol.currentParty!.color,
          slug: pol.currentParty!.slug,
        });
      }
    }

    // By politician
    const polExisting = politicianFalseMap.get(pol.id);
    if (polExisting) {
      polExisting.count++;
    } else {
      politicianFalseMap.set(pol.id, {
        fullName: pol.fullName,
        slug: pol.slug,
        photoUrl: pol.photoUrl,
        party: partyName,
        partyColor: pol.currentParty?.color || null,
        count: 1,
      });
    }
  }

  const falseByParty = [...partyFalseMap.entries()]
    .map(([name, data]) => ({ name, ...data }))
    .filter((p) => p.count >= 3) // Minimum 3 mentions
    .sort((a, b) => b.count - a.count);

  const topPoliticians = [...politicianFalseMap.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    total,
    groups,
    byRating: byRating.map((r) => ({
      rating: r.verdictRating as FactCheckRating,
      count: r._count,
    })),
    bySource: bySource.map((s) => ({ source: s.source, count: s._count })),
    falseByParty,
    topPoliticians,
  };
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

// ── Page ─────────────────────────────────────────────────────

export default async function StatistiquesPage() {
  if (!(await isFeatureEnabled("STATISTIQUES_SECTION"))) notFound();

  const [legislativeData, judicialData, factCheckData] = await Promise.all([
    getLegislativeData(),
    getJudicialData(),
    getFactCheckData(),
  ]);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">Statistiques</h1>
      <p className="text-muted-foreground mb-8">
        Vue d&apos;ensemble des données sur la vie politique française
      </p>

      <StatsTabs
        judicialContent={
          <JudicialSection
            totalDirect={judicialData.totalDirect}
            condamnationsDefinitives={judicialData.condamnationsDefinitives}
            partiesConcernees={judicialData.partiesConcernees}
            byStatus={judicialData.byStatus}
            byCategory={judicialData.byCategory}
            graveByCategory={judicialData.graveByCategory}
          />
        }
        factCheckContent={
          <FactCheckSection
            total={factCheckData.total}
            groups={factCheckData.groups}
            byRating={factCheckData.byRating}
            bySource={factCheckData.bySource}
            falseByParty={factCheckData.falseByParty}
            topPoliticians={factCheckData.topPoliticians}
          />
        }
        legislativeContent={
          <LegislativeSection
            allData={legislativeData.all}
            anData={legislativeData.an}
            senatData={legislativeData.senat}
          />
        }
      />
    </div>
  );
}
