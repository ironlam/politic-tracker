"use client";

import { useFilterParams } from "@/hooks/useFilterParams";
import { DebouncedSearchInput, SelectFilter } from "@/components/filters";
import { Spinner } from "@/components/ui/spinner";
import { POLITICAL_POSITION_LABELS, POLITICAL_POSITION_ORDER } from "@/config/labels";

interface PartiesFilterBarProps {
  currentFilters: {
    search: string;
    position: string;
    status: string;
    sort: string;
  };
  total: number;
}

const SORT_OPTIONS: Record<string, string> = {
  members: "Membres (desc)",
  alpha: "A - Z",
  "alpha-desc": "Z - A",
};

const STATUS_OPTIONS: Record<string, string> = {
  actifs: "Actifs",
  historiques: "Historiques",
  "": "Tous",
};

export function PartiesFilterBar({ currentFilters, total }: PartiesFilterBarProps) {
  const { isPending, updateParams } = useFilterParams();

  const positionOptions = [
    { value: "", label: "Toutes" },
    ...POLITICAL_POSITION_ORDER.map((pos) => ({
      value: pos,
      label: POLITICAL_POSITION_LABELS[pos],
    })),
  ];

  const statusOptions = Object.entries(STATUS_OPTIONS).map(([value, label]) => ({ value, label }));

  const sortOptions = Object.entries(SORT_OPTIONS).map(([value, label]) => ({ value, label }));

  return (
    <div className="mb-6 rounded-lg border bg-muted/40 p-4 space-y-3 relative">
      {/* Loading overlay */}
      {isPending && (
        <div className="absolute inset-0 rounded-lg bg-background/60 flex items-center justify-center z-10">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner />
            <span>Chargement...</span>
          </div>
        </div>
      )}

      {/* Search + filters grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <DebouncedSearchInput
          id="search-parties"
          value={currentFilters.search}
          onSearch={(v) => updateParams({ search: v })}
          placeholder="Nom du parti..."
          label="Recherche"
        />

        <SelectFilter
          id="position-parties"
          label="Orientation"
          value={currentFilters.position}
          onChange={(v) => updateParams({ position: v })}
          options={positionOptions}
        />

        <SelectFilter
          id="status-parties"
          label="Statut"
          value={currentFilters.status}
          onChange={(v) => updateParams({ status: v })}
          options={statusOptions}
        />

        <SelectFilter
          id="sort-parties"
          label="Trier par"
          value={currentFilters.sort}
          onChange={(v) => updateParams({ sort: v })}
          options={sortOptions}
        />
      </div>

      {/* Results count */}
      <div className="text-xs text-muted-foreground">
        {total} parti{total !== 1 ? "s" : ""}
      </div>
    </div>
  );
}
