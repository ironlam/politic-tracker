"use client";

import { useState, useEffect, useRef, useCallback, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { PoliticianAvatar } from "@/components/politicians/PoliticianAvatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useSearchIndex } from "@/hooks";

interface Politician {
  id: string;
  slug: string;
  fullName: string;
  photoUrl: string | null;
  currentParty: {
    name: string;
    shortName: string;
    color: string | null;
  } | null;
  currentMandate?: string;
}

interface PoliticianSelectorProps {
  position: "left" | "right";
  selectedPolitician?: Politician | null;
  otherPoliticianId?: string;
}

export function PoliticianSelector({
  position,
  selectedPolitician,
  otherPoliticianId,
}: PoliticianSelectorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Politician[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [activeOnly, setActiveOnly] = useState(true);
  const [isPending, startTransition] = useTransition();
  const { isReady, searchPoliticians } = useSearchIndex();
  const [isNavigating, setIsNavigating] = useState(false);

  // Reset isNavigating when transition completes or data arrives
  useEffect(() => {
    if (isNavigating && (!isPending || selectedPolitician)) {
      setIsNavigating(false);
    }
  }, [isPending, isNavigating, selectedPolitician]);

  // Listen for navigation events from SuggestedComparisons
  useEffect(() => {
    const handler = () => setIsNavigating(true);
    window.addEventListener("compare-navigating", handler);
    return () => window.removeEventListener("compare-navigating", handler);
  }, []);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Search politicians — client-side when index ready, API fallback otherwise
  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      setActiveIndex(-1);
      return;
    }

    if (isReady) {
      // Instant client-side search
      const otherSlug = searchParams.get(position === "left" ? "right" : "left");
      let matches = searchPoliticians(query, otherSlug || undefined);
      // Apply activeOnly filter: politicians with a current mandate have mandateType set
      if (activeOnly) {
        matches = matches.filter((p) => p.mandateType !== null);
      }
      // Map to component's expected format
      const mapped = matches.map((p) => ({
        id: p.slug, // Use slug as ID for client-side results
        slug: p.slug,
        fullName: p.fullName,
        photoUrl: p.photoUrl,
        currentParty: p.partyShortName
          ? { name: p.partyShortName, shortName: p.partyShortName, color: p.partyColor }
          : null,
        currentMandate: p.mandateType || undefined,
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
        const activeParam = activeOnly ? "&active=true" : "";
        const response = await fetch(
          `/api/search/politicians?q=${encodeURIComponent(query)}${activeParam}`,
          { signal: controller.signal }
        );
        if (!response.ok) throw new Error("Search failed");
        const data = await response.json();
        const mapped = data
          .filter((p: { id: string }) => p.id !== otherPoliticianId)
          .map(
            (p: {
              id: string;
              slug: string;
              fullName: string;
              photoUrl: string | null;
              party: string | null;
              partyName: string | null;
              partyColor: string | null;
              mandate: string | null;
            }) => ({
              id: p.id,
              slug: p.slug,
              fullName: p.fullName,
              photoUrl: p.photoUrl,
              currentParty: p.party
                ? { name: p.partyName || p.party, shortName: p.party, color: p.partyColor }
                : null,
              currentMandate: p.mandate,
            })
          );
        setResults(mapped);
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
  }, [query, otherPoliticianId, activeOnly, isReady, searchPoliticians, searchParams, position]);

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

  const selectPolitician = useCallback(
    (politician: Politician) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set(position, politician.slug);
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
            selectPolitician(results[activeIndex]);
          }
          break;
        case "Escape":
          setIsOpen(false);
          setActiveIndex(-1);
          break;
      }
    },
    [isOpen, results, activeIndex, selectPolitician]
  );

  // Scroll active item into view
  useEffect(() => {
    if (activeIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll("[data-result-item]");
      items[activeIndex]?.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex]);

  if ((isPending || isNavigating) && !selectedPolitician) {
    return (
      <div className="bg-muted rounded-lg p-4 animate-in fade-in-0 duration-200">
        <div className="flex items-center gap-4">
          <Skeleton className="h-12 w-12 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      </div>
    );
  }

  if (selectedPolitician) {
    return (
      <div className="bg-muted rounded-lg p-4 animate-in fade-in-0 duration-300">
        <div className="flex items-center gap-4">
          <PoliticianAvatar
            photoUrl={selectedPolitician.photoUrl}
            fullName={selectedPolitician.fullName}
            size="lg"
          />
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg truncate">{selectedPolitician.fullName}</h3>
            {selectedPolitician.currentParty && (
              <span
                className="inline-block px-2 py-0.5 rounded text-xs font-medium text-white"
                title={selectedPolitician.currentParty.name}
                style={{ backgroundColor: selectedPolitician.currentParty.color || "#888" }}
              >
                {selectedPolitician.currentParty.shortName}
              </span>
            )}
            {selectedPolitician.currentMandate && (
              <p className="text-sm text-muted-foreground mt-1">
                {selectedPolitician.currentMandate}
              </p>
            )}
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
          placeholder="Rechercher un politique..."
          className="w-full pl-10 pr-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          role="combobox"
          aria-expanded={isOpen && results.length > 0}
          aria-controls="search-results"
          aria-activedescendant={activeIndex >= 0 ? `result-${activeIndex}` : undefined}
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
          id="search-results"
          role="listbox"
          className="absolute z-10 w-full mt-1 bg-background border rounded-lg shadow-lg max-h-80 overflow-auto"
        >
          {results.map((politician, index) => (
            <button
              key={politician.id}
              id={`result-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              data-result-item
              onClick={() => selectPolitician(politician)}
              className={`w-full flex items-center gap-3 p-3 transition-colors text-left ${
                index === activeIndex ? "bg-accent" : "hover:bg-muted"
              }`}
            >
              <PoliticianAvatar
                photoUrl={politician.photoUrl}
                fullName={politician.fullName}
                size="sm"
              />
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{politician.fullName}</p>
                {politician.currentParty && (
                  <span
                    className="text-xs text-muted-foreground"
                    title={politician.currentParty.name}
                  >
                    {politician.currentParty.shortName}
                  </span>
                )}
              </div>
            </button>
          ))}
          {activeOnly && (
            <button
              onClick={() => setActiveOnly(false)}
              className="w-full p-3 text-sm text-primary hover:bg-muted transition-colors border-t text-center"
            >
              Rechercher parmi tous les représentants
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
              Rechercher parmi tous les représentants
            </button>
          )}
        </div>
      )}
    </div>
  );
}
