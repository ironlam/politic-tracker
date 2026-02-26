import { Metadata } from "next";
import Link from "next/link";
import { cacheTag, cacheLife } from "next/cache";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PoliticianAvatar } from "@/components/politicians/PoliticianAvatar";
import { SeoIntro } from "@/components/seo/SeoIntro";
import {
  BreadcrumbJsonLd,
  CollectionPageJsonLd,
  FAQJsonLd,
  ItemListJsonLd,
} from "@/components/seo/JsonLd";
import { formatCompactCurrency } from "@/lib/utils";
import { ensureContrast } from "@/lib/contrast";
import {
  DeclarationsFilterBar,
  type DeclarationSortOption,
} from "@/components/declarations/DeclarationsFilterBar";
import type { DeclarationDetails } from "@/types/hatvp";

export const revalidate = 300;

const BASE_URL = "https://poligraph.fr";
const PAGE_SIZE = 24;

export const metadata: Metadata = {
  title: "Déclarations HATVP des élus français",
  description:
    "Explorez les déclarations d'intérêts et de patrimoine des députés, sénateurs et ministres français. Portefeuilles financiers, participations, revenus et activités — données officielles HATVP.",
  openGraph: {
    title: "Déclarations HATVP des élus français — Poligraph",
    description:
      "Classement des élus par patrimoine déclaré, entreprises détenues et revenus. Source officielle : HATVP.",
  },
};

interface PageProps {
  searchParams: Promise<{
    search?: string;
    party?: string;
    sort?: string;
    page?: string;
  }>;
}

// ─── FAQ content (reused in component + JSON-LD) ──────────────

const FAQ_ITEMS = [
  {
    question: "Qu'est-ce qu'une déclaration d'intérêts (DIA) ?",
    answer:
      "La déclaration d'intérêts et d'activités (DIA) est un document officiel dans lequel un élu déclare ses participations financières, activités professionnelles, mandats et fonctions de direction. Elle est publiée par la Haute Autorité pour la Transparence de la Vie Publique (HATVP) et consultable librement en ligne.",
  },
  {
    question: "Quelle différence entre déclaration d'intérêts et déclaration de patrimoine ?",
    answer:
      "La déclaration d'intérêts (DIA) liste les activités, revenus et participations de l'élu. La déclaration de patrimoine (DSP) détaille l'ensemble des biens (immobilier, valeurs mobilières, comptes bancaires). Pour les parlementaires, seules les DIA sont consultables en ligne — les déclarations de patrimoine ne sont consultables qu'en préfecture.",
  },
  {
    question: "D'où viennent les données affichées sur cette page ?",
    answer:
      "Toutes les données proviennent des fichiers open data de la HATVP (CSV et XML). Poligraph récupère et parse ces fichiers pour les rendre lisibles, comparables et explorables. Aucune donnée n'est inventée ou estimée.",
  },
  {
    question: "À quelle fréquence les données sont-elles mises à jour ?",
    answer:
      "Poligraph synchronise les données HATVP quotidiennement. Les déclarations sont publiées par la HATVP elle-même, avec un délai variable : les DIA des députés et sénateurs sont publiées lors de chaque renouvellement, celles du gouvernement à la nomination.",
  },
];

// ─── Data fetching ────────────────────────────────────────────

interface DeclarationRow {
  id: string;
  slug: string;
  firstName: string;
  lastName: string;
  fullName: string;
  photoUrl: string | null;
  party: { id: string; name: string; shortName: string | null; color: string | null } | null;
  totalPortfolioValue: number | null;
  totalCompanies: number;
  latestAnnualIncome: number | null;
  totalDirectorships: number;
  declarationCount: number;
  latestYear: number | null;
  hasDetails: boolean;
}

/**
 * Fetch aggregated stats — cached
 */
