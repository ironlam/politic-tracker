"use client";

import { useTransition, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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

const selectClassName =
  "h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 cursor-pointer hover:border-primary/50 transition-colors";

export function AffairesFilterBar({
  currentFilters,
  parties,
  severityCounts,
  statusCounts,
}: AffairesFilterBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  // Sync input with URL on back/forward navigation + cleanup debounce
  useEffect(() => {
    if (inputRef.current && inputRef.current.value !== currentFilters.search) {
      inputRef.current.value = currentFilters.search;
    }
  }, [currentFilters.search]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const updateParams = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete("page");

    startTransition(() => {
      const qs = params.toString();
      router.push(qs ? `/affaires?${qs}` : "/affaires");
    });
  };

  const VALID_GROUPS: InvolvementGroup[] = ["mise-en-cause", "victime", "mentionne"];
  const activeGroups: InvolvementGroup[] = currentFilters.involvement
    ? (currentFilters.involvement
        .split(",")
        .filter((v) => VALID_GROUPS.includes(v as InvolvementGroup)) as InvolvementGroup[])
    : ["mise-en-cause"];

  const handleSearchInput = (value: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      updateParams("search", value.trim());
    }, 300);
  };

  const toggleGroup = (group: InvolvementGroup) => {
    const current = new Set(activeGroups);
    if (current.has(group)) {
      current.delete(group);
    } else {
      current.add(group);
    }
    if (current.size === 0) current.add("mise-en-cause");

    const isDefault = current.size === 1 && current.has("mise-en-cause");
    updateParams("involvement", isDefault ? "" : [...current].join(","));
  };

  return (
    <div className="mb-6 rounded-lg border bg-muted/40 p-4 space-y-3 relative">
      {/* Loading overlay */}
      {isPending && (
        <div className="absolute inset-0 rounded-lg bg-background/60 flex items-center justify-center z-10">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <svg
              className="animate-spin h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span>Chargement...</span>
          </div>
        </div>
      )}

      {/* Search input */}
      <div>
        <label
          htmlFor="search-affairs"
          className="text-xs font-medium text-muted-foreground mb-1 block"
        >
          Recherche
        </label>
        <input
          ref={inputRef}
          id="search-affairs"
          type="search"
          placeholder="Rechercher une affaire..."
          defaultValue={currentFilters.search}
          onChange={(e) => handleSearchInput(e.target.value)}
          className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 placeholder:text-muted-foreground"
        />
      </div>

      {/* Dropdowns grid: 2 cols mobile, 4 cols desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <label
            htmlFor="sort-affairs"
            className="text-xs font-medium text-muted-foreground mb-1 block"
          >
            Trier par
          </label>
          <select
            id="sort-affairs"
            value={currentFilters.sort}
            onChange={(e) => updateParams("sort", e.target.value)}
            className={selectClassName}
          >
            {Object.entries(SORT_OPTIONS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="parti-affairs"
            className="text-xs font-medium text-muted-foreground mb-1 block"
          >
            Parti
          </label>
          <select
            id="parti-affairs"
            value={currentFilters.parti}
            onChange={(e) => updateParams("parti", e.target.value)}
            className={selectClassName}
          >
            <option value="">Tous les partis</option>
            {parties.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.shortName} — {p.name} ({p.count})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="severity-affairs"
            className="text-xs font-medium text-muted-foreground mb-1 block"
          >
            Gravité
          </label>
          <select
            id="severity-affairs"
            value={currentFilters.severity}
            onChange={(e) => updateParams("severity", e.target.value)}
            className={selectClassName}
          >
            <option value="">Toutes</option>
            {(Object.keys(AFFAIR_SEVERITY_EDITORIAL) as AffairSeverity[]).map((sev) => (
              <option key={sev} value={sev}>
                {AFFAIR_SEVERITY_EDITORIAL[sev]} ({severityCounts[sev] || 0})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="status-affairs"
            className="text-xs font-medium text-muted-foreground mb-1 block"
          >
            Statut
          </label>
          <select
            id="status-affairs"
            value={currentFilters.status}
            onChange={(e) => updateParams("status", e.target.value)}
            className={selectClassName}
          >
            <option value="">Tous les statuts</option>
            {STATUS_GROUPS.map((group) => {
              const groupStatuses = group.statuses.filter((s) => (statusCounts[s] || 0) > 0);
              if (groupStatuses.length === 0) return null;
              return [
                <option key={`sep-${group.label}`} disabled>
                  {group.label}
                </option>,
                ...groupStatuses.map((s) => (
                  <option key={s} value={s}>
                    {AFFAIR_STATUS_LABELS[s]} ({statusCounts[s] || 0})
                  </option>
                )),
              ];
            })}
          </select>
        </div>
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
    </div>
  );
}
