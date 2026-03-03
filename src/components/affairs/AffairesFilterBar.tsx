"use client";

import { useFilterParams } from "@/hooks/useFilterParams";
import { DebouncedSearchInput, SelectFilter } from "@/components/filters";
import { FilterBarShell } from "@/components/filters/FilterBarShell";
import { Badge } from "@/components/ui/badge";
import {
  AFFAIR_STATUS_LABELS,
  AFFAIR_SEVERITY_EDITORIAL,
  INVOLVEMENT_GROUP_LABELS,
  INVOLVEMENT_GROUP_COLORS,
  type InvolvementGroup,
} from "@/config/labels";
import type { AffairStatus, AffairSeverity } from "@/types";

interface AffairesFilterBarProps {
  currentFilters: {
    search: string;
    sort: string;
    severity: string;
    parti: string;
    status: string;
    involvement: string;
    supercat: string;
  };
  parties: Array<{
    slug: string;
    shortName: string;
    name: string;
    count: number;
  }>;
  severityCounts: Record<string, number>;
  statusCounts: Record<string, number>;
}

const SORT_OPTIONS: Record<string, string> = {
  "": "Pertinence",
  "date-desc": "Plus récentes",
  "date-asc": "Plus anciennes",
};

const STATUS_GROUPS: { label: string; statuses: AffairStatus[] }[] = [
  {
    label: "── Condamnations ──",
    statuses: ["CONDAMNATION_DEFINITIVE", "CONDAMNATION_PREMIERE_INSTANCE", "APPEL_EN_COURS"],
  },
  {
    label: "── Procédures ──",
    statuses: ["INSTRUCTION", "MISE_EN_EXAMEN", "RENVOI_TRIBUNAL", "PROCES_EN_COURS"],
  },
  {
    label: "── Enquêtes ──",
    statuses: ["ENQUETE_PRELIMINAIRE"],
  },
  {
    label: "── Classées ──",
    statuses: ["RELAXE", "ACQUITTEMENT", "NON_LIEU", "PRESCRIPTION", "CLASSEMENT_SANS_SUITE"],
  },
];

const VALID_GROUPS: InvolvementGroup[] = ["mise-en-cause", "victime", "mentionne"];

export function AffairesFilterBar({
  currentFilters,
  parties,
  severityCounts,
  statusCounts,
}: AffairesFilterBarProps) {
  const { isPending, updateParams } = useFilterParams();

  const activeGroups: InvolvementGroup[] = currentFilters.involvement
    ? (currentFilters.involvement
        .split(",")
        .filter((v) => VALID_GROUPS.includes(v as InvolvementGroup)) as InvolvementGroup[])
    : ["mise-en-cause"];

  const toggleGroup = (group: InvolvementGroup) => {
    const current = new Set(activeGroups);
    if (current.has(group)) {
      current.delete(group);
    } else {
      current.add(group);
    }
    if (current.size === 0) current.add("mise-en-cause");

    const isDefault = current.size === 1 && current.has("mise-en-cause");
    updateParams({ involvement: isDefault ? "" : [...current].join(",") });
  };

  const statusOptions = [
    { value: "", label: "Tous les statuts" },
    ...STATUS_GROUPS.flatMap((group) => {
      const groupStatuses = group.statuses.filter((s) => (statusCounts[s] || 0) > 0);
      if (groupStatuses.length === 0) return [];
      return [
        { value: `sep-${group.label}`, label: group.label, disabled: true },
        ...groupStatuses.map((s) => ({
          value: s,
          label: `${AFFAIR_STATUS_LABELS[s]} (${statusCounts[s] || 0})`,
        })),
      ];
    }),
  ];

  const severityOptions = [
    { value: "", label: "Toutes" },
    ...(Object.keys(AFFAIR_SEVERITY_EDITORIAL) as AffairSeverity[]).map((sev) => ({
      value: sev,
      label: `${AFFAIR_SEVERITY_EDITORIAL[sev]} (${severityCounts[sev] || 0})`,
    })),
  ];

  const partyOptions = [
    { value: "", label: "Tous les partis" },
    ...parties.map((p) => ({
      value: p.slug,
      label: `${p.shortName} — ${p.name} (${p.count})`,
    })),
  ];

  const sortOptions = Object.entries(SORT_OPTIONS).map(([value, label]) => ({ value, label }));

  return (
    <FilterBarShell isPending={isPending} className="space-y-3">
      {/* Search input */}
      <DebouncedSearchInput
        id="search-affairs"
        value={currentFilters.search}
        onSearch={(v) => updateParams({ search: v })}
        placeholder="Rechercher une affaire..."
        label="Recherche"
      />

      {/* Dropdowns grid: 2 cols mobile, 4 cols desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SelectFilter
          id="sort-affairs"
          label="Trier par"
          value={currentFilters.sort}
          onChange={(v) => updateParams({ sort: v })}
          options={sortOptions}
        />

        <SelectFilter
          id="parti-affairs"
          label="Parti"
          value={currentFilters.parti}
          onChange={(v) => updateParams({ parti: v })}
          options={partyOptions}
        />

        <SelectFilter
          id="severity-affairs"
          label="Gravité"
          value={currentFilters.severity}
          onChange={(v) => updateParams({ severity: v })}
          options={severityOptions}
        />

        <SelectFilter
          id="status-affairs"
          label="Statut"
          value={currentFilters.status}
          onChange={(v) => updateParams({ status: v })}
          options={statusOptions}
        />
      </div>

      {/* Involvement toggles */}
      <div
        className="flex items-center gap-2 flex-wrap pt-1 border-t border-border/50"
        role="group"
        aria-label="Rôle du responsable politique"
      >
        <span className="text-xs font-medium text-muted-foreground">Rôle :</span>
        {(Object.keys(INVOLVEMENT_GROUP_LABELS) as InvolvementGroup[]).map((group) => {
          const isActive = activeGroups.includes(group);
          return (
            <Badge
              key={group}
              variant={isActive ? "default" : "outline"}
              className={`cursor-pointer hover:bg-primary/10 transition-colors ${isActive ? INVOLVEMENT_GROUP_COLORS[group] : ""}`}
              onClick={() => toggleGroup(group)}
              role="button"
              tabIndex={0}
              aria-pressed={isActive}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  toggleGroup(group);
                }
              }}
            >
              {isActive ? "● " : "○ "}
              {INVOLVEMENT_GROUP_LABELS[group]}
            </Badge>
          );
        })}
      </div>
    </FilterBarShell>
  );
}
