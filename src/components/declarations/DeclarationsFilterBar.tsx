"use client";

import { useFilterParams } from "@/hooks/useFilterParams";
import { DebouncedSearchInput } from "@/components/filters";

export type DeclarationSortOption = "portfolio" | "income" | "companies" | "alpha" | "recent";

const SORT_OPTIONS: { value: DeclarationSortOption; label: string }[] = [
  { value: "portfolio", label: "Portefeuille" },
  { value: "income", label: "Revenus" },
  { value: "companies", label: "Participations" },
  { value: "alpha", label: "Nom (A-Z)" },
  { value: "recent", label: "Plus récent" },
];

interface Party {
  id: string;
  name: string;
  shortName: string | null;
  color: string | null;
}

interface DeclarationsFilterBarProps {
  parties: Party[];
  defaultSearch: string;
  partyFilter: string;
  sortOption: DeclarationSortOption;
}

export function DeclarationsFilterBar({
  parties,
  defaultSearch,
  partyFilter,
  sortOption,
}: DeclarationsFilterBarProps) {
  const { isPending, updateParams } = useFilterParams();

  return (
    <div
      className={`flex flex-col sm:flex-row gap-3 ${isPending ? "opacity-60" : ""}`}
      role="search"
      aria-label="Filtrer les déclarations"
    >
      <DebouncedSearchInput
        id="declarations-search"
        value={defaultSearch}
        onSearch={(v) => updateParams({ search: v })}
        placeholder="Rechercher un élu..."
        className="flex-1"
      />

      <label htmlFor="declarations-party" className="sr-only">
        Filtrer par parti
      </label>
      <select
        id="declarations-party"
        value={partyFilter}
        onChange={(e) => updateParams({ party: e.target.value })}
        className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <option value="">Tous les partis</option>
        {parties.map((p) => (
          <option key={p.id} value={p.id}>
            {p.shortName || p.name}
          </option>
        ))}
      </select>

      <label htmlFor="declarations-sort" className="sr-only">
        Trier par
      </label>
      <select
        id="declarations-sort"
        value={sortOption}
        onChange={(e) => updateParams({ sort: e.target.value })}
        className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        {SORT_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            Trier : {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
