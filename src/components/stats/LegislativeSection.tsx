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

function ThemeBars({ themes, title }: { themes: ThemeDistribution[]; title: string }) {
  if (themes.length === 0) {
    return <p className="text-sm text-muted-foreground">Aucune donnée disponible</p>;
  }
  const maxCount = Math.max(...themes.map((t) => t.count));
  return (
    <HorizontalBars
      title={title}
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
      <table className="w-full text-sm min-w-[480px]">
        <thead>
          <tr className="border-b text-left">
            <th className="py-2 pr-2 font-medium">Thème</th>
            <th className="py-2 px-2 text-right font-medium">Déposés</th>
            <th className="py-2 px-2 text-right font-medium">Commission</th>
            <th className="py-2 px-2 text-right font-medium">Adoptés</th>
            <th className="py-2 pl-2 text-right font-medium">Rejetés</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.theme} className="border-b last:border-0">
              <td className="py-2.5 pr-2">
                <span className="text-sm whitespace-nowrap">
                  {r.icon} <span className="hidden sm:inline">{r.label}</span>
                  <span className="sm:hidden">
                    {r.label.length > 15 ? r.label.slice(0, 15) + "\u2026" : r.label}
                  </span>
                </span>
              </td>
              <td className="py-2.5 px-2 text-right tabular-nums text-muted-foreground">
                {r.depose || "\u2014"}
              </td>
              <td className="py-2.5 px-2 text-right tabular-nums text-yellow-600 dark:text-yellow-400">
                {r.enCommission + r.enCours || "\u2014"}
              </td>
              <td className="py-2.5 px-2 text-right tabular-nums text-green-600 dark:text-green-400">
                {r.adopte || "\u2014"}
              </td>
              <td className="py-2.5 pl-2 text-right tabular-nums text-red-600 dark:text-red-400">
                {r.rejete || "\u2014"}
              </td>
            </tr>
          ))}
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
  const { kpi, themesAN, themesSENAT, pipeline, keyVotesAN, keyVotesSENAT } = stats;

  return (
    <section aria-labelledby="legislative-heading" className="py-8">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold tabular-nums">
              {kpi.dossiersEnCours.toLocaleString("fr-FR")}
            </div>
            <div className="text-sm text-muted-foreground mt-1">Dossiers en cours</div>
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
            <div className="text-3xl font-bold tabular-nums">{kpi.themesActifs}</div>
            <div className="text-sm text-muted-foreground mt-1">Thèmes actifs</div>
          </CardContent>
        </Card>
      </div>

      {/* Theme priorities — AN / Sénat side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Assemblée nationale</CardTitle>
            <p className="text-sm text-muted-foreground">Thèmes les plus traités en scrutins</p>
          </CardHeader>
          <CardContent>
            <ThemeBars themes={themesAN} title="Thèmes AN" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Sénat</CardTitle>
            <p className="text-sm text-muted-foreground">Thèmes les plus traités en scrutins</p>
          </CardHeader>
          <CardContent>
            <ThemeBars themes={themesSENAT} title="Thèmes Sénat" />
          </CardContent>
        </Card>
      </div>

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

      {/* Key votes — AN / Sénat side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Votes marquants — AN</CardTitle>
            <p className="text-sm text-muted-foreground">Scrutins récents les plus contestés</p>
          </CardHeader>
          <CardContent>
            <KeyVotesList votes={keyVotesAN} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Votes marquants — Sénat</CardTitle>
            <p className="text-sm text-muted-foreground">Scrutins récents les plus contestés</p>
          </CardHeader>
          <CardContent>
            <KeyVotesList votes={keyVotesSENAT} />
          </CardContent>
        </Card>
      </div>

      {/* Methodology */}
      <MethodologyDisclaimer>
        Données issues de l&apos;open data de l&apos;Assemblée nationale et du Sénat. La
        classification thématique est réalisée par IA (13 catégories). Le pipeline reflète
        l&apos;état actuel des dossiers législatifs. Les votes marquants sont les scrutins récents
        avec le plus fort taux de contestation (écart le plus faible entre pour et contre).
      </MethodologyDisclaimer>
    </section>
  );
}
