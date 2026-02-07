"use client";

import { DepartmentStats } from "@/app/api/stats/departments/route";
import { DisplayMode } from "./MapFilters";

interface MapLegendProps {
  mode: DisplayMode;
  departments: DepartmentStats[];
  isDarkMode: boolean;
}

export function MapLegend({ mode, departments, isDarkMode }: MapLegendProps) {
  if (mode === "count") {
    return (
      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium text-muted-foreground">Nombre d&apos;élus</span>
        <div className="flex items-center gap-1">
          <div
            className="w-4 h-4 rounded"
            style={{ backgroundColor: isDarkMode ? "#1e3a5f" : "#f0f9ff" }}
          />
          <span className="text-xs">0</span>
          <div
            className="w-4 h-4 rounded ml-2"
            style={{ backgroundColor: isDarkMode ? "#0369a1" : "#7dd3fc" }}
          />
          <span className="text-xs">5</span>
          <div
            className="w-4 h-4 rounded ml-2"
            style={{ backgroundColor: isDarkMode ? "#38bdf8" : "#0284c7" }}
          />
          <span className="text-xs">15</span>
          <div
            className="w-4 h-4 rounded ml-2"
            style={{ backgroundColor: isDarkMode ? "#bae6fd" : "#0c4a6e" }}
          />
          <span className="text-xs">25+</span>
        </div>
      </div>
    );
  }

  // Party mode - show dominant parties
  const partyColors = new Map<string, { shortName: string; color: string; count: number }>();
  let noDominantCount = 0;

  for (const dept of departments) {
    if (dept.dominantParty) {
      const key = dept.dominantParty.id;
      const existing = partyColors.get(key);
      if (existing) {
        existing.count++;
      } else {
        partyColors.set(key, {
          shortName: dept.dominantParty.shortName,
          color: dept.dominantParty.color || "#888888",
          count: 1,
        });
      }
    } else if (dept.parties.length > 0) {
      noDominantCount++;
    }
  }

  // Sort by count descending
  const sortedParties = Array.from(partyColors.values()).sort((a, b) => b.count - a.count);

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium text-muted-foreground">Parti dominant</span>
      <div className="flex flex-wrap gap-2">
        {sortedParties.slice(0, 8).map((party) => (
          <div key={party.shortName} className="flex items-center gap-1">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: party.color }}
            />
            <span className="text-xs">
              {party.shortName} ({party.count})
            </span>
          </div>
        ))}
        {noDominantCount > 0 && (
          <div className="flex items-center gap-1">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: isDarkMode ? "#374151" : "#e5e7eb" }}
            />
            <span className="text-xs">
              Sans majorité ({noDominantCount})
            </span>
          </div>
        )}
        {sortedParties.length === 0 && noDominantCount === 0 && (
          <span className="text-xs text-muted-foreground">Aucune donnée</span>
        )}
      </div>
    </div>
  );
}
