import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PoliticianAvatar } from "@/components/politicians/PoliticianAvatar";
import { HorizontalBars } from "./HorizontalBars";
import { ProportionBar } from "./ProportionBar";
import { MethodologyDisclaimer } from "./MethodologyDisclaimer";
import { VERDICT_GROUP_COLORS, VERDICT_GROUP_LABELS } from "@/config/labels";

interface VerdictBreakdown {
  vrai: number;
  trompeur: number;
  faux: number;
  inverifiable: number;
}

interface RankedPolitician {
  fullName: string;
  slug: string;
  photoUrl: string | null;
  party: string | null;
  partyColor: string | null;
  totalMentions: number;
  breakdown: VerdictBreakdown;
  scoreVrai: number;
  scoreFaux: number;
}

interface RankedParty {
  name: string;
  color: string | null;
  slug: string | null;
  totalMentions: number;
  breakdown: VerdictBreakdown;
  scoreVrai: number;
  scoreFaux: number;
}

interface FactCheckSectionProps {
  total: number;
  groups: VerdictBreakdown;
  bySource: { source: string; count: number }[];
  mostReliablePoliticians: RankedPolitician[];
  leastReliablePoliticians: RankedPolitician[];
  mostReliableParties: RankedParty[];
  leastReliableParties: RankedParty[];
}

function PoliticianRankingItem({
  pol,
  rank,
  mode,
}: {
  pol: RankedPolitician;
  rank: number;
  mode: "reliable" | "unreliable";
}) {
  const score = mode === "reliable" ? pol.scoreVrai : pol.scoreFaux;
  return (
    <Link
      href={`/politiques/${pol.slug}`}
      className="flex items-center gap-3 hover:bg-muted/50 rounded-lg p-2 -mx-2 transition-colors"
    >
      <span className="text-sm font-bold text-muted-foreground w-6 text-right tabular-nums shrink-0">
        {rank}.
      </span>
      <PoliticianAvatar photoUrl={pol.photoUrl} fullName={pol.fullName} size="sm" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{pol.fullName}</div>
        <div className="flex items-center gap-2">
          {pol.party && <span className="text-xs text-muted-foreground">{pol.party}</span>}
          <span className="text-xs text-muted-foreground">
            · {pol.totalMentions} fact-check{pol.totalMentions > 1 ? "s" : ""}
          </span>
        </div>
        <div className="mt-1">
          <ProportionBar breakdown={pol.breakdown} />
        </div>
      </div>
      <span
        className="text-sm font-bold tabular-nums shrink-0"
        style={{
          color: mode === "reliable" ? VERDICT_GROUP_COLORS.vrai : VERDICT_GROUP_COLORS.faux,
        }}
      >
        {(score * 100).toFixed(0)}%
      </span>
    </Link>
  );
}

