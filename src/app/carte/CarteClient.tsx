"use client";

import { useState, useCallback, useEffect } from "react";
import { useTheme } from "next-themes";
import dynamic from "next/dynamic";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import {
  DepartmentTooltip,
  MapFilters,
  MapLegend,
  MapSidebar,
  MobileMapView,
} from "@/components/map";
import type { FilterType, DisplayMode } from "@/components/map";
import { DepartmentStats } from "@/app/api/stats/departments/route";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// Dynamic import for map to avoid SSR issues
const DepartmentMap = dynamic(
  () => import("@/components/map/DepartmentMap").then((m) => m.DepartmentMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-[500px] bg-muted/30 rounded-lg">
        <div className="flex flex-col items-center gap-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <span className="text-sm text-muted-foreground">Chargement de la carte...</span>
        </div>
      </div>
    ),
  }
);

interface CarteClientProps {
  initialDepartments: DepartmentStats[];
  initialStats: {
    totalDepartments: number;
    totalElus: number;
    totalDeputes: number;
    totalSenateurs: number;
  };
}

export function CarteClient({ initialDepartments, initialStats }: CarteClientProps) {
  const { resolvedTheme } = useTheme();
  const isDarkMode = resolvedTheme === "dark";
  const isMobile = useMediaQuery("(max-width: 768px)");

  const [filter, setFilter] = useState<FilterType>("all");
  const [mode, setMode] = useState<DisplayMode>("party");
  const [departments, setDepartments] = useState(initialDepartments);
  const [stats, setStats] = useState(initialStats);
  const [loading, setLoading] = useState(false);

  // Tooltip state
  const [hoveredDept, setHoveredDept] = useState<DepartmentStats | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  // Sidebar state
  const [selectedDept, setSelectedDept] = useState<DepartmentStats | null>(null);

  // Fetch data when filter changes
  useEffect(() => {
    // Skip fetch for initial "all" filter - use SSR data
    if (filter === "all") {
      setDepartments(initialDepartments);
      setStats(initialStats);
      return;
    }

    async function fetchData() {
      setLoading(true);
      try {
        const res = await fetch(`/api/stats/departments?filter=${filter}`);
        const data = await res.json();
        setDepartments(data.departments);
        setStats(data.stats);
      } catch (error) {
        console.error("Error fetching department stats:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [filter, initialDepartments, initialStats]);

  const handleDepartmentHover = useCallback(
    (dept: DepartmentStats | null, event?: React.MouseEvent) => {
      setHoveredDept(dept);
      if (event && dept) {
        setTooltipPosition({ x: event.clientX, y: event.clientY });
      }
    },
    []
  );

  const handleDepartmentClick = useCallback((dept: DepartmentStats) => {
    setSelectedDept(dept);
  }, []);

  const handleCloseSidebar = useCallback(() => {
    setSelectedDept(null);
  }, []);

  // Show mobile list view on small screens
  if (isMobile) {
    return (
      <div className="space-y-4">
        {/* Stats summary */}
        <div className="grid grid-cols-2 gap-2">
          <Card>
            <CardContent className="p-3 text-center">
              <div className="text-2xl font-bold">{stats.totalDeputes}</div>
              <div className="text-xs text-muted-foreground">Députés</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <div className="text-2xl font-bold">{stats.totalSenateurs}</div>
              <div className="text-xs text-muted-foreground">Sénateurs</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex justify-center">
          <MapFilters
            filter={filter}
            mode={mode}
            onFilterChange={setFilter}
            onModeChange={setMode}
          />
        </div>

        {/* Mobile list */}
        {loading ? (
          <div className="space-y-2">
            {[...Array(10)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : (
          <MobileMapView departments={departments} />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats and filters */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <div className="text-center">
            <div className="text-3xl font-bold">{stats.totalElus}</div>
            <div className="text-sm text-muted-foreground">Élus</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-semibold text-blue-600">{stats.totalDeputes}</div>
            <div className="text-sm text-muted-foreground">Députés</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-semibold text-purple-600">{stats.totalSenateurs}</div>
            <div className="text-sm text-muted-foreground">Sénateurs</div>
          </div>
        </div>

        <MapFilters
          filter={filter}
          mode={mode}
          onFilterChange={setFilter}
          onModeChange={setMode}
        />
      </div>

      {/* Map and sidebar container */}
      <div className="relative flex">
        {/* Map */}
        <div
          className={`flex-1 h-[600px] bg-muted/20 rounded-lg overflow-hidden transition-all ${
            selectedDept ? "mr-80" : ""
          }`}
        >
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <DepartmentMap
              departments={departments}
              mode={mode}
              onDepartmentHover={handleDepartmentHover}
              onDepartmentClick={handleDepartmentClick}
              selectedDepartment={selectedDept?.code || null}
              isDarkMode={isDarkMode}
            />
          )}
        </div>

        {/* Sidebar */}
        {selectedDept && (
          <div className="absolute right-0 top-0 h-[600px] w-80">
            <MapSidebar department={selectedDept} onClose={handleCloseSidebar} />
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex justify-between items-start">
        <MapLegend mode={mode} departments={departments} isDarkMode={isDarkMode} />
        <div className="text-xs text-muted-foreground">
          Cliquez sur un département pour voir les détails
        </div>
      </div>

      {/* Tooltip */}
      {hoveredDept && !selectedDept && (
        <DepartmentTooltip department={hoveredDept} position={tooltipPosition} />
      )}
    </div>
  );
}
