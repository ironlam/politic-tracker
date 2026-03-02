import { formatCompactCurrency } from "@/lib/utils";
import type { DeclarationDetails, FinancialParticipation } from "@/types/hatvp";

interface PatrimoineDeclaration {
  year: number;
  type: string;
  details: unknown;
}

interface PatrimoineSideData {
  declarations: PatrimoineDeclaration[];
}

interface PatrimoineSectionProps {
  left: PatrimoineSideData;
  right: PatrimoineSideData;
  leftLabel: string;
  rightLabel: string;
}

/** Extract details from the latest DIA declaration that has parsed data. */
function extractDetails(declarations: PatrimoineDeclaration[]): DeclarationDetails | null {
  const dia = declarations.find((d) => d.details !== null);
  return (dia?.details as DeclarationDetails) ?? null;
}

function cleanCompanyName(name: string): string {
  return name.includes("[Données non publiées]") ? "Société (nom non publié)" : name;
}

export function PatrimoineSection({ left, right, leftLabel, rightLabel }: PatrimoineSectionProps) {
  if (left.declarations.length === 0 && right.declarations.length === 0) return null;

  return (
    <section>
      <h3 className="text-lg font-display font-semibold mb-4">Patrimoine & intérêts (HATVP)</h3>
      <div className="grid md:grid-cols-2 gap-6">
        <PatrimoineSide data={left} label={leftLabel} />
        <PatrimoineSide data={right} label={rightLabel} />
      </div>
    </section>
  );
}

function PatrimoineSide({ data, label }: { data: PatrimoineSideData; label: string }) {
  if (data.declarations.length === 0) {
    return (
      <div className="bg-muted rounded-lg p-4">
        <p className="text-xs font-medium text-muted-foreground mb-2">{label}</p>
        <p className="text-muted-foreground text-sm text-center py-2">Aucune déclaration</p>
      </div>
    );
  }

  const details = extractDetails(data.declarations);
  const latestYear = Math.max(...data.declarations.map((d) => d.year));

  return (
    <div className="bg-muted rounded-lg p-4 space-y-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>

      {/* Key metrics grid */}
      {details ? (
        <MetricsGrid details={details} year={latestYear} />
      ) : (
        <p className="text-sm text-muted-foreground">
          {data.declarations.length} déclaration{data.declarations.length > 1 ? "s" : ""} (
          {latestYear})
        </p>
      )}

      {/* Financial participations */}
      {details && details.financialParticipations.length > 0 && (
        <ParticipationsList participations={details.financialParticipations} />
      )}

      {/* Professional activities & directorships */}
      {details &&
        (details.professionalActivities.length > 0 || details.directorships.length > 0) && (
          <ActivitiesAndDirectorships details={details} />
        )}
    </div>
  );
}

function MetricsGrid({ details, year }: { details: DeclarationDetails; year: number }) {
  const metrics = [
    { value: formatCompactCurrency(details.totalPortfolioValue), label: "Portefeuille" },
    { value: formatCompactCurrency(details.latestAnnualIncome), label: "Revenus annuels" },
    { value: String(details.totalCompanies), label: "Participations" },
    { value: String(details.totalDirectorships), label: "Directions" },
  ];

  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
        {metrics.map((m) => (
          <div key={m.label} className="bg-background/60 rounded-md p-2">
            <div className="text-lg font-bold font-mono leading-tight">{m.value}</div>
            <div className="text-[11px] text-muted-foreground">{m.label}</div>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground mt-1">Source : HATVP {year}</p>
    </div>
  );
}

function ParticipationsList({ participations }: { participations: FinancialParticipation[] }) {
  const withValue = participations
    .filter((p) => p.evaluation !== null && p.evaluation > 0)
    .sort((a, b) => (b.evaluation ?? 0) - (a.evaluation ?? 0));

  // Show top 5, collapsible for the rest
  const top = withValue.slice(0, 5);
  const rest = withValue.slice(5);
  const noValue = participations.filter((p) => !p.evaluation || p.evaluation === 0);

  if (top.length === 0 && noValue.length === 0) return null;

  return (
    <div>
      <p className="text-xs font-medium mb-1.5">
        Participations financières ({participations.length})
      </p>
      <div className="space-y-1">
        {top.map((p, i) => (
          <div key={i} className="flex items-center justify-between text-xs gap-2">
            <span className="truncate">
              {cleanCompanyName(p.company)}
              {p.isBoardMember && (
                <span className="text-amber-600 ml-1" title="Membre du conseil">
                  CA
                </span>
              )}
            </span>
            <span className="font-mono text-muted-foreground whitespace-nowrap">
              {new Intl.NumberFormat("fr-FR").format(p.evaluation!)} €
            </span>
          </div>
        ))}
      </div>
      {(rest.length > 0 || noValue.length > 0) && (
        <details className="mt-1">
          <summary className="cursor-pointer text-[11px] text-muted-foreground hover:underline">
            +{rest.length + noValue.length} autre{rest.length + noValue.length > 1 ? "s" : ""}
          </summary>
          <div className="pt-1 space-y-1">
            {rest.map((p, i) => (
              <div key={`r-${i}`} className="flex items-center justify-between text-xs gap-2">
                <span className="truncate">{cleanCompanyName(p.company)}</span>
                <span className="font-mono text-muted-foreground whitespace-nowrap">
                  {new Intl.NumberFormat("fr-FR").format(p.evaluation!)} €
                </span>
              </div>
            ))}
            {noValue.map((p, i) => (
              <div key={`nv-${i}`} className="text-xs text-muted-foreground truncate">
                {cleanCompanyName(p.company)}
                {p.capitalPercent ? ` (${p.capitalPercent}%)` : ""}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function ActivitiesAndDirectorships({ details }: { details: DeclarationDetails }) {
  const activities = details.professionalActivities;
  const directorships = details.directorships;

  return (
    <div className="space-y-3">
      {/* Professional activities */}
      {activities.length > 0 && (
        <div>
          <p className="text-xs font-medium mb-1.5">
            Activités professionnelles ({activities.length})
          </p>
          <div className="space-y-1.5">
            {activities.map((a, i) => (
              <div key={i} className="text-xs">
                <div className="font-medium">{a.description}</div>
                <div className="text-muted-foreground">{a.employer}</div>
                {a.annualRevenues.length > 0 && (
                  <div className="flex flex-wrap gap-x-2 mt-0.5">
                    {a.annualRevenues.map((r) => (
                      <span key={r.year} className="font-mono text-muted-foreground">
                        {r.year}: {new Intl.NumberFormat("fr-FR").format(r.amount)} €
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Directorships */}
      {directorships.length > 0 && (
        <div>
          <p className="text-xs font-medium mb-1.5">Postes de direction ({directorships.length})</p>
          <div className="space-y-1.5">
            {directorships.map((d, i) => (
              <div key={i} className="text-xs">
                <div className="font-medium">{d.company}</div>
                <div className="text-muted-foreground">{d.role}</div>
                {d.annualRevenues.length > 0 && (
                  <div className="flex flex-wrap gap-x-2 mt-0.5">
                    {d.annualRevenues.map((r) => (
                      <span key={r.year} className="font-mono text-muted-foreground">
                        {r.year}: {new Intl.NumberFormat("fr-FR").format(r.amount)} €
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
