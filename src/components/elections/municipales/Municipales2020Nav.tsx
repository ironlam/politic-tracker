"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Home, MapPin, Search } from "lucide-react";
import { useState } from "react";
import { CommuneSearch } from "./CommuneSearch";

interface Tab {
  href: string;
  label: string;
  icon: typeof Home;
  exact?: boolean;
}

const TABS: Tab[] = [
  {
    href: "/elections/municipales-2020",
    label: "Résultats",
    icon: Home,
    exact: true,
  },
  {
    href: "/elections/municipales-2020/departements",
    label: "Départements",
    icon: MapPin,
  },
];

export function Municipales2020Nav() {
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <div className="border-b bg-background/80 backdrop-blur-sm sticky top-16 z-40">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide -mb-px">
          {TABS.map((tab) => {
            const isActive = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
            const Icon = tab.icon;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                prefetch={false}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors",
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </Link>
            );
          })}
          <button
            onClick={() => setSearchOpen(!searchOpen)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ml-auto",
              searchOpen
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
            )}
            aria-label="Rechercher une commune"
          >
            <Search className="h-4 w-4" />
            <span className="hidden sm:inline">Chercher une commune</span>
          </button>
        </div>
        {searchOpen && (
          <div className="py-3 border-t">
            <CommuneSearch
              basePath="/elections/municipales-2020"
              placeholder="Rechercher une commune..."
              label="Résultats dans ma commune"
              className="max-w-md"
            />
          </div>
        )}
      </div>
    </div>
  );
}