async function getDeclarationStats() {
  "use cache";
  cacheTag("declarations");
  cacheLife("minutes");

  const [totalDeclarations, politiciansWithDeclarations] = await Promise.all([
    db.declaration.count(),
    db.politician.count({
      where: { declarations: { some: {} }, publicationStatus: "PUBLISHED" },
    }),
  ]);

  // Get all enriched declarations to compute aggregate portfolio
  const enriched = await db.declaration.findMany({
    where: { details: { not: Prisma.DbNull } },
    select: { details: true, politicianId: true },
  });

  // Group by politician, take max portfolio per politician
  const byPolitician = new Map<string, number>();
  for (const decl of enriched) {
    const details = decl.details as unknown as DeclarationDetails;
    const value = details?.totalPortfolioValue ?? 0;
    const current = byPolitician.get(decl.politicianId) ?? 0;
    if (value > current) byPolitician.set(decl.politicianId, value);
  }

  const totalPortfolio = Array.from(byPolitician.values()).reduce((a, b) => a + b, 0);

  return {
    totalDeclarations,
    politiciansWithDeclarations,
    enrichedCount: enriched.length,
    totalPortfolio,
  };
}

/**
 * Top politicians by portfolio value — cached
 */
async function getTopPortfolios(limit = 10) {
  "use cache";
  cacheTag("declarations");
  cacheLife("minutes");

  const politicians = await db.politician.findMany({
    where: {
      publicationStatus: "PUBLISHED",
      declarations: { some: { details: { not: Prisma.DbNull } } },
    },
    include: {
      currentParty: { select: { id: true, name: true, shortName: true, color: true } },
      declarations: {
        where: { details: { not: Prisma.DbNull } },
        orderBy: { year: "desc" },
        take: 1,
        select: { details: true, year: true },
      },
    },
  });

  const rows = politicians
    .map((p) => {
      const details = p.declarations[0]?.details as unknown as DeclarationDetails | null;
      return {
        id: p.id,
        slug: p.slug,
        firstName: p.firstName,
        lastName: p.lastName,
        fullName: p.fullName,
        photoUrl: p.photoUrl,
        party: p.currentParty,
        totalPortfolioValue: details?.totalPortfolioValue ?? 0,
        totalCompanies: details?.totalCompanies ?? 0,
        year: p.declarations[0]?.year,
      };
    })
    .filter((r) => r.totalPortfolioValue > 0)
    .sort((a, b) => b.totalPortfolioValue - a.totalPortfolioValue)
    .slice(0, limit);

  return rows;
}

/**
 * Most commonly held companies by politicians — cached
 */
async function getTopCompanies(limit = 10) {
  "use cache";
  cacheTag("declarations");
  cacheLife("minutes");

  const declarations = await db.declaration.findMany({
    where: { details: { not: Prisma.DbNull } },
    select: { details: true, politicianId: true },
  });

  const companyMap = new Map<string, { politicians: Set<string>; totalValue: number }>();

  for (const decl of declarations) {
    const details = decl.details as unknown as DeclarationDetails;
    if (!details?.financialParticipations) continue;

    for (const part of details.financialParticipations) {
      if (!part.company) continue;
      const key = part.company.toUpperCase().trim();
      if (!companyMap.has(key)) {
        companyMap.set(key, { politicians: new Set(), totalValue: 0 });
      }
      const entry = companyMap.get(key)!;
      entry.politicians.add(decl.politicianId);
      if (part.evaluation) entry.totalValue += part.evaluation;
    }
  }

  return Array.from(companyMap.entries())
    .map(([name, data]) => ({
      company: name,
      politicianCount: data.politicians.size,
      totalValue: data.totalValue,
    }))
    .filter((c) => c.politicianCount >= 2) // Only companies held by 2+ politicians
    .sort((a, b) => b.politicianCount - a.politicianCount || b.totalValue - a.totalValue)
    .slice(0, limit);
}

/**
 * Core query for the declarations listing
 */
