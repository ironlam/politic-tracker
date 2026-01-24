"use client";

import { RelationType } from "@/types/relations";
import { RELATION_TYPE_LABELS, RELATION_TYPE_COLORS } from "@/config/relations";

interface RelationLegendProps {
  activeTypes: Partial<Record<RelationType, number>>;
}

export function RelationLegend({ activeTypes }: RelationLegendProps) {
  const types = Object.entries(activeTypes) as [RelationType, number][];

  if (types.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-3">
      {types.map(([type, count]) => (
        <div key={type} className="flex items-center gap-2 text-sm">
          <span
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: RELATION_TYPE_COLORS[type] }}
          />
          <span className="text-muted-foreground">
            {RELATION_TYPE_LABELS[type]} ({count})
          </span>
        </div>
      ))}
    </div>
  );
}
