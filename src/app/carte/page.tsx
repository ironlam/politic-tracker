import { Metadata } from "next";
import { CarteClient } from "./CarteClient";
import { getElectionMapData } from "@/services/electionMap";

export const metadata: Metadata = {
  title: "Carte des Résultats Électoraux | Poligraph",
  description:
    "Carte interactive des résultats électoraux par département. Visualisez la répartition politique des sièges aux législatives 2024 en France métropolitaine et outre-mer.",
  openGraph: {
    title: "Carte des Résultats Électoraux | Poligraph",
    description:
      "Carte interactive des résultats électoraux par département. Visualisez la répartition politique des sièges aux législatives 2024.",
    type: "website",
  },
};

export default async function CartePage() {
  const { departments, totalSeats } = await getElectionMapData();

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Carte des Résultats Électoraux</h1>
        <p className="text-muted-foreground">
          Visualisez les résultats des législatives 2024 par département. Cliquez sur un département
          pour voir les détails.
        </p>
      </div>

      <CarteClient initialDepartments={departments} totalSeats={totalSeats} />
    </div>
  );
}
