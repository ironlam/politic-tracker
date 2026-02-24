import { Metadata } from "next";
import Link from "next/link";
import { cacheTag, cacheLife } from "next/cache";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExportButton } from "@/components/ui/ExportButton";
import {
  AFFAIR_STATUS_LABELS,
  AFFAIR_STATUS_COLORS,
  AFFAIR_CATEGORY_LABELS,
  AFFAIR_STATUS_NEEDS_PRESUMPTION,
  AFFAIR_SUPER_CATEGORY_LABELS,
  AFFAIR_SUPER_CATEGORY_COLORS,
  AFFAIR_SUPER_CATEGORY_DESCRIPTIONS,
  CATEGORY_TO_SUPER,
  getCategoriesForSuper,
  INVOLVEMENT_LABELS,
  INVOLVEMENT_COLORS,
  INVOLVEMENT_GROUP_LABELS,
  INVOLVEMENT_GROUP_COLORS,
  involvementsFromGroups,
  AFFAIR_SEVERITY_LABELS,
  AFFAIR_SEVERITY_COLORS,
  AFFAIR_SEVERITY_EDITORIAL,
  type InvolvementGroup,
  type AffairSuperCategory,
} from "@/config/labels";
import type { AffairStatus, AffairCategory, AffairSeverity, Involvement } from "@/types";

export const revalidate = 300; // 5 minutes — CDN edge cache with ISR

interface PageProps {
  searchParams: Promise<{
    status?: string;
    supercat?: string;
    category?: string;
    severity?: string;
    page?: string;
    involvement?: string;
    parti?: string;
  }>;
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const params = await searchParams;
  const partiSlug = params.parti || "";
  const statusKey = params.status || "";
  const superCatKey = (params.supercat || "") as AffairSuperCategory | "";

  let title = "Affaires judiciaires des responsables politiques français";
  let description =
    "Liste des affaires judiciaires impliquant des responsables politiques français. Sources vérifiées, présomption d'innocence respectée.";

  if (partiSlug) {
    const party = await db.party.findUnique({
      where: { slug: partiSlug },
      select: { name: true, shortName: true },
    });
    if (party) {
      title = `Affaires judiciaires — ${party.name} (${party.shortName})`;
      description = `Affaires judiciaires impliquant des élus ${party.name}. Filtrez par statut et catégorie. Sources vérifiées.`;
    }
  } else if (statusKey && AFFAIR_STATUS_LABELS[statusKey as AffairStatus]) {
    title = `Affaires judiciaires : ${AFFAIR_STATUS_LABELS[statusKey as AffairStatus]}`;
    description = `Responsables politiques français avec une affaire au statut "${AFFAIR_STATUS_LABELS[statusKey as AffairStatus]}".`;
  } else if (superCatKey && AFFAIR_SUPER_CATEGORY_LABELS[superCatKey]) {
    title = `Affaires judiciaires : ${AFFAIR_SUPER_CATEGORY_LABELS[superCatKey]}`;
    description = `${AFFAIR_SUPER_CATEGORY_DESCRIPTIONS[superCatKey]}. Liste des responsables politiques concernés.`;
  }

  return {
    title,
    description,
    openGraph: {
      title: `${title} | Poligraph`,
      description,
    },
  };
}

async function getPartiesWithAffairs() {
  "use cache";
  cacheTag("affairs", "parties");
  cacheLife("hours");

  const parties = await db.party.findMany({
    where: {
      affairsAtTime: {
        some: { publicationStatus: "PUBLISHED" },
      },
      slug: { not: null },
    },
    select: {
      slug: true,
      shortName: true,
      name: true,
      color: true,
      _count: {
        select: { affairsAtTime: { where: { publicationStatus: "PUBLISHED" } } },
      },
    },
    orderBy: { shortName: "asc" },
  });

  return parties;
}

