import { formatCompactCurrency } from "@/lib/utils";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import type { GlossaryKey } from "@/config/glossary";

interface DeclarationMetricsProps {
  totalPortfolioValue: number | null;
  totalCompanies: number;
  latestAnnualIncome: number | null;
  totalDirectorships: number;
}

const HATVP_DI_URL =
  "https://www.hatvp.fr/espacedeclarant/patrimoine-interets-instruments-financiers/la-declaration-dinterets/";

export function DeclarationMetrics({
  totalPortfolioValue,
  totalCompanies,
  latestAnnualIncome,
  totalDirectorships,
}: DeclarationMetricsProps) {
  const metrics: { value: string; label: string; term: GlossaryKey }[] = [
    {
      value: formatCompactCurrency(totalPortfolioValue),
      label: "Portefeuille total",
      term: "portefeuilleTotal",
    },
    {
      value: String(totalCompanies),
      label: "Participations",
      term: "participationsHatvp",
    },
    {
      value: formatCompactCurrency(latestAnnualIncome),
      label: "Revenus annuels",
      term: "revenusAnnuels",
    },
    {
      value: String(totalDirectorships),
      label: "Mandats & directions",
      term: "mandatsDirections",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {metrics.map((metric) => (
        <div key={metric.label} className="bg-muted/50 rounded-lg p-3">
          <div className="text-2xl font-bold font-mono">{metric.value}</div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <span>{metric.label}</span>
            <InfoTooltip term={metric.term} href={HATVP_DI_URL} size="sm" />
          </div>
        </div>
      ))}
    </div>
  );
}
