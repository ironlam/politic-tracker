"use client";

import { useTransition, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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

const inputClassName =
  "h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 hover:border-primary/50 transition-colors";

export function FactChecksFilterBar({
  currentFilters,
  sources,
  ratingCounts,
}: FactChecksFilterBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [searchValue, setSearchValue] = useState(currentFilters.search);

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
      router.push(qs ? `/factchecks?${qs}` : "/factchecks");
    });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateParams("search", searchValue.trim());
  };

  return (
    <div className="mb-6 rounded-lg border bg-muted/40 p-4 relative">
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

      {/* Dropdowns grid: 2 cols mobile, 4 cols desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <label
            htmlFor="search-factchecks"
            className="text-xs font-medium text-muted-foreground mb-1 block"
          >
            Recherche
          </label>
          <form onSubmit={handleSearchSubmit}>
            <input
              id="search-factchecks"
              type="text"
              placeholder="Mot-clé..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className={inputClassName}
            />
          </form>
        </div>

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
            onChange={(e) => updateParams("source", e.target.value)}
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
            onChange={(e) => updateParams("verdict", e.target.value)}
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
            onChange={(e) => updateParams("type", e.target.value)}
            className={selectClassName}
          >
            <option value="">Tous les fact-checks</option>
            <option value="direct">Propos de politicien</option>
          </select>
        </div>
      </div>
    </div>
  );
}
