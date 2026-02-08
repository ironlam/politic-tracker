"use client";

import { RelationType } from "@/types/relations";
import {
  RELATION_TYPE_LABELS,
  RELATION_TYPE_COLORS,
  RELATION_TYPE_DESCRIPTIONS,
  ALL_RELATION_TYPES,
} from "@/config/relations";

interface RelationFiltersProps {
  selectedTypes: RelationType[];
  onChange: (types: RelationType[]) => void;
}

export function RelationFilters({ selectedTypes, onChange }: RelationFiltersProps) {
  const handleToggle = (type: RelationType) => {
    if (selectedTypes.includes(type)) {
      // Don't allow removing all types
      if (selectedTypes.length > 1) {
        onChange(selectedTypes.filter((t) => t !== type));
      }
    } else {
      onChange([...selectedTypes, type]);
    }
  };

  const handleSelectAll = () => {
    onChange(ALL_RELATION_TYPES);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Types de relations</h3>
        {selectedTypes.length < ALL_RELATION_TYPES.length && (
          <button onClick={handleSelectAll} className="text-xs text-primary hover:underline">
            Tout sélectionner
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {ALL_RELATION_TYPES.map((type) => {
          const isSelected = selectedTypes.includes(type);
          return (
            <button
              key={type}
              onClick={() => handleToggle(type)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-left text-sm transition-colors ${
                isSelected
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-muted-foreground/30"
              }`}
              title={RELATION_TYPE_DESCRIPTIONS[type]}
            >
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{
                  backgroundColor: isSelected ? RELATION_TYPE_COLORS[type] : "#D1D5DB",
                }}
              />
              <span className={isSelected ? "text-foreground" : "text-muted-foreground"}>
                {RELATION_TYPE_LABELS[type]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
