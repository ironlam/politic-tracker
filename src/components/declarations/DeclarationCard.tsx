import type { DeclarationDetails } from "@/types/hatvp";
import { HorizontalBars } from "@/components/stats/HorizontalBars";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DeclarationMetrics } from "./DeclarationMetrics";

interface DeclarationCardProps {
  declarations: Array<{
    id: string;
    type: string;
    year: number;
    hatvpUrl: string;
    pdfUrl: string | null;
    details: DeclarationDetails | null;
  }>;
  politicianHatvpUrl: string | null;
}

export function DeclarationCard({ declarations, politicianHatvpUrl }: DeclarationCardProps) {
  if (declarations.length === 0) return null;

  // Find the latest DIA that has parsed details
  const latestDIA = declarations.find((d) => d.details !== null);
  const details = latestDIA?.details as DeclarationDetails | null;

  // Build financial participation bars (top 5 by evaluation)
  const allParticipations =
    details?.financialParticipations.filter((p) => p.evaluation !== null && p.evaluation > 0) ?? [];
  const sortedParticipations = [...allParticipations].sort(
    (a, b) => (b.evaluation ?? 0) - (a.evaluation ?? 0)
  );
  const topParticipations = sortedParticipations.slice(0, 5);
  const remainingParticipations = sortedParticipations.slice(5);

  const participationBars = topParticipations.map((p) => ({
    label: p.company.includes("[Données non publiées]") ? "Société (nom non publié)" : p.company,
    value: p.evaluation!,
    suffix: " €",
  }));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            Déclarations d&apos;intérêts et d&apos;activités
          </h2>
          {politicianHatvpUrl && (
            <a
              href={politicianHatvpUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:underline"
            >
              Source : HATVP ↗
            </a>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Key metrics */}
        {details && (
          <DeclarationMetrics
            totalPortfolioValue={details.totalPortfolioValue}
            totalCompanies={details.totalCompanies}
            latestAnnualIncome={details.latestAnnualIncome}
            totalDirectorships={details.totalDirectorships}
          />
        )}

        {/* Financial participations */}
        {participationBars.length > 0 && (
          <div>
            <HorizontalBars bars={participationBars} title="Participations financières" />
            {remainingParticipations.length > 0 && (
              <details className="mt-3">
                <summary className="cursor-pointer text-sm text-muted-foreground hover:underline">
                  Voir les {sortedParticipations.length} participations
                </summary>
                <div className="pt-2 space-y-2">
                  {remainingParticipations.map((p, i) => (
                    <div key={`part-${i}`} className="flex items-center justify-between text-sm">
                      <span className="truncate mr-2">
                        {p.company.includes("[Données non publiées]")
                          ? "Société (nom non publié)"
                          : p.company}
                      </span>
                      <span className="font-mono text-muted-foreground whitespace-nowrap">
                        {new Intl.NumberFormat("fr-FR").format(p.evaluation!)} €
                      </span>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}

        {/* Professional activities */}
        {details && details.professionalActivities.length > 0 && (
          <details className="group">
            <summary className="flex items-center justify-between cursor-pointer py-2 text-sm font-medium">
              <span>Revenus et activités professionnelles</span>
              <span className="text-muted-foreground text-xs">
                {details.professionalActivities.length}
              </span>
            </summary>
            <div className="pt-2 space-y-3">
              {details.professionalActivities.map((activity, i) => (
                <div key={`activity-${i}`} className="text-sm">
                  <div className="font-medium">{activity.description}</div>
                  <div className="text-muted-foreground">{activity.employer}</div>
                  {activity.startDate && (
                    <div className="text-xs text-muted-foreground">
                      {activity.startDate} — {activity.endDate || "en cours"}
                    </div>
                  )}
                  {activity.annualRevenues.length > 0 && (
                    <div className="flex gap-3 mt-1">
                      {activity.annualRevenues.map((r) => (
                        <span key={r.year} className="text-xs font-mono">
                          {r.year}: {new Intl.NumberFormat("fr-FR").format(r.amount)} €
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </details>
        )}

        {/* Electoral mandates */}
        {details && details.electoralMandates.length > 0 && (
          <details className="group">
            <summary className="flex items-center justify-between cursor-pointer py-2 text-sm font-medium">
              <span>Mandats électifs et indemnités</span>
              <span className="text-muted-foreground text-xs">
                {details.electoralMandates.length}
              </span>
            </summary>
            <div className="pt-2 space-y-3">
              {details.electoralMandates.map((mandate, i) => (
                <div key={`mandate-${i}`} className="text-sm">
                  <div className="font-medium">{mandate.mandate}</div>
                  {mandate.startDate && (
                    <div className="text-xs text-muted-foreground">
                      {mandate.startDate} — {mandate.endDate || "en cours"}
                    </div>
                  )}
                  {mandate.annualRevenues.length > 0 && (
                    <div className="flex gap-3 mt-1">
                      {mandate.annualRevenues.map((r) => (
                        <span key={r.year} className="text-xs font-mono">
                          {r.year}: {new Intl.NumberFormat("fr-FR").format(r.amount)} €
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </details>
        )}

        {/* Directorships */}
        {details && details.directorships.length > 0 && (
          <details className="group">
            <summary className="flex items-center justify-between cursor-pointer py-2 text-sm font-medium">
              <span>Postes de direction</span>
              <span className="text-muted-foreground text-xs">{details.directorships.length}</span>
            </summary>
            <div className="pt-2 space-y-3">
              {details.directorships.map((dir, i) => (
                <div key={`dir-${i}`} className="text-sm">
                  <div className="font-medium">{dir.company}</div>
                  <div className="text-muted-foreground">{dir.role}</div>
                  {dir.startDate && (
                    <div className="text-xs text-muted-foreground">
                      {dir.startDate} — {dir.endDate || "en cours"}
                    </div>
                  )}
                  {dir.annualRevenues.length > 0 && (
                    <div className="flex gap-3 mt-1">
                      {dir.annualRevenues.map((r) => (
                        <span key={r.year} className="text-xs font-mono">
                          {r.year}: {new Intl.NumberFormat("fr-FR").format(r.amount)} €
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </details>
        )}

        {/* Spouse & collaborators */}
        {details && (details.spouseActivity || details.collaborators.length > 0) && (
          <details className="group">
            <summary className="flex items-center justify-between cursor-pointer py-2 text-sm font-medium">
              <span>Conjoint & collaborateurs</span>
            </summary>
            <div className="pt-2 space-y-2">
              {details.spouseActivity && (
                <p className="text-sm text-muted-foreground">{details.spouseActivity}</p>
              )}
              {details.collaborators.map((c, i) => (
                <div key={`collab-${i}`} className="text-sm">
                  <span className="font-medium">{c.name}</span>
                  <span className="text-muted-foreground"> — {c.employer}</span>
                </div>
              ))}
            </div>
          </details>
        )}

        {/* All declaration links */}
        <div className="flex flex-wrap gap-2 pt-4 border-t">
          {declarations.map((d) => (
            <a key={d.id} href={d.hatvpUrl} target="_blank" rel="noopener noreferrer">
              <Badge variant="outline" className="hover:bg-accent cursor-pointer">
                {d.type === "INTERETS" ? "Intérêts" : "Patrimoine"} {d.year} ↗
              </Badge>
            </a>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
