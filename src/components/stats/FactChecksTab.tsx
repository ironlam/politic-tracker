import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "./ProgressBar";
import { FACTCHECK_RATING_LABELS } from "@/config/labels";
import { ensureContrast } from "@/lib/contrast";
import type { FactCheckRating } from "@/types";

// Hex colors for verdict distribution bar — blue (true) → gray → muted red (false)
const RATING_HEX_COLORS: Record<FactCheckRating, string> = {
  TRUE: "#2d4a7c",
  MOSTLY_TRUE: "#4a6a9c",
  HALF_TRUE: "#8a8e96",
  MISLEADING: "#9a7a7a",
  OUT_OF_CONTEXT: "#9a7a7a",
  MOSTLY_FALSE: "#9a6868",
  FALSE: "#9e5454",
  UNVERIFIABLE: "#9498a0",
};

// Ordered ratings for the distribution bar (vrai → faux)
const RATING_ORDER: FactCheckRating[] = [
  "TRUE",
  "MOSTLY_TRUE",
  "HALF_TRUE",
  "MISLEADING",
  "OUT_OF_CONTEXT",
  "MOSTLY_FALSE",
  "FALSE",
  "UNVERIFIABLE",
];

interface FactChecksTabProps {
  total: number;
  groups: { vrai: number; mitige: number; faux: number; inverifiable: number };
  byRating: { rating: FactCheckRating; count: number }[];
  bySource: { source: string; count: number }[];
  topPoliticians: {
    id: string;
    slug: string;
    fullName: string;
    party: { name: string; shortName: string | null; color: string | null } | null;
    total: number;
    vrai: number;
    mitige: number;
    faux: number;
  }[];
}

