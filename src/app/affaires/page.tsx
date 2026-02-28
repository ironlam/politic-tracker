import { Metadata } from "next";
import Link from "next/link";
import { cacheTag, cacheLife } from "next/cache";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { StatCard } from "@/components/ui/StatCard";
import { Badge } from "@/components/ui/badge";
import { ExportButton } from "@/components/ui/ExportButton";
import { AffairesFilterBar } from "@/components/affairs/AffairesFilterBar";
import { SeoIntro } from "@/components/seo/SeoIntro";
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
  involvementsFromGroups,
  AFFAIR_SEVERITY_EDITORIAL,
  AFFAIR_SEVERITY_COLORS,
  type InvolvementGroup,
  type AffairSuperCategory,
} from "@/config/labels";
import type { AffairStatus, AffairCategory, AffairSeverity, Involvement } from "@/types";

export const revalidate = 300; // 5 minutes — CDN edge cache with ISR

// Hex accent colors per super-category (for inline styles per CLAUDE.md convention)
const SUPER_CATEGORY_ACCENT: Record<AffairSuperCategory, { border: string; bg: string }> = {
  PROBITE: { border: "#9333ea", bg: "#9333ea0a" },
  FINANCES: { border: "#2563eb", bg: "#2563eb0a" },
  PERSONNES: { border: "#dc2626", bg: "#dc26260a" },
  EXPRESSION: { border: "#d97706", bg: "#d977060a" },
  AUTRE: { border: "#6b7280", bg: "#6b72800a" },
};

