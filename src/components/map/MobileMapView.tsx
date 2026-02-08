"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { ChevronRight, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { DepartmentStats } from "@/app/api/stats/departments/route";

interface MobileMapViewProps {
  departments: DepartmentStats[];
}

type SortOption = "name" | "totalElus" | "deputes" | "senateurs";

export function MobileMapView({ departments }: MobileMapViewProps) {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("name");

  const filteredAndSorted = useMemo(() => {
    let result = [...departments];

    // Filter by search
    if (search) {
      const lowerSearch = search.toLowerCase();
      result = result.filter(
        (d) =>
          d.name.toLowerCase().includes(lowerSearch) ||
          d.code.toLowerCase().includes(lowerSearch) ||
          d.region.toLowerCase().includes(lowerSearch)
      );
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case "totalElus":
          return b.totalElus - a.totalElus;
        case "deputes":
          return b.deputes - a.deputes;
        case "senateurs":
          return b.senateurs - a.senateurs;
        default:
          return a.name.localeCompare(b.name, "fr");
      }
    });

    return result;
  }, [departments, search, sortBy]);

  // Generate slug for department page
  const getDeptSlug = (name: string) =>
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

  return (
    <div className="flex flex-col gap-4">
      {/* Search and sort controls */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher un département..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortOption)}
          className="w-full sm:w-[180px]"
        >
          <option value="name">Nom (A-Z)</option>
          <option value="totalElus">Total élus</option>
          <option value="deputes">Nombre de députés</option>
          <option value="senateurs">Nombre de sénateurs</option>
        </Select>
      </div>

      {/* Results count */}
      <div className="text-sm text-muted-foreground">
        {filteredAndSorted.length} département{filteredAndSorted.length !== 1 ? "s" : ""}
      </div>

      {/* Department list */}
      <div className="divide-y rounded-lg border">
        {filteredAndSorted.map((dept) => (
          <Link
            key={dept.code}
            href={`/departements/${getDeptSlug(dept.name)}`}
            className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium truncate">{dept.name}</span>
                <span className="text-xs text-muted-foreground">({dept.code})</span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary" className="text-xs">
                  {dept.deputes} député{dept.deputes !== 1 ? "s" : ""}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {dept.senateurs} sénateur{dept.senateurs !== 1 ? "s" : ""}
                </Badge>
                {dept.dominantParty && (
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: dept.dominantParty.color || "#888" }}
                    title={dept.dominantParty.shortName}
                  />
                )}
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          </Link>
        ))}

        {filteredAndSorted.length === 0 && (
          <div className="p-8 text-center text-muted-foreground">Aucun département trouvé</div>
        )}
      </div>
    </div>
  );
}