export function FactChecksTab({
  total,
  groups,
  byRating,
  bySource,
  topPoliticians,
}: FactChecksTabProps) {
  const maxBySource = Math.max(...bySource.map((s) => s.count), 1);

  const fauxPct = total > 0 ? ((groups.faux / total) * 100).toFixed(1) : "0";
  const mitigePct = total > 0 ? ((groups.mitige / total) * 100).toFixed(1) : "0";
  const vraiPct = total > 0 ? ((groups.vrai / total) * 100).toFixed(1) : "0";

  // Build rating count map for the distribution bar
  const ratingCountMap: Record<string, number> = {};
  byRating.forEach((r) => {
    ratingCountMap[r.rating] = r.count;
  });

  return (
    <div>
      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total fact-checks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{total}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Faux / trompeurs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-red-600 dark:text-red-400">{groups.faux}</p>
            <p className="text-sm text-muted-foreground">{fauxPct}% du total</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Mitigés</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">
              {groups.mitige}
            </p>
            <p className="text-sm text-muted-foreground">{mitigePct}% du total</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Vrais</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-600 dark:text-green-400">{groups.vrai}</p>
            <p className="text-sm text-muted-foreground">{vraiPct}% du total</p>
          </CardContent>
        </Card>
      </div>

      {/* Verdict distribution bar */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Distribution des verdicts</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className="w-full h-6 rounded-full overflow-hidden flex bg-muted"
            role="img"
            aria-label={`Distribution : ${groups.vrai} vrais, ${groups.mitige} mitigés, ${groups.faux} faux, ${groups.inverifiable} invérifiables`}
          >
            {RATING_ORDER.map((rating) => {
              const count = ratingCountMap[rating] || 0;
              if (count === 0) return null;
              const pct = total > 0 ? (count / total) * 100 : 0;
              return (
                <div
                  key={rating}
                  className="h-full"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: RATING_HEX_COLORS[rating],
                  }}
                  title={`${FACTCHECK_RATING_LABELS[rating]} : ${count}`}
                />
              );
            })}
          </div>
          {/* Legend */}
          <div className="flex flex-wrap gap-3 mt-3 text-xs">
            {RATING_ORDER.map((rating) => {
              const count = ratingCountMap[rating] || 0;
              if (count === 0) return null;
              return (
                <div key={rating} className="flex items-center gap-1.5">
                  <span
                    className="w-3 h-3 rounded-sm shrink-0"
                    style={{ backgroundColor: RATING_HEX_COLORS[rating] }}
                    aria-hidden="true"
                  />
                  <span className="text-muted-foreground">
                    {FACTCHECK_RATING_LABELS[rating]} ({count})
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Top politicians */}
        <Card>
          <CardHeader>
            <CardTitle>Politiques les plus vérifiés</CardTitle>
            <p className="text-sm text-muted-foreground">Top 10 par nombre de fact-checks</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {topPoliticians.length === 0 ? (
              <p className="text-muted-foreground text-sm">Aucune donnée disponible</p>
            ) : (
              topPoliticians.map((politician) => {
                const polTotal = politician.vrai + politician.mitige + politician.faux;
                const vraiW = polTotal > 0 ? (politician.vrai / polTotal) * 100 : 0;
                const mitigeW = polTotal > 0 ? (politician.mitige / polTotal) * 100 : 0;
                const fauxW = polTotal > 0 ? (politician.faux / polTotal) * 100 : 0;

                return (
                  <div key={politician.id}>
                    <div className="flex justify-between text-sm mb-1">
                      <Link
                        href={`/factchecks?politician=${politician.slug}`}
                        className="hover:underline flex items-center gap-2 truncate"
                      >
                        <span className="truncate">{politician.fullName}</span>
                        {politician.party && (
                          <Badge
                            variant="outline"
                            className="text-xs shrink-0"
                            title={politician.party.name}
                            style={{
                              borderColor: politician.party.color || undefined,
                              color: politician.party.color
                                ? ensureContrast(politician.party.color, "#ffffff")
                                : undefined,
                            }}
                          >
                            {politician.party.shortName}
                          </Badge>
                        )}
                      </Link>
                      <span className="font-medium shrink-0 ml-2">{politician.total}</span>
                    </div>
                    {/* Mini stacked bar: vrai / mitigé / faux */}
                    <div
                      className="w-full h-3 rounded-full overflow-hidden flex bg-muted"
                      role="img"
                      aria-label={`${politician.fullName} : ${politician.vrai} vrais, ${politician.mitige} mitigés, ${politician.faux} faux`}
                    >
                      {politician.vrai > 0 && (
                        <div
                          className="h-full"
                          style={{ width: `${vraiW}%`, backgroundColor: "#2d4a7c" }}
                          title={`Vrai : ${politician.vrai}`}
                        />
                      )}
                      {politician.mitige > 0 && (
                        <div
                          className="h-full"
                          style={{ width: `${mitigeW}%`, backgroundColor: "#8a8e96" }}
                          title={`Mitigé : ${politician.mitige}`}
                        />
                      )}
                      {politician.faux > 0 && (
                        <div
                          className="h-full"
                          style={{ width: `${fauxW}%`, backgroundColor: "#9e5454" }}
                          title={`Faux : ${politician.faux}`}
                        />
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* By source */}
        <Card>
          <CardHeader>
            <CardTitle>Par source de fact-checking</CardTitle>
            <p className="text-sm text-muted-foreground">Nombre de vérifications par organisme</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {bySource.map(({ source, count }) => (
              <div key={source}>
                <div className="flex justify-between text-sm mb-1">
                  <Badge variant="outline">{source}</Badge>
                  <span className="font-medium">{count}</span>
                </div>
                <ProgressBar
                  value={count}
                  max={maxBySource}
                  color="bg-primary"
                  label={`${source} : ${count} fact-checks`}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Pedagogical section */}
      <Card className="mt-8 bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
        <CardContent className="pt-6">
          <h2 className="font-semibold text-blue-900 dark:text-blue-100 mb-3">
            Comprendre les fact-checks
          </h2>
          <div className="text-sm text-blue-800 dark:text-blue-200 space-y-2">
            <p>
              Un <strong>fact-check</strong> est une vérification factuelle d&apos;une déclaration
              publique, réalisée par un organisme indépendant (AFP Factuel, Les Décodeurs, etc.).
            </p>
            <p>
              Les <strong>verdicts</strong> sont attribués par les organismes de fact-checking selon
              leurs propres méthodologies. Poligraph agrège ces données sans produire ses propres
              vérifications.
            </p>
            <p>
              Les verdicts vont de <strong>Vrai</strong> (affirmation exacte) à{" "}
              <strong>Faux</strong> (contraire aux faits), en passant par des nuances comme{" "}
              <strong>Partiellement vrai</strong> ou <strong>Trompeur</strong>.
            </p>
          </div>
          <div className="mt-4">
            <Link
              href="/factchecks"
              className="text-blue-600 dark:text-blue-400 hover:underline text-sm font-medium"
            >
              Explorer tous les fact-checks &rarr;
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
