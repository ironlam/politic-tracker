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
    <div role="list" className="flex flex-wrap gap-3">
      {types.map(([type, count]) => (
        <div key={type} role="listitem" className="flex items-center gap-1.5 text-xs">
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: RELATION_TYPE_COLORS[type] }}
          />
          <span className="text-muted-foreground">{RELATION_TYPE_LABELS[type]}</span>
          <span className="text-muted-foreground/60">{count}</span>
        </div>
      ))}
    </div>
  );
}
