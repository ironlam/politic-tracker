"use client";

import { memo, useCallback, useState } from "react";
import dynamic from "next/dynamic";
import { scaleLinear } from "d3-scale";
import { DepartmentStats } from "@/app/api/stats/departments/route";

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

  return (
    <div className="relative w-full h-full">
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{
          center: [2.5, 46.5],
          scale: 2800,
        }}
        className="w-full h-full"
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
  );
}

export const DepartmentMap = memo(DepartmentMapComponent);
