import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { VoteStatsResult } from "@/services/voteStats";
import { HorizontalBars } from "./HorizontalBars";
import { MethodologyDisclaimer } from "./MethodologyDisclaimer";

interface LegislativeSectionProps {
  allData: VoteStatsResult;
  anData: VoteStatsResult;
  senatData: VoteStatsResult;
}

export function LegislativeSection({ allData }: LegislativeSectionProps) {
  const { global, parties, divisiveScrutins } = allData;

  const filteredParties = parties.filter((p) => p.totalVotes >= 100);
  const sortedByParticipation = [...filteredParties].sort(
    (a, b) => b.participationRate - a.participationRate
  );
  const sortedByCohesion = [...filteredParties].sort((a, b) => b.cohesionRate - a.cohesionRate);
  const avgParticipation =
    filteredParties.length > 0
      ? filteredParties.reduce((sum, p) => sum + p.participationRate, 0) / filteredParties.length
      : 0;

  return (
    <section aria-labelledby="legislative-heading" className="py-8">
      {/* Contextual KPIs */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold tabular-nums">
              {global.totalScrutins.toLocaleString("fr-FR")}
            </div>
            <div className="text-sm text-muted-foreground mt-1">Scrutins analysés</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold tabular-nums">{filteredParties.length}</div>
            <div className="text-sm text-muted-foreground mt-1">Groupes représentés</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold tabular-nums">{avgParticipation.toFixed(0)}%</div>
            <div className="text-sm text-muted-foreground mt-1">Participation moyenne</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Participation */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Participation aux votes</CardTitle>
            <p className="text-sm text-muted-foreground">
              Pourcentage de votes exprimés (hors absents et non-votants)
            </p>
          </CardHeader>
          <CardContent>
            <HorizontalBars
              title="Participation aux votes par parti"
              maxValue={100}
              bars={sortedByParticipation.slice(0, 12).map((p) => ({
                label: p.partyShortName || p.partyName,
                value: p.participationRate,
                color: p.partyColor || undefined,
                suffix: "%",
                href: p.partySlug ? `/partis/${p.partySlug}` : undefined,
              }))}
            />
          </CardContent>
        </Card>

        {/* Cohésion */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Cohésion de groupe</CardTitle>
            <p className="text-sm text-muted-foreground">
              Pourcentage de membres votant avec la position majoritaire du groupe
            </p>
          </CardHeader>
          <CardContent>
            <HorizontalBars
              title="Cohésion de vote par parti"
              maxValue={100}
              bars={sortedByCohesion.slice(0, 12).map((p) => ({
                label: p.partyShortName || p.partyName,
                value: p.cohesionRate,
                color: p.partyColor || undefined,
                suffix: "%",
                href: p.partySlug ? `/partis/${p.partySlug}` : undefined,
              }))}
            />
          </CardContent>
        </Card>
      </div>

      {/* Scrutins clés */}
      {divisiveScrutins.length > 0 && (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="text-lg">Scrutins les plus contestés</CardTitle>
            <p className="text-sm text-muted-foreground">
              Votes avec le plus de divisions internes
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {divisiveScrutins.slice(0, 5).map((s) => (
                <div key={s.id} className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/votes/${s.slug || s.id}`}
                      className="text-sm font-medium hover:underline line-clamp-2"
                    >
                      {s.title}
                    </Link>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <span>{new Date(s.votingDate).toLocaleDateString("fr-FR")}</span>
                      <Badge variant="outline" className="text-xs py-0">
                        {s.chamber}
                      </Badge>
                    </div>
                  </div>
                  <div className="text-right text-xs whitespace-nowrap">
                    <span className="text-green-700 dark:text-green-400">{s.votesFor} pour</span> /{" "}
                    <span className="text-red-700 dark:text-red-400">{s.votesAgainst} contre</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <MethodologyDisclaimer>
        Données issues des scrutins publics de l&apos;Assemblée nationale et du Sénat. La
        participation exclut les votes non-publics. La cohésion mesure le % de membres votant comme
        la majorité de leur groupe.
      </MethodologyDisclaimer>
    </section>
  );
}
