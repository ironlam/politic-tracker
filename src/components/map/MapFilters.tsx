"use client";

import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

export type FilterType = "all" | "deputes" | "senateurs";
export type DisplayMode = "count" | "party";

interface MapFiltersProps {
  filter: FilterType;
  mode: DisplayMode;
  onFilterChange: (filter: FilterType) => void;
  onModeChange: (mode: DisplayMode) => void;
}

export function MapFilters({
  filter,
  mode,
  onFilterChange,
  onModeChange,
}: MapFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      {/* Type filter */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Afficher:</span>
        <div className="flex rounded-lg border bg-muted p-1">
          <Button
            variant={filter === "all" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => onFilterChange("all")}
            className="h-7 px-3 text-xs"
          >
            Tous
          </Button>
          <Button
            variant={filter === "deputes" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => onFilterChange("deputes")}
            className="h-7 px-3 text-xs"
          >
            Députés
          </Button>
          <Button
            variant={filter === "senateurs" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => onFilterChange("senateurs")}
            className="h-7 px-3 text-xs"
          >
            Sénateurs
          </Button>
        </div>
      </div>

      {/* Display mode */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Couleur:</span>
        <Select
          value={mode}
          onChange={(e) => onModeChange(e.target.value as DisplayMode)}
          className="w-[160px] h-8"
        >
          <option value="count">Nombre d&apos;élus</option>
          <option value="party">Parti dominant</option>
        </Select>
      </div>
    </div>
  );
}
