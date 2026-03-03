"use client";

import { useFilterParams } from "@/hooks/useFilterParams";
import { DebouncedSearchInput } from "@/components/filters";
import { FilterBarShell } from "@/components/filters/FilterBarShell";
import { FACTCHECK_RATING_LABELS } from "@/config/labels";
import type { FactCheckRating } from "@/types";

interface FactChecksFilterBarProps {
  currentFilters: {
    search: string;
    source: string;
    verdict: string;
    type: string;
  };
  sources: Array<{ name: string; count: number }>;
  ratingCounts: Record<string, number>;
}

const RATING_OPTIONS: FactCheckRating[] = [
  "FALSE",
  "MOSTLY_FALSE",
  "MISLEADING",
  "OUT_OF_CONTEXT",
  "HALF_TRUE",
  "MOSTLY_TRUE",
  "TRUE",
  "UNVERIFIABLE",
];

const selectClassName =
  "h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 cursor-pointer hover:border-primary/50 transition-colors";

export function FactChecksFilterBar({
  currentFilters,
  sources,
  ratingCounts,
}: FactChecksFilterBarProps) {
  const { isPending, updateParams } = useFilterParams();

  return (
    <FilterBarShell isPending={isPending}>
      {/* Dropdowns grid: 2 cols mobile, 4 cols desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <DebouncedSearchInput
          id="search-factchecks"
          value={currentFilters.search}
          onSearch={(v) => updateParams({ search: v })}
          placeholder="Mot-clé..."
          label="Recherche"
        />

        <div>
          <label
            htmlFor="source-factchecks"
            className="text-xs font-medium text-muted-foreground mb-1 block"
          >
            Source
          </label>
          <select
            id="source-factchecks"
            value={currentFilters.source}
            onChange={(e) => updateParams({ source: e.target.value })}
            className={selectClassName}
          >
            <option value="">Toutes les sources</option>
            {sources.map((s) => (
              <option key={s.name} value={s.name}>
                {s.name} ({s.count})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="verdict-factchecks"
            className="text-xs font-medium text-muted-foreground mb-1 block"
          >
            Verdict
          </label>
          <select
            id="verdict-factchecks"
            value={currentFilters.verdict}
            onChange={(e) => updateParams({ verdict: e.target.value })}
            className={selectClassName}
          >
            <option value="">Tous les verdicts</option>
            {RATING_OPTIONS.map((rating) => {
              const count = ratingCounts[rating] || 0;
              if (count === 0) return null;
              return (
                <option key={rating} value={rating}>
                  {FACTCHECK_RATING_LABELS[rating]} ({count})
                </option>
              );
            })}
          </select>
        </div>

        <div>
          <label
            htmlFor="type-factchecks"
            className="text-xs font-medium text-muted-foreground mb-1 block"
          >
            Type
          </label>
          <select
            id="type-factchecks"
            value={currentFilters.type}
            onChange={(e) => updateParams({ type: e.target.value })}
            className={selectClassName}
          >
            <option value="">Tous les fact-checks</option>
            <option value="direct">Propos de politicien</option>
          </select>
        </div>
      </div>
    </FilterBarShell>
  );
}
