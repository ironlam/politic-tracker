import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HorizontalBars } from "./HorizontalBars";
import { MethodologyDisclaimer } from "./MethodologyDisclaimer";
import type {
  LegislativeStatsResult,
  ThemeDistribution,
  PipelineRow,
  KeyVote,
} from "@/services/voteStats";

interface LegislativeSectionProps {
  stats: LegislativeStatsResult;
}

function ThemeBars({ themes }: { themes: ThemeDistribution[] }) {
  if (themes.length === 0) {
    return <p className="text-sm text-muted-foreground">Aucune donnée disponible</p>;
  }
  const maxCount = Math.max(...themes.map((t) => t.count));
  return (
    <HorizontalBars
      title="Répartition thématique des scrutins"
      maxValue={maxCount}
      bars={themes.slice(0, 10).map((t) => ({
        label: `${t.icon} ${t.label}`,
        value: t.count,
        suffix: " scrutins",
      }))}
    />
  );
}

function PipelineTable({ rows }: { rows: PipelineRow[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="overflow-x-auto -mx-4 sm:mx-0">
      <table className="w-full text-sm min-w-[400px]">
        <thead>
          <tr className="border-b text-left">
            <th className="py-2 pr-2 font-medium">Thème</th>
            <th className="py-2 px-2 text-right font-medium">En discussion</th>
            <th className="py-2 px-2 text-right font-medium">Adoptés</th>
            <th className="py-2 px-2 text-right font-medium">Total</th>
            <th className="py-2 pl-2 w-24 font-medium">Avancement</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const enDiscussion = r.enCommission + r.enCours;
            const pct = r.total > 0 ? Math.round((r.adopte / r.total) * 100) : 0;
            return (
              <tr key={r.theme} className="border-b last:border-0">
                <td className="py-2.5 pr-2">
                  <span className="text-sm">
                    {r.icon} {r.label}
                  </span>
                </td>
                <td className="py-2.5 px-2 text-right tabular-nums text-yellow-600 dark:text-yellow-400">
                  {enDiscussion}
                </td>
                <td className="py-2.5 px-2 text-right tabular-nums text-green-600 dark:text-green-400">
                  {r.adopte}
                </td>
                <td className="py-2.5 px-2 text-right tabular-nums text-muted-foreground">
                  {r.total}
                </td>
                <td className="py-2.5 pl-2">
                  <div className="flex items-center gap-2">
                    <div className="h-2 flex-1 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 dark:bg-green-400 rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs tabular-nums text-muted-foreground w-8 text-right">
                      {pct}%
                    </span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function KeyVotesList({ votes }: { votes: KeyVote[] }) {
  if (votes.length === 0) {
    return <p className="text-sm text-muted-foreground">Aucun scrutin disponible</p>;
  }
  return (
    <div className="space-y-3">
      {votes.map((v) => (
        <div key={v.id} className="flex flex-col gap-1">
          <Link
            href={`/votes/${v.slug || v.id}`}
            prefetch={false}
            className="text-sm font-medium hover:underline leading-snug"
          >
            {v.title}
          </Link>
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <span>{new Date(v.votingDate).toLocaleDateString("fr-FR")}</span>
            {v.themeLabel && (
              <Badge variant="outline" className="text-xs py-0">
                {v.themeIcon} {v.themeLabel}
              </Badge>
            )}
            <Badge
              variant={v.result === "ADOPTED" ? "default" : "destructive"}
              className="text-xs py-0"
            >
              {v.result === "ADOPTED" ? "Adopté" : "Rejeté"}
            </Badge>
          </div>
          <div className="text-xs">
            <span className="text-green-700 dark:text-green-400">{v.votesFor} pour</span>
            {" / "}
            <span className="text-red-700 dark:text-red-400">{v.votesAgainst} contre</span>
            {" / "}
            <span className="text-muted-foreground">{v.votesAbstain} abst.</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function LegislativeSection({ stats }: LegislativeSectionProps) {
  const { kpi, themes, pipeline, keyVotes } = stats;

  return (
    <section aria-labelledby="legislative-heading" className="py-8">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-2">
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold tabular-nums">
              {kpi.scrutinsAnalyses.toLocaleString("fr-FR")}
            </div>
            <div className="text-sm text-muted-foreground mt-1">Scrutins analysés</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold tabular-nums">
              {kpi.textesAdoptes.toLocaleString("fr-FR")}
            </div>
            <div className="text-sm text-muted-foreground mt-1">Textes adoptés</div>
          </CardContent>
        </Card>
        <Card className="col-span-2 sm:col-span-1">
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold tabular-nums">
              {kpi.dossiersEnDiscussion.toLocaleString("fr-FR")}
            </div>
            <div className="text-sm text-muted-foreground mt-1">Dossiers en discussion</div>
          </CardContent>
        </Card>
      </div>
      <p className="text-xs text-muted-foreground mb-8 text-center">
        XVIIe législature · Assemblée nationale · Données mises à jour quotidiennement
      </p>

      {/* Theme distribution — AN only, full width */}
      <Card className="mb-8">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Répartition thématique des scrutins</CardTitle>
          <p className="text-sm text-muted-foreground">
            Thèmes les plus traités à l&apos;Assemblée nationale
          </p>
        </CardHeader>
        <CardContent>
          <ThemeBars themes={themes} />
        </CardContent>
      </Card>

      {/* Pipeline */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-lg">Pipeline législatif</CardTitle>
          <p className="text-sm text-muted-foreground">
            État d&apos;avancement des dossiers par thème
          </p>
        </CardHeader>
        <CardContent>
          <PipelineTable rows={pipeline} />
        </CardContent>
      </Card>

      {/* Key votes — AN only, full width */}
      <Card className="mb-8">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Votes marquants</CardTitle>
          <p className="text-sm text-muted-foreground">
            Les 5 scrutins récents les plus contestés (écart serré entre pour et contre)
          </p>
        </CardHeader>
        <CardContent>
          <KeyVotesList votes={keyVotes} />
        </CardContent>
      </Card>

      {/* Methodology */}
      <MethodologyDisclaimer>
        Données issues de l&apos;open data de l&apos;Assemblée nationale (XVIIe législature). La
        classification thématique est réalisée par IA (13 catégories). Le pipeline reflète
        l&apos;état actuel des dossiers législatifs. Les votes marquants sont les scrutins récents
        avec le plus fort taux de contestation (écart le plus faible entre pour et contre). Les
        données du Sénat ne sont pas encore intégrées à cette section.
      </MethodologyDisclaimer>
    </section>
  );
}
