"use client";

import Link from "next/link";

interface Suggestion {
  leftSlug: string;
  leftName: string;
  rightSlug: string;
  rightName: string;
}

const POLITICIAN_SUGGESTIONS: Suggestion[] = [
  {
    leftSlug: "emmanuel-macron",
    leftName: "Emmanuel Macron",
    rightSlug: "jordan-bardella",
    rightName: "Jordan Bardella",
  },
  {
    leftSlug: "gabriel-attal",
    leftName: "Gabriel Attal",
    rightSlug: "mathilde-panot",
    rightName: "Mathilde Panot",
  },
  {
    leftSlug: "marine-le-pen",
    leftName: "Marine Le Pen",
    rightSlug: "francois-ruffin",
    rightName: "François Ruffin",
  },
  {
    leftSlug: "gerald-darmanin",
    leftName: "Gérald Darmanin",
    rightSlug: "manuel-bompard",
    rightName: "Manuel Bompard",
  },
  {
    leftSlug: "yael-braun-pivet",
    leftName: "Yaël Braun-Pivet",
    rightSlug: "eric-ciotti",
    rightName: "Éric Ciotti",
  },
  {
    leftSlug: "bruno-retailleau",
    leftName: "Bruno Retailleau",
    rightSlug: "francois-hollande",
    rightName: "François Hollande",
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
  const suggestions = mode === "partis" ? PARTY_SUGGESTIONS : POLITICIAN_SUGGESTIONS;

  return (
    <div className="py-8">
      <h2 className="text-lg font-semibold text-center mb-6">Comparaisons populaires</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
        {suggestions.map((s) => {
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
