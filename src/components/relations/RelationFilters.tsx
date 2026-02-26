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
  compact?: boolean;
}

/** Short label for mobile compact mode: take the last word of the label */
function shortLabel(label: string): string {
  const words = label.split(" ");
  return words[words.length - 1];
}

export function RelationFilters({
  selectedTypes,
  onChange,
  compact = false,
}: RelationFiltersProps) {
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
    onChange([...ALL_RELATION_TYPES]);
  };

  if (compact) {
    return (
      <div
        role="group"
        aria-label="Filtrer les types de relations"
        className="flex flex-wrap gap-1.5"
      >
        {ALL_RELATION_TYPES.map((type) => {
          const isSelected = selectedTypes.includes(type);
          return (
            <button
              key={type}
              onClick={() => handleToggle(type)}
              aria-pressed={isSelected}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors border focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:outline-none ${
                isSelected
                  ? "border-foreground/20 bg-foreground/5 text-foreground"
                  : "border-border text-muted-foreground hover:border-muted-foreground/30"
              }`}
              title={RELATION_TYPE_DESCRIPTIONS[type]}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{
                  backgroundColor: isSelected ? RELATION_TYPE_COLORS[type] : "#D1D5DB",
                }}
              />
              <span className="hidden sm:inline">{RELATION_TYPE_LABELS[type]}</span>
              <span className="sm:hidden">{shortLabel(RELATION_TYPE_LABELS[type])}</span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div role="group" aria-label="Filtrer les types de relations" className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Types de relations</h3>
        {selectedTypes.length < ALL_RELATION_TYPES.length && (
          <button
            onClick={handleSelectAll}
            className="text-xs text-primary hover:underline focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:outline-none rounded"
          >
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
              aria-pressed={isSelected}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-left text-sm transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:outline-none ${
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
