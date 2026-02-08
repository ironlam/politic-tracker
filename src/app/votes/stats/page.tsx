import { redirect } from "next/navigation";

interface PageProps {
  searchParams: Promise<{
    chamber?: string;
  }>;
}

export default async function VoteStatsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const chamber = params.chamber;
  const url = chamber
    ? `/statistiques?tab=votes&chamber=${chamber}`
    : "/statistiques?tab=votes";
  redirect(url);
}
