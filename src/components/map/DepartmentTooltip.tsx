"use client";

import type { MapDepartmentData } from "@/app/api/carte/route";

interface DepartmentTooltipProps {
  department: MapDepartmentData;
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

      <div className="space-y-1 text-xs">
        <div>
          <span className="text-muted-foreground">Sièges :</span>{" "}
          <span className="font-medium">{department.totalSeats}</span>
        </div>
        {department.winningParty && (
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">Parti gagnant :</span>
            <span
              className="inline-block w-3 h-3 rounded-full"
              style={{ backgroundColor: department.winningParty.color || "#888" }}
            />
            <span className="font-medium" title={department.winningParty.name}>
              {department.winningParty.shortName}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
