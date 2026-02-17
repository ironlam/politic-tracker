"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";

interface Suggestion {
  leftSlug: string;
  leftName: string;
  rightSlug: string;
  rightName: string;
}

// Fallback for when API is unavailable
const FALLBACK_SUGGESTIONS: Suggestion[] = [
  {
    leftSlug: "emmanuel-macron",
    leftName: "Emmanuel Macron",
    rightSlug: "jordan-bardella",
    rightName: "Jordan Bardella",
  },
  {
    leftSlug: "marine-le-pen",
    leftName: "Marine Le Pen",
    rightSlug: "jean-luc-melenchon",
    rightName: "Jean-Luc Mélenchon",
  },
  {
    leftSlug: "gabriel-attal",
    leftName: "Gabriel Attal",
    rightSlug: "mathilde-panot",
    rightName: "Mathilde Panot",
  },
];

const PARTY_SUGGESTIONS: Suggestion[] = [
  {
    leftSlug: "renaissance",
    leftName: "Renaissance",
    rightSlug: "rassemblement-national",
    rightName: "Rassemblement National",
  },
  {
    leftSlug: "la-france-insoumise",
    leftName: "La France Insoumise",
    rightSlug: "les-republicains",
    rightName: "Les Républicains",
  },
  {
    leftSlug: "socialistes-et-apparentes",
    leftName: "Parti Socialiste",
    rightSlug: "renaissance",
    rightName: "Renaissance",
  },
  {
    leftSlug: "rassemblement-national",
    leftName: "Rassemblement National",
    rightSlug: "les-republicains",
    rightName: "Les Républicains",
  },
];

interface SuggestedComparisonsProps {
  mode: "politiciens" | "partis";
}

export function SuggestedComparisons({ mode }: SuggestedComparisonsProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>(
    mode === "partis" ? PARTY_SUGGESTIONS : FALLBACK_SUGGESTIONS
  );
  const [isLoading, setIsLoading] = useState(mode === "politiciens");

  useEffect(() => {
    if (mode !== "politiciens") return;

    setIsLoading(true);
    fetch("/api/compare/suggestions")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.length > 0) {
          setSuggestions(data);
        }
      })
      .catch(() => {
        // Keep fallback
      })
      .finally(() => setIsLoading(false));
  }, [mode]);

  return (
    <div className="py-8">
      <h2 className="text-lg font-semibold text-center mb-6">Comparaisons populaires</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
        {isLoading
          ? [...Array(3)].map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)
          : suggestions.map((s) => {
              const href =
                mode === "partis"
                  ? `/comparer?left=${s.leftSlug}&right=${s.rightSlug}&mode=partis`
                  : `/comparer?left=${s.leftSlug}&right=${s.rightSlug}`;

              return (
                <Link
                  key={`${s.leftSlug}-${s.rightSlug}`}
                  href={href}
                  className="flex items-center justify-center gap-3 rounded-lg border bg-card p-4 text-sm transition-all hover:shadow-md hover:border-primary/20"
                >
                  <span className="font-medium text-right flex-1 truncate">{s.leftName}</span>
                  <span className="text-muted-foreground font-bold text-xs shrink-0">VS</span>
                  <span className="font-medium text-left flex-1 truncate">{s.rightName}</span>
                </Link>
              );
            })}
      </div>
    </div>
  );
}
