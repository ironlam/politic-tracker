import { Metadata } from "next";
import { DailyVotesPage } from "@/components/votes/DailyVotesPage";
import { getParisToday } from "@/lib/data/votes";

export const revalidate = 300; // ISR 5 min

export async function generateMetadata(): Promise<Metadata> {
  const today = getParisToday();
  const formatted = new Date(today + "T00:00:00Z").toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  return {
    title: `Votes du jour — ${formatted}`,
    description: `Scrutins de l'Assemblée nationale et du Sénat du ${formatted}. Résultats, résumés et détails des votes parlementaires.`,
    alternates: { canonical: "/votes/aujourd-hui" },
  };
}

export default async function AujourdhuiPage() {
  const today = getParisToday();
  return <DailyVotesPage date={today} isToday />;
}
