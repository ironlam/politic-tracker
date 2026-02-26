import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HorizontalBars } from "./HorizontalBars";
import { MethodologyDisclaimer } from "./MethodologyDisclaimer";
import type { ParticipationRankingResult, PartyParticipationStats } from "@/services/voteStats";

interface ParticipationSectionProps {
  ranking: ParticipationRankingResult;
  partyStats: PartyParticipationStats[];
}

function rateColor(rate: number): string {
  if (rate < 50) return "text-red-600 dark:text-red-400";
  if (rate < 75) return "text-yellow-600 dark:text-yellow-400";
  return "text-green-600 dark:text-green-400";
}

function chamberLabel(mandateType: string): { label: string; variant: "default" | "secondary" } {
  if (mandateType === "DEPUTE") return { label: "AN", variant: "default" };
  if (mandateType === "SENATEUR") return { label: "Sénat", variant: "secondary" };
  return { label: mandateType, variant: "default" };
}

export function ParticipationSection({ ranking, partyStats }: ParticipationSectionProps) {
  const avgRate =
    partyStats.length > 0
      ? partyStats.reduce((sum, p) => sum + p.avgParticipationRate, 0) / partyStats.length
      : 0;

  const totalParliamentarians = ranking.total;
  const groupsRepresented = partyStats.length;

  // Sort parties by participation rate descending for the chart
  const sortedParties = [...partyStats].sort(
    (a, b) => b.avgParticipationRate - a.avgParticipationRate
  );

  return (
    <section aria-labelledby="participation-heading" className="py-8">
      {/* KPI cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold tabular-nums">{avgRate.toFixed(0)}%</div>
            <div className="text-sm text-muted-foreground mt-1">Participation moyenne</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold tabular-nums">
              {totalParliamentarians.toLocaleString("fr-FR")}
            </div>
            <div className="text-sm text-muted-foreground mt-1">Parlementaires suivis</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold tabular-nums">{groupsRepresented}</div>
            <div className="text-sm text-muted-foreground mt-1">Groupes représentés</div>
          </CardContent>
        </Card>
      </div>

      {/* Party participation bars */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Participation moyenne par groupe</CardTitle>
        </CardHeader>
        <CardContent>
          <HorizontalBars
            title="Participation moyenne par groupe parlementaire"
            maxValue={100}
            bars={sortedParties.map((p) => ({
              label: p.partyShortName || p.partyName,
              value: p.avgParticipationRate,
              color: p.partyColor || undefined,
              href: p.partySlug ? `/partis/${p.partySlug}` : undefined,
              suffix: "%",
            }))}
          />
        </CardContent>
      </Card>

      {/* Ranking table */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Classement des parlementaires</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-2 pr-2 w-10">#</th>
                  <th className="py-2 pr-2">Parlementaire</th>
                  <th className="py-2 pr-2">Parti</th>
                  <th className="py-2 pr-2 text-right">Présences</th>
                  <th className="py-2 text-right">Taux</th>
                </tr>
              </thead>
              <tbody>
                {ranking.entries.map((entry, i) => {
                  const chamber = chamberLabel(entry.mandateType);
                  return (
                    <tr key={entry.politicianId} className="border-b last:border-0">
                      <td className="py-2 pr-2 tabular-nums text-muted-foreground">{i + 1}</td>
                      <td className="py-2 pr-2">
                        <Link
                          href={`/politiques/${entry.slug}`}
                          prefetch={false}
                          className="flex items-center gap-2 hover:underline"
                        >
                          {entry.photoUrl ? (
                            <Image
                              src={entry.photoUrl}
                              alt=""
                              width={28}
                              height={28}
                              className="rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-muted" />
                          )}
                          <span className="font-medium">
                            {entry.firstName} {entry.lastName}
                          </span>
                          <Badge variant={chamber.variant} className="text-xs">
                            {chamber.label}
                          </Badge>
                        </Link>
                      </td>
                      <td className="py-2 pr-2">
                        {entry.partyShortName && (
                          <span
                            className="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
                            style={{
                              backgroundColor: entry.partyColor
                                ? `${entry.partyColor}33`
                                : "hsl(var(--muted))",
                              color: entry.partyColor || "hsl(var(--muted-foreground))",
                            }}
                          >
                            {entry.partyShortName}
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-2 text-right tabular-nums text-muted-foreground">
                        {entry.votesCount}/{entry.eligibleScrutins}
                      </td>
                      <td
                        className={`py-2 text-right tabular-nums font-semibold ${rateColor(entry.participationRate)}`}
                      >
                        {entry.participationRate.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Methodology disclaimer */}
      <MethodologyDisclaimer>
        Le taux de participation est calculé en comparant le nombre de votes enregistrés pour chaque
        parlementaire au nombre total de scrutins pendant la durée de son mandat. Les non-votants
        (présidents de séance) sont comptés comme présents.
      </MethodologyDisclaimer>
    </section>
  );
}
