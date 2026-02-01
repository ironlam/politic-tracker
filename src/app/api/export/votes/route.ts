import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { toCSV, formatDateForCSV, createCSVResponse } from "@/lib/csv";
import { VOTING_RESULT_LABELS, CHAMBER_LABELS } from "@/config/labels";
import type { VotingResult, Chamber } from "@/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  // Optional filters
  const chamber = searchParams.get("chamber") as Chamber | null;
  const result = searchParams.get("result") as VotingResult | null;
  const legislature = searchParams.get("legislature");
  const limit = Math.min(parseInt(searchParams.get("limit") || "10000", 10), 50000);

  // Build where clause
  const where: Record<string, unknown> = {};

  if (chamber) {
    where.chamber = chamber;
  }

  if (result) {
    where.result = result;
  }

  if (legislature) {
    where.legislature = parseInt(legislature, 10);
  }

  // Fetch scrutins
  const scrutins = await db.scrutin.findMany({
    where,
    orderBy: { votingDate: "desc" },
    take: limit,
  });

  // Transform to flat structure for CSV
  const data = scrutins.map((s) => ({
    id: s.id,
    externalId: s.externalId,
    slug: s.slug || "",
    title: s.title,
    votingDate: formatDateForCSV(s.votingDate),
    legislature: s.legislature,
    chamber: CHAMBER_LABELS[s.chamber] || s.chamber,
    votesFor: s.votesFor,
    votesAgainst: s.votesAgainst,
    votesAbstain: s.votesAbstain,
    totalVotes: s.votesFor + s.votesAgainst + s.votesAbstain,
    result: VOTING_RESULT_LABELS[s.result],
    sourceUrl: s.sourceUrl || "",
    pageUrl: `https://politic-tracker.vercel.app/votes/${s.slug || s.id}`,
  }));

  const columns = [
    { key: "id" as const, header: "ID" },
    { key: "externalId" as const, header: "ID Externe" },
    { key: "slug" as const, header: "Slug" },
    { key: "title" as const, header: "Titre" },
    { key: "votingDate" as const, header: "Date du Vote" },
    { key: "legislature" as const, header: "Legislature" },
    { key: "chamber" as const, header: "Chambre" },
    { key: "votesFor" as const, header: "Pour" },
    { key: "votesAgainst" as const, header: "Contre" },
    { key: "votesAbstain" as const, header: "Abstention" },
    { key: "totalVotes" as const, header: "Total Votants" },
    { key: "result" as const, header: "Resultat" },
    { key: "sourceUrl" as const, header: "Source URL" },
    { key: "pageUrl" as const, header: "Page URL" },
  ];

  const csv = toCSV(data, columns);
  const filename = `votes-${chamber ? chamber.toLowerCase() + "-" : ""}${new Date().toISOString().split("T")[0]}.csv`;

  return createCSVResponse(csv, filename);
}
