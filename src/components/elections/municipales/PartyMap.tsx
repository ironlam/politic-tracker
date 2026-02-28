"use client";

import { memo, useCallback, useMemo, useState } from "react";
import dynamic from "next/dynamic";

// Dynamic imports to avoid SSR issues with react-simple-maps
const ComposableMap = dynamic(() => import("react-simple-maps").then((m) => m.ComposableMap), {
  ssr: false,
});
const Geographies = dynamic(() => import("react-simple-maps").then((m) => m.Geographies), {
  ssr: false,
});
const Geography = dynamic(() => import("react-simple-maps").then((m) => m.Geography), {
  ssr: false,
});

const geoUrl = "/data/departements.geojson";

// Île-de-France department codes
const IDF_CODES = ["75", "77", "78", "91", "92", "93", "94", "95"];

// DOM-TOM codes for separate display
const DOMTOM_CODES = ["971", "972", "973", "974", "976"];
const DOMTOM_NAMES: Record<string, string> = {
  "971": "Guadeloupe",
  "972": "Martinique",
  "973": "Guyane",
  "974": "La Réunion",
  "976": "Mayotte",
};

// Predefined party colors for common French party labels
const PARTY_COLORS: Record<string, string> = {
  RN: "#1A365D",
  LR: "#2B6CB0",
  Renaissance: "#FFD966",
  PS: "#E8555E",
  EELV: "#48BB78",
  LFI: "#BB1840",
  PCF: "#C53030",
  MoDem: "#F6AD55",
  UDI: "#63B3ED",
  Horizons: "#90CDF4",
  DVG: "#FC8181",
  DVD: "#BEE3F8",
  DIV: "#CBD5E0",
  SE: "#A0AEC0",
};

const NO_DATA_COLOR = "#e5e7eb";

/** Generate a consistent color for unknown party labels via simple hash */
function hashColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash) % 360;
  return `hsl(${h}, 55%, 50%)`;
}

function getPartyColor(label: string | null): string {
  if (!label) return NO_DATA_COLOR;
  return PARTY_COLORS[label] ?? hashColor(label);
}

export interface PartyMapDepartment {
  code: string;
  name: string;
  parties: Array<{ label: string; listCount: number }>;
  totalLists: number;
  dominantParty: string | null;
}

interface PartyMapProps {
  departments: PartyMapDepartment[];
  mini?: boolean;
}

interface TooltipState {
  x: number;
  y: number;
  dept: PartyMapDepartment;
}

