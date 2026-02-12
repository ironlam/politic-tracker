"use client";

import { Search } from "lucide-react";
import { useGlobalSearch } from "./GlobalSearchProvider";

interface GlobalSearchTriggerProps {
  variant: "desktop" | "mobile";
  onBeforeOpen?: () => void;
}

export function GlobalSearchTrigger({ variant, onBeforeOpen }: GlobalSearchTriggerProps) {
  const { openSearch } = useGlobalSearch();

  function handleClick() {
    onBeforeOpen?.();
    openSearch();
  }

  if (variant === "mobile") {
    return (
      <button
        onClick={handleClick}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-border font-medium rounded-lg hover:bg-muted/50 transition-colors"
        aria-label="Ouvrir la recherche"
      >
        <Search className="h-5 w-5" aria-hidden="true" />
        Rechercher...
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground border border-border rounded-lg hover:bg-muted/50 hover:text-foreground transition-colors cursor-pointer"
      aria-label="Ouvrir la recherche (Ctrl+K)"
    >
      <Search className="h-4 w-4" aria-hidden="true" />
      <span className="hidden xl:inline">Rechercher...</span>
      <kbd className="hidden xl:inline-flex items-center gap-0.5 ml-2 px-1.5 py-0.5 text-[10px] font-mono bg-muted rounded border border-border">
        <span className="text-xs">&#8984;</span>K
      </kbd>
    </button>
  );
}