async function queryDeclarationsList(
  search?: string,
  partyId?: string,
  sortOption: DeclarationSortOption = "portfolio",
  page = 1
): Promise<{ rows: DeclarationRow[]; total: number; page: number; totalPages: number }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conditions: any[] = [
    { publicationStatus: "PUBLISHED" as const },
    { declarations: { some: {} } },
  ];

  if (search) {
    conditions.push({
      OR: [
        { fullName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
      ],
    });
  }

  if (partyId) {
    conditions.push({ currentPartyId: partyId });
  }

  const where = { AND: conditions };

  const politicians = await db.politician.findMany({
    where,
    include: {
      currentParty: { select: { id: true, name: true, shortName: true, color: true } },
      declarations: {
        orderBy: { year: "desc" },
        select: { type: true, year: true, details: true },
      },
    },
  });

  // Extract summary from latest enriched DIA
  const rows: DeclarationRow[] = politicians.map((p) => {
    const latestDIA = p.declarations.find((d) => d.details !== null);
    const details = latestDIA?.details as unknown as DeclarationDetails | null;

    return {
      id: p.id,
      slug: p.slug,
      firstName: p.firstName,
      lastName: p.lastName,
      fullName: p.fullName,
      photoUrl: p.photoUrl,
      party: p.currentParty,
      totalPortfolioValue: details?.totalPortfolioValue ?? null,
      totalCompanies: details?.totalCompanies ?? 0,
      latestAnnualIncome: details?.latestAnnualIncome ?? null,
      totalDirectorships: details?.totalDirectorships ?? 0,
      declarationCount: p.declarations.length,
      latestYear: p.declarations[0]?.year ?? null,
      hasDetails: details !== null,
    };
  });

  // Sort
  switch (sortOption) {
    case "portfolio":
      rows.sort((a, b) => (b.totalPortfolioValue ?? -1) - (a.totalPortfolioValue ?? -1));
      break;
    case "income":
      rows.sort((a, b) => (b.latestAnnualIncome ?? -1) - (a.latestAnnualIncome ?? -1));
      break;
    case "companies":
      rows.sort((a, b) => b.totalCompanies - a.totalCompanies);
      break;
    case "alpha":
      rows.sort((a, b) => a.lastName.localeCompare(b.lastName, "fr"));
      break;
    case "recent":
      rows.sort((a, b) => (b.latestYear ?? 0) - (a.latestYear ?? 0));
      break;
  }

  const total = rows.length;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const paginatedRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return { rows: paginatedRows, total, page, totalPages };
}

/**
 * Cached path — bounded params (no free-text search)
 */
async function getDeclarationsFiltered(
  partyId?: string,
  sortOption: DeclarationSortOption = "portfolio",
  page = 1
) {
  "use cache";
  cacheTag("declarations");
  cacheLife("minutes");
  return queryDeclarationsList(undefined, partyId, sortOption, page);
}

/**
 * Uncached path — free-text search (unbounded key space)
 */
async function searchDeclarations(
  search: string,
  partyId?: string,
  sortOption: DeclarationSortOption = "portfolio",
  page = 1
) {
  return queryDeclarationsList(search, partyId, sortOption, page);
}

/**
 * Router: cached when no search, uncached when searching
 */
async function getDeclarations(
  search?: string,
  partyId?: string,
  sortOption: DeclarationSortOption = "portfolio",
  page = 1
) {
  if (search) return searchDeclarations(search, partyId, sortOption, page);
  return getDeclarationsFiltered(partyId, sortOption, page);
}

/**
 * Parties with at least one member who has declarations
 */
async function getParties() {
  "use cache";
  cacheTag("declarations", "parties");
  cacheLife("minutes");

  return db.party.findMany({
    where: {
      politicians: {
        some: {
          declarations: { some: {} },
          publicationStatus: "PUBLISHED",
        },
      },
    },
    select: { id: true, name: true, shortName: true, color: true },
    orderBy: { name: "asc" },
  });
}

// ─── Page component ───────────────────────────────────────────

