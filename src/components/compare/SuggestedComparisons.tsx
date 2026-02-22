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
    leftSlug: "jean-luc-melenchon",
    leftName: "Jean-Luc Mélenchon",
    rightSlug: "marine-le-pen",
    rightName: "Marine Le Pen",
  },
  {
    leftSlug: "jordan-bardella",
    leftName: "Jordan Bardella",
    rightSlug: "mathilde-panot",
    rightName: "Mathilde Panot",
  },
  {
    leftSlug: "emmanuel-macron",
    leftName: "Emmanuel Macron",
    rightSlug: "jean-luc-melenchon",
    rightName: "Jean-Luc Mélenchon",
  },
];

const PARTY_SUGGESTIONS: Suggestion[] = [
  {
    leftSlug: "la-france-insoumise",
    leftName: "La France Insoumise",
    rightSlug: "rassemblement-national",
    rightName: "Rassemblement National",
  },
  {
    leftSlug: "renaissance",
    leftName: "Renaissance",
    rightSlug: "rassemblement-national",
    rightName: "Rassemblement National",
  },
  {
    leftSlug: "socialistes-et-apparentes",
    leftName: "Parti Socialiste",
    rightSlug: "les-republicains",
    rightName: "Les Républicains",
  },
  {
    leftSlug: "ecologiste-et-social",
    leftName: "Écologistes",
    rightSlug: "rassemblement-national",
    rightName: "Rassemblement National",
  },
];

interface SuggestedComparisonsProps {
  mode: "politiciens" | "partis";
}

export function SuggestedComparisons({ mode }: SuggestedComparisonsProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>(
    mode === "partis" ? PARTY_SUGGESTIONS : FALLBACK_SUGGESTIONS
  );
  const [isLoading, setIsLoading] = useState(true);

  /* eslint-disable react-hooks/set-state-in-effect -- data fetching effect */
  useEffect(() => {
    setIsLoading(true);
    const url =
      mode === "partis" ? "/api/compare/suggestions?mode=partis" : "/api/compare/suggestions";

    fetch(url)
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
  /* eslint-enable react-hooks/set-state-in-effect */

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
