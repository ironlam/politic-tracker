"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";

export type SortOption = "prominence" | "alpha" | "alpha-desc" | "recent" | "affairs";
export type MandateFilter =
  | ""
  | "depute"
  | "senateur"
  | "gouvernement"
  | "president_parti"
  | "dirigeants";
export type StatusFilter = "" | "active" | "former";

const SORT_OPTIONS: Record<SortOption, string> = {
  prominence: "Importance",
  alpha: "A - Z",
  "alpha-desc": "Z - A",
  recent: "Plus récents",
  affairs: "Plus d'affaires",
};

const MANDATE_OPTIONS: Record<MandateFilter, string> = {
  "": "Tous les mandats",
  depute: "Députés",
  senateur: "Sénateurs",
  gouvernement: "Gouvernement",
  president_parti: "Présidents de parti",
  dirigeants: "Dirigeants de parti",
};

interface FilterBarProps {
  currentSort: SortOption;
  currentMandate: MandateFilter;
  currentStatus: StatusFilter;
  counts: {
    deputes: number;
    senateurs: number;
    gouvernement: number;
    presidentParti: number;
    dirigeants: number;
    active: number;
    former: number;
  };
  onLoadingChange?: (loading: boolean) => void;
}

export function FilterBar({
  currentSort,
  currentMandate,
  currentStatus,
  counts,
  onLoadingChange,
}: FilterBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const updateParams = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    // Reset page when changing filters
    params.delete("page");

    startTransition(() => {
      router.push(`/politiques?${params.toString()}`);
      onLoadingChange?.(true);
    });
  };

  return (
    <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-3 sm:gap-4">
      {/* Loading indicator */}
      {isPending && (
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
      )}

      {/* Sort */}
      <div className="flex items-center gap-2">
        <label htmlFor="sort-select" className="text-sm text-muted-foreground whitespace-nowrap">
          Tri:
        </label>
        <select
          id="sort-select"
          value={currentSort}
          onChange={(e) => updateParams("sort", e.target.value === "alpha" ? "" : e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 cursor-pointer hover:border-primary/50 transition-colors"
        >
          {Object.entries(SORT_OPTIONS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Mandate type filter */}
      <div className="flex items-center gap-2">
        <label htmlFor="mandate-select" className="text-sm text-muted-foreground whitespace-nowrap">
          Mandat:
        </label>
        <select
          id="mandate-select"
          value={currentMandate}
          onChange={(e) => updateParams("mandate", e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 cursor-pointer hover:border-primary/50 transition-colors"
        >
          {Object.entries(MANDATE_OPTIONS).map(([value, label]) => {
            const count =
              value === "depute"
                ? counts.deputes
                : value === "senateur"
                  ? counts.senateurs
                  : value === "gouvernement"
                    ? counts.gouvernement
                    : value === "president_parti"
                      ? counts.presidentParti
                      : value === "dirigeants"
                        ? counts.dirigeants
                        : null;
            return (
              <option key={value} value={value}>
                {label}
                {count !== null ? ` (${count})` : ""}
              </option>
            );
          })}
        </select>
      </div>

      {/* Status filter (active/former) */}
      <div
        className="flex items-center gap-2 sm:border-l sm:pl-4 w-full sm:w-auto"
        role="group"
        aria-label="Filtrer par statut"
      >
        <Badge
          variant={currentStatus === "" ? "default" : "outline"}
          className="cursor-pointer hover:bg-primary/10 transition-colors"
          onClick={() => updateParams("status", "")}
          role="button"
          tabIndex={0}
          aria-pressed={currentStatus === ""}
          onKeyDown={(e) => e.key === "Enter" && updateParams("status", "")}
        >
          Tous
        </Badge>
        <Badge
          variant={currentStatus === "active" ? "default" : "outline"}
          className="cursor-pointer hover:bg-primary/10 transition-colors"
          onClick={() => updateParams("status", currentStatus === "active" ? "" : "active")}
          role="button"
          tabIndex={0}
          aria-pressed={currentStatus === "active"}
          onKeyDown={(e) =>
            e.key === "Enter" && updateParams("status", currentStatus === "active" ? "" : "active")
          }
        >
          Actifs ({counts.active})
        </Badge>
        <Badge
          variant={currentStatus === "former" ? "secondary" : "outline"}
          className="cursor-pointer hover:bg-muted transition-colors"
          onClick={() => updateParams("status", currentStatus === "former" ? "" : "former")}
          role="button"
          tabIndex={0}
          aria-pressed={currentStatus === "former"}
          onKeyDown={(e) =>
            e.key === "Enter" && updateParams("status", currentStatus === "former" ? "" : "former")
          }
        >
          Anciens ({counts.former})
        </Badge>
      </div>
    </div>
  );
}
