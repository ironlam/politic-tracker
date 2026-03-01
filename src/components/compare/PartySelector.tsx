"use client";

import { useState, useEffect, useRef, useCallback, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X, Building2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useSearchIndex } from "@/hooks";

interface Party {
  id: string;
  slug: string | null;
  name: string;
  shortName: string;
  color: string | null;
  logoUrl: string | null;
  memberCount: number;
}

interface PartySelectorProps {
  position: "left" | "right";
  selectedParty?: Party | null;
  otherPartyId?: string;
}

export function PartySelector({ position, selectedParty, otherPartyId }: PartySelectorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Party[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [activeOnly, setActiveOnly] = useState(true);
  const [isPending, startTransition] = useTransition();
  const { isReady, searchParties } = useSearchIndex();
  const [isNavigating, setIsNavigating] = useState(false);

  // Reset isNavigating when transition completes or data arrives
  useEffect(() => {
    if (isNavigating && (!isPending || selectedParty)) {
      setIsNavigating(false);
    }
  }, [isPending, isNavigating, selectedParty]);

  // Listen for navigation events from SuggestedComparisons
  useEffect(() => {
    const handler = () => setIsNavigating(true);
    window.addEventListener("compare-navigating", handler);
    return () => window.removeEventListener("compare-navigating", handler);
  }, []);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Search parties — client-side when index ready, API fallback otherwise
  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      setActiveIndex(-1);
      return;
    }

    if (isReady) {
      // Instant client-side search
      const otherSlug = searchParams.get(position === "left" ? "right" : "left");
      const matches = searchParties(query, otherSlug || undefined);
      // Map to component's expected format
      const mapped = matches.map((p) => ({
        id: p.slug || "", // Use slug as ID for client-side results
        slug: p.slug,
        name: p.name,
        shortName: p.shortName || p.name,
        color: p.color,
        logoUrl: p.logoUrl,
        memberCount: p.memberCount,
      }));
      setResults(mapped);
      setActiveIndex(-1);
      setIsLoading(false);
      return;
    }

    // Fallback: API search with debounce when index not ready
    const controller = new AbortController();
    const fetchResults = async () => {
      setIsLoading(true);
      try {
        const activeParam = activeOnly ? "&active=true" : "&active=false";
        const response = await fetch(
          `/api/search/parties?q=${encodeURIComponent(query)}${activeParam}`,
          { signal: controller.signal }
        );
        if (!response.ok) throw new Error("Search failed");
        const data = await response.json();
        const filtered = data.filter((p: Party) => p.id !== otherPartyId);
        setResults(filtered);
        setActiveIndex(-1);
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setResults([]);
        }
      } finally {
        setIsLoading(false);
      }
    };

    const timeout = setTimeout(fetchResults, 150);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [query, otherPartyId, activeOnly, isReady, searchParties, searchParams, position]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectParty = useCallback(
    (party: Party) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("mode", "partis");
      params.set(position, party.slug || party.id);
      setQuery("");
      setIsOpen(false);
      setActiveIndex(-1);
      setIsNavigating(true);
      startTransition(() => {
        router.push(`/comparer?${params.toString()}`);
      });
    },
    [position, router, searchParams]
  );

  const clearSelection = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete(position);
    setIsNavigating(true);
    startTransition(() => {
      router.push(`/comparer?${params.toString()}`);
    });
  }, [position, router, searchParams]);

  // Keyboard navigation
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
            selectParty(results[activeIndex]!);
          }
          break;
        case "Escape":
          setIsOpen(false);
          setActiveIndex(-1);
          break;
      }
    },
    [isOpen, results, activeIndex, selectParty]
  );

  // Scroll active item into view
  useEffect(() => {
    if (activeIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll("[data-result-item]");
      items[activeIndex]?.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex]);

  if ((isPending || isNavigating) && !selectedParty) {
    return (
      <div className="bg-muted rounded-lg p-4 animate-in fade-in-0 duration-200">
        <div className="flex items-center gap-4">
          <Skeleton className="h-12 w-12 rounded-lg shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      </div>
    );
  }

  if (selectedParty) {
    return (
      <div className="bg-muted rounded-lg p-4 animate-in fade-in-0 duration-300">
        <div className="flex items-center gap-4">
          <div
            className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0"
            style={{ backgroundColor: selectedParty.color || "#888" }}
          >
            {selectedParty.shortName.slice(0, 3)}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg truncate">{selectedParty.name}</h3>
            <p className="text-sm text-muted-foreground">
              {selectedParty.memberCount} membre{selectedParty.memberCount > 1 ? "s" : ""}
            </p>
          </div>
          <button
            onClick={clearSelection}
            className="p-2 hover:bg-background rounded-full transition-colors"
            title="Retirer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
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
          placeholder="Rechercher un parti..."
          className="w-full pl-10 pr-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          role="combobox"
          aria-expanded={isOpen && results.length > 0}
          aria-controls="party-search-results"
          aria-activedescendant={activeIndex >= 0 ? `party-result-${activeIndex}` : undefined}
          aria-autocomplete="list"
        />
        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        )}
      </div>

      {isOpen && results.length > 0 && (
        <div
          ref={listRef}
          id="party-search-results"
          role="listbox"
          className="absolute z-10 w-full mt-1 bg-background border rounded-lg shadow-lg max-h-80 overflow-auto"
        >
          {results.map((party, index) => (
            <button
              key={party.id}
              id={`party-result-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              data-result-item
              onClick={() => selectParty(party)}
              className={`w-full flex items-center gap-3 p-3 transition-colors text-left ${
                index === activeIndex ? "bg-accent" : "hover:bg-muted"
              }`}
            >
              <div
                className="w-8 h-8 rounded flex items-center justify-center text-white text-xs font-bold shrink-0"
                style={{ backgroundColor: party.color || "#888" }}
              >
                {party.shortName.slice(0, 3)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{party.name}</p>
                <span className="text-xs text-muted-foreground">
                  {party.shortName} &middot; {party.memberCount} membre
                  {party.memberCount > 1 ? "s" : ""}
                </span>
              </div>
              <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
            </button>
          ))}
          {activeOnly && (
            <button
              onClick={() => setActiveOnly(false)}
              className="w-full p-3 text-sm text-primary hover:bg-muted transition-colors border-t text-center"
            >
              Rechercher parmi tous les partis
            </button>
          )}
        </div>
      )}

      {isOpen && query.length >= 2 && results.length === 0 && !isLoading && (
        <div className="absolute z-10 w-full mt-1 bg-background border rounded-lg shadow-lg p-4 text-center text-muted-foreground">
          <p>Aucun résultat pour &quot;{query}&quot;</p>
          {activeOnly && (
            <button
              onClick={() => setActiveOnly(false)}
              className="mt-2 text-sm text-primary hover:underline"
            >
              Rechercher parmi tous les partis
            </button>
          )}
        </div>
      )}
    </div>
  );
}
