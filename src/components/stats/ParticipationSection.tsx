import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HorizontalBars } from "./HorizontalBars";
import { MethodologyDisclaimer } from "./MethodologyDisclaimer";
import { ParticipationControls } from "./ParticipationControls";
import type { ParticipationRankingResult, GroupParticipationStats } from "@/services/voteStats";
import type { Chamber } from "@/generated/prisma";

interface ParticipationSectionProps {
  ranking: ParticipationRankingResult;
  groupStats: GroupParticipationStats[];
  chamber?: Chamber;
  page: number;
  sortDirection: "ASC" | "DESC";
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

export function ParticipationSection({
  ranking,
  groupStats,
  chamber,
  page,
  sortDirection,
}: ParticipationSectionProps) {
  const avgRate =
    groupStats.length > 0
      ? groupStats.reduce((sum, g) => sum + g.avgParticipationRate, 0) / groupStats.length
      : 0;

  const totalParliamentarians = ranking.total;
  const totalPages = Math.ceil(ranking.total / 50);

  // Sort groups by participation rate descending for the chart
  const sortedGroups = [...groupStats].sort(
    (a, b) => b.avgParticipationRate - a.avgParticipationRate
  );

  return (
    <section aria-labelledby="participation-heading" className="py-8">
      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
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
        <Card className="col-span-2 sm:col-span-1">
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold tabular-nums">{groupStats.length}</div>
            <div className="text-sm text-muted-foreground mt-1">Groupes représentés</div>
          </CardContent>
        </Card>
      </div>

      {/* Group participation bars */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Participation moyenne par groupe parlementaire</CardTitle>
        </CardHeader>
        <CardContent>
          <HorizontalBars
            title="Participation moyenne par groupe parlementaire"
            maxValue={100}
            bars={sortedGroups.map((g) => ({
              label: g.groupCode,
              value: g.avgParticipationRate,
              color: g.groupColor || undefined,
              suffix: "%",
            }))}
          />
        </CardContent>
      </Card>

      {/* Ranking table */}
      <Card className="mb-8">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
            <CardTitle>Classement des parlementaires</CardTitle>
            <ParticipationControls
              chamber={chamber}
              page={page}
              sortDirection={sortDirection}
              totalPages={totalPages}
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-2 pr-2 w-10">#</th>
                  <th className="py-2 pr-2">Parlementaire</th>
                  <th className="py-2 pr-2">Groupe</th>
                  <th className="py-2 pr-2 text-right">Présences</th>
                  <th className="py-2 text-right">Taux</th>
                </tr>
              </thead>
              <tbody>
                {ranking.entries.map((entry, i) => {
                  const ch = chamberLabel(entry.mandateType);
                  const rank = (page - 1) * 50 + i + 1;
                  return (
                    <tr key={entry.politicianId} className="border-b last:border-0">
                      <td className="py-2 pr-2 tabular-nums text-muted-foreground">{rank}</td>
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
                          <Badge variant={ch.variant} className="text-xs shrink-0">
                            {ch.label}
                          </Badge>
                        </Link>
                      </td>
                      <td className="py-2 pr-2">
                        {entry.groupCode ? (
                          <span
                            className="inline-block px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap"
                            style={{
                              backgroundColor: entry.groupColor
                                ? `${entry.groupColor}33`
                                : "hsl(var(--muted))",
                              color: entry.groupColor || "hsl(var(--muted-foreground))",
                            }}
                          >
                            {entry.groupCode}
                          </span>
                        ) : entry.partyShortName ? (
                          <span className="text-xs text-muted-foreground">
                            {entry.partyShortName}
                          </span>
                        ) : null}
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

          {/* Pagination */}
          {totalPages > 1 && (
            <ParticipationControls
              chamber={chamber}
              page={page}
              sortDirection={sortDirection}
              totalPages={totalPages}
              paginationOnly
            />
          )}
        </CardContent>
      </Card>

      {/* Methodology disclaimer */}
      <MethodologyDisclaimer>
        Le taux de participation est calculé en comparant le nombre de votes enregistrés pour chaque
        parlementaire au nombre total de scrutins pendant la durée de son mandat. Les non-votants
        (présidents de séance) sont comptés comme présents. Source : data.assemblee-nationale.fr,
        data.senat.fr.
      </MethodologyDisclaimer>
    </section>
  );
}
