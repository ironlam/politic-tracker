"use client";

import { Badge } from "@/components/ui/badge";
import { MANDATE_TYPE_LABELS, feminizeRole } from "@/config/labels";
import type { SerializedMandate, MandateType } from "@/types";

interface MandateTimelineProps {
  mandates: SerializedMandate[];
  civility?: string | null;
}

// Group mandates by category
const MANDATE_CATEGORIES: Record<string, { label: string; icon: string; types: MandateType[] }> = {
  executif: {
    label: "Exécutif national",
    icon: "🏛️",
    types: [
      "PRESIDENT_REPUBLIQUE",
      "PREMIER_MINISTRE",
      "MINISTRE",
      "MINISTRE_DELEGUE",
      "SECRETAIRE_ETAT",
    ],
  },
  parlementaire: {
    label: "Parlementaire",
    icon: "📜",
    types: ["DEPUTE", "SENATEUR", "DEPUTE_EUROPEEN"],
  },
  local: {
    label: "Mandats locaux",
    icon: "🏘️",
    types: [
      "PRESIDENT_REGION",
      "PRESIDENT_DEPARTEMENT",
      "MAIRE",
      "ADJOINT_MAIRE",
      "CONSEILLER_REGIONAL",
      "CONSEILLER_DEPARTEMENTAL",
      "CONSEILLER_MUNICIPAL",
    ],
  },
  parti: {
    label: "Direction de parti",
    icon: "🏳️",
    types: ["PRESIDENT_PARTI"],
  },
};

function getMandateCategory(type: MandateType): string {
  for (const [key, cat] of Object.entries(MANDATE_CATEGORIES)) {
    if (cat.types.includes(type)) return key;
  }
  return "other";
}

function formatDuration(startDate: Date, endDate?: Date | null): string {
  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : new Date();

  const years = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 365));
  const months = Math.floor(
    ((end.getTime() - start.getTime()) % (1000 * 60 * 60 * 24 * 365)) / (1000 * 60 * 60 * 24 * 30)
  );

  if (years === 0) {
    return months <= 1 ? "1 mois" : `${months} mois`;
  }
  if (months === 0) {
    return years === 1 ? "1 an" : `${years} ans`;
  }
  return `${years} an${years > 1 ? "s" : ""} ${months} mois`;
}

function formatYear(date: Date): string {
  return new Date(date).getFullYear().toString();
}

