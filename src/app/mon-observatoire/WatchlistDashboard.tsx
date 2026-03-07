"use client";

import { useMemo } from "react";
import { X } from "lucide-react";
import { StatCard } from "@/components/ui/StatCard";
import type {
  ActivityItem,
  ActivityStats,
  WatchlistPolitician,
  WatchlistParty,
} from "@/types/activity";

const STAT_ACCENTS = {
  votes: { border: "#2563eb", bg: "#2563eb0a" },
  press: { border: "#16a34a", bg: "#16a34a0a" },
  affairs: { border: "#d97706", bg: "#d9770610" },
};

const FILTERS = [
  { key: "all", label: "Tous" },
  { key: "vote", label: "Votes" },
  { key: "press", label: "Presse" },
  { key: "affair", label: "Affaires" },
] as const;

interface WatchlistDashboardProps {
  stats: ActivityStats | null;
  filteredActivity: ActivityItem[];
  hasPersonFilter: boolean;
  activeFilter: string;
  onFilterChange: (filter: string) => void;
  selectedSlugs: Set<string>;
  politicians: WatchlistPolitician[];
  parties: WatchlistParty[];
  onRemoveSlug: (slug: string) => void;
  onClearFilter: () => void;
}

export function WatchlistDashboard({
  stats,
  filteredActivity,
  hasPersonFilter,
  activeFilter,
  onFilterChange,
  selectedSlugs,
  politicians,
  parties,
  onRemoveSlug,
  onClearFilter,
}: WatchlistDashboardProps) {
  // Recalculate stats from filtered activity when person filter is active
  const displayStats = useMemo(() => {
    if (!hasPersonFilter || !stats) return stats;
    return {
      votesCount: filteredActivity.filter((a) => a.type === "vote").length,
      pressCount: filteredActivity.filter((a) => a.type === "press").length,
      activeAffairsCount: filteredActivity.filter((a) => a.type === "affair").length,
    };
  }, [stats, hasPersonFilter, filteredActivity]);

  // Resolve selected slugs to display names
  const selectedItems = useMemo(() => {
    const items: { slug: string; label: string }[] = [];
    for (const slug of selectedSlugs) {
      const politician = politicians.find((p) => p.slug === slug);
      if (politician) {
        items.push({ slug, label: politician.fullName });
        continue;
      }
      const party = parties.find((p) => p.slug === slug);
      if (party) {
        items.push({ slug, label: party.shortName || party.name });
      }
    }
    return items;
  }, [selectedSlugs, politicians, parties]);

  return (
    <div className="space-y-4">
      {/* Period label + Stats row */}
      {displayStats && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">30 derniers jours</p>
          <div className="grid grid-cols-3 gap-3">
            <StatCard count={displayStats.votesCount} label="Votes" accent={STAT_ACCENTS.votes} />
            <StatCard count={displayStats.pressCount} label="Presse" accent={STAT_ACCENTS.press} />
            <StatCard
              count={displayStats.activeAffairsCount}
              label="Affaires"
              accent={STAT_ACCENTS.affairs}
            />
          </div>
        </div>
      )}

      {/* Active person filter chips */}
      {selectedItems.length > 0 && (
        <div className="flex gap-2 flex-wrap items-center">
          <span className="text-xs text-muted-foreground">Filtré par :</span>
          {selectedItems.map((item) => (
            <button
              key={item.slug}
              onClick={() => onRemoveSlug(item.slug)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
            >
              {item.label}
              <X className="size-3" />
            </button>
          ))}
          {selectedItems.length > 1 && (
            <button
              onClick={onClearFilter}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Tout effacer
            </button>
          )}
        </div>
      )}

      {/* Type filter chips */}
      <div className="flex gap-2 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => onFilterChange(f.key)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              activeFilter === f.key
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
    </div>
  );
}
