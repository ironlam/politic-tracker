import { Metadata } from "next";
import { Suspense } from "react";
import { AdvancedSearchClient } from "./AdvancedSearchClient";

export const metadata: Metadata = {
  title: "Recherche avancée",
  description: "Recherche avancée de représentants politiques avec filtres multiples",
};

function SearchLoading() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-10 bg-muted rounded-md w-full" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-10 bg-muted rounded-md" />
        ))}
      </div>
    </div>
  );
}

export default function RecherchePage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Recherche avancée</h1>
        <p className="text-muted-foreground">
          Trouvez des représentants politiques avec des critères précis
        </p>
      </div>

      <Suspense fallback={<SearchLoading />}>
        <AdvancedSearchClient />
      </Suspense>
    </div>
  );
}
