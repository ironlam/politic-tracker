"use client";

import { memo, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import type { MapDepartmentData } from "@/app/api/carte/route";
import { POSITION_COLORS, NO_DATA_COLOR_LIGHT, NO_DATA_COLOR_DARK } from "./constants";

// DOM-TOM codes for separate display
const DOMTOM_CODES = ["971", "972", "973", "974", "976"];
const DOMTOM_NAMES: Record<string, string> = {
  "971": "Guadeloupe",
  "972": "Martinique",
  "973": "Guyane",
  "974": "La Réunion",
  "976": "Mayotte",
};

// Île-de-France department codes
const IDF_CODES = ["75", "77", "78", "91", "92", "93", "94", "95"];

// Dynamic import to avoid SSR issues with react-simple-maps
const ComposableMap = dynamic(() => import("react-simple-maps").then((m) => m.ComposableMap), {
  ssr: false,
});
const Geographies = dynamic(() => import("react-simple-maps").then((m) => m.Geographies), {
  ssr: false,
});
const Geography = dynamic(() => import("react-simple-maps").then((m) => m.Geography), {
  ssr: false,
});

interface DepartmentMapProps {
  departments: MapDepartmentData[];
  mode: "party" | "position";
  onDepartmentHover: (dept: MapDepartmentData | null, event?: React.MouseEvent) => void;
  onDepartmentClick: (dept: MapDepartmentData) => void;
  selectedDepartment: string | null;
  isDarkMode: boolean;
}

const geoUrl = "/data/departements.geojson";

/**
 * Get the dominant political position for a department by aggregating seats.
 */
function getDominantPosition(dept: MapDepartmentData): string | null {
  const positionSeats = new Map<string, number>();
  for (const party of dept.parties) {
    if (party.politicalPosition) {
      positionSeats.set(
        party.politicalPosition,
        (positionSeats.get(party.politicalPosition) || 0) + party.seats
      );
    }
  }
  if (positionSeats.size === 0) return null;

  let maxPosition: string | null = null;
  let maxSeats = 0;
  for (const [position, seats] of positionSeats) {
    if (seats > maxSeats) {
      maxSeats = seats;
      maxPosition = position;
    }
  }
  return maxPosition;
}

function DepartmentMapComponent({
  departments,
  mode,
  onDepartmentHover,
  onDepartmentClick,
  selectedDepartment,
  isDarkMode,
}: DepartmentMapProps) {
  // Build lookup map
  const deptMap = useMemo(() => new Map(departments.map((d) => [d.code, d])), [departments]);

  const noDataColor = isDarkMode ? NO_DATA_COLOR_DARK : NO_DATA_COLOR_LIGHT;

  const getColor = useCallback(
    (code: string) => {
      const dept = deptMap.get(code);
      if (!dept) return noDataColor;

      if (mode === "party") {
        return dept.winningParty?.color || noDataColor;
      }

      // Position mode: aggregate seats by political position
      const dominantPosition = getDominantPosition(dept);
      if (dominantPosition && POSITION_COLORS[dominantPosition]) {
        return POSITION_COLORS[dominantPosition];
      }
      return noDataColor;
    },
    [deptMap, mode, noDataColor]
  );

  // Render a Geography element (shared between main map and IdF inset)
  const renderGeography = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (geo: any) => {
      const code = geo.properties.code;
      const dept = deptMap.get(code);
      const isSelected = selectedDepartment === code;

      return (
        <Geography
          key={geo.rsmKey}
          geography={geo}
          fill={getColor(code)}
          stroke={isDarkMode ? "#1f2937" : "#ffffff"}
          strokeWidth={isSelected ? 2 : 0.5}
          style={{
            default: {
              outline: "none",
              cursor: dept ? "pointer" : "default",
            },
            hover: {
              outline: "none",
              fill: isDarkMode ? "#60a5fa" : "#3b82f6",
              cursor: dept ? "pointer" : "default",
            },
            pressed: {
              outline: "none",
            },
          }}
          onMouseEnter={(event) => {
            if (dept) {
              onDepartmentHover(dept, event);
            }
          }}
          onMouseLeave={() => {
            onDepartmentHover(null);
          }}
          onClick={() => {
            if (dept) {
              onDepartmentClick(dept);
            }
          }}
          tabIndex={dept ? 0 : -1}
          role="button"
          aria-label={dept ? `${dept.name}: ${dept.totalSeats} sièges` : geo.properties.nom}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              if (dept) {
                onDepartmentClick(dept);
              }
            }
          }}
        />
      );
    },
    [deptMap, getColor, isDarkMode, selectedDepartment, onDepartmentHover, onDepartmentClick]
  );

  // Extract DOM-TOM departments for separate display
  const domtomDepts = DOMTOM_CODES.map((code) => deptMap.get(code)).filter(
    Boolean
  ) as MapDepartmentData[];

  return (
    <div className="relative w-full h-full flex flex-col">
      {/* Main France map */}
      <div className="flex-1 min-h-0">
        <ComposableMap
          projection="geoMercator"
          projectionConfig={{
            center: [2.5, 46.2],
            scale: 2400,
          }}
          className="w-full h-full"
          style={{ width: "100%", height: "100%" }}
        >
          <Geographies geography={geoUrl}>
            {({ geographies }) => geographies.map((geo) => renderGeography(geo))}
          </Geographies>
        </ComposableMap>
      </div>

      {/* Île-de-France inset */}
      <div
        aria-label="Carte de l'Île-de-France"
        className="absolute top-2 right-2 border rounded-lg overflow-hidden"
        style={{
          width: 220,
          height: 200,
          backgroundColor: isDarkMode ? "rgba(17,24,39,0.85)" : "rgba(255,255,255,0.85)",
          backdropFilter: "blur(4px)",
        }}
      >
        <div
          className="text-[10px] font-medium text-center py-1"
          style={{
            color: isDarkMode ? "#d1d5db" : "#6b7280",
            borderBottom: `1px solid ${isDarkMode ? "#374151" : "#e5e7eb"}`,
          }}
        >
          Île-de-France
        </div>
        <ComposableMap
          projection="geoMercator"
          projectionConfig={{
            center: [2.35, 48.86],
            scale: 12000,
          }}
          style={{ width: "100%", height: "calc(100% - 24px)" }}
        >
          <Geographies geography={geoUrl}>
            {({ geographies }) =>
              geographies
                .filter((geo) => IDF_CODES.includes(geo.properties.code))
                .map((geo) => renderGeography(geo))
            }
          </Geographies>
        </ComposableMap>
      </div>

      {/* DOM-TOM insets */}
      {domtomDepts.length > 0 && (
        <div
          aria-label="Territoires d'outre-mer"
          className="flex justify-center gap-2 py-2 border-t border-border/50"
        >
          <span className="text-xs text-muted-foreground self-center mr-2">Outre-mer:</span>
          {DOMTOM_CODES.map((code) => {
            const dept = deptMap.get(code);
            const isSelected = selectedDepartment === code;
            const color = getColor(code);

            return (
              <button
                key={code}
                onClick={() => dept && onDepartmentClick(dept)}
                onMouseEnter={(e) => dept && onDepartmentHover(dept, e)}
                onMouseLeave={() => onDepartmentHover(null)}
                className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-all ${
                  isSelected ? "ring-2 ring-primary" : ""
                } ${dept ? "cursor-pointer hover:opacity-80" : "opacity-50 cursor-default"}`}
                style={{ backgroundColor: color }}
                disabled={!dept}
                title={
                  dept ? `${DOMTOM_NAMES[code]}: ${dept.totalSeats} sièges` : DOMTOM_NAMES[code]
                }
              >
                <span className="text-white" style={{ textShadow: "0 0 2px rgba(0,0,0,0.5)" }}>
                  {DOMTOM_NAMES[code]} &middot; {dept?.winningParty?.shortName || "\u2014"}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export const DepartmentMap = memo(DepartmentMapComponent);
