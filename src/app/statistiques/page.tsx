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
  VERDICT_GROUPS,
  type AffairSuperCategory,
} from "@/config/labels";
import type { AffairStatus, AffairCategory } from "@/types";
import type { Chamber } from "@/generated/prisma";
import { StatsTabs } from "@/components/stats/StatsTabs";
import { LegislativeSection } from "@/components/stats/LegislativeSection";
import { JudicialSection } from "@/components/stats/JudicialSection";
import { FactCheckSection } from "@/components/stats/FactCheckSection";
import { bayesianScore } from "@/lib/bayesianScore";

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

  // Statuses that represent an actual condemnation (even if appeal is pending)
  const CONDAMNATION_STATUSES = [
    "CONDAMNATION_DEFINITIVE",
    "CONDAMNATION_PREMIERE_INSTANCE",
    "APPEL_EN_COURS",
  ] as const;

  const condamnationFilter = {
    ...directFilter,
    status: { in: [...CONDAMNATION_STATUSES] },
  };

  // Single batch: counts + status breakdown + grave affairs with party info
  const [
    totalDirect,
    totalCondamnations,
    condamnationsDefinitives,
    byStatusRaw,
    byCategoryRaw,
    graveAffairs,
  ] = await Promise.all([
    db.affair.count({ where: directFilter }),
    db.affair.count({ where: condamnationFilter }),
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
      where: condamnationFilter,
      _count: { category: true },
      orderBy: { _count: { category: "desc" } },
    }),
    // Grave affairs — only condemnations
    db.affair.findMany({
      where: {
        ...condamnationFilter,
        category: { in: GRAVE_CATEGORIES },
      },
      select: {
        category: true,
        politician: {
          select: {
            currentParty: {
              select: { name: true, shortName: true, color: true, slug: true },
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
    const partyKey = party.name || party.shortName || "Autre";

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

  return {
    totalDirect,
    totalCondamnations,
    condamnationsDefinitives,
    byStatus,
    byCategory,
    graveByCategory,
  };
}

// ── Fact-check data ──────────────────────────────────────────

interface VerdictBreakdown {
  vrai: number;
  trompeur: number;
  faux: number;
  inverifiable: number;
}

interface RankedPolitician {
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

interface RankedParty {
  name: string;
  color: string | null;
  slug: string | null;
  totalMentions: number;
  breakdown: VerdictBreakdown;
  scoreVrai: number;
  scoreFaux: number;
}

function classifyRating(rating: string): keyof VerdictBreakdown {
  if ((VERDICT_GROUPS.vrai as readonly string[]).includes(rating)) return "vrai";
  if ((VERDICT_GROUPS.trompeur as readonly string[]).includes(rating)) return "trompeur";
  if ((VERDICT_GROUPS.faux as readonly string[]).includes(rating)) return "faux";
  return "inverifiable";
}

const MIN_MENTIONS = 5;

async function getFactCheckData() {
  "use cache";
  cacheTag("statistics", "factchecks");
  cacheLife("minutes");

  const [total, byRating, bySource, allMentions] = await Promise.all([
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
    // Fetch ALL mentions (not just false) with verdict + politician + party
    db.factCheckMention.findMany({
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
  byRating.forEach((r) => {
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
    bySource: bySource.map((s) => ({ source: s.source, count: s._count })),
    mostReliablePoliticians,
    leastReliablePoliticians,
    mostReliableParties,
    leastReliableParties,
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
            totalCondamnations={judicialData.totalCondamnations}
            condamnationsDefinitives={judicialData.condamnationsDefinitives}
            byStatus={judicialData.byStatus}
            byCategory={judicialData.byCategory}
            graveByCategory={judicialData.graveByCategory}
          />
        }
        factCheckContent={
          <FactCheckSection
            total={factCheckData.total}
            groups={factCheckData.groups}
            bySource={factCheckData.bySource}
            mostReliablePoliticians={factCheckData.mostReliablePoliticians}
            leastReliablePoliticians={factCheckData.leastReliablePoliticians}
            mostReliableParties={factCheckData.mostReliableParties}
            leastReliableParties={factCheckData.leastReliableParties}
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
