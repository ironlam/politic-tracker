import { Metadata } from "next";
import { AdvancedSearchClient } from "./AdvancedSearchClient";

export const metadata: Metadata = {
  title: "Recherche avancée",
  description: "Recherche avancée de représentants politiques avec filtres multiples",
};

export default function RecherchePage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Recherche avancée</h1>
        <p className="text-muted-foreground">
          Trouvez des représentants politiques avec des critères précis
        </p>
      </div>

      <AdvancedSearchClient />
    </div>
  );
}
