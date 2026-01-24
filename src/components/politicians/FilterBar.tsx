"use client";

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
}

export function FilterBar({
  currentSort,
  currentMandate,
  currentStatus,
  counts,
}: FilterBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const updateParams = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    // Reset page when changing filters
    params.delete("page");
    router.push(`/politiques?${params.toString()}`);
  };

  return (
    <div className="flex flex-wrap items-center gap-4">
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