export function MandateTimeline({ mandates, civility }: MandateTimelineProps) {
  const currentMandates = mandates.filter((m) => m.isCurrent);
  const pastMandates = mandates.filter((m) => !m.isCurrent);

  // Calculate career span: first mandate start → last mandate end (or now)
  const totalYears =
    mandates.length > 0
      ? (() => {
          const starts = mandates.map((m) => new Date(m.startDate).getTime());
          const ends = mandates.map((m) =>
            m.endDate ? new Date(m.endDate).getTime() : Date.now()
          );
          const earliest = Math.min(...starts);
          const latest = Math.max(...ends);
          return (latest - earliest) / (1000 * 60 * 60 * 24 * 365);
        })()
      : 0;

  // Group past mandates by category, then by type within each category
  const pastByCategory = pastMandates.reduce(
    (acc, m) => {
      const cat = getMandateCategory(m.type);
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(m);
      return acc;
    },
    {} as Record<string, SerializedMandate[]>
  );

  // Within each category, group mandates by type for compact display
  function groupByType(mandates: SerializedMandate[]) {
    const groups = new Map<MandateType, SerializedMandate[]>();
    for (const m of mandates) {
      const list = groups.get(m.type) || [];
      list.push(m);
      groups.set(m.type, list);
    }
    return groups;
  }

  return (
    <div className="space-y-6">
      {/* Summary badge */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Badge variant="outline" className="bg-primary/5">
          {totalYears < 1
            ? "Moins d\u2019un an de vie politique"
            : `${Math.round(totalYears)} ans de vie politique`}
        </Badge>
        <span>·</span>
        <span>
          {mandates.length} mandat{mandates.length > 1 ? "s" : ""}
        </span>
      </div>

      {/* Current mandates */}
      {currentMandates.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-primary mb-3 flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            Mandat{currentMandates.length > 1 ? "s" : ""} actuel
            {currentMandates.length > 1 ? "s" : ""}
          </h3>
          <div className="space-y-3">
            {currentMandates.map((mandate) => {
              const displayRole = mandate.role ? feminizeRole(mandate.role, civility) : null;
              return (
                <div key={mandate.id} className="relative pl-6 pb-3 border-l-2 border-primary">
                  <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-primary border-2 border-background" />
                  <div className="bg-primary/5 rounded-lg p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-lg">
                          {displayRole || MANDATE_TYPE_LABELS[mandate.type] || mandate.type}
                        </p>
                        {displayRole && (
                          <Badge variant="outline" className="mt-1">
                            {MANDATE_TYPE_LABELS[mandate.type] || mandate.type}
                          </Badge>
                        )}
                        {mandate.constituency && (
                          <p className="text-muted-foreground">{mandate.constituency}</p>
                        )}
                        {mandate.title &&
                          mandate.title !== MANDATE_TYPE_LABELS[mandate.type] &&
                          !displayRole && (
                            <p className="text-sm text-muted-foreground mt-1">{mandate.title}</p>
                          )}
                      </div>
                      <Badge variant="secondary" className="shrink-0">
                        Depuis {formatYear(mandate.startDate)}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      {formatDuration(mandate.startDate)} en poste
                    </p>
                    {mandate.officialUrl && (
                      <a
                        href={mandate.officialUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline mt-2 inline-block"
                      >
                        Voir sur le site officiel →
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Past mandates by category */}
      {pastMandates.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground mb-3">Mandats précédents</h3>
          <div className="space-y-4">
            {Object.entries(MANDATE_CATEGORIES).map(([key, category]) => {
              const categoryMandates = pastByCategory[key];
              if (!categoryMandates?.length) return null;

              const typeGroups = groupByType(categoryMandates);

              return (
                <div key={key}>
                  <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                    <span>{category.icon}</span>
                    {category.label}
                  </p>
                  <div className="space-y-2">
                    {[...typeGroups.entries()].map(([type, groupMandates]) => (
                      <div key={type} className="relative pl-6 border-l border-muted-foreground/20">
                        <div className="absolute -left-[5px] top-2 w-2 h-2 rounded-full bg-muted-foreground/40" />
                        <div className="py-2">
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-medium">{MANDATE_TYPE_LABELS[type] || type}</p>
                            {groupMandates.length > 1 && (
                              <Badge variant="outline" className="text-xs shrink-0">
                                {groupMandates.length} mandats
                              </Badge>
                            )}
                          </div>
                          <div className="mt-1 space-y-0.5">
                            {groupMandates.map((mandate) => {
                              const detail =
                                mandate.title &&
                                mandate.title !== MANDATE_TYPE_LABELS[type] &&
                                mandate.title !==
                                  `${(MANDATE_TYPE_LABELS[type] || "").toLowerCase()} français`
                                  ? mandate.title
                                  : mandate.institution || mandate.constituency || null;
                              return (
                                <div
                                  key={mandate.id}
                                  className="flex items-baseline gap-2 text-xs text-muted-foreground"
                                >
                                  <span className="shrink-0">
                                    {formatYear(mandate.startDate)}
                                    {mandate.endDate && ` - ${formatYear(mandate.endDate)}`}
                                  </span>
                                  <span>·</span>
                                  <span className="truncate">
                                    {detail
                                      ? `${detail} · ${formatDuration(mandate.startDate, mandate.endDate)}`
                                      : formatDuration(mandate.startDate, mandate.endDate)}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Other mandates not in categories */}
            {pastByCategory.other?.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Autres mandats</p>
                <div className="space-y-2">
                  {pastByCategory.other.map((mandate) => (
                    <div
                      key={mandate.id}
                      className="relative pl-6 border-l border-muted-foreground/20"
                    >
                      <div className="absolute -left-[5px] top-2 w-2 h-2 rounded-full bg-muted-foreground/40" />
                      <div className="py-2">
                        <p className="font-medium">
                          {MANDATE_TYPE_LABELS[mandate.type] || mandate.type}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatYear(mandate.startDate)}
                          {mandate.endDate && ` - ${formatYear(mandate.endDate)}`}
                          {" · "}
                          {formatDuration(mandate.startDate, mandate.endDate)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {mandates.length === 0 && (
        <p className="text-muted-foreground text-sm">Aucun mandat enregistré</p>
      )}
    </div>
  );
}
