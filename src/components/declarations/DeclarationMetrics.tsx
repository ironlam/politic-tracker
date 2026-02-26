interface DeclarationMetricsProps {
  totalPortfolioValue: number | null;
  totalCompanies: number;
  latestAnnualIncome: number | null;
  totalDirectorships: number;
}

function formatCompactCurrency(value: number | null): string {
  if (value === null || value === 0) return "—";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} M€`;
  if (value >= 1_000) return `${Math.round(value / 1_000)} k€`;
  return `${value} €`;
}

export function DeclarationMetrics({
  totalPortfolioValue,
  totalCompanies,
  latestAnnualIncome,
  totalDirectorships,
}: DeclarationMetricsProps) {
  const metrics = [
    {
      value: formatCompactCurrency(totalPortfolioValue),
      label: "Portefeuille total",
    },
    {
      value: String(totalCompanies),
      label: "Participations",
    },
    {
      value: formatCompactCurrency(latestAnnualIncome),
      label: "Revenus annuels",
    },
    {
      value: String(totalDirectorships),
      label: "Mandats & directions",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {metrics.map((metric) => (
        <div key={metric.label} className="bg-muted/50 rounded-lg p-3">
          <div className="text-2xl font-bold font-mono">{metric.value}</div>
          <div className="text-xs text-muted-foreground">{metric.label}</div>
        </div>
      ))}
    </div>
  );
}
