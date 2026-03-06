"use client";

import { StatCard } from "@/components/ui/StatCard";
import type { ActivityStats } from "@/types/activity";

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
  activeFilter: string;
  onFilterChange: (filter: string) => void;
}

export function WatchlistDashboard({
  stats,
  activeFilter,
  onFilterChange,
}: WatchlistDashboardProps) {
  return (
    <div className="space-y-4">
      {/* Stats row */}
      {stats && (
        <div className="grid grid-cols-3 gap-3">
          <StatCard count={stats.votesCount} label="Votes" accent={STAT_ACCENTS.votes} />
          <StatCard count={stats.pressCount} label="Presse" accent={STAT_ACCENTS.press} />
          <StatCard
            count={stats.activeAffairsCount}
            label="Affaires"
            accent={STAT_ACCENTS.affairs}
          />
        </div>
      )}

      {/* Filter chips */}
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