export default async function DeclarationsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const search = params.search || "";
  const partyFilter = params.party || "";
  const sortOption = (params.sort || "portfolio") as DeclarationSortOption;
  const page = parseInt(params.page || "1", 10);

  const [stats, topPortfolios, topCompanies, tableData, parties] = await Promise.all([
    getDeclarationStats(),
    getTopPortfolios(10),
    getTopCompanies(10),
    getDeclarations(search, partyFilter, sortOption, page),
    getParties(),
  ]);

  const maxPortfolio = topPortfolios[0]?.totalPortfolioValue ?? 1;

  return (
    <div className="container mx-auto px-4 py-8">
      {/* SEO structured data */}
      <BreadcrumbJsonLd
        items={[
          { name: "Accueil", url: BASE_URL },
          { name: "Déclarations HATVP", url: `${BASE_URL}/declarations` },
        ]}
      />
      <CollectionPageJsonLd
        name="Déclarations HATVP des élus français"
        description="Déclarations d'intérêts et de patrimoine des députés, sénateurs et ministres français. Données officielles de la HATVP."
        url={`${BASE_URL}/declarations`}
        numberOfItems={stats.totalDeclarations}
        about={{ name: "HATVP", url: "https://www.hatvp.fr" }}
      />
      <ItemListJsonLd
        name="Classement des élus par portefeuille déclaré"
        description="Les élus français avec les plus gros portefeuilles financiers déclarés auprès de la HATVP."
        url={`${BASE_URL}/declarations`}
        items={topPortfolios.map((p, i) => ({
          name: p.fullName,
          url: `${BASE_URL}/politiques/${p.slug}`,
          position: i + 1,
        }))}
      />
      <FAQJsonLd questions={FAQ_ITEMS} />

      {/* Hero */}
      <div className="mb-8">
        <h1 className="text-3xl font-display font-extrabold tracking-tight mb-2">
          Déclarations HATVP
        </h1>
        <p className="text-muted-foreground max-w-2xl">
          Explorez les déclarations d&apos;intérêts et de patrimoine des élus français, publiées par
          la Haute Autorité pour la Transparence de la Vie Publique.
        </p>
        <div className="sr-only">
          <SeoIntro
            text={`Poligraph référence ${stats.totalDeclarations.toLocaleString("fr-FR")} déclarations HATVP pour ${stats.politiciansWithDeclarations.toLocaleString("fr-FR")} élus français. Consultez les portefeuilles financiers, participations dans des entreprises, revenus déclarés et postes de direction.`}
          />
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <StatCard
          value={stats.totalDeclarations.toLocaleString("fr-FR")}
          label="Déclarations"
          accent="#2563eb"
        />
        <StatCard
          value={stats.politiciansWithDeclarations.toLocaleString("fr-FR")}
          label="Élus déclarants"
          accent="#9333ea"
        />
        <StatCard
          value={formatCompactCurrency(stats.totalPortfolio)}
          label="Portefeuille cumulé"
          accent="#059669"
        />
        <StatCard
          value={stats.enrichedCount.toLocaleString("fr-FR")}
          label="Déclarations enrichies"
          accent="#d97706"
        />
      </div>

      {/* Rankings: top portfolios + top companies */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
        {/* Top portfolios */}
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Les plus gros portefeuilles déclarés</h2>
            <p className="text-xs text-muted-foreground">
              Classement par valeur totale des participations financières
            </p>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3" aria-label="Classement des portefeuilles">
              {topPortfolios.map((p, i) => (
                <li key={p.id}>
                  <Link
                    href={`/politiques/${p.slug}`}
                    className="flex items-center gap-3 group hover:bg-accent/50 rounded-lg p-2 -m-2 transition-colors"
                  >
                    <span
                      className="text-xs font-bold w-5 text-center flex-shrink-0"
                      style={{ color: i < 3 ? "#d97706" : undefined }}
                    >
                      {i + 1}
                    </span>
                    <PoliticianAvatar
                      photoUrl={p.photoUrl}
                      firstName={p.firstName}
                      lastName={p.lastName}
                      size="sm"
                      politicianId={p.id}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                          {p.fullName}
                        </span>
                        {p.party && (
                          <Badge
                            variant="secondary"
                            className="text-[10px] px-1.5 py-0 flex-shrink-0"
                            style={{
                              backgroundColor: p.party.color ? `${p.party.color}15` : undefined,
                              color: p.party.color
                                ? ensureContrast(p.party.color, "#ffffff")
                                : undefined,
                            }}
                          >
                            {p.party.shortName}
                          </Badge>
                        )}
                      </div>
                      {/* Mini bar */}
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${(p.totalPortfolioValue / maxPortfolio) * 100}%`,
                              backgroundColor: "#059669",
                            }}
                          />
                        </div>
                        <span className="text-xs font-mono text-muted-foreground whitespace-nowrap">
                          {formatCompactCurrency(p.totalPortfolioValue)}
                        </span>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        {/* Top companies */}
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Entreprises les plus détenues par les élus</h2>
            <p className="text-xs text-muted-foreground">
              Sociétés apparaissant dans le plus de déclarations
            </p>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3" aria-label="Entreprises les plus déclarées">
              {topCompanies.map((c, i) => {
                const maxCount = topCompanies[0]?.politicianCount ?? 1;
                return (
                  <li key={c.company} className="flex items-center gap-3">
                    <span
                      className="text-xs font-bold w-5 text-center flex-shrink-0"
                      style={{ color: i < 3 ? "#2563eb" : undefined }}
                    >
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium truncate">{c.company}</span>
                        <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                          {c.politicianCount} élu{c.politicianCount > 1 ? "s" : ""}
                        </span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${(c.politicianCount / maxCount) * 100}%`,
                            backgroundColor: "#2563eb",
                          }}
                        />
                      </div>
                      {c.totalValue > 0 && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Valeur cumulée : {formatCompactCurrency(c.totalValue)}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </CardContent>
        </Card>
      </div>

      {/* Listing section */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-1">
          Tous les élus déclarants
          <span className="text-muted-foreground text-base font-normal ml-2">
            ({tableData.total})
          </span>
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          {search ? `Résultats pour "${search}"` : "Élus ayant au moins une déclaration HATVP"}
        </p>

        {/* Filters */}
        <DeclarationsFilterBar
          parties={parties}
          defaultSearch={search}
          partyFilter={partyFilter}
          sortOption={sortOption}
        />
      </div>

      {/* Results grid */}
      {tableData.rows.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-lg">Aucun résultat</p>
          <p className="text-sm mt-1">
            {search
              ? "Essayez un autre terme de recherche."
              : "Aucun élu ne correspond aux filtres sélectionnés."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {tableData.rows.map((row) => (
            <DeclarationListCard key={row.id} row={row} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {tableData.totalPages > 1 && (
        <Pagination
          currentPage={tableData.page}
          totalPages={tableData.totalPages}
          search={search}
          partyFilter={partyFilter}
          sortOption={sortOption}
        />
      )}

      {/* FAQ Section */}
      <section className="mt-16 border-t pt-10" aria-labelledby="faq-heading">
        <h2 id="faq-heading" className="text-xl font-semibold mb-6">
          Questions fréquentes
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {FAQ_ITEMS.map((item) => (
            <Card key={item.question}>
              <CardContent className="pt-5">
                <h3 className="font-medium mb-2">{item.question}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.answer}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-6 text-center">
          Source :{" "}
          <a
            href="https://www.hatvp.fr"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground"
          >
            Haute Autorité pour la Transparence de la Vie Publique
          </a>
        </p>
      </section>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────

function StatCard({ value, label, accent }: { value: string; label: string; accent: string }) {
  return (
    <Card className="border-l-4" style={{ borderLeftColor: accent }}>
      <CardContent className="p-3 py-3">
        <div
          className="text-2xl font-display font-extrabold tracking-tight"
          style={{ color: accent }}
        >
          {value}
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
      </CardContent>
    </Card>
  );
}

function DeclarationListCard({ row }: { row: DeclarationRow }) {
  return (
    <Link href={`/politiques/${row.slug}`} className="block group focus-visible:outline-none">
      <Card className="h-full transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 hover:border-primary/30 focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2">
        <CardContent className="pt-5">
          <div className="flex items-start gap-3 mb-3">
            <div className="transition-transform duration-300 group-hover:scale-110">
              <PoliticianAvatar
                photoUrl={row.photoUrl}
                firstName={row.firstName}
                lastName={row.lastName}
                size="sm"
                politicianId={row.id}
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate group-hover:text-primary transition-colors">
                {row.fullName}
              </p>
              <div className="flex items-center gap-2 mt-1">
                {row.party && (
                  <Badge
                    variant="secondary"
                    className="text-[10px] px-1.5 py-0"
                    style={{
                      backgroundColor: row.party.color ? `${row.party.color}15` : undefined,
                      color: row.party.color
                        ? ensureContrast(row.party.color, "#ffffff")
                        : undefined,
                    }}
                  >
                    {row.party.shortName || row.party.name}
                  </Badge>
                )}
                {row.latestYear && (
                  <span className="text-[10px] text-muted-foreground">{row.latestYear}</span>
                )}
              </div>
            </div>
          </div>

          {/* Metrics grid */}
          {row.hasDetails ? (
            <div className="grid grid-cols-2 gap-2">
              <MetricCell
                value={formatCompactCurrency(row.totalPortfolioValue)}
                label="Portefeuille"
              />
              <MetricCell value={String(row.totalCompanies)} label="Participations" />
              <MetricCell
                value={formatCompactCurrency(row.latestAnnualIncome)}
                label="Revenus/an"
              />
              <MetricCell value={String(row.totalDirectorships)} label="Directions" />
            </div>
          ) : (
            <div className="text-xs text-muted-foreground bg-muted/50 rounded-md p-2 text-center">
              {row.declarationCount} déclaration{row.declarationCount > 1 ? "s" : ""} — détails non
              disponibles en open data
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

function MetricCell({ value, label }: { value: string; label: string }) {
  return (
    <div className="bg-muted/50 rounded-md px-2 py-1.5">
      <div className="text-sm font-bold font-mono">{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}

function Pagination({
  currentPage,
  totalPages,
  search,
  partyFilter,
  sortOption,
}: {
  currentPage: number;
  totalPages: number;
  search: string;
  partyFilter: string;
  sortOption: string;
}) {
  function buildUrl(page: number) {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (partyFilter) params.set("party", partyFilter);
    if (sortOption && sortOption !== "portfolio") params.set("sort", sortOption);
    if (page > 1) params.set("page", String(page));
    const qs = params.toString();
    return `/declarations${qs ? `?${qs}` : ""}`;
  }

  // Show limited page numbers around current
  const pages: number[] = [];
  const start = Math.max(1, currentPage - 2);
  const end = Math.min(totalPages, currentPage + 2);
  for (let i = start; i <= end; i++) pages.push(i);

  return (
    <nav aria-label="Pagination" className="flex items-center justify-center gap-1 mb-8">
      {currentPage > 1 && (
        <Link
          href={buildUrl(currentPage - 1)}
          className="px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors"
          aria-label="Page précédente"
        >
          &larr;
        </Link>
      )}
      {start > 1 && (
        <>
          <Link
            href={buildUrl(1)}
            className="px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors"
          >
            1
          </Link>
          {start > 2 && <span className="px-2 text-muted-foreground">...</span>}
        </>
      )}
      {pages.map((p) => (
        <Link
          key={p}
          href={buildUrl(p)}
          className={`px-3 py-2 text-sm rounded-md transition-colors ${
            p === currentPage ? "bg-primary text-primary-foreground font-medium" : "hover:bg-accent"
          }`}
          aria-current={p === currentPage ? "page" : undefined}
        >
          {p}
        </Link>
      ))}
      {end < totalPages && (
        <>
          {end < totalPages - 1 && <span className="px-2 text-muted-foreground">...</span>}
          <Link
            href={buildUrl(totalPages)}
            className="px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors"
          >
            {totalPages}
          </Link>
        </>
      )}
      {currentPage < totalPages && (
        <Link
          href={buildUrl(currentPage + 1)}
          className="px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors"
          aria-label="Page suivante"
        >
          &rarr;
        </Link>
      )}
    </nav>
  );
}
