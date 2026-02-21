import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AFFAIR_SUPER_CATEGORY_LABELS,
  AFFAIR_STATUS_LABELS,
  type AffairSuperCategory,
} from "@/config/labels";
import type { AffairStatus } from "@/types";
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

interface PartyAffairStats {
  name: string;
  shortName: string | null;
  color: string | null;
  slug: string | null;
  directAffairs: number;
  totalElected: number;
  ratePer100: number;
}

interface JudicialSectionProps {
  totalDirect: number;
  byStatus: StatusCount[];
  byCategory: CategoryCount[];
  byParty: PartyAffairStats[];
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
  byStatus,
  byCategory,
  byParty,
}: JudicialSectionProps) {
  const ongoing = byStatus
    .filter((s) => ONGOING_STATUSES.has(s.status))
    .reduce((sum, s) => sum + s.count, 0);
  const closed = byStatus
    .filter((s) => !ONGOING_STATUSES.has(s.status))
    .reduce((sum, s) => sum + s.count, 0);

  return (
    <section aria-labelledby="judicial-heading" className="py-12">
      <h2 id="judicial-heading" className="text-2xl font-bold mb-2">
        Transparence judiciaire
      </h2>
      <p className="text-muted-foreground mb-8">
        {totalDirect} affaire{totalDirect !== 1 ? "s" : ""} documentée{totalDirect !== 1 ? "s" : ""}{" "}
        avec implication directe
      </p>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Donut par catégorie */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Par type d&apos;infraction</CardTitle>
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

        {/* Statut */}
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

      {/* Par parti (normalisé) */}
      {byParty.length > 0 && (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="text-lg">Par parti (normalisé)</CardTitle>
            <p className="text-sm text-muted-foreground">
              Nombre d&apos;affaires directes pour 100 élus du parti. Seuls les partis avec au moins
              5 élus sont affichés.
            </p>
          </CardHeader>
          <CardContent>
            <HorizontalBars
              title="Affaires directes pour 100 élus par parti"
              bars={byParty.map((p) => ({
                label: p.shortName || p.name,
                value: p.ratePer100,
                color: p.color || undefined,
                href: p.slug ? `/partis/${p.slug}` : undefined,
              }))}
            />
          </CardContent>
        </Card>
      )}

      <MethodologyDisclaimer>
        Seules les affaires où le politicien est directement mis en cause (involvement
        &laquo;&nbsp;direct&nbsp;&raquo;) sont comptabilisées. Les mentions simples, rôles de
        victime ou plaignant sont exclus. Les ratios par parti sont normalisés par le nombre total
        d&apos;élus publiés dans notre base.
      </MethodologyDisclaimer>
    </section>
  );
}
