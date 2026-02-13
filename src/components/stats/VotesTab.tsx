import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getColor, TEXT_COLORS } from "@/config/colors";
import { CHAMBER_LABELS, CHAMBER_COLORS } from "@/config/labels";
import type { VoteStatsResult } from "@/services/voteStats";

interface VotesTabProps {
  data: VoteStatsResult;
  chamberFilter: "all" | "AN" | "SENAT";
}

function CohesionBadge({ rate }: { rate: number }) {
  let classes = "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
  if (rate >= 90) classes = "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
  else if (rate >= 75)
    classes = "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300";
  else if (rate >= 60)
    classes = "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300";

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${classes}`}
    >
      {rate}%
    </span>
  );
}

function ParticipationBadge({ rate }: { rate: number }) {
  let classes = "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
  if (rate >= 80) classes = "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
  else if (rate >= 60)
    classes = "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300";

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${classes}`}
    >
      {rate}%
    </span>
  );
}

export function VotesTab({ data, chamberFilter }: VotesTabProps) {
  const { global, parties, divisiveScrutins } = data;

  return (
    <div>
      {/* Global stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total scrutins
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{global.totalScrutins.toLocaleString("fr-FR")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Taux de participation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{global.participationRate}%</p>
            <p className="text-xs text-muted-foreground mt-1">
              des parlementaires votent en moyenne
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Résultats des votes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className={`text-2xl font-bold ${TEXT_COLORS.vote.pour}`}>
                {global.adoptes}
              </span>
              <span className="text-muted-foreground text-sm">adoptés</span>
              <span className="text-muted-foreground">·</span>
              <span className={`text-2xl font-bold ${TEXT_COLORS.vote.contre}`}>
                {global.rejetes}
              </span>
              <span className="text-muted-foreground text-sm">rejetés</span>
            </div>
            {/* Mini bar */}
            <div
              className="w-full h-2 rounded-full overflow-hidden flex bg-muted mt-2"
              role="img"
              aria-label={`${global.adoptes} adoptés, ${global.rejetes} rejetés`}
            >
              <div
                className="h-full"
                style={{
                  width: `${global.adoptes + global.rejetes > 0 ? (global.adoptes / (global.adoptes + global.rejetes)) * 100 : 0}%`,
                  backgroundColor: getColor("vote", "pour", "light"),
                }}
              />
              <div
                className="h-full"
                style={{
                  width: `${global.adoptes + global.rejetes > 0 ? (global.rejetes / (global.adoptes + global.rejetes)) * 100 : 0}%`,
                  backgroundColor: getColor("vote", "contre", "light"),
                }}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Par chambre</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className={`text-2xl font-bold ${TEXT_COLORS.chamber.AN}`}>
                {global.anScrutins}
              </span>
              <span className="text-xs text-muted-foreground">AN</span>
              <span className="text-muted-foreground">·</span>
              <span className={`text-2xl font-bold ${TEXT_COLORS.chamber.SENAT}`}>
                {global.senatScrutins}
              </span>
              <span className="text-xs text-muted-foreground">Sénat</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chamber filter */}
      <div className="flex gap-2 mb-6">
        <Link
          href="/statistiques?tab=votes&chamber=all"
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            chamberFilter === "all"
              ? "bg-primary text-primary-foreground"
              : "bg-muted hover:bg-muted/80"
          }`}
        >
          Toutes
        </Link>
        <Link
          href="/statistiques?tab=votes&chamber=AN"
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            chamberFilter === "AN"
              ? "bg-primary text-primary-foreground"
              : "bg-muted hover:bg-muted/80"
          }`}
        >
          Assemblée
        </Link>
        <Link
          href="/statistiques?tab=votes&chamber=SENAT"
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            chamberFilter === "SENAT"
              ? "bg-primary text-primary-foreground"
              : "bg-muted hover:bg-muted/80"
          }`}
        >
          Sénat
        </Link>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Votes by party */}
        <Card>
          <CardHeader>
            <CardTitle>Comment votent les partis</CardTitle>
            <p className="text-sm text-muted-foreground">
              Répartition pour/contre/abstention par groupe politique
            </p>
          </CardHeader>
          <CardContent>
            {/* Column headers */}
            <div className="flex justify-end gap-4 text-xs text-muted-foreground mb-3 pr-1">
              <span title="Cohésion : pourcentage de membres votant dans la même direction">
                Cohésion
              </span>
              <span title="Participation : pourcentage de votes effectifs (hors absences)">
                Participation
              </span>
            </div>

            <div className="space-y-4">
              {parties.map((party) => {
                const participating = party.pour + party.contre + party.abstention;
                const pourPct = participating > 0 ? (party.pour / participating) * 100 : 0;
                const contrePct = participating > 0 ? (party.contre / participating) * 100 : 0;
                const abstPct = participating > 0 ? (party.abstention / participating) * 100 : 0;

                return (
                  <div key={party.partyId}>
                    <div className="flex justify-between text-sm mb-1">
                      <Link
                        href={party.partySlug ? `/partis/${party.partySlug}` : "/partis"}
                        title={party.partyName}
                        className="hover:underline flex items-center gap-2"
                      >
                        {party.partyColor && (
                          <span
                            className="w-3 h-3 rounded-full inline-block shrink-0"
                            style={{ backgroundColor: party.partyColor }}
                            aria-label={`Couleur du parti ${party.partyName}`}
                          />
                        )}
                        <span>{party.partyShortName || party.partyName}</span>
                      </Link>
                      <div className="flex items-center gap-3">
                        <CohesionBadge rate={party.cohesionRate} />
                        <ParticipationBadge rate={party.participationRate} />
                      </div>
                    </div>
                    {/* Stacked bar */}
                    <div
                      className="w-full h-4 rounded-full overflow-hidden flex bg-muted"
                      role="img"
                      aria-label={`${party.partyShortName || party.partyName} : ${pourPct.toFixed(0)}% pour, ${contrePct.toFixed(0)}% contre, ${abstPct.toFixed(0)}% abstention`}
                    >
                      <div
                        className="h-full"
                        style={{
                          width: `${pourPct}%`,
                          backgroundColor: getColor("vote", "pour", "light"),
                        }}
                        title={`Pour: ${party.pour.toLocaleString("fr-FR")}`}
                      />
                      <div
                        className="h-full"
                        style={{
                          width: `${contrePct}%`,
                          backgroundColor: getColor("vote", "contre", "light"),
                        }}
                        title={`Contre: ${party.contre.toLocaleString("fr-FR")}`}
                      />
                      <div
                        className="h-full"
                        style={{
                          width: `${abstPct}%`,
                          backgroundColor: getColor("vote", "abstention", "light"),
                        }}
                        title={`Abstention: ${party.abstention.toLocaleString("fr-FR")}`}
                      />
                    </div>
                    <div className="flex gap-4 text-xs mt-1">
                      <span className={TEXT_COLORS.vote.pour}>{pourPct.toFixed(0)}% pour</span>
                      <span className={TEXT_COLORS.vote.contre}>
                        {contrePct.toFixed(0)}% contre
                      </span>
                      <span className={TEXT_COLORS.vote.abstention}>
                        {abstPct.toFixed(0)}% abst.
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Explanations */}
            <div className="mt-6 pt-4 border-t space-y-2 text-xs text-muted-foreground">
              <p>
                <strong>Cohésion</strong> : mesure si les membres d&apos;un parti votent ensemble.
                100% = tous votent pareil.
              </p>
              <p>
                <strong>Participation</strong> : proportion de votes effectifs (hors absences).
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Top contested scrutins */}
        <Card>
          <CardHeader>
            <CardTitle>Scrutins les plus serrés</CardTitle>
            <p className="text-sm text-muted-foreground">
              Les votes où l&apos;Assemblée ou le Sénat était le plus divisé
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {divisiveScrutins.map((scrutin) => {
              const total = scrutin.votesFor + scrutin.votesAgainst + scrutin.votesAbstain;
              const pourPct = total > 0 ? (scrutin.votesFor / total) * 100 : 0;
              const contrePct = total > 0 ? (scrutin.votesAgainst / total) * 100 : 0;

              return (
                <Link
                  key={scrutin.id}
                  href={`/votes/${scrutin.slug || scrutin.id}`}
                  className="block hover:bg-muted/50 rounded-lg p-3 -mx-3 transition-colors"
                >
                  <div className="flex justify-between items-start gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full border ${CHAMBER_COLORS[scrutin.chamber]}`}
                        >
                          {CHAMBER_LABELS[scrutin.chamber]}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(scrutin.votingDate).toLocaleDateString("fr-FR")}
                        </span>
                      </div>
                      <p className="font-medium line-clamp-1 text-sm">{scrutin.title}</p>
                    </div>
                    <Badge
                      variant="outline"
                      className="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 border-orange-200 dark:border-orange-800 shrink-0"
                    >
                      {scrutin.divisionScore}% divisif
                    </Badge>
                  </div>
                  <div className="flex gap-2 text-xs">
                    <span className={TEXT_COLORS.vote.pour}>
                      {scrutin.votesFor} pour ({pourPct.toFixed(0)}%)
                    </span>
                    <span className="text-muted-foreground">·</span>
                    <span className={TEXT_COLORS.vote.contre}>
                      {scrutin.votesAgainst} contre ({contrePct.toFixed(0)}%)
                    </span>
                  </div>
                </Link>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-6 mt-6 text-sm">
        <div className="flex items-center gap-2">
          <span
            className="w-4 h-4 rounded"
            style={{ backgroundColor: getColor("vote", "pour", "light") }}
            aria-hidden="true"
          />
          <span>Pour</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="w-4 h-4 rounded"
            style={{ backgroundColor: getColor("vote", "contre", "light") }}
            aria-hidden="true"
          />
          <span>Contre</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="w-4 h-4 rounded"
            style={{ backgroundColor: getColor("vote", "abstention", "light") }}
            aria-hidden="true"
          />
          <span>Abstention</span>
        </div>
      </div>

      {/* Pedagogical section */}
      <Card className="mt-8 bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
        <CardContent className="pt-6">
          <h2 className="font-semibold text-blue-900 dark:text-blue-100 mb-3">
            Comment lire ces statistiques
          </h2>
          <div className="text-sm text-blue-800 dark:text-blue-200 space-y-2">
            <p>
              Les <strong>scrutins</strong> sont les votes officiels du Parlement. Chaque député ou
              sénateur peut voter Pour, Contre, s&apos;Abstenir, ou être Absent.
            </p>
            <p>
              La <strong>cohésion de groupe</strong> indique si les membres d&apos;un même parti
              votent ensemble. Un taux élevé (90%+) signifie que le parti vote en bloc ; un taux
              faible révèle des divisions internes.
            </p>
            <p>
              Le <strong>taux de participation</strong> mesure la proportion de parlementaires qui
              se déplacent pour voter (hors absences). Un taux bas peut indiquer un désintérêt ou
              des contraintes d&apos;agenda.
            </p>
            <p>
              Le <strong>score de division</strong> d&apos;un scrutin mesure l&apos;écart entre les
              Pour et les Contre. Plus le score est élevé, plus le vote était serré.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
