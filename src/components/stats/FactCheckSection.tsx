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

interface FactCheckSectionProps {
  total: number;
  groups: { vrai: number; mitige: number; faux: number; inverifiable: number };
  bySource: { source: string; count: number }[];
  byRating: { rating: FactCheckRating; count: number }[];
}

export function FactCheckSection({ total, groups, bySource }: FactCheckSectionProps) {
  const verdictBars = (["vrai", "mitige", "faux", "inverifiable"] as const)
    .filter((key) => groups[key] > 0)
    .map((key) => ({
      label: VERDICT_LABELS[key],
      value: groups[key],
      color: VERDICT_COLORS[key],
    }));

  return (
    <section aria-labelledby="factcheck-heading" className="py-12">
      <h2 id="factcheck-heading" className="text-2xl font-bold mb-2">
        Fact-checking
      </h2>
      <p className="text-muted-foreground mb-8">
        {total.toLocaleString("fr-FR")} vérifications issues de sources indépendantes
      </p>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Verdicts */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Répartition des verdicts</CardTitle>
          </CardHeader>
          <CardContent>
            <HorizontalBars title="Répartition des verdicts de fact-checking" bars={verdictBars} />

            {/* Percentage summary */}
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

        {/* Sources */}
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
        catégories. Un politicien peut être mentionné dans un fact-check sans en être l&apos;auteur
        de la déclaration vérifiée.
      </MethodologyDisclaimer>
    </section>
  );
}
