import { Metadata } from "next";
import { WatchlistContent } from "./WatchlistContent";

export const metadata: Metadata = {
  title: "Mon Observatoire",
  description:
    "Suivez l'activité de vos représentants et partis politiques : votes, actualités presse, affaires judiciaires. Votre tableau de bord civique personnalisé.",
  alternates: { canonical: "/mon-observatoire" },
};

export default function MonObservatoirePage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-display font-extrabold tracking-tight mb-1">Mon Observatoire</h1>
      <WatchlistContent />
    </div>
  );
}
