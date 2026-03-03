import { Metadata } from "next";
import { Suspense } from "react";
import { SearchClient } from "./SearchClient";

interface Props {
  searchParams: Promise<{ q?: string }>;
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { q } = await searchParams;
  const title = q ? `${q} — Recherche` : "Recherche";
  return {
    title,
    description:
      "Recherche globale : représentants politiques, partis, affaires judiciaires et votes parlementaires.",
    robots: { index: true, follow: true },
  };
}

function SearchLoading() {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="h-14 bg-muted rounded-2xl animate-pulse" />
    </div>
  );
}

export default function RecherchePage() {
  return (
    <div className="container mx-auto px-4 py-10">
      <h1 className="text-3xl font-display font-extrabold tracking-tight mb-8 max-w-2xl mx-auto">
        Recherche
      </h1>
      <Suspense fallback={<SearchLoading />}>
        <SearchClient />
      </Suspense>
    </div>
  );
}
