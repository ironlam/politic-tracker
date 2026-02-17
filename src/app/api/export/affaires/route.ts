import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { toCSV, formatDateForCSV, createCSVResponse } from "@/lib/csv";
import { AFFAIR_STATUS_LABELS, AFFAIR_CATEGORY_LABELS } from "@/config/labels";
import type { AffairStatus, AffairCategory } from "@/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  // Optional filters
  const status = searchParams.get("status") as AffairStatus | null;
  const category = searchParams.get("category") as AffairCategory | null;
  const politicianId = searchParams.get("politicianId");
  const limit = Math.min(parseInt(searchParams.get("limit") || "10000", 10), 50000);

  // Build where clause
  const where: Record<string, unknown> = {
    publicationStatus: "PUBLISHED",
  };

  if (status) {
    where.status = status;
  }

  if (category) {
    where.category = category;
  }

  if (politicianId) {
    where.politicianId = politicianId;
  }

  // Fetch affairs with politician and sources
  const affairs = await db.affair.findMany({
    where,
    include: {
      politician: {
        select: {
          id: true,
          slug: true,
          fullName: true,
          currentParty: { select: { shortName: true } },
        },
      },
      partyAtTime: { select: { shortName: true } },
      sources: { take: 1 },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  // Transform to flat structure for CSV
  const data = affairs.map((a) => ({
    id: a.id,
    slug: a.slug,
    title: a.title,
    politicianName: a.politician.fullName,
    politicianSlug: a.politician.slug,
    currentParty: a.politician.currentParty?.shortName || "",
    partyAtTime: a.partyAtTime?.shortName || "",
    status: AFFAIR_STATUS_LABELS[a.status],
    category: AFFAIR_CATEGORY_LABELS[a.category],
    factsDate: formatDateForCSV(a.factsDate),
    startDate: formatDateForCSV(a.startDate),
    verdictDate: formatDateForCSV(a.verdictDate),
    sentence: a.sentence || "",
    description: a.description.substring(0, 500), // Truncate for CSV
    sourceUrl: a.sources[0]?.url || "",
    sourceTitle: a.sources[0]?.title || "",
    pageUrl: `https://politic-tracker.vercel.app/affaires/${a.slug}`,
  }));

  const columns = [
    { key: "id" as const, header: "ID" },
    { key: "slug" as const, header: "Slug" },
    { key: "title" as const, header: "Titre" },
    { key: "politicianName" as const, header: "Politique" },
    { key: "politicianSlug" as const, header: "Politique Slug" },
    { key: "currentParty" as const, header: "Parti Actuel" },
    { key: "partyAtTime" as const, header: "Parti au Moment" },
    { key: "status" as const, header: "Statut" },
    { key: "category" as const, header: "Categorie" },
    { key: "factsDate" as const, header: "Date des Faits" },
    { key: "startDate" as const, header: "Date de Debut" },
    { key: "verdictDate" as const, header: "Date du Verdict" },
    { key: "sentence" as const, header: "Peine" },
    { key: "description" as const, header: "Description" },
    { key: "sourceUrl" as const, header: "Source URL" },
    { key: "sourceTitle" as const, header: "Source Titre" },
    { key: "pageUrl" as const, header: "Page URL" },
  ];

  const csv = toCSV(data, columns);
  const filename = `affaires-${new Date().toISOString().split("T")[0]}.csv`;

  return createCSVResponse(csv, filename);
}
