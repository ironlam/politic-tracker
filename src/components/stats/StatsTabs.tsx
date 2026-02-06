"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Gavel, Vote, Newspaper, MapPin } from "lucide-react";

export type StatsTabType = "affaires" | "votes" | "presse" | "geo";

interface StatsTabsProps {
  activeTab: StatsTabType;
}

const tabs: { id: StatsTabType; label: string; icon: typeof Gavel }[] = [
  { id: "affaires", label: "Affaires", icon: Gavel },
  { id: "votes", label: "Votes", icon: Vote },
  { id: "presse", label: "Presse", icon: Newspaper },
  { id: "geo", label: "Géographie", icon: MapPin },
];

export function StatsTabs({ activeTab }: StatsTabsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleTabChange = (tab: StatsTabType) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.push(`/statistiques?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="flex flex-wrap gap-1 p-1 bg-muted/50 rounded-lg w-fit mb-8">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="h-4 w-4" />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
