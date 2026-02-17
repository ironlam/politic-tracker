"use client";

import type { MapDepartmentData } from "@/app/api/carte/route";
import { DisplayMode } from "./MapFilters";

const POSITION_COLORS: Record<string, string> = {
  FAR_LEFT: "#BB1840",
  LEFT: "#E8555E",
  CENTER_LEFT: "#F0956E",
  CENTER: "#FFD966",
  CENTER_RIGHT: "#7CB9E8",
  RIGHT: "#2B6CB0",
  FAR_RIGHT: "#1A365D",
};

const POSITION_LABELS: Record<string, string> = {
  FAR_LEFT: "Extrême gauche",
  LEFT: "Gauche",
  CENTER_LEFT: "Centre-gauche",
  CENTER: "Centre",
  CENTER_RIGHT: "Centre-droit",
  RIGHT: "Droite",
  FAR_RIGHT: "Extrême droite",
};

interface MapLegendProps {
  mode: DisplayMode;
  departments: MapDepartmentData[];
  isDarkMode: boolean;
}

export function MapLegend({ mode, departments, isDarkMode }: MapLegendProps) {
  if (mode === "position") {
    // Show color blocks for each political position present in the data
    const positionsPresent = new Set<string>();
    for (const dept of departments) {
      for (const party of dept.parties) {
        if (party.politicalPosition) {
          positionsPresent.add(party.politicalPosition);
        }
      }
    }

    // Ordered from left to right
    const orderedPositions = [
      "FAR_LEFT",
      "LEFT",
      "CENTER_LEFT",
      "CENTER",
      "CENTER_RIGHT",
      "RIGHT",
      "FAR_RIGHT",
    ].filter((p) => positionsPresent.has(p));

    return (
      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium text-muted-foreground">Position politique</span>
        <div className="flex flex-wrap gap-2">
          {orderedPositions.map((position) => (
            <div key={position} className="flex items-center gap-1">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: POSITION_COLORS[position] }}
              />
              <span className="text-xs">{POSITION_LABELS[position]}</span>
            </div>
          ))}
          {orderedPositions.length === 0 && (
            <span className="text-xs text-muted-foreground">Aucune donnée</span>
          )}
        </div>
      </div>
    );
  }

  // Party mode - show top parties by number of departments won
  const partyColors = new Map<
    string,
    { name: string; shortName: string; color: string; count: number }
  >();
  let noWinnerCount = 0;

  for (const dept of departments) {
    if (dept.winningParty) {
      const key = dept.winningParty.id;
      const existing = partyColors.get(key);
      if (existing) {
        existing.count++;
      } else {
        partyColors.set(key, {
          name: dept.winningParty.name,
          shortName: dept.winningParty.shortName,
          color: dept.winningParty.color || "#888888",
          count: 1,
        });
      }
    } else if (dept.parties.length > 0) {
      noWinnerCount++;
    }
  }

  // Sort by count descending
  const sortedParties = Array.from(partyColors.values()).sort((a, b) => b.count - a.count);

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium text-muted-foreground">Parti gagnant</span>
      <div className="flex flex-wrap gap-2">
        {sortedParties.slice(0, 8).map((party) => (
          <div key={party.shortName} className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: party.color }} />
            <span className="text-xs" title={party.name}>
              {party.shortName} ({party.count})
            </span>
          </div>
        ))}
        {noWinnerCount > 0 && (
          <div className="flex items-center gap-1">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: isDarkMode ? "#374151" : "#e5e7eb" }}
            />
            <span className="text-xs">Sans majorité ({noWinnerCount})</span>
          </div>
        )}
        {sortedParties.length === 0 && noWinnerCount === 0 && (
          <span className="text-xs text-muted-foreground">Aucune donnée</span>
        )}
      </div>
    </div>
  );
}
