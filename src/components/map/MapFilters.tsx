"use client";

import { Button } from "@/components/ui/button";

export type DisplayMode = "party" | "position";

interface MapFiltersProps {
  mode: DisplayMode;
  onModeChange: (mode: DisplayMode) => void;
}

export function MapFilters({ mode, onModeChange }: MapFiltersProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">Couleur :</span>
      <div className="flex rounded-lg border bg-muted p-1">
        <Button
          variant={mode === "party" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => onModeChange("party")}
          className="h-7 px-3 text-xs"
        >
          Par parti
        </Button>
        <Button
          variant={mode === "position" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => onModeChange("position")}
          className="h-7 px-3 text-xs"
        >
          Par position
        </Button>
      </div>
    </div>
  );
}