function PartyRankingItem({
  party,
  rank,
  mode,
}: {
  party: RankedParty;
  rank: number;
  mode: "reliable" | "unreliable";
}) {
  const score = mode === "reliable" ? party.scoreVrai : party.scoreFaux;
  return (
    <Link
      href={party.slug ? `/partis/${party.slug}` : "#"}
      className="flex items-center gap-3 hover:bg-muted/50 rounded-lg p-2 -mx-2 transition-colors"
    >
      <span className="text-sm font-bold text-muted-foreground w-6 text-right tabular-nums shrink-0">
        {rank}.
      </span>
      <div
        className="w-8 h-8 rounded flex items-center justify-center text-white text-xs font-bold shrink-0"
        style={{ backgroundColor: party.color || "#888" }}
      >
        {party.name.slice(0, 3)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{party.name}</div>
        <span className="text-xs text-muted-foreground">
          {party.totalMentions} fact-check{party.totalMentions > 1 ? "s" : ""}
        </span>
        <div className="mt-1">
          <ProportionBar breakdown={party.breakdown} />
        </div>
      </div>
      <span
        className="text-sm font-bold tabular-nums shrink-0"
        style={{
          color: mode === "reliable" ? VERDICT_GROUP_COLORS.vrai : VERDICT_GROUP_COLORS.faux,
        }}
      >
        {(score * 100).toFixed(0)}%
      </span>
    </Link>
  );
}

export function FactCheckSection({
  total,
  groups,
  bySource,
  mostReliablePoliticians,
  leastReliablePoliticians,
  mostReliableParties,
  leastReliableParties,
}: FactCheckSectionProps) {
  const vraiPct = total > 0 ? ((groups.vrai / total) * 100).toFixed(0) : "0";
  const trompeurPct = total > 0 ? ((groups.trompeur / total) * 100).toFixed(0) : "0";
  const fauxPct = total > 0 ? ((groups.faux / total) * 100).toFixed(0) : "0";

  const verdictBars = (["vrai", "trompeur", "faux", "inverifiable"] as const)
    .filter((key) => groups[key] > 0)
    .map((key) => ({
      label: VERDICT_GROUP_LABELS[key],
      value: groups[key],
      color: VERDICT_GROUP_COLORS[key],
    }));

  return (
    <section aria-labelledby="factcheck-heading" className="py-8">
      <h2 id="factcheck-heading" className="sr-only">
        Fact-checking
      </h2>
      {/* Methodology — top, before data */}
      <MethodologyDisclaimer
        details={
          <ul className="list-disc list-inside space-y-1">
            <li>
              <strong>Biais de visibilité :</strong> les figures médiatiques sont plus scrutées par
              les fact-checkeurs
            </li>
            <li>
              <strong>Biais de sélection :</strong> les fact-checkeurs ciblent les propos douteux,
              pas les évidences
            </li>
            <li>
              <strong>Score pondéré :</strong> le classement utilise une moyenne pondérée qui réduit
              l&apos;impact des petits échantillons (méthode bayésienne)
            </li>
            <li>
              <strong>Seuil :</strong> minimum 5 propos vérifiés pour figurer dans les classements
            </li>
          </ul>
        }
      >
        Le nombre de fact-checks reflète la place d&apos;un responsable politique dans le débat
        public. Les proportions et le score pondéré permettent de comparer leur fiabilité
        indépendamment de leur exposition médiatique.
      </MethodologyDisclaimer>

      {/* KPI cards — 4 columns */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 mb-8">
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold tabular-nums">{total.toLocaleString("fr-FR")}</div>
            <div className="text-sm text-muted-foreground mt-1">Propos vérifiés</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div
              className="text-3xl font-bold tabular-nums"
              style={{ color: VERDICT_GROUP_COLORS.vrai }}
            >
              {vraiPct}%
            </div>
            <div className="text-sm text-muted-foreground mt-1">Vrai</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div
              className="text-3xl font-bold tabular-nums"
              style={{ color: VERDICT_GROUP_COLORS.trompeur }}
            >
              {trompeurPct}%
            </div>
            <div className="text-sm text-muted-foreground mt-1">Trompeur</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div
              className="text-3xl font-bold tabular-nums"
              style={{ color: VERDICT_GROUP_COLORS.faux }}
            >
              {fauxPct}%
            </div>
            <div className="text-sm text-muted-foreground mt-1">Faux</div>
          </CardContent>
        </Card>
      </div>

      {/* Politician rankings — 2 columns */}
      <div className="grid md:grid-cols-2 gap-8 mb-8">
        {mostReliablePoliticians.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Politiques les plus fiables</CardTitle>
              <p className="text-sm text-muted-foreground">
                Par proportion de propos vérifiés vrais (score pondéré)
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {mostReliablePoliticians.map((pol, i) => (
                  <PoliticianRankingItem key={pol.slug} pol={pol} rank={i + 1} mode="reliable" />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {leastReliablePoliticians.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Politiques les moins fiables</CardTitle>
              <p className="text-sm text-muted-foreground">
                Par proportion de propos vérifiés faux (score pondéré)
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {leastReliablePoliticians.map((pol, i) => (
                  <PoliticianRankingItem key={pol.slug} pol={pol} rank={i + 1} mode="unreliable" />
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Party rankings — 2 columns */}
      <div className="grid md:grid-cols-2 gap-8 mb-8">
        {mostReliableParties.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Partis les plus fiables</CardTitle>
              <p className="text-sm text-muted-foreground">
                Par proportion de propos vérifiés vrais (score pondéré)
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {mostReliableParties.map((party, i) => (
                  <PartyRankingItem key={party.name} party={party} rank={i + 1} mode="reliable" />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {leastReliableParties.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Partis les moins fiables</CardTitle>
              <p className="text-sm text-muted-foreground">
                Par proportion de propos vérifiés faux (score pondéré)
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {leastReliableParties.map((party, i) => (
                  <PartyRankingItem key={party.name} party={party} rank={i + 1} mode="unreliable" />
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Verdict distribution + sources */}
      <div className="grid md:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Répartition des verdicts</CardTitle>
          </CardHeader>
          <CardContent>
            <HorizontalBars title="Répartition des verdicts de fact-checking" bars={verdictBars} />

            <div className="grid grid-cols-4 gap-4 mt-6 pt-4 border-t">
              {(["vrai", "trompeur", "faux", "inverifiable"] as const).map((key) => {
                const pct = total > 0 ? ((groups[key] / total) * 100).toFixed(0) : "0";
                return (
                  <div key={key} className="text-center">
                    <div
                      className="text-2xl font-bold"
                      style={{ color: VERDICT_GROUP_COLORS[key] }}
                    >
                      {pct}%
                    </div>
                    <div className="text-xs text-muted-foreground">{VERDICT_GROUP_LABELS[key]}</div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Par source</CardTitle>
            <p className="text-sm text-muted-foreground">Organismes de fact-checking référencés</p>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2">
              {bySource.slice(0, 8).map((s, i) => (
                <li key={s.source} className="flex items-center justify-between">
                  <span className="text-sm">
                    <span className="text-muted-foreground mr-2 tabular-nums">{i + 1}.</span>
                    {s.source}
                  </span>
                  <span className="text-sm font-medium tabular-nums">
                    {s.count.toLocaleString("fr-FR")}
                  </span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </div>

      {/* Legend for proportion bars */}
      <div className="flex items-center justify-center gap-4 mt-6 text-xs text-muted-foreground">
        {(["vrai", "trompeur", "faux", "inverifiable"] as const).map((key) => (
          <div key={key} className="flex items-center gap-1.5">
            <span
              className="inline-block w-3 h-3 rounded-sm"
              style={{ backgroundColor: VERDICT_GROUP_COLORS[key] }}
            />
            {VERDICT_GROUP_LABELS[key]}
          </div>
        ))}
      </div>
    </section>
  );
}
