import Image from "next/image";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HorizontalBars } from "./HorizontalBars";
import { MethodologyDisclaimer } from "./MethodologyDisclaimer";
import type { FactCheckRating } from "@/types";

const VERDICT_COLORS: Record<string, string> = {
  vrai: "#2d6a4f",
  mitige: "#e9c46a",
  faux: "#c1121f",
  inverifiable: "#6b7280",
};

const VERDICT_LABELS: Record<string, string> = {
  vrai: "Vrai / Plutôt vrai",
  mitige: "Mitigé",
  faux: "Faux / Trompeur",
  inverifiable: "Invérifiable",
};

interface PartyFalseStats {
  name: string;
  count: number;
  color: string | null;
  slug: string | null;
}

interface PoliticianFalseStats {
  fullName: string;
  slug: string;
  photoUrl: string | null;
  party: string | null;
  partyColor: string | null;
  count: number;
}

interface FactCheckSectionProps {
  total: number;
  groups: { vrai: number; mitige: number; faux: number; inverifiable: number };
  bySource: { source: string; count: number }[];
  byRating: { rating: FactCheckRating; count: number }[];
  falseByParty: PartyFalseStats[];
  topPoliticians: PoliticianFalseStats[];
}

export function FactCheckSection({
  total,
  groups,
  bySource,
  falseByParty,
  topPoliticians,
}: FactCheckSectionProps) {
  const fauxPct = total > 0 ? ((groups.faux / total) * 100).toFixed(0) : "0";

  const verdictBars = (["vrai", "mitige", "faux", "inverifiable"] as const)
    .filter((key) => groups[key] > 0)
    .map((key) => ({
      label: VERDICT_LABELS[key],
      value: groups[key],
      color: VERDICT_COLORS[key],
    }));

  return (
    <section aria-labelledby="factcheck-heading" className="py-8">
      {/* Contextual KPIs */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold tabular-nums">{total.toLocaleString("fr-FR")}</div>
            <div className="text-sm text-muted-foreground mt-1">Fact-checks analysés</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold tabular-nums text-red-600">
              {groups.faux.toLocaleString("fr-FR")}
            </div>
            <div className="text-sm text-muted-foreground mt-1">Déclarations fausses</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold tabular-nums text-red-600">{fauxPct}%</div>
            <div className="text-sm text-muted-foreground mt-1">Taux de fausseté</div>
          </CardContent>
        </Card>
      </div>

      {/* False declarations by party */}
      {falseByParty.length > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-lg" id="factcheck-heading">
              Fausses déclarations par parti
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Nombre de fact-checks classés faux, trompeurs ou hors contexte par parti
            </p>
          </CardHeader>
          <CardContent>
            <HorizontalBars
              title="Fausses déclarations par parti politique"
              bars={falseByParty.map((p) => ({
                label: p.name,
                value: p.count,
                color: p.color || undefined,
                href: p.slug ? `/partis/${p.slug}` : undefined,
              }))}
            />
          </CardContent>
        </Card>
      )}

      {/* Top 10 politicians */}
      {topPoliticians.length > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-lg">
              Politiciens avec le plus de fausses déclarations
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Classement par nombre de fact-checks classés faux ou trompeurs
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topPoliticians.map((pol, i) => (
                <Link
                  key={pol.slug}
                  href={`/politiques/${pol.slug}`}
                  className="flex items-center gap-3 hover:bg-muted/50 rounded-lg p-2 -mx-2 transition-colors"
                >
                  <span className="text-sm font-bold text-muted-foreground w-6 text-right tabular-nums">
                    {i + 1}.
                  </span>
                  {pol.photoUrl ? (
                    <Image
                      src={pol.photoUrl}
                      alt=""
                      width={32}
                      height={32}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                      {pol.fullName
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .slice(0, 2)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{pol.fullName}</div>
                    {pol.party && <div className="text-xs text-muted-foreground">{pol.party}</div>}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span
                      className="inline-block w-2 h-2 rounded-full"
                      style={{ backgroundColor: pol.partyColor || "#6b7280" }}
                    />
                    <span className="text-sm font-bold tabular-nums">{pol.count}</span>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Verdict distribution + sources */}
      <div className="grid md:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Répartition des verdicts</CardTitle>
          </CardHeader>
          <CardContent>
            <HorizontalBars title="Répartition des verdicts de fact-checking" bars={verdictBars} />

            <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t">
              {(["vrai", "faux", "mitige"] as const).map((key) => {
                const pct = total > 0 ? ((groups[key] / total) * 100).toFixed(0) : "0";
                return (
                  <div key={key} className="text-center">
                    <div className="text-2xl font-bold" style={{ color: VERDICT_COLORS[key] }}>
                      {pct}%
                    </div>
                    <div className="text-xs text-muted-foreground">{VERDICT_LABELS[key]}</div>
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
            <HorizontalBars
              title="Nombre de fact-checks par source"
              bars={bySource.slice(0, 8).map((s) => ({
                label: s.source,
                value: s.count,
              }))}
            />
          </CardContent>
        </Card>
      </div>

      <MethodologyDisclaimer>
        Les fact-checks sont issus d&apos;organismes indépendants (AFP Factuel, Les Décodeurs,
        etc.). Les verdicts sont classés selon l&apos;échelle de chaque source, harmonisée en 4
        catégories. Un politicien est comptabilisé s&apos;il est mentionné dans le fact-check, même
        s&apos;il n&apos;est pas l&apos;auteur de la déclaration vérifiée. Minimum 3 mentions par
        parti pour apparaître dans le classement.
      </MethodologyDisclaimer>
    </section>
  );
}