function PartyMapComponent({ departments, mini = false }: PartyMapProps) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [selectedDept, setSelectedDept] = useState<PartyMapDepartment | null>(null);

  // Build lookup map
  const deptMap = useMemo(() => new Map(departments.map((d) => [d.code, d])), [departments]);

  const getColor = useCallback(
    (code: string) => {
      const dept = deptMap.get(code);
      if (!dept) return NO_DATA_COLOR;
      return getPartyColor(dept.dominantParty);
    },
    [deptMap]
  );

  const handleHover = useCallback(
    (dept: PartyMapDepartment | null, event?: React.MouseEvent) => {
      if (mini) return;
      if (dept && event) {
        setTooltip({ x: event.clientX, y: event.clientY, dept });
      } else {
        setTooltip(null);
      }
    },
    [mini]
  );

  const handleClick = useCallback(
    (dept: PartyMapDepartment) => {
      if (mini) return;
      setSelectedDept((prev) => (prev?.code === dept.code ? null : dept));
    },
    [mini]
  );

  const renderGeography = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (geo: any) => {
      const code = geo.properties.code;
      const dept = deptMap.get(code);
      const isSelected = selectedDept?.code === code;

      return (
        <Geography
          key={geo.rsmKey}
          geography={geo}
          fill={getColor(code)}
          stroke="#ffffff"
          strokeWidth={isSelected ? 2 : 0.5}
          style={{
            default: {
              outline: "none",
              cursor: dept && !mini ? "pointer" : "default",
            },
            hover: {
              outline: "none",
              fill: mini ? getColor(code) : "#3b82f6",
              cursor: dept && !mini ? "pointer" : "default",
            },
            pressed: { outline: "none" },
          }}
          onMouseEnter={(event) => {
            if (dept) handleHover(dept, event);
          }}
          onMouseLeave={() => handleHover(null)}
          onClick={() => {
            if (dept) handleClick(dept);
          }}
          tabIndex={dept && !mini ? 0 : -1}
          role={mini ? undefined : "button"}
          aria-label={
            dept
              ? `${dept.name} : ${dept.dominantParty ?? "aucun parti"} (${dept.totalLists} listes)`
              : geo.properties.nom
          }
          onKeyDown={(e) => {
            if (!mini && (e.key === "Enter" || e.key === " ")) {
              e.preventDefault();
              if (dept) handleClick(dept);
            }
          }}
        />
      );
    },
    [deptMap, getColor, selectedDept, mini, handleHover, handleClick]
  );

  // Extract DOM-TOM departments for separate display
  const domtomDepts = DOMTOM_CODES.map((code) => deptMap.get(code)).filter(
    Boolean
  ) as PartyMapDepartment[];

  if (mini) {
    return (
      <div className="relative w-full" style={{ height: 320 }}>
        <ComposableMap
          projection="geoMercator"
          projectionConfig={{ center: [2.5, 46.2], scale: 1800 }}
          className="w-full h-full"
          style={{ width: "100%", height: "100%" }}
        >
          <Geographies geography={geoUrl}>
            {({ geographies }) => geographies.map((geo) => renderGeography(geo))}
          </Geographies>
        </ComposableMap>
      </div>
    );
  }

  return (
    <div className="relative flex gap-6">
      {/* Map area */}
      <div className="flex-1 min-w-0">
        <div className="relative" style={{ height: 520 }}>
          {/* Main France map */}
          <ComposableMap
            projection="geoMercator"
            projectionConfig={{ center: [2.5, 46.2], scale: 2400 }}
            className="w-full h-full"
            style={{ width: "100%", height: "100%" }}
          >
            <Geographies geography={geoUrl}>
              {({ geographies }) => geographies.map((geo) => renderGeography(geo))}
            </Geographies>
          </ComposableMap>

          {/* Île-de-France inset */}
          <div
            aria-label="Carte de l'Île-de-France"
            className="absolute top-2 right-2 border rounded-lg overflow-hidden bg-white/85 dark:bg-gray-900/85 backdrop-blur-sm"
            style={{ width: 200, height: 180 }}
          >
            <div className="text-[10px] font-medium text-center py-1 text-muted-foreground border-b">
              Île-de-France
            </div>
            <ComposableMap
              projection="geoMercator"
              projectionConfig={{ center: [2.35, 48.86], scale: 12000 }}
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
        </div>

        {/* DOM-TOM buttons */}
        {domtomDepts.length > 0 && (
          <div
            aria-label="Territoires d'outre-mer"
            className="flex justify-center gap-2 py-2 border-t border-border/50"
          >
            <span className="text-xs text-muted-foreground self-center mr-2">Outre-mer :</span>
            {DOMTOM_CODES.map((code) => {
              const dept = deptMap.get(code);
              const isSelected = selectedDept?.code === code;
              const color = getColor(code);

              return (
                <button
                  key={code}
                  onClick={() => dept && handleClick(dept)}
                  onMouseEnter={(e) => dept && handleHover(dept, e)}
                  onMouseLeave={() => handleHover(null)}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-all ${
                    isSelected ? "ring-2 ring-primary" : ""
                  } ${dept ? "cursor-pointer hover:opacity-80" : "opacity-50 cursor-default"}`}
                  style={{ backgroundColor: color }}
                  disabled={!dept}
                  title={
                    dept
                      ? `${DOMTOM_NAMES[code]} : ${dept.dominantParty ?? "—"} (${dept.totalLists} listes)`
                      : DOMTOM_NAMES[code]
                  }
                >
                  <span className="text-white" style={{ textShadow: "0 0 2px rgba(0,0,0,0.5)" }}>
                    {DOMTOM_NAMES[code]} &middot; {dept?.dominantParty ?? "—"}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Sidebar: department details */}
      {selectedDept && (
        <aside className="w-72 shrink-0 border rounded-lg p-4 bg-card max-h-[560px] overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-lg">{selectedDept.name}</h3>
            <button
              onClick={() => setSelectedDept(null)}
              className="text-muted-foreground hover:text-foreground text-sm"
              aria-label="Fermer"
            >
              ✕
            </button>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            {selectedDept.totalLists} listes au total
          </p>
          <div className="space-y-2">
            {selectedDept.parties.map((party) => {
              const pct =
                selectedDept.totalLists > 0
                  ? ((party.listCount / selectedDept.totalLists) * 100).toFixed(1)
                  : "0";
              return (
                <div key={party.label} className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: getPartyColor(party.label) }}
                  />
                  <span className="text-sm flex-1 truncate">{party.label}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {party.listCount} ({pct} %)
                  </span>
                </div>
              );
            })}
          </div>
        </aside>
      )}

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 pointer-events-none bg-popover text-popover-foreground border rounded-lg shadow-lg p-3 text-sm"
          style={{
            left: tooltip.x + 12,
            top: tooltip.y - 8,
            maxWidth: 260,
          }}
        >
          <p className="font-semibold mb-1">
            {tooltip.dept.name} ({tooltip.dept.code})
          </p>
          <p className="text-xs text-muted-foreground mb-2">{tooltip.dept.totalLists} listes</p>
          {tooltip.dept.parties.slice(0, 3).map((party) => (
            <div key={party.label} className="flex items-center gap-2 text-xs">
              <div
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: getPartyColor(party.label) }}
              />
              <span className="flex-1 truncate">{party.label}</span>
              <span className="tabular-nums">{party.listCount}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export const PartyMap = memo(PartyMapComponent);

/** Exported for use in legend on carte page */
export { PARTY_COLORS, getPartyColor };
