"use client";

import { DepartmentStats } from "@/app/api/stats/departments/route";

interface DepartmentTooltipProps {
  department: DepartmentStats;
  position: { x: number; y: number };
}

export function DepartmentTooltip({ department, position }: DepartmentTooltipProps) {
  return (
    <div
      className="fixed z-50 pointer-events-none bg-popover text-popover-foreground border rounded-lg shadow-lg p-3 min-w-[200px]"
      style={{
        left: position.x + 15,
        top: position.y + 15,
        transform: "translateY(-50%)",
      }}
      role="tooltip"
      aria-live="polite"
    >
      <div className="font-semibold text-sm mb-1">
        {department.name} ({department.code})
      </div>
      <div className="text-xs text-muted-foreground mb-2">{department.region}</div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <span className="text-muted-foreground">Total élus:</span>{" "}
          <span className="font-medium">{department.totalElus}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Députés:</span>{" "}
          <span className="font-medium">{department.deputes}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Sénateurs:</span>{" "}
          <span className="font-medium">{department.senateurs}</span>
        </div>
        {department.dominantParty && (
          <div className="col-span-2 flex items-center gap-1">
            <span className="text-muted-foreground">Parti dominant:</span>
            <span
              className="inline-block w-3 h-3 rounded-full"
              style={{ backgroundColor: department.dominantParty.color || "#888" }}
            />
            <span className="font-medium" title={department.dominantParty.name}>
              {department.dominantParty.shortName}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
