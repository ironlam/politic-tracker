"use client";

import { memo, useCallback, useState } from "react";
import dynamic from "next/dynamic";
import { scaleLinear } from "d3-scale";
import { DepartmentStats } from "@/app/api/stats/departments/route";

// DOM-TOM codes for separate display
const DOMTOM_CODES = ["971", "972", "973", "974", "976"];
const DOMTOM_NAMES: Record<string, string> = {
  "971": "Guadeloupe",
  "972": "Martinique",
  "973": "Guyane",
  "974": "La Réunion",
  "976": "Mayotte",
};

// Dynamic import to avoid SSR issues with react-simple-maps
const ComposableMap = dynamic(
  () => import("react-simple-maps").then((m) => m.ComposableMap),
  { ssr: false }
);
const Geographies = dynamic(
  () => import("react-simple-maps").then((m) => m.Geographies),
  { ssr: false }
);
const Geography = dynamic(
  () => import("react-simple-maps").then((m) => m.Geography),
  { ssr: false }
);
const ZoomableGroup = dynamic(
  () => import("react-simple-maps").then((m) => m.ZoomableGroup),
  { ssr: false }
);

interface DepartmentMapProps {
  departments: DepartmentStats[];
  mode: "count" | "party";
  onDepartmentHover: (dept: DepartmentStats | null, event?: React.MouseEvent) => void;
  onDepartmentClick: (dept: DepartmentStats) => void;
  selectedDepartment: string | null;
  isDarkMode: boolean;
}

const geoUrl = "/data/departements.geojson";

// Color scales for count mode
const countColorScaleLight = scaleLinear<string>()
  .domain([0, 5, 15, 25])
  .range(["#f0f9ff", "#7dd3fc", "#0284c7", "#0c4a6e"]);

const countColorScaleDark = scaleLinear<string>()
  .domain([0, 5, 15, 25])
  .range(["#1e3a5f", "#0369a1", "#38bdf8", "#bae6fd"]);

function DepartmentMapComponent({
  departments,
  mode,
  onDepartmentHover,
  onDepartmentClick,
  selectedDepartment,
  isDarkMode,
}: DepartmentMapProps) {
  const [position, setPosition] = useState({ coordinates: [2.5, 46.5] as [number, number], zoom: 1 });

  // Build lookup map
  const deptMap = new Map(departments.map((d) => [d.code, d]));

  const getColor = useCallback(
    (code: string) => {
      const dept = deptMap.get(code);
      if (!dept) return isDarkMode ? "#374151" : "#e5e7eb";

      if (mode === "party") {
        return dept.dominantParty?.color || (isDarkMode ? "#374151" : "#e5e7eb");
      }

      // Count mode
      const colorScale = isDarkMode ? countColorScaleDark : countColorScaleLight;
      return colorScale(dept.totalElus);
    },
    [deptMap, mode, isDarkMode]
  );

  const handleMoveEnd = useCallback((position: { coordinates: [number, number]; zoom: number }) => {
    setPosition(position);
  }, []);

  // Extract DOM-TOM departments for separate display
  const domtomDepts = DOMTOM_CODES.map(code => deptMap.get(code)).filter(Boolean) as DepartmentStats[];

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
          <ZoomableGroup
            center={position.coordinates}
            zoom={position.zoom}
            onMoveEnd={handleMoveEnd}
            minZoom={0.8}
            maxZoom={4}
          >
            <Geographies geography={geoUrl}>
              {({ geographies }) =>
                geographies.map((geo) => {
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
                      aria-label={dept ? `${dept.name}: ${dept.totalElus} élus` : geo.properties.nom}
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
                })
              }
            </Geographies>
          </ZoomableGroup>
        </ComposableMap>
      </div>

      {/* DOM-TOM insets */}
      {domtomDepts.length > 0 && (
        <div className="flex justify-center gap-2 py-2 border-t border-border/50">
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
                title={dept ? `${DOMTOM_NAMES[code]}: ${dept.totalElus} élus` : DOMTOM_NAMES[code]}
              >
                <span className={isDarkMode ? "text-white" : "text-white"} style={{ textShadow: "0 0 2px rgba(0,0,0,0.5)" }}>
                  {DOMTOM_NAMES[code]}
                </span>
                {dept && (
                  <span className="bg-white/20 px-1 rounded text-white" style={{ textShadow: "0 0 2px rgba(0,0,0,0.5)" }}>
                    {dept.totalElus}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export const DepartmentMap = memo(DepartmentMapComponent);
