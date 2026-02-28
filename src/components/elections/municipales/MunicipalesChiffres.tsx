import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";

interface MunicipalesChiffresProps {
  communesWithCompetition: number;
  totalCommunes: number;
  averageCompetitionIndex: number;
  parityRate: number; // 0-1
  nationalPoliticiansCandidates: number;
}

function competitionColor(index: number): string {
  if (index > 1.5) return "text-green-600 dark:text-green-400";
  if (index > 1) return "text-yellow-600 dark:text-yellow-400";
  return "text-red-600 dark:text-red-400";
}

function parityColor(rate: number): string {
  if (rate >= 0.45) return "text-green-600 dark:text-green-400";
  if (rate >= 0.3) return "text-yellow-600 dark:text-yellow-400";
  return "text-red-600 dark:text-red-400";
}

export function MunicipalesChiffres({
  communesWithCompetition,
  totalCommunes,
  averageCompetitionIndex,
  parityRate,
  nationalPoliticiansCandidates,
}: MunicipalesChiffresProps) {
  const competitionPct =
    totalCommunes > 0 ? ((communesWithCompetition / totalCommunes) * 100).toFixed(1) : "0";

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Communes avec competition */}
      <Card>
        <CardContent className="pt-5">
          <p className="tabular-nums text-2xl font-bold">
            {communesWithCompetition.toLocaleString("fr-FR")}{" "}
            <span className="text-base font-normal text-muted-foreground">
              / {totalCommunes.toLocaleString("fr-FR")}
            </span>
          </p>
          <p className="text-sm text-muted-foreground mt-1">Communes avec competition</p>
          <p className="text-xs text-muted-foreground mt-0.5">{competitionPct}%</p>
        </CardContent>
      </Card>

      {/* Indice de competition moyen */}
      <Card>
        <CardContent className="pt-5">
          <p
            className={`tabular-nums text-2xl font-bold ${competitionColor(averageCompetitionIndex)}`}
          >
            {averageCompetitionIndex.toFixed(2)}
          </p>
          <p className="text-sm text-muted-foreground mt-1">Indice de competition moyen</p>
        </CardContent>
      </Card>

      {/* Taux de parite */}
      <Card>
        <CardContent className="pt-5">
          <p className={`tabular-nums text-2xl font-bold ${parityColor(parityRate)}`}>
            {(parityRate * 100).toFixed(1)}%
          </p>
          <p className="text-sm text-muted-foreground mt-1">Taux de parite</p>
        </CardContent>
      </Card>

      {/* Politiciens nationaux candidats */}
      <Card>
        <CardContent className="pt-5">
          <p className="tabular-nums text-2xl font-bold">
            {nationalPoliticiansCandidates.toLocaleString("fr-FR")}
          </p>
          <p className="text-sm text-muted-foreground mt-1">Politiciens nationaux candidats</p>
          <Link
            href="/elections/municipales-2026/cumul"
            prefetch={false}
            className="text-xs text-primary hover:underline mt-1 inline-block"
          >
            Voir les details &rarr;
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
