import { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AFFAIR_STATUS_LABELS,
  AFFAIR_STATUS_COLORS,
  AFFAIR_SUPER_CATEGORY_LABELS,
  AFFAIR_SUPER_CATEGORY_COLORS,
  CATEGORY_TO_SUPER,
  type AffairSuperCategory,
} from "@/config/labels";
import type { AffairStatus, AffairCategory } from "@/types";

export const metadata: Metadata = {
  title: "Statistiques",
  description: "Statistiques sur les affaires judiciaires des représentants politiques français",
};

async function getGlobalStats() {
  const [
    totalPoliticians,
    totalAffairs,
    totalParties,
    politiciansWithAffairs,
    condamnations,
  ] = await Promise.all([
    db.politician.count(),
    db.affair.count(),
    db.party.count({ where: { politicians: { some: {} } } }),
    db.politician.count({ where: { affairs: { some: {} } } }),
    db.affair.count({
      where: {
        status: { in: ["CONDAMNATION_PREMIERE_INSTANCE", "CONDAMNATION_DEFINITIVE"] },
      },
    }),
  ]);

  return {
    totalPoliticians,
    totalAffairs,
    totalParties,
    politiciansWithAffairs,
    condamnations,
    percentWithAffairs: totalPoliticians > 0
      ? ((politiciansWithAffairs / totalPoliticians) * 100).toFixed(1)
      : "0",
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

  // Group by super-category
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

async function getTopPoliticians() {
  const politicians = await db.politician.findMany({
    where: { affairs: { some: {} } },
    select: {
      id: true,
      slug: true,
      fullName: true,
      photoUrl: true,
      currentParty: {
        select: { shortName: true, color: true },
      },
      _count: { select: { affairs: true } },
      affairs: {
        where: {
          status: { in: ["CONDAMNATION_PREMIERE_INSTANCE", "CONDAMNATION_DEFINITIVE"] },
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

// Hex colors for progress bars (Tailwind dynamic classes don't work)
const SUPER_CATEGORY_BAR_COLORS: Record<AffairSuperCategory, string> = {
  PROBITE: "#9333ea",    // purple-600
  FINANCES: "#2563eb",   // blue-600
  PERSONNES: "#dc2626",  // red-600
  EXPRESSION: "#d97706", // amber-600
  AUTRE: "#6b7280",      // gray-500
};

function ProgressBar({
  value,
  max,
  color,
  hexColor,
}: {
  value: number;
  max: number;
  color?: string;
  hexColor?: string;
}) {
  const percentage = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="w-full bg-gray-100 rounded-full h-4 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${color || ""}`}
        style={{
          width: `${percentage}%`,
          backgroundColor: hexColor,
        }}
      />
    </div>
  );
}

export default async function StatistiquesPage() {
  const [globalStats, byStatus, byCategory, byParty, topPoliticians] =
    await Promise.all([
      getGlobalStats(),
      getAffairsByStatus(),
      getAffairsByCategory(),
      getAffairsByParty(),
      getTopPoliticians(),
    ]);

  const maxByStatus = Math.max(...byStatus.map((s) => s.count), 1);
  const maxByCategory = Math.max(...byCategory.map((c) => c.count), 1);
  const maxByParty = Math.max(...byParty.map((p) => p.totalAffairs), 1);
  const maxByPolitician = Math.max(...topPoliticians.map((p) => p._count.affairs), 1);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Statistiques</h1>
        <p className="text-muted-foreground">
          Vue d&apos;ensemble des affaires judiciaires documentées
        </p>
      </div>

      {/* Global stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Représentants
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{globalStats.totalPoliticians}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Affaires documentées
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{globalStats.totalAffairs}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Condamnations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-red-600">{globalStats.condamnations}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avec affaire(s)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{globalStats.politiciansWithAffairs}</p>
            <p className="text-sm text-muted-foreground">
              {globalStats.percentWithAffairs}% du total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Partis concernés
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{byParty.length}</p>
            <p className="text-sm text-muted-foreground">
              sur {globalStats.totalParties} partis
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-8 mb-8">
        {/* By status */}
        <Card>
          <CardHeader>
            <CardTitle>Répartition par statut</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {byStatus.map(({ status, count }) => (
              <div key={status}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="truncate mr-2">
                    <Badge className={AFFAIR_STATUS_COLORS[status]} variant="outline">
                      {AFFAIR_STATUS_LABELS[status]}
                    </Badge>
                  </span>
                  <span className="font-medium">{count}</span>
                </div>
                <ProgressBar
                  value={count}
                  max={maxByStatus}
                  color={
                    status.includes("CONDAMNATION")
                      ? "bg-red-500"
                      : status === "RELAXE" || status === "ACQUITTEMENT"
                        ? "bg-green-500"
                        : "bg-yellow-500"
                  }
                />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* By super-category */}
        <Card>
          <CardHeader>
            <CardTitle>Répartition par type</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {byCategory.map(({ category, count }) => (
              <div key={category}>
                <div className="flex justify-between text-sm mb-1">
                  <Badge className={AFFAIR_SUPER_CATEGORY_COLORS[category]} variant="outline">
                    {AFFAIR_SUPER_CATEGORY_LABELS[category]}
                  </Badge>
                  <span className="font-medium">{count}</span>
                </div>
                <ProgressBar
                  value={count}
                  max={maxByCategory}
                  hexColor={SUPER_CATEGORY_BAR_COLORS[category]}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* By party */}
        <Card>
          <CardHeader>
            <CardTitle>Affaires par parti</CardTitle>
            <p className="text-sm text-muted-foreground">
              Top 10 des partis par nombre d&apos;affaires
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {byParty.map((party) => (
              <div key={party.id}>
                <div className="flex justify-between text-sm mb-1">
                  <Link
                    href={`/partis/${party.slug}`}
                    className="hover:underline flex items-center gap-2"
                  >
                    {party.color && (
                      <span
                        className="w-3 h-3 rounded-full inline-block"
                        style={{ backgroundColor: party.color }}
                      />
                    )}
                    <span>{party.shortName}</span>
                    <span className="text-muted-foreground">
                      ({party.politiciansWithAffairs} pers.)
                    </span>
                  </Link>
                  <span className="font-medium">{party.totalAffairs}</span>
                </div>
                <ProgressBar
                  value={party.totalAffairs}
                  max={maxByParty}
                  color="bg-primary"
                />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Top politicians */}
        <Card>
          <CardHeader>
            <CardTitle>Politiques les plus concernés</CardTitle>
            <p className="text-sm text-muted-foreground">
              Top 10 par nombre d&apos;affaires
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {topPoliticians.map((politician) => (
              <div key={politician.id}>
                <div className="flex justify-between text-sm mb-1">
                  <Link
                    href={`/politiques/${politician.slug}`}
                    className="hover:underline flex items-center gap-2 truncate"
                  >
                    <span className="truncate">{politician.fullName}</span>
                    {politician.currentParty && (
                      <Badge
                        variant="outline"
                        className="text-xs shrink-0"
                        style={{
                          borderColor: politician.currentParty.color || undefined,
                          color: politician.currentParty.color || undefined,
                        }}
                      >
                        {politician.currentParty.shortName}
                      </Badge>
                    )}
                  </Link>
                  <span className="font-medium shrink-0 ml-2">
                    {politician._count.affairs}
                    {politician.condamnations > 0 && (
                      <span className="text-red-600 ml-1">
                        ({politician.condamnations} cond.)
                      </span>
                    )}
                  </span>
                </div>
                <ProgressBar
                  value={politician._count.affairs}
                  max={maxByPolitician}
                  color={politician.condamnations > 0 ? "bg-red-500" : "bg-orange-500"}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Disclaimer */}
      <Card className="mt-8 bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <h3 className="font-semibold text-blue-900 mb-2">Note méthodologique</h3>
          <p className="text-sm text-blue-800">
            Ces statistiques reflètent uniquement les affaires documentées dans notre base.
            Une affaire en cours ne préjuge pas de la culpabilité (présomption d&apos;innocence).
            Les données sont issues de sources publiques et journalistiques vérifiables.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
