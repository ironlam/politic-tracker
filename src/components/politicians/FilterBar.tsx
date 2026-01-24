"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";

export type SortOption = "alpha" | "alpha-desc" | "recent" | "affairs";
export type MandateFilter = "" | "depute" | "senateur" | "gouvernement";
export type StatusFilter = "" | "active" | "former";

const SORT_OPTIONS: Record<SortOption, string> = {
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
};

interface FilterBarProps {
  currentSort: SortOption;
  currentMandate: MandateFilter;
  currentStatus: StatusFilter;
  counts: {
    deputes: number;
    senateurs: number;
    gouvernement: number;
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
    <div className="flex flex-wrap items-center gap-4">
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
        <span className="text-sm text-muted-foreground">Tri:</span>
        <select
          value={currentSort}
          onChange={(e) => updateParams("sort", e.target.value === "alpha" ? "" : e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
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
        <span className="text-sm text-muted-foreground">Mandat:</span>
        <select
          value={currentMandate}
          onChange={(e) => updateParams("mandate", e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          {Object.entries(MANDATE_OPTIONS).map(([value, label]) => {
            const count =
              value === "depute"
                ? counts.deputes
                : value === "senateur"
                ? counts.senateurs
                : value === "gouvernement"
                ? counts.gouvernement
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
      <div className="flex items-center gap-2 border-l pl-4">
        <Badge
          variant={currentStatus === "" ? "default" : "outline"}
          className="cursor-pointer"
          onClick={() => updateParams("status", "")}
        >
          Tous
        </Badge>
        <Badge
          variant={currentStatus === "active" ? "default" : "outline"}
          className="cursor-pointer"
          onClick={() => updateParams("status", currentStatus === "active" ? "" : "active")}
        >
          Actifs ({counts.active})
        </Badge>
        <Badge
          variant={currentStatus === "former" ? "secondary" : "outline"}
          className="cursor-pointer"
          onClick={() => updateParams("status", currentStatus === "former" ? "" : "former")}
        >
          Anciens ({counts.former})
        </Badge>
      </div>
    </div>
  );
}
