import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "./ProgressBar";
import {
  AFFAIR_STATUS_LABELS,
  AFFAIR_STATUS_COLORS,
  AFFAIR_SUPER_CATEGORY_LABELS,
  AFFAIR_SUPER_CATEGORY_COLORS,
  type AffairSuperCategory,
} from "@/config/labels";
import { COLORS, TEXT_COLORS } from "@/config/colors";
import { ensureContrast } from "@/lib/contrast";
import type { AffairStatus } from "@/types";

interface GlobalStats {
  totalPoliticians: number;
  totalAffairs: number;
  totalParties: number;
  politiciansWithAffairs: number;
  condamnations: number;
  percentWithAffairs: string;
}

interface StatusCount {
  status: AffairStatus;
  count: number;
}

interface CategoryCount {
  category: AffairSuperCategory;
  count: number;
}

interface PartyStats {
  id: string;
  name: string;
  shortName: string | null;
  color: string | null;
  slug: string | null;
  politiciansWithAffairs: number;
  totalAffairs: number;
}

interface PoliticianStats {
  id: string;
  slug: string;
  fullName: string;
  currentParty: { name: string; shortName: string | null; color: string | null } | null;
  _count: { affairs: number };
  condamnations: number;
}

interface AffairsTabProps {
  globalStats: GlobalStats;
  byStatus: StatusCount[];
  byCategory: CategoryCount[];
  byParty: PartyStats[];
  topPoliticians: PoliticianStats[];
}

export function AffairsTab({
  globalStats,
  byStatus,
  byCategory,
  byParty,
  topPoliticians,
}: AffairsTabProps) {
  const maxByStatus = Math.max(...byStatus.map((s) => s.count), 1);
  const maxByCategory = Math.max(...byCategory.map((c) => c.count), 1);
  const maxByParty = Math.max(...byParty.map((p) => p.totalAffairs), 1);
  const maxByPolitician = Math.max(...topPoliticians.map((p) => p._count.affairs), 1);

  return (
    <div>
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
            <p className={`text-3xl font-bold ${TEXT_COLORS.affairStatus.CONDAMNATION_DEFINITIVE}`}>
              {globalStats.condamnations}
            </p>
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
            <p className="text-sm text-muted-foreground">sur {globalStats.totalParties} partis</p>
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
            {byStatus.map(({ status, count }) => {
              const colorKey = status.includes("CONDAMNATION")
                ? "CONDAMNATION_DEFINITIVE"
                : status === "RELAXE" || status === "ACQUITTEMENT"
                  ? "RELAXE"
                  : "MISE_EN_EXAMEN";
              return (
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
                    hexColor={COLORS.affairStatus[colorKey]?.light}
                    label={`${AFFAIR_STATUS_LABELS[status]} : ${count}`}
                  />
                </div>
              );
            })}
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
                  hexColor={
                    COLORS.affairCategory[category as keyof typeof COLORS.affairCategory]?.light
                  }
                  label={`${AFFAIR_SUPER_CATEGORY_LABELS[category]} : ${count}`}
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
                    href={party.slug ? `/partis/${party.slug}` : "/partis"}
                    title={party.name}
                    className="hover:underline flex items-center gap-2"
                  >
                    {party.color && (
                      <span
                        className="w-3 h-3 rounded-full inline-block shrink-0"
                        style={{ backgroundColor: party.color }}
                        aria-label={`Couleur du parti ${party.name}`}
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
                  label={`${party.name} : ${party.totalAffairs} affaires`}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Top politicians */}
        <Card>
          <CardHeader>
            <CardTitle>Politiques les plus concernés</CardTitle>
            <p className="text-sm text-muted-foreground">Top 10 par nombre d&apos;affaires</p>
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
                        title={politician.currentParty.name}
                        style={{
                          borderColor: politician.currentParty.color || undefined,
                          color: politician.currentParty.color
                            ? ensureContrast(politician.currentParty.color, "#ffffff")
                            : undefined,
                        }}
                      >
                        {politician.currentParty.shortName}
                      </Badge>
                    )}
                  </Link>
                  <span className="font-medium shrink-0 ml-2">
                    {politician._count.affairs}
                    {politician.condamnations > 0 && (
                      <span className={`ml-1 ${TEXT_COLORS.affairStatus.CONDAMNATION_DEFINITIVE}`}>
                        ({politician.condamnations} cond.)
                      </span>
                    )}
                  </span>
                </div>
                <ProgressBar
                  value={politician._count.affairs}
                  max={maxByPolitician}
                  hexColor={
                    politician.condamnations > 0
                      ? COLORS.affairStatus.CONDAMNATION_DEFINITIVE.light
                      : COLORS.ui.warning.light
                  }
                  label={`${politician.fullName} : ${politician._count.affairs} affaires`}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
