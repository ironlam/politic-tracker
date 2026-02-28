"use client";

import { useTransition, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { POLITICAL_POSITION_LABELS, POLITICAL_POSITION_ORDER } from "@/config/labels";

interface PartiesFilterBarProps {
  currentFilters: {
    search: string;
    position: string;
    status: string;
    sort: string;
  };
  total: number;
}

const SORT_OPTIONS: Record<string, string> = {
  members: "Membres (desc)",
  alpha: "A - Z",
  "alpha-desc": "Z - A",
};

const STATUS_OPTIONS: Record<string, string> = {
  actifs: "Actifs",
  historiques: "Historiques",
  "": "Tous",
};

const selectClassName =
  "h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 cursor-pointer hover:border-primary/50 transition-colors";

export function PartiesFilterBar({ currentFilters, total }: PartiesFilterBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  // Sync input with URL on back/forward navigation + cleanup debounce
  useEffect(() => {
    if (inputRef.current && inputRef.current.value !== currentFilters.search) {
      inputRef.current.value = currentFilters.search;
    }
  }, [currentFilters.search]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const updateParams = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete("page");

    startTransition(() => {
      const qs = params.toString();
      router.push(qs ? `/partis?${qs}` : "/partis");
    });
  };

  const handleSearchInput = (value: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      updateParams("search", value.trim());
    }, 300);
  };

  return (
    <div className="mb-6 rounded-lg border bg-muted/40 p-4 space-y-3 relative">
      {/* Loading overlay */}
      {isPending && (
        <div className="absolute inset-0 rounded-lg bg-background/60 flex items-center justify-center z-10">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <svg
              className="animate-spin h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span>Chargement...</span>
          </div>
        </div>
      )}

      {/* Search + filters grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <label
            htmlFor="search-parties"
            className="text-xs font-medium text-muted-foreground mb-1 block"
          >
            Recherche
          </label>
          <input
            ref={inputRef}
            id="search-parties"
            type="search"
            placeholder="Nom du parti..."
            defaultValue={currentFilters.search}
            onChange={(e) => handleSearchInput(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 placeholder:text-muted-foreground"
          />
        </div>

        <div>
          <label
            htmlFor="position-parties"
            className="text-xs font-medium text-muted-foreground mb-1 block"
          >
            Orientation
          </label>
          <select
            id="position-parties"
            value={currentFilters.position}
            onChange={(e) => updateParams("position", e.target.value)}
            className={selectClassName}
          >
            <option value="">Toutes</option>
            {POLITICAL_POSITION_ORDER.map((pos) => (
              <option key={pos} value={pos}>
                {POLITICAL_POSITION_LABELS[pos]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="status-parties"
            className="text-xs font-medium text-muted-foreground mb-1 block"
          >
            Statut
          </label>
          <select
            id="status-parties"
            value={currentFilters.status}
            onChange={(e) => updateParams("status", e.target.value)}
            className={selectClassName}
          >
            {Object.entries(STATUS_OPTIONS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="sort-parties"
            className="text-xs font-medium text-muted-foreground mb-1 block"
          >
            Trier par
          </label>
          <select
            id="sort-parties"
            value={currentFilters.sort}
            onChange={(e) => updateParams("sort", e.target.value)}
            className={selectClassName}
          >
            {Object.entries(SORT_OPTIONS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Results count */}
      <div className="text-xs text-muted-foreground">
        {total} parti{total !== 1 ? "s" : ""}
      </div>
    </div>
  );
}
