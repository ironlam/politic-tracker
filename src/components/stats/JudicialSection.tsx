import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AFFAIR_SUPER_CATEGORY_LABELS,
  AFFAIR_STATUS_LABELS,
  type AffairSuperCategory,
} from "@/config/labels";
import type { AffairCategory, AffairStatus } from "@/types";
import { DonutChart } from "./DonutChart";
import { HorizontalBars } from "./HorizontalBars";
import { MethodologyDisclaimer } from "./MethodologyDisclaimer";

const SUPER_CATEGORY_HEX: Record<AffairSuperCategory, string> = {
  PROBITE: "#7c3aed",
  FINANCES: "#2563eb",
  PERSONNES: "#dc2626",
  EXPRESSION: "#d97706",
  AUTRE: "#6b7280",
};

interface StatusCount {
  status: AffairStatus;
  count: number;
}

interface CategoryCount {
  category: AffairSuperCategory;
  count: number;
}

interface GraveCategoryData {
  category: AffairCategory;
  label: string;
  total: number;
  parties: { name: string; count: number; color: string | null; slug: string | null }[];
}

interface JudicialSectionProps {
  totalDirect: number;
  totalCondamnations: number;
  condamnationsDefinitives: number;
  byStatus: StatusCount[];
  byCategory: CategoryCount[];
  graveByCategory: GraveCategoryData[];
}

const ONGOING_STATUSES = new Set<AffairStatus>([
  "ENQUETE_PRELIMINAIRE",
  "INSTRUCTION",
  "MISE_EN_EXAMEN",
  "RENVOI_TRIBUNAL",
  "PROCES_EN_COURS",
  "APPEL_EN_COURS",
]);

export function JudicialSection({
  totalDirect,
  totalCondamnations,
  condamnationsDefinitives,
  byStatus,
  byCategory,
  graveByCategory,
}: JudicialSectionProps) {
  const ongoing = byStatus
    .filter((s) => ONGOING_STATUSES.has(s.status))
    .reduce((sum, s) => sum + s.count, 0);
  const closed = byStatus
    .filter((s) => !ONGOING_STATUSES.has(s.status))
    .reduce((sum, s) => sum + s.count, 0);

  return (
    <section aria-labelledby="judicial-heading" className="py-8">
      {/* Contextual KPIs */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold tabular-nums">
              {totalCondamnations.toLocaleString("fr-FR")}
            </div>
            <div className="text-sm text-muted-foreground mt-1">Condamnations</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold tabular-nums text-red-600">
              {condamnationsDefinitives.toLocaleString("fr-FR")}
            </div>
            <div className="text-sm text-muted-foreground mt-1">dont définitives</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold tabular-nums text-muted-foreground">
              {totalDirect.toLocaleString("fr-FR")}
            </div>
            <div className="text-sm text-muted-foreground mt-1">Affaires documentées</div>
          </CardContent>
        </Card>
      </div>

      {/* Grave affairs by category → party */}
      {graveByCategory.length > 0 && (
        <>
          <h2 id="judicial-heading" className="text-xl font-bold mb-2">
            Condamnations graves par parti
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            Condamnations (1ère instance, appel ou définitives) avec implication directe, par
            catégorie et par parti
          </p>

          <div className="space-y-6 mb-8">
            {graveByCategory.map(({ category, label, total, parties }) => (
              <Card key={category}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span>{label}</span>
                    <span className="text-sm font-normal text-muted-foreground">
                      {total} affaire{total !== 1 ? "s" : ""}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <HorizontalBars
                    title={`${label} par parti`}
                    bars={parties.map((p) => ({
                      label: p.name,
                      value: p.count,
                      color: p.color || undefined,
                      href: p.slug ? `/affaires/parti/${p.slug}` : undefined,
                    }))}
                  />
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Status + Category overview */}
      <div className="grid md:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Condamnations par type</CardTitle>
          </CardHeader>
          <CardContent>
            <DonutChart
              title="Répartition des affaires par type d'infraction"
              segments={byCategory.map((c) => ({
                label: AFFAIR_SUPER_CATEGORY_LABELS[c.category],
                value: c.count,
                color: SUPER_CATEGORY_HEX[c.category],
              }))}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Statut des procédures</CardTitle>
            <p className="text-sm text-muted-foreground">
              {ongoing} en cours · {closed} terminée{closed !== 1 ? "s" : ""}
            </p>
          </CardHeader>
          <CardContent>
            <HorizontalBars
              title="Répartition des affaires par statut"
              bars={byStatus
                .filter((s) => s.count > 0)
                .sort((a, b) => b.count - a.count)
                .map((s) => ({
                  label: AFFAIR_STATUS_LABELS[s.status],
                  value: s.count,
                  color: ONGOING_STATUSES.has(s.status) ? "#d97706" : "#2563eb",
                }))}
            />
          </CardContent>
        </Card>
      </div>

      <MethodologyDisclaimer>
        Les graphiques &laquo;&nbsp;condamnations graves&nbsp;&raquo; et &laquo;&nbsp;par
        type&nbsp;&raquo; ne comptabilisent que les condamnations (1ère instance, appel en cours ou
        définitives) où le politicien est directement mis en cause. Les enquêtes préliminaires,
        mises en examen, classements sans suite et relaxes sont exclus de ces comptages. Les
        catégories &laquo;&nbsp;graves&nbsp;&raquo; regroupent : violence, agression sexuelle,
        harcèlement, menace, incitation à la haine, corruption, fraude fiscale et financement
        illégal.
      </MethodologyDisclaimer>
    </section>
  );
}
