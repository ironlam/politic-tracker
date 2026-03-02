"use client";

import { useSearchParams } from "next/navigation";

const FILTER_OPTIONS = [
  { value: "all", label: "Tous" },
  { value: "agree", label: "D'accord" },
  { value: "disagree", label: "Désaccord" },
  { value: "partial", label: "Partiellement" },
] as const;

export function VoteComparisonFilters() {
  const searchParams = useSearchParams();
  const currentFilter = searchParams.get("filter") || "all";
  const currentSearch = searchParams.get("search") || "";

  // Preserve all existing params when submitting
  const cat = searchParams.get("cat") || "deputes";
  const a = searchParams.get("a") || "";
  const b = searchParams.get("b") || "";

  return (
    <form action="/comparer/votes" className="flex flex-col sm:flex-row gap-3">
      {/* Hidden params to preserve */}
      <input type="hidden" name="cat" value={cat} />
      <input type="hidden" name="a" value={a} />
      <input type="hidden" name="b" value={b} />

      {/* Search */}
      <div className="flex-1">
        <label htmlFor="vote-search" className="sr-only">
          Rechercher un scrutin
        </label>
        <input
          id="vote-search"
          type="text"
          name="search"
          placeholder="Rechercher un scrutin..."
          defaultValue={currentSearch}
          className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {/* Filter */}
      <div>
        <label htmlFor="vote-filter" className="sr-only">
          Filtrer par concordance
        </label>
        <select
          id="vote-filter"
          name="filter"
          defaultValue={currentFilter}
          className="w-full sm:w-auto px-4 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
        >
          {FILTER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Submit */}
      <button
        type="submit"
        className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
      >
        Filtrer
      </button>
    </form>
  );
}
