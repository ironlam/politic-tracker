"use client";

import { useState, useEffect, useRef, useCallback, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Search, X, User, Building2, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useSearchIndex } from "@/hooks/useSearchIndex";
import type { PoliticianEntry, PartyEntry, GroupEntry } from "@/hooks/useSearchIndex";
import type { CompareCategory } from "@/types/compare";
import { isCategoryPolitician } from "@/types/compare";

/* ------------------------------------------------------------------ */
/*  Unified result type — every search result maps to this shape      */
/* ------------------------------------------------------------------ */

interface SearchResult {
  /** Unique key — slug for politicians/parties, id for groups */
  key: string;
  /** URL param value (slug or id) */
  paramValue: string;
  label: string;
  sublabel?: string;
  photoUrl?: string | null;
  color?: string | null;
  icon: "user" | "building" | "users";
}

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export interface CompareSelectorProps {
  category: CompareCategory;
  side: "a" | "b";
  /** Preview data for currently selected item (server-rendered) */
  preview: {
    slug: string;
    label: string;
    sublabel?: string;
    photoUrl?: string | null;
    color?: string | null;
  } | null;
}

/* ------------------------------------------------------------------ */
/*  Mapping helpers: index entries -> SearchResult                     */
/* ------------------------------------------------------------------ */

function mapPolitician(p: PoliticianEntry): SearchResult {
  const parts: string[] = [];
  if (p.partyShortName) parts.push(p.partyShortName);
  if (p.mandateType) parts.push(p.mandateType);
  return {
    key: p.slug,
    paramValue: p.slug,
    label: p.fullName,
    sublabel: parts.length > 0 ? parts.join(" · ") : undefined,
    photoUrl: p.photoUrl,
    color: p.partyColor,
    icon: "user",
  };
}

function mapParty(p: PartyEntry): SearchResult {
  return {
    key: p.slug,
    paramValue: p.slug,
    label: p.name,
    sublabel:
      `${p.shortName || ""} · ${p.memberCount} membre${p.memberCount > 1 ? "s" : ""}`.replace(
        /^ · /,
        ""
      ),
    color: p.color,
    icon: "building",
  };
}

function mapGroup(g: GroupEntry): SearchResult {
  const chamber = g.chamber === "ASSEMBLEE_NATIONALE" ? "AN" : "Sénat";
  return {
    key: g.id,
    paramValue: g.id,
    label: g.name,
    sublabel:
      `${g.shortName || ""} · ${chamber} · ${g.memberCount} membre${g.memberCount > 1 ? "s" : ""}`.replace(
        /^ · /,
        ""
      ),
    color: g.color,
    icon: "users",
  };
}

/* ------------------------------------------------------------------ */
/*  Placeholder text per category                                      */
/* ------------------------------------------------------------------ */

const PLACEHOLDER: Record<CompareCategory, string> = {
  deputes: "Rechercher un député...",
  senateurs: "Rechercher un sénateur...",
  ministres: "Rechercher un ministre...",
  partis: "Rechercher un parti...",
  groupes: "Rechercher un groupe...",
};

/* ------------------------------------------------------------------ */
/*  ResultIcon                                                         */
/* ------------------------------------------------------------------ */

