"use client";

import Link from "next/link";
import { X, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DepartmentStats } from "@/app/api/stats/departments/route";

interface MapSidebarProps {
  department: DepartmentStats;
  onClose: () => void;
}

export function MapSidebar({ department, onClose }: MapSidebarProps) {
  // Generate slug for department page
  const deptSlug = department.name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  return (
    <Card className="w-full md:w-80 h-full md:h-auto border-l-0 md:border-l rounded-l-none md:rounded-l-lg">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-lg">{department.name}</CardTitle>
          <p className="text-sm text-muted-foreground">{department.region}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fermer">
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-muted rounded-lg p-2">
            <div className="text-2xl font-bold">{department.totalElus}</div>
            <div className="text-xs text-muted-foreground">Total</div>
          </div>
          <div className="bg-muted rounded-lg p-2">
            <div className="text-2xl font-bold">{department.deputes}</div>
            <div className="text-xs text-muted-foreground">Députés</div>
          </div>
          <div className="bg-muted rounded-lg p-2">
            <div className="text-2xl font-bold">{department.senateurs}</div>
            <div className="text-xs text-muted-foreground">Sénateurs</div>
          </div>
        </div>

        {/* Dominant party */}
        {department.dominantParty && (
          <div>
            <h4 className="text-sm font-medium mb-2">Parti dominant</h4>
            <div className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: department.dominantParty.color || "#888" }}
              />
              <span className="font-medium" title={department.dominantParty.name}>
                {department.dominantParty.shortName}
              </span>
              <span className="text-muted-foreground text-sm">
                ({department.dominantParty.count} élu{department.dominantParty.count > 1 ? "s" : ""}
                )
              </span>
            </div>
          </div>
        )}

        {/* All parties */}
        {department.parties.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2">Répartition par parti</h4>
            <div className="flex flex-wrap gap-1">
              {department.parties.map((party) => (
                <Badge
                  key={party.id}
                  variant="outline"
                  className="text-xs"
                  title={party.name}
                  style={{
                    borderColor: party.color || undefined,
                    backgroundColor: party.color ? `${party.color}20` : undefined,
                  }}
                >
                  {party.shortName}: {party.count}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Action button */}
        <Button asChild className="w-full">
          <Link href={`/departements/${deptSlug}`}>
            Voir tous les élus
            <ExternalLink className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
