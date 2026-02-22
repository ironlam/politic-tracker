import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { toCSV, formatDateForCSV, createCSVResponse } from "@/lib/csv";
import { MANDATE_TYPE_LABELS } from "@/config/labels";
import type { MandateType } from "@/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  // Optional filters
  const partyId = searchParams.get("partyId");
  const mandateType = searchParams.get("mandateType") as MandateType | null;
  const hasAffairs = searchParams.get("hasAffairs") === "true";
  const activeOnly = searchParams.get("activeOnly") !== "false"; // Default true

  // Build where clause
  const where: Record<string, unknown> = {};

  if (partyId) {
    where.currentPartyId = partyId;
  }

  if (mandateType) {
    where.mandates = {
      some: {
        type: mandateType,
        ...(activeOnly && { isCurrent: true }),
      },
    };
  } else if (activeOnly) {
    where.mandates = {
      some: { isCurrent: true },
    };
  }

  if (hasAffairs) {
    where.affairs = { some: { publicationStatus: "PUBLISHED" } };
  }

  // Fetch politicians with current mandate and party
  const politicians = await db.politician.findMany({
    where,
    include: {
      currentParty: true,
      mandates: {
        where: activeOnly ? { isCurrent: true } : undefined,
        orderBy: { startDate: "desc" },
        take: 1,
      },
      _count: { select: { affairs: { where: { publicationStatus: "PUBLISHED" } } } },
    },
    orderBy: { lastName: "asc" },
  });

  // Transform to flat structure for CSV
  const data = politicians.map((p) => ({
    id: p.id,
    slug: p.slug,
    civility: p.civility || "",
    firstName: p.firstName,
    lastName: p.lastName,
    fullName: p.fullName,
    birthDate: formatDateForCSV(p.birthDate),
    birthPlace: p.birthPlace || "",
    deathDate: formatDateForCSV(p.deathDate),
    partyName: p.currentParty?.name || "",
    partyShortName: p.currentParty?.shortName || "",
    currentMandate: p.mandates[0] ? MANDATE_TYPE_LABELS[p.mandates[0].type] : "",
    constituency: p.mandates[0]?.constituency || "",
    affairsCount: p._count.affairs,
    photoUrl: p.photoUrl || "",
    profileUrl: `${process.env.NEXT_PUBLIC_SITE_URL || "https://poligraph.fr"}/politiques/${p.slug}`,
  }));

  const columns = [
    { key: "id" as const, header: "ID" },
    { key: "slug" as const, header: "Slug" },
    { key: "civility" as const, header: "Civilite" },
    { key: "firstName" as const, header: "Prenom" },
    { key: "lastName" as const, header: "Nom" },
    { key: "fullName" as const, header: "Nom Complet" },
    { key: "birthDate" as const, header: "Date Naissance" },
    { key: "birthPlace" as const, header: "Lieu Naissance" },
    { key: "deathDate" as const, header: "Date Deces" },
    { key: "partyName" as const, header: "Parti" },
    { key: "partyShortName" as const, header: "Parti (abrege)" },
    { key: "currentMandate" as const, header: "Mandat Actuel" },
    { key: "constituency" as const, header: "Circonscription" },
    { key: "affairsCount" as const, header: "Nombre Affaires" },
    { key: "photoUrl" as const, header: "Photo URL" },
    { key: "profileUrl" as const, header: "Profil URL" },
  ];

  const csv = toCSV(data, columns);
  const filename = `politiques-${new Date().toISOString().split("T")[0]}.csv`;

  return createCSVResponse(csv, filename);
}