interface PageProps {
  searchParams: Promise<{
    search?: string;
    sort?: string;
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

// Tier 1: Core query — accepts free-text search (never cached directly)
async function queryAffairs(
  search?: string,
  status?: string,
  superCategory?: AffairSuperCategory,
  category?: string,
  severity?: AffairSeverity,
  page = 1,
  involvements: Involvement[] = ["DIRECT"],
  partySlug?: string,
  sort?: string
) {
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
    ...(search && {
      OR: [
        { title: { contains: search, mode: "insensitive" as const } },
        { description: { contains: search, mode: "insensitive" as const } },
      ],
    }),
  };

  const orderBy =
    sort === "date-desc"
      ? [
          { verdictDate: { sort: "desc" as const, nulls: "last" as const } },
          { startDate: { sort: "desc" as const, nulls: "last" as const } },
          { createdAt: "desc" as const },
        ]
      : sort === "date-asc"
        ? [
            { verdictDate: { sort: "asc" as const, nulls: "last" as const } },
            { startDate: { sort: "asc" as const, nulls: "last" as const } },
            { createdAt: "asc" as const },
          ]
        : [
            { severity: "asc" as const },
            { verdictDate: { sort: "desc" as const, nulls: "last" as const } },
            { startDate: { sort: "desc" as const, nulls: "last" as const } },
            { createdAt: "desc" as const },
          ];

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
      orderBy,
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

// Tier 2: Cached path — bounded params only (no free-text search)
async function getAffairsFiltered(
  status?: string,
  superCategory?: AffairSuperCategory,
  category?: string,
  severity?: AffairSeverity,
  page = 1,
  involvements: Involvement[] = ["DIRECT"],
  partySlug?: string,
  sort?: string
) {
  "use cache";
  cacheTag("affairs");
  cacheLife("minutes");
  return queryAffairs(
    undefined,
    status,
    superCategory,
    category,
    severity,
    page,
    involvements,
    partySlug,
    sort
  );
}

// Tier 3: Uncached path — free-text search
async function searchAffairs(
  search: string,
  status?: string,
  superCategory?: AffairSuperCategory,
  category?: string,
  severity?: AffairSeverity,
  page = 1,
  involvements: Involvement[] = ["DIRECT"],
  partySlug?: string,
  sort?: string
) {
  return queryAffairs(
    search,
    status,
    superCategory,
    category,
    severity,
    page,
    involvements,
    partySlug,
    sort
  );
}

// Router — decides cached vs uncached
async function getAffairs(
  search?: string,
  status?: string,
  superCategory?: AffairSuperCategory,
  category?: string,
  severity?: AffairSeverity,
  page = 1,
  involvements: Involvement[] = ["DIRECT"],
  partySlug?: string,
  sort?: string
) {
  if (search) {
    return searchAffairs(
      search,
      status,
      superCategory,
      category,
      severity,
      page,
      involvements,
      partySlug,
      sort
    );
  }
  return getAffairsFiltered(
    status,
    superCategory,
    category,
    severity,
    page,
    involvements,
    partySlug,
    sort
  );
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
  const searchFilter = params.search || "";
  const sortFilter = params.sort || "";
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
      searchFilter || undefined,
      statusFilter,
      superCatFilter || undefined,
      categoryFilter,
      severityFilter || undefined,
      page,
      activeInvolvements,
      partiFilter || undefined,
      sortFilter || undefined
    ),
    getSuperCategoryCounts(),
    getStatusCounts(),
    getSeverityCounts(),
    getPartiesWithAffairs(),
  ]);

  const totalAffairs = Object.values(superCounts).reduce((a, b) => a + b, 0);

  // Build URL helper (only used for super-category cards + pagination)
  function buildUrl(params: Record<string, string>) {
    const filtered = Object.entries(params).filter(([, v]) => v);
    if (filtered.length === 0) return "/affaires";
    return `/affaires?${filtered.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&")}`;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-extrabold tracking-tight mb-1">
            Affaires judiciaires
          </h1>
          <p className="text-sm text-muted-foreground">
            {totalAffairs} affaire{totalAffairs !== 1 ? "s" : ""} documentée
            {totalAffairs !== 1 ? "s" : ""} avec sources vérifiables
          </p>
          <div className="sr-only">
            <SeoIntro
              text={`${totalAffairs} affaires judiciaires impliquant des responsables politiques, documentées avec sources vérifiables. Mises en examen, procès, condamnations et relaxes.`}
            />
          </div>
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
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {(Object.keys(AFFAIR_SUPER_CATEGORY_LABELS) as AffairSuperCategory[]).map((superCat) => {
          const count = superCounts[superCat] || 0;
          const isActive = superCatFilter === superCat;
          const accent = SUPER_CATEGORY_ACCENT[superCat];
          return (
            <StatCard
              key={superCat}
              count={count}
              label={AFFAIR_SUPER_CATEGORY_LABELS[superCat]}
              description={AFFAIR_SUPER_CATEGORY_DESCRIPTIONS[superCat]}
              accent={accent}
              href={isActive ? "/affaires" : buildUrl({ supercat: superCat })}
              isActive={isActive}
            />
          );
        })}
      </div>

      {/* Compact filter bar */}
      <AffairesFilterBar
        currentFilters={{
          search: searchFilter,
          sort: sortFilter,
          severity: severityFilter,
          parti: partiFilter,
          status: statusFilter,
          involvement: involvementFilter,
          supercat: superCatFilter,
        }}
        parties={partiesWithAffairs.map((p) => ({
          slug: p.slug as string,
          shortName: p.shortName,
          name: p.name,
          count: p._count.affairsAtTime,
        }))}
        severityCounts={severityCounts}
        statusCounts={statusCounts}
      />

      {/* Active filters summary */}
      {(searchFilter ||
        superCatFilter ||
        statusFilter ||
        severityFilter ||
        involvementFilter ||
        partiFilter) && (
        <div className="mb-6 flex items-center gap-2 text-sm flex-wrap">
          <span className="text-muted-foreground">Filtres actifs :</span>
          {searchFilter && <Badge variant="outline">Recherche : {searchFilter}</Badge>}
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
              Rôle : {activeGroups.map((g) => INVOLVEMENT_GROUP_LABELS[g]).join(", ")}
            </Badge>
          )}
          <Link href="/affaires" className="text-primary hover:underline ml-2">
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
                <Card
                  key={affair.id}
                  className="border-l-4 transition-shadow hover:shadow-md"
                  style={{ borderLeftColor: SUPER_CATEGORY_ACCENT[superCat].border }}
                >
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
                          {affair.severity === "CRITIQUE" && (
                            <Badge
                              className={AFFAIR_SEVERITY_COLORS[affair.severity as AffairSeverity]}
                            >
                              {AFFAIR_SEVERITY_EDITORIAL[affair.severity as AffairSeverity]}
                            </Badge>
                          )}
                          {affair.status === "CONDAMNATION_DEFINITIVE" && (
                            <Badge className={AFFAIR_STATUS_COLORS[affair.status]}>
                              {AFFAIR_STATUS_LABELS[affair.status]}
                            </Badge>
                          )}
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
                    search: searchFilter,
                    page: String(page - 1),
                    sort: sortFilter,
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
                    search: searchFilter,
                    page: String(page + 1),
                    sort: sortFilter,
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
              {searchFilter || statusFilter || superCatFilter ? " avec ces filtres" : ""}
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
