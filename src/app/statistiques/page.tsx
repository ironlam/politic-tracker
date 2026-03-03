import { Metadata } from "next";
import { notFound } from "next/navigation";
import { cacheTag, cacheLife } from "next/cache";
import { db } from "@/lib/db";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { voteStatsService } from "@/services/voteStats";
import { factcheckStatsService } from "@/services/factcheckStats";
import {
  CATEGORY_TO_SUPER,
  AFFAIR_CATEGORY_LABELS,
  type AffairSuperCategory,
} from "@/config/labels";
import type { AffairStatus, AffairCategory } from "@/types";
import type { Chamber } from "@/generated/prisma";
import { StatsTabs } from "@/components/stats/StatsTabs";
import { LegislativeSection } from "@/components/stats/LegislativeSection";
import { JudicialSection } from "@/components/stats/JudicialSection";
import { FactCheckSection } from "@/components/stats/FactCheckSection";
import { ParticipationSection } from "@/components/stats/ParticipationSection";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Statistiques",
  description:
    "Statistiques sur la vie politique française : travail législatif, transparence judiciaire, fact-checking",
  alternates: { canonical: "/statistiques" },
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

  // Single batch: counts + status breakdown + severity + critique affairs by party
  const [
    totalDirect,
    totalCondamnations,
    condamnationsDefinitives,
    byStatusRaw,
    byCategoryRaw,
    bySeverityRaw,
    critiqueAffairs,
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
    db.affair.groupBy({
      by: ["severity"],
      where: directFilter,
      _count: { severity: true },
    }),
    // Critique affairs (atteintes à la probité) — all statuses
    db.affair.findMany({
      where: {
        ...directFilter,
        severity: "CRITIQUE",
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

  // Severity breakdown
  const bySeverity = Object.fromEntries(
    bySeverityRaw.map((s) => [s.severity, s._count.severity])
  ) as Record<string, number>;

  // Aggregate critique affairs: category → party → count
  const critiqueByCategoryParty = new Map<
    string,
    Map<string, { count: number; color: string | null; slug: string | null }>
  >();

  for (const affair of critiqueAffairs) {
    const party = affair.politician.currentParty;
    if (!party) continue;
    const partyKey = party.name || party.shortName || "Autre";

    if (!critiqueByCategoryParty.has(affair.category)) {
      critiqueByCategoryParty.set(affair.category, new Map());
    }
    const partyMap = critiqueByCategoryParty.get(affair.category)!;
    const existing = partyMap.get(partyKey);
    if (existing) {
      existing.count++;
    } else {
      partyMap.set(partyKey, { count: 1, color: party.color, slug: party.slug });
    }
  }

  // Convert to sorted array: categories sorted by total desc, parties sorted by count desc
  const critiqueByCategory = [...critiqueByCategoryParty.entries()]
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
    bySeverity,
    byStatus,
    byCategory,
    critiqueByCategory,
  };
}

// ── Fact-check data ──────────────────────────────────────────

async function getFactCheckData() {
  "use cache";
  cacheTag("statistics", "factchecks");
  cacheLife("minutes");

  return factcheckStatsService.getStatisticsData();
}

// ── Legislative data ─────────────────────────────────────────

async function getLegislativeData() {
  "use cache";
  cacheTag("statistics", "votes", "legislation");
  cacheLife("minutes");

  return voteStatsService.getLegislativeStats();
}

// ── Participation data ────────────────────────────────────────

async function getParticipationData(
  chamber?: Chamber,
  page: number = 1,
  sortDirection: "ASC" | "DESC" = "ASC"
) {
  "use cache";
  cacheTag("statistics", "participation");
  cacheLife("minutes");

  const [ranking, groupStatsAN, groupStatsSENAT] = await Promise.all([
    voteStatsService.getParticipationRanking(chamber, undefined, page, 50, sortDirection),
    voteStatsService.getGroupParticipationStats("AN" as Chamber),
    voteStatsService.getGroupParticipationStats("SENAT" as Chamber),
  ]);

  return { ranking, groupStatsAN, groupStatsSENAT };
}

// ── Page ─────────────────────────────────────────────────────

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function StatistiquesPage({ searchParams }: PageProps) {
  if (!(await isFeatureEnabled("STATISTIQUES_SECTION"))) notFound();

  const params = await searchParams;
  const pChamber =
    params.chamber === "AN" || params.chamber === "SENAT" ? (params.chamber as Chamber) : undefined;
  const pPage = Math.max(1, Math.min(100, parseInt(String(params.pPage ?? "1"), 10) || 1));
  const pSort = params.pSort === "desc" ? ("DESC" as const) : ("ASC" as const);

  const [legislativeData, judicialData, factCheckData, participationData] = await Promise.all([
    getLegislativeData(),
    getJudicialData(),
    getFactCheckData(),
    getParticipationData(pChamber, pPage, pSort),
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
            bySeverity={judicialData.bySeverity}
            byStatus={judicialData.byStatus}
            byCategory={judicialData.byCategory}
            critiqueByCategory={judicialData.critiqueByCategory}
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
        legislativeContent={<LegislativeSection stats={legislativeData} />}
        participationContent={
          <ParticipationSection
            ranking={participationData.ranking}
            groupStatsAN={participationData.groupStatsAN}
            groupStatsSENAT={participationData.groupStatsSENAT}
            chamber={pChamber}
            page={pPage}
            sortDirection={pSort}
          />
        }
      />
    </div>
  );
}
