"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X, User } from "lucide-react";
import Image from "next/image";

interface Politician {
  id: string;
  slug: string;
  fullName: string;
  photoUrl: string | null;
  currentParty: {
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
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Search politicians
  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }

    const controller = new AbortController();
    const fetchResults = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/politiques/search?q=${encodeURIComponent(query)}&limit=8`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Search failed");
        const data = await response.json();
        // Filter out the other selected politician
        setResults(data.results.filter((p: Politician) => p.id !== otherPoliticianId));
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          console.error("Search error:", error);
        }
      } finally {
        setIsLoading(false);
      }
    };

    const timeout = setTimeout(fetchResults, 200);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [query, otherPoliticianId]);

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

  const selectPolitician = (politician: Politician) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set(position, politician.slug);
    router.push(`/comparer?${params.toString()}`);
    setQuery("");
    setIsOpen(false);
  };

  const clearSelection = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete(position);
    router.push(`/comparer?${params.toString()}`);
  };

  if (selectedPolitician) {
    return (
      <div className="bg-muted rounded-lg p-4">
        <div className="flex items-center gap-4">
          <div className="relative h-16 w-16 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
            {selectedPolitician.photoUrl ? (
              <Image
                src={selectedPolitician.photoUrl}
                alt={selectedPolitician.fullName}
                fill
                className="object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <User className="h-8 w-8 text-gray-400" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg truncate">{selectedPolitician.fullName}</h3>
            {selectedPolitician.currentParty && (
              <span
                className="inline-block px-2 py-0.5 rounded text-xs font-medium text-white"
                style={{ backgroundColor: selectedPolitician.currentParty.color || "#888" }}
              >
                {selectedPolitician.currentParty.shortName}
              </span>
            )}
            {selectedPolitician.currentMandate && (
              <p className="text-sm text-muted-foreground mt-1">{selectedPolitician.currentMandate}</p>
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
          placeholder="Rechercher un politique..."
          className="w-full pl-10 pr-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
        />
        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        )}
      </div>

      {isOpen && results.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-background border rounded-lg shadow-lg max-h-80 overflow-auto">
          {results.map((politician) => (
            <button
              key={politician.id}
              onClick={() => selectPolitician(politician)}
              className="w-full flex items-center gap-3 p-3 hover:bg-muted transition-colors text-left"
            >
              <div className="relative h-10 w-10 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
                {politician.photoUrl ? (
                  <Image
                    src={politician.photoUrl}
                    alt={politician.fullName}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <User className="h-5 w-5 text-gray-400" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{politician.fullName}</p>
                {politician.currentParty && (
                  <span className="text-xs text-muted-foreground">
                    {politician.currentParty.shortName}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {isOpen && query.length >= 2 && results.length === 0 && !isLoading && (
        <div className="absolute z-10 w-full mt-1 bg-background border rounded-lg shadow-lg p-4 text-center text-muted-foreground">
          Aucun résultat pour &quot;{query}&quot;
        </div>
      )}
    </div>
  );
}