function ResultIcon({
  result,
  size = "sm",
}: {
  result: Pick<SearchResult, "icon" | "color" | "photoUrl" | "label">;
  size?: "sm" | "lg";
}) {
  const dim = size === "sm" ? "w-8 h-8" : "w-12 h-12";
  const iconSize = size === "sm" ? "h-4 w-4" : "h-5 w-5";

  // Politician with photo
  if (result.icon === "user" && result.photoUrl) {
    return (
      <img src={result.photoUrl} alt="" className={`${dim} rounded-full object-cover shrink-0`} />
    );
  }

  // Politician without photo — initials circle
  if (result.icon === "user") {
    return (
      <div className={`${dim} rounded-full bg-gray-200 flex items-center justify-center shrink-0`}>
        <User className={`${iconSize} text-gray-500`} />
      </div>
    );
  }

  // Party / Group — color badge
  const bg = result.color || "#888";
  const Icon = result.icon === "building" ? Building2 : Users;
  return (
    <div
      className={`${dim} rounded-lg flex items-center justify-center text-white shrink-0`}
      style={{ backgroundColor: bg }}
    >
      <Icon className={iconSize} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  CompareSelector                                                    */
/* ------------------------------------------------------------------ */

export function CompareSelector({ category, side, preview }: CompareSelectorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isPending, startTransition] = useTransition();
  const [isNavigating, setIsNavigating] = useState(false);

  const { isReady, searchPoliticiansByCategory, searchParties, searchGroups } = useSearchIndex();

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  /* ---------- Reset isNavigating when transition completes ---------- */

  useEffect(() => {
    if (isNavigating && (!isPending || preview)) {
      setIsNavigating(false);
    }
  }, [isPending, isNavigating, preview]);

  /* ---------- Listen for external navigation events ---------- */

  useEffect(() => {
    const handler = () => setIsNavigating(true);
    window.addEventListener("compare-navigating", handler);
    return () => window.removeEventListener("compare-navigating", handler);
  }, []);

  /* ---------- Debounced search ---------- */

  useEffect(() => {
    // Clear previous timer
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (query.length < 2) {
      setResults([]);
      setActiveIndex(-1);
      return;
    }

    if (!isReady) {
      // Index not loaded yet — wait
      return;
    }

    debounceRef.current = setTimeout(() => {
      const otherSide = side === "a" ? "b" : "a";
      const otherValue = searchParams.get(otherSide) || undefined;

      let mapped: SearchResult[];

      if (isCategoryPolitician(category)) {
        const matches = searchPoliticiansByCategory(
          query,
          category as "deputes" | "senateurs" | "ministres",
          otherValue
        );
        mapped = matches.map(mapPolitician);
      } else if (category === "partis") {
        const matches = searchParties(query, otherValue);
        mapped = matches.map(mapParty);
      } else {
        // groupes
        const matches = searchGroups(query, otherValue);
        mapped = matches.map(mapGroup);
      }

      setResults(mapped);
      setActiveIndex(-1);
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [
    query,
    category,
    side,
    isReady,
    searchPoliticiansByCategory,
    searchParties,
    searchGroups,
    searchParams,
  ]);

  /* ---------- Click outside ---------- */

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  /* ---------- Selection ---------- */

  const selectItem = useCallback(
    (result: SearchResult) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set(side, result.paramValue);
      // Preserve category
      if (!params.has("cat")) {
        params.set("cat", category);
      }
      setQuery("");
      setIsOpen(false);
      setActiveIndex(-1);
      setIsNavigating(true);
      window.dispatchEvent(new CustomEvent("compare-navigating"));
      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`, { scroll: false });
      });
    },
    [side, category, pathname, router, searchParams]
  );

  const clearSelection = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete(side);
    setIsNavigating(true);
    window.dispatchEvent(new CustomEvent("compare-navigating"));
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }, [side, pathname, router, searchParams]);

  /* ---------- Keyboard navigation ---------- */

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen || results.length === 0) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setActiveIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
          break;
        case "ArrowUp":
          e.preventDefault();
          setActiveIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
          break;
        case "Enter":
          e.preventDefault();
          if (activeIndex >= 0 && activeIndex < results.length) {
            selectItem(results[activeIndex]!);
          }
          break;
        case "Escape":
          setIsOpen(false);
          setActiveIndex(-1);
          break;
      }
    },
    [isOpen, results, activeIndex, selectItem]
  );

  /* ---------- Scroll active item into view ---------- */

  useEffect(() => {
    if (activeIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll("[data-result-item]");
      items[activeIndex]?.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex]);

  /* ---------- Reset query when category changes ---------- */

  useEffect(() => {
    setQuery("");
    setResults([]);
    setIsOpen(false);
    setActiveIndex(-1);
  }, [category]);

  /* ---------------------------------------------------------------- */
  /*  Render: Loading skeleton                                         */
  /* ---------------------------------------------------------------- */

  const listId = `compare-results-${side}`;

  if ((isPending || isNavigating) && !preview) {
    return (
      <div className="bg-muted rounded-lg p-4 animate-in fade-in-0 duration-200">
        <div className="flex items-center gap-4">
          <Skeleton
            className={`h-12 w-12 shrink-0 ${isCategoryPolitician(category) ? "rounded-full" : "rounded-lg"}`}
          />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Render: Selected state (preview card)                            */
  /* ---------------------------------------------------------------- */

  if (preview) {
    const previewResult: Pick<SearchResult, "icon" | "color" | "photoUrl" | "label"> = {
      icon: isCategoryPolitician(category) ? "user" : category === "partis" ? "building" : "users",
      color: preview.color,
      photoUrl: preview.photoUrl,
      label: preview.label,
    };

    return (
      <div className="bg-muted rounded-lg p-4 animate-in fade-in-0 duration-300">
        <div className="flex items-center gap-4">
          <ResultIcon result={previewResult} size="lg" />
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg truncate">{preview.label}</h3>
            {preview.sublabel && (
              <p className="text-sm text-muted-foreground truncate">{preview.sublabel}</p>
            )}
          </div>
          <button
            onClick={clearSelection}
            className="p-2 hover:bg-background rounded-full transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            title="Retirer"
            aria-label="Retirer la sélection"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Render: Search input + dropdown                                  */
  /* ---------------------------------------------------------------- */

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={PLACEHOLDER[category]}
          className="w-full pl-10 pr-4 py-3 min-h-[44px] border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm"
          role="combobox"
          aria-expanded={isOpen && results.length > 0}
          aria-controls={listId}
          aria-activedescendant={activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
          aria-autocomplete="list"
        />
        {!isReady && query.length >= 2 && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        )}
      </div>

      {/* Not ready message */}
      {isOpen && !isReady && query.length >= 2 && (
        <div className="absolute z-10 w-full mt-1 bg-background border border-input rounded-lg shadow-lg p-4 text-center text-muted-foreground text-sm">
          {"Chargement de l'index de recherche..."}
        </div>
      )}

      {/* Results dropdown */}
      {isOpen && isReady && results.length > 0 && (
        <div
          ref={listRef}
          id={listId}
          role="listbox"
          className="absolute z-10 w-full mt-1 bg-background border border-input rounded-lg shadow-lg max-h-80 overflow-auto"
        >
          {results.map((result, index) => (
            <button
              key={result.key}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              data-result-item
              onClick={() => selectItem(result)}
              className={`w-full flex items-center gap-3 p-3 min-h-[44px] transition-colors text-left ${
                index === activeIndex ? "bg-accent" : "hover:bg-muted"
              }`}
            >
              <ResultIcon result={result} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate text-sm">{result.label}</p>
                {result.sublabel && (
                  <span className="text-xs text-muted-foreground truncate block">
                    {result.sublabel}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Empty state */}
      {isOpen && isReady && query.length >= 2 && results.length === 0 && (
        <div className="absolute z-10 w-full mt-1 bg-background border border-input rounded-lg shadow-lg p-4 text-center text-muted-foreground text-sm">
          Aucun résultat pour &quot;{query}&quot;
        </div>
      )}
    </div>
  );
}