async function getAffairs(
  status?: string,
  superCategory?: AffairSuperCategory,
  category?: string,
  severity?: AffairSeverity,
  page = 1,
  involvements: Involvement[] = ["DIRECT"],
  partySlug?: string
) {
  "use cache";
  cacheTag("affairs");
  cacheLife("minutes");

  const limit = 20;
  const skip = (page - 1) * limit;

  // Build category filter based on super-category or specific category
  let categoryFilter: AffairCategory[] | undefined;
  if (category) {
    categoryFilter = [category as AffairCategory];
  } else if (superCategory) {
    categoryFilter = getCategoriesForSuper(superCategory);
  }

  const where = {
    publicationStatus: "PUBLISHED" as const,
    involvement: { in: involvements },
    ...(status && { status: status as AffairStatus }),
    ...(categoryFilter && { category: { in: categoryFilter } }),
    ...(severity && { severity }),
    ...(partySlug && { partyAtTime: { slug: partySlug } }),
  };

  const [affairs, total] = await Promise.all([
    db.affair.findMany({
      where,
      include: {
        politician: {
          select: { id: true, fullName: true, slug: true, currentParty: true },
        },
        partyAtTime: {
          select: { id: true, slug: true, shortName: true, name: true, color: true },
        },
        sources: { select: { id: true }, take: 1 },
      },
      // Order by severity (CRITIQUE first), then most relevant date
      orderBy: [
        { severity: "asc" },
        { verdictDate: { sort: "desc", nulls: "last" } },
        { startDate: { sort: "desc", nulls: "last" } },
        { createdAt: "desc" },
      ],
      skip,
      take: limit,
    }),
    db.affair.count({ where }),
  ]);

  return {
    affairs,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

async function getSuperCategoryCounts() {
  "use cache";
  cacheTag("affairs");
  cacheLife("minutes");

  const categoryCounts = await db.affair.groupBy({
    by: ["category"],
    where: { publicationStatus: "PUBLISHED", involvement: "DIRECT" },
    _count: { category: true },
  });

  // Aggregate by super-category
  const superCounts: Record<string, number> = {
    PROBITE: 0,
    FINANCES: 0,
    PERSONNES: 0,
    EXPRESSION: 0,
    AUTRE: 0,
  };

  for (const { category, _count } of categoryCounts) {
    const superCat = CATEGORY_TO_SUPER[category as AffairCategory];
    if (superCat) {
      superCounts[superCat] += _count.category;
    }
  }

  return superCounts;
}

async function getStatusCounts() {
  "use cache";
  cacheTag("affairs");
  cacheLife("minutes");

  const statusCounts = await db.affair.groupBy({
    by: ["status"],
    where: { publicationStatus: "PUBLISHED", involvement: "DIRECT" },
    _count: { status: true },
  });

  return Object.fromEntries(statusCounts.map((s) => [s.status, s._count.status]));
}

async function getSeverityCounts() {
  "use cache";
  cacheTag("affairs");
  cacheLife("minutes");

  const severityCounts = await db.affair.groupBy({
    by: ["severity"],
    where: { publicationStatus: "PUBLISHED", involvement: "DIRECT" },
    _count: { severity: true },
  });

  return Object.fromEntries(severityCounts.map((s) => [s.severity, s._count.severity])) as Record<
    string,
    number
  >;
}

export default async function AffairesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const statusFilter = params.status || "";
  const superCatFilter = (params.supercat || "") as AffairSuperCategory | "";
  const categoryFilter = params.category || "";
  const severityFilter = (params.severity || "") as AffairSeverity | "";
  const involvementFilter = params.involvement || "";
  const partiFilter = params.parti || "";
  const page = parseInt(params.page || "1", 10);

  // Parse involvement filter: group-based (mise-en-cause, victime, mentionne)
  const VALID_GROUPS: InvolvementGroup[] = ["mise-en-cause", "victime", "mentionne"];
  const activeGroups: InvolvementGroup[] = involvementFilter
    ? (involvementFilter
        .split(",")
        .filter((v) => VALID_GROUPS.includes(v as InvolvementGroup)) as InvolvementGroup[])
    : ["mise-en-cause"];
  const activeInvolvements = involvementsFromGroups(activeGroups);

  const [
    { affairs, total, totalPages },
    superCounts,
    statusCounts,
    severityCounts,
    partiesWithAffairs,
  ] = await Promise.all([
    getAffairs(
      statusFilter,
      superCatFilter || undefined,
      categoryFilter,
      severityFilter || undefined,
      page,
      activeInvolvements,
      partiFilter || undefined
    ),
    getSuperCategoryCounts(),
    getStatusCounts(),
    getSeverityCounts(),
    getPartiesWithAffairs(),
  ]);

  const totalAffairs = Object.values(superCounts).reduce((a, b) => a + b, 0);

  // Build URL helper
  function buildUrl(params: Record<string, string>) {
    const filtered = Object.entries(params).filter(([, v]) => v);
    if (filtered.length === 0) return "/affaires";
    return `/affaires?${filtered.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&")}`;
  }

  function toggleGroup(key: InvolvementGroup) {
    const current = new Set(activeGroups);
    if (current.has(key)) {
      current.delete(key);
    } else {
      current.add(key);
    }
    // If empty, reset to mise-en-cause
    if (current.size === 0) current.add("mise-en-cause");
    const inv = [...current].join(",");
    // Only include involvement param if not default (mise-en-cause only)
    const isDefault = current.size === 1 && current.has("mise-en-cause");
    return buildUrl({
      status: statusFilter,
      supercat: superCatFilter,
      severity: severityFilter,
      parti: partiFilter,
      involvement: isDefault ? "" : inv,
    });
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">Affaires judiciaires</h1>
          <p className="text-muted-foreground">
            {totalAffairs} affaire{totalAffairs !== 1 ? "s" : ""} documentée
            {totalAffairs !== 1 ? "s" : ""} avec sources vérifiables
          </p>
        </div>
        <ExportButton
          endpoint="/api/export/affaires"
          label="Export CSV"
          params={{
            status: statusFilter || undefined,
            category: categoryFilter || undefined,
          }}
        />
      </div>

      {/* Super-category cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        {(Object.keys(AFFAIR_SUPER_CATEGORY_LABELS) as AffairSuperCategory[]).map((superCat) => {
          const count = superCounts[superCat] || 0;
          const isActive = superCatFilter === superCat;
          return (
            <Link key={superCat} href={isActive ? "/affaires" : buildUrl({ supercat: superCat })}>
              <Card
                className={`cursor-pointer transition-all hover:shadow-md ${
                  isActive ? "ring-2 ring-primary" : ""
                }`}
              >
                <CardContent className="p-4">
                  <div
                    className={`text-2xl font-bold ${
                      AFFAIR_SUPER_CATEGORY_COLORS[superCat].split(" ")[1]
                    }`}
                  >
                    {count}
                  </div>
                  <div className="text-sm font-medium">
                    {AFFAIR_SUPER_CATEGORY_LABELS[superCat]}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {AFFAIR_SUPER_CATEGORY_DESCRIPTIONS[superCat]}
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Severity filter */}
      <div className="mb-6">
        <p className="text-sm font-medium mb-2">Niveau de gravité</p>
        <div className="flex flex-wrap gap-2">
          <Link
            href={buildUrl({
              status: statusFilter,
              supercat: superCatFilter,
              involvement: involvementFilter,
              parti: partiFilter,
            })}
          >
            <Badge
              variant={severityFilter === "" ? "default" : "outline"}
              className="cursor-pointer"
            >
              Tous
            </Badge>
          </Link>
          {(Object.keys(AFFAIR_SEVERITY_LABELS) as AffairSeverity[]).map((sev) => {
            const count = severityCounts[sev] || 0;
            const isActive = severityFilter === sev;
            return (
              <Link
                key={sev}
                href={buildUrl({
                  severity: isActive ? "" : sev,
                  status: statusFilter,
                  supercat: superCatFilter,
                  involvement: involvementFilter,
                  parti: partiFilter,
                })}
              >
                <Badge
                  variant={isActive ? "default" : "outline"}
                  className={`cursor-pointer ${isActive ? AFFAIR_SEVERITY_COLORS[sev] : ""}`}
                >
                  {AFFAIR_SEVERITY_EDITORIAL[sev]} ({count})
                </Badge>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Party filter */}
      <div className="mb-6">
        <p className="text-sm font-medium mb-2">Filtrer par parti</p>
        <div className="flex flex-wrap gap-2">
          <Link
            href={buildUrl({
              status: statusFilter,
              supercat: superCatFilter,
              severity: severityFilter,
              involvement: involvementFilter,
            })}
          >
            <Badge variant={partiFilter === "" ? "default" : "outline"} className="cursor-pointer">
              Tous les partis
            </Badge>
          </Link>
          {partiesWithAffairs.map((p) => {
            const isActive = partiFilter === p.slug;
            return (
              <Link
                key={p.slug}
                href={buildUrl({
                  parti: isActive ? "" : (p.slug as string),
                  status: statusFilter,
                  supercat: superCatFilter,
                  severity: severityFilter,
                  involvement: involvementFilter,
                })}
              >
                <Badge
                  variant={isActive ? "default" : "outline"}
                  className="cursor-pointer"
                  style={{
                    ...(isActive && p.color
                      ? {
                          backgroundColor: `${p.color}20`,
                          color: p.color,
                          borderColor: p.color,
                        }
                      : {}),
                  }}
                >
                  {p.shortName} ({p._count.affairsAtTime})
                </Badge>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Status filter */}
      <div className="mb-6">
        <p className="text-sm font-medium mb-2">Filtrer par statut</p>
        <div className="flex flex-wrap gap-2">
          <Link href={buildUrl({ supercat: superCatFilter, severity: severityFilter })}>
            <Badge variant={statusFilter === "" ? "default" : "outline"} className="cursor-pointer">
              Tous
            </Badge>
          </Link>
          {Object.entries(AFFAIR_STATUS_LABELS).map(([key, label]) => {
            const count = statusCounts[key] || 0;
            if (count === 0) return null;
            const isActive = statusFilter === key;
            return (
              <Link
                key={key}
                href={buildUrl({
                  status: isActive ? "" : key,
                  supercat: superCatFilter,
                  severity: severityFilter,
                })}
              >
                <Badge
                  variant={isActive ? "default" : "outline"}
                  className={`cursor-pointer ${
                    isActive ? AFFAIR_STATUS_COLORS[key as AffairStatus] : ""
                  }`}
                >
                  {label} ({count})
                </Badge>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Involvement filter — 3 groups */}
      <div className="mb-6">
        <p className="text-sm font-medium mb-2">Implication du politicien</p>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(INVOLVEMENT_GROUP_LABELS) as InvolvementGroup[]).map((group) => {
            const isActive = activeGroups.includes(group);
            return (
              <Link key={group} href={toggleGroup(group)}>
                <Badge
                  variant={isActive ? "default" : "outline"}
                  className={`cursor-pointer ${isActive ? INVOLVEMENT_GROUP_COLORS[group] : ""}`}
                >
                  {isActive ? "● " : "○ "}
                  {INVOLVEMENT_GROUP_LABELS[group]}
                </Badge>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Active filters summary */}
      {(superCatFilter || statusFilter || severityFilter || involvementFilter || partiFilter) && (
        <div className="mb-6 flex items-center gap-2 text-sm flex-wrap">
          <span className="text-muted-foreground">Filtres actifs :</span>
          {partiFilter && (
            <Badge variant="outline">
              Parti :{" "}
              {partiesWithAffairs.find((p) => p.slug === partiFilter)?.shortName || partiFilter}
            </Badge>
          )}
          {superCatFilter && (
            <Badge className={AFFAIR_SUPER_CATEGORY_COLORS[superCatFilter]}>
              {AFFAIR_SUPER_CATEGORY_LABELS[superCatFilter]}
            </Badge>
          )}
          {severityFilter && (
            <Badge className={AFFAIR_SEVERITY_COLORS[severityFilter as AffairSeverity]}>
              {AFFAIR_SEVERITY_EDITORIAL[severityFilter as AffairSeverity]}
            </Badge>
          )}
          {statusFilter && (
            <Badge className={AFFAIR_STATUS_COLORS[statusFilter as AffairStatus]}>
              {AFFAIR_STATUS_LABELS[statusFilter as AffairStatus]}
            </Badge>
          )}
          {involvementFilter && (
            <Badge variant="outline">
              Implication : {activeGroups.map((g) => INVOLVEMENT_GROUP_LABELS[g]).join(", ")}
            </Badge>
          )}
          <Link href="/affaires" className="text-blue-600 hover:underline ml-2">
            Effacer les filtres
          </Link>
        </div>
      )}

      {/* Results count */}
      <p className="text-sm text-muted-foreground mb-4">
        {total} résultat{total !== 1 ? "s" : ""}
      </p>

      {/* Results */}
      {affairs.length > 0 ? (
        <>
          <div className="space-y-4">
            {affairs.map((affair) => {
              const superCat = CATEGORY_TO_SUPER[affair.category];
              // Get the most relevant date for display
              const relevantDate = affair.verdictDate || affair.startDate || affair.factsDate;
              const dateLabel = affair.verdictDate
                ? "Verdict"
                : affair.startDate
                  ? "Révélation"
                  : affair.factsDate
                    ? "Faits"
                    : null;
              return (
                <Card key={affair.id}>
                  <CardContent className="pt-6">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-start gap-2 mb-2 flex-wrap">
                          {relevantDate && (
                            <Badge variant="secondary" className="font-mono text-base">
                              {new Date(relevantDate).getFullYear()}
                              {dateLabel && (
                                <span className="ml-1 text-xs opacity-70">({dateLabel})</span>
                              )}
                            </Badge>
                          )}
                          <Badge className={AFFAIR_SUPER_CATEGORY_COLORS[superCat]}>
                            {AFFAIR_SUPER_CATEGORY_LABELS[superCat]}
                          </Badge>
                          <Badge
                            className={AFFAIR_SEVERITY_COLORS[affair.severity as AffairSeverity]}
                          >
                            {AFFAIR_SEVERITY_EDITORIAL[affair.severity as AffairSeverity]}
                          </Badge>
                          <Badge className={AFFAIR_STATUS_COLORS[affair.status]}>
                            {AFFAIR_STATUS_LABELS[affair.status]}
                          </Badge>
                          <Badge variant="outline">{AFFAIR_CATEGORY_LABELS[affair.category]}</Badge>
                          {affair.involvement !== "DIRECT" && (
                            <Badge
                              className={INVOLVEMENT_COLORS[affair.involvement as Involvement]}
                            >
                              {INVOLVEMENT_LABELS[affair.involvement as Involvement]}
                            </Badge>
                          )}
                        </div>

                        <h2 className="text-lg font-semibold mb-1">{affair.title}</h2>

                        <Link
                          href={`/politiques/${affair.politician.slug}`}
                          className="text-blue-600 hover:underline text-sm"
                        >
                          {affair.politician.fullName}
                        </Link>
                        {(affair.partyAtTime || affair.politician.currentParty) && (
                          <span className="text-sm text-muted-foreground">
                            {" ("}
                            {affair.partyAtTime?.slug ? (
                              <Link
                                href={`/affaires/parti/${affair.partyAtTime.slug}`}
                                className="hover:underline hover:text-foreground"
                              >
                                {affair.partyAtTime.shortName}
                              </Link>
                            ) : (
                              affair.partyAtTime?.shortName ||
                              affair.politician.currentParty?.shortName
                            )}
                            {affair.partyAtTime &&
                              affair.partyAtTime.id !== affair.politician.currentParty?.id && (
                                <span className="text-xs"> à l&apos;époque</span>
                              )}
                            {")"}
                          </span>
                        )}

                        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                          {affair.description}
                        </p>

                        {AFFAIR_STATUS_NEEDS_PRESUMPTION[affair.status] &&
                          (affair.involvement === "DIRECT" ||
                            affair.involvement === "INDIRECT") && (
                            <p className="text-xs text-amber-700 bg-amber-50 p-2 rounded mt-3 inline-block">
                              Présomption d&apos;innocence : affaire en cours
                            </p>
                          )}
                      </div>

                      <div className="text-sm text-muted-foreground md:text-right md:min-w-[150px]">
                        {affair.sentence && (
                          <p className="font-medium text-foreground mb-2">{affair.sentence}</p>
                        )}
                        <p className="mb-2">
                          {affair.sources.length} source
                          {affair.sources.length !== 1 ? "s" : ""}
                        </p>
                        <Link
                          href={`/affaires/${affair.slug}`}
                          className="text-blue-600 hover:underline text-xs"
                        >
                          Voir détails →
                        </Link>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-8 flex justify-center gap-2">
              {page > 1 && (
                <Link
                  href={buildUrl({
                    page: String(page - 1),
                    status: statusFilter,
                    supercat: superCatFilter,
                    severity: severityFilter,
                    involvement: involvementFilter,
                    parti: partiFilter,
                  })}
                  className="px-4 py-2 border rounded-md hover:bg-muted"
                >
                  Précédent
                </Link>
              )}
              <span className="px-4 py-2 text-muted-foreground">
                Page {page} sur {totalPages}
              </span>
              {page < totalPages && (
                <Link
                  href={buildUrl({
                    page: String(page + 1),
                    status: statusFilter,
                    supercat: superCatFilter,
                    severity: severityFilter,
                    involvement: involvementFilter,
                    parti: partiFilter,
                  })}
                  className="px-4 py-2 border rounded-md hover:bg-muted"
                >
                  Suivant
                </Link>
              )}
            </div>
          )}
        </>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-2">
              Aucune affaire documentée
              {statusFilter || superCatFilter ? " avec ces filtres" : ""}
            </p>
            <p className="text-sm text-muted-foreground">
              Les affaires sont ajoutées avec des sources vérifiables. Notre base est enrichie
              régulièrement et ne prétend pas à l&apos;exhaustivité.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Info box */}
      <Card className="mt-8 bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <h3 className="font-semibold text-blue-900 mb-2">À propos des données</h3>
          <p className="text-sm text-blue-800">
            Chaque affaire est documentée avec au minimum une source vérifiable (article de presse,
            décision de justice). La présomption d&apos;innocence est systématiquement rappelée pour
            les affaires en cours. Les informations proviennent de sources publiques : Wikidata,
            articles de presse, décisions de justice publiées.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
