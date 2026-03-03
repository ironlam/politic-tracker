import { Metadata } from "next";
import { WatchlistContent } from "./WatchlistContent";

export const metadata: Metadata = {
  title: "Mon Observatoire",
  description: "Suivez l'activité de vos représentants : votes, presse, affaires judiciaires.",
  alternates: { canonical: "/mon-observatoire" },
};

export default function MonObservatoirePage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-display font-extrabold tracking-tight mb-1">
          Mon Observatoire
        </h1>
        <p className="text-sm text-muted-foreground">
          Suivez l{"'"}activité récente des représentants que vous avez ajoutés à votre liste.
        </p>
      </div>
      <WatchlistContent />
    </div>
  );
}
