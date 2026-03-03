"use client";

import { DebouncedSearchInput, ComboboxFilter, SelectFilter } from "@/components/filters";
import type { ComboboxOption, SelectOption } from "@/components/filters";
import { useFilterParams } from "@/hooks/useFilterParams";
import { FilterBarShell } from "@/components/filters/FilterBarShell";

interface MairesFilterBarProps {
  departments: ComboboxOption[];
  parties: SelectOption[];
  total: number;
  activeFilterCount: number;
}

const GENDER_OPTIONS: SelectOption[] = [
  { value: "F", label: "Femmes" },
  { value: "M", label: "Hommes" },
];

export function MairesFilterBar({
  departments,
  parties,
  total,
  activeFilterCount,
}: MairesFilterBarProps) {
  const { searchParams, isPending, updateParams } = useFilterParams();
  const search = searchParams.get("search") || "";
  const dept = searchParams.get("dept") || "";
  const party = searchParams.get("party") || "";
  const gender = searchParams.get("gender") || "";

  return (
    <FilterBarShell isPending={isPending} className="space-y-3">
      {/* Search */}
      <DebouncedSearchInput
        id="search-maires"
        value={search}
        onSearch={(v) => updateParams({ search: v })}
        placeholder="Rechercher un maire..."
        label="Recherche"
      />

      {/* Filters grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <ComboboxFilter
          id="dept-maires"
          options={departments}
          value={dept}
          onChange={(v) => updateParams({ dept: v })}
          placeholder="Tous les départements"
          searchPlaceholder="Chercher un département..."
          label="Département"
        />

        <SelectFilter
          id="party-maires"
          options={parties}
          value={party}
          onChange={(v) => updateParams({ party: v })}
          placeholder="Tous les partis"
          label="Parti"
        />

        <SelectFilter
          id="gender-maires"
          options={GENDER_OPTIONS}
          value={gender}
          onChange={(v) => updateParams({ gender: v })}
          placeholder="Tous genres"
          label="Genre"
        />
      </div>

      {/* Active filter count + clear */}
      <div className="flex items-center gap-3 text-sm">
        <span className="text-muted-foreground">
          {total.toLocaleString("fr-FR")} maire{total > 1 ? "s" : ""}
        </span>
        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={() => updateParams({ search: "", dept: "", party: "", gender: "" })}
            className="text-primary hover:underline text-xs"
          >
            Effacer les filtres ({activeFilterCount})
          </button>
        )}
      </div>
    </FilterBarShell>
  );
}
