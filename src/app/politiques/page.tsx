import { Metadata } from "next";
import { db } from "@/lib/db";
import { PoliticianCard } from "@/components/politicians/PoliticianCard";
import { PartySelect } from "@/components/politicians/PartySelect";
import { SearchAutocomplete } from "@/components/politicians/SearchAutocomplete";
import { FilterBar, type SortOption, type MandateFilter, type StatusFilter } from "@/components/politicians/FilterBar";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { AffairStatus, MandateType } from "@/generated/prisma";
import { SearchForm } from "@/components/politicians/SearchForm";

// Minimum members to show a party in filters (avoid cluttering with old/small parties)
const MIN_PARTY_MEMBERS = 2;

export const metadata: Metadata = {
  title: "Représentants politiques",
  description: "Liste des représentants politiques français - députés, sénateurs, ministres",
};

interface PageProps {
  searchParams: Promise<{
    search?: string;
    party?: string;
    conviction?: string;
    mandate?: string;
    status?: string;
    sort?: string;
    page?: string;
  }>;
}

// Statuses that count as convictions
const CONVICTION_STATUSES: AffairStatus[] = [
  "CONDAMNATION_PREMIERE_INSTANCE",
  "CONDAMNATION_DEFINITIVE",
];

// Mandate type groups
const MANDATE_GROUPS: Record<string, MandateType[]> = {
  depute: ["DEPUTE"],
  senateur: ["SENATEUR"],
  gouvernement: ["MINISTRE", "PREMIER_MINISTRE", "MINISTRE_DELEGUE", "SECRETAIRE_ETAT"],
};

// Sort configurations - using 'any' to handle complex Prisma orderBy types
const SORT_CONFIGS: Record<SortOption, unknown> = {
  alpha: { lastName: "asc" },
  "alpha-desc": { lastName: "desc" },
  recent: { createdAt: "desc" },
  affairs: [{ affairs: { _count: "desc" } }, { lastName: "asc" }],
};

async function getPoliticians(
  search?: string,
  partyId?: string,
  withConviction?: boolean,
  mandateFilter?: MandateFilter,
  statusFilter?: StatusFilter,
  sortOption: SortOption = "alpha",
  page = 1
) {
  const limit = 24;
  const skip = (page - 1) * limit;

  // Build where clause
  const where: Record<string, unknown> = {};

  if (search) {
    where.OR = [
      { fullName: { contains: search, mode: "insensitive" } },
      { lastName: { contains: search, mode: "insensitive" } },
      { firstName: { contains: search, mode: "insensitive" } },
    ];
  }

  if (partyId) {
    where.currentPartyId = partyId;
  }

  if (withConviction) {
    where.affairs = {
      some: {
        status: { in: CONVICTION_STATUSES },
      },
    };
  }

  // Mandate type filter
  if (mandateFilter && MANDATE_GROUPS[mandateFilter]) {
    where.mandates = {
      some: {
        type: { in: MANDATE_GROUPS[mandateFilter] },
        isCurrent: true,
      },
    };
  }

  // Status filter (alive/deceased)
  if (statusFilter === "alive") {
    where.deathDate = null;
  } else if (statusFilter === "deceased") {
    where.deathDate = { not: null };
  }

  // Get order by config
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orderBy = (SORT_CONFIGS[sortOption] || SORT_CONFIGS.alpha) as any;

  const [politicians, total] = await Promise.all([
    db.politician.findMany({
      where,
      include: {
        currentParty: true,
        _count: {
          select: { affairs: true },
        },
        affairs: {
          where: { status: { in: CONVICTION_STATUSES } },
          select: { id: true },
          take: 1,
        },
      },
      orderBy,
      skip,
      take: limit,
    }),
    db.politician.count({ where }),
  ]);

  // Transform to add hasConviction flag
  const politiciansWithConviction = politicians.map((p) => ({
    ...p,
    hasConviction: p.affairs.length > 0,
    affairs: undefined, // Remove the affairs array, keep only the flag
  }));

  return {
    politicians: politiciansWithConviction,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

async function getParties() {
  const parties = await db.party.findMany({
    where: {
      politicians: { some: {} }, // Only parties with members
    },
    orderBy: [
      { politicians: { _count: "desc" } },
      { name: "asc" },
    ],
    include: {
      _count: { select: { politicians: true } },
    },
  });

  // Filter out parties with too few members (old/merged parties)
  return parties.filter((p) => p._count.politicians >= MIN_PARTY_MEMBERS);
}

async function getFilterCounts() {
  const [withConviction, totalAffairs, deputes, senateurs, gouvernement, deceased, alive] =
    await Promise.all([
      // Conviction counts
      db.politician.count({
        where: {
          affairs: {
            some: { status: { in: CONVICTION_STATUSES } },
          },
        },
      }),
      db.affair.count({
        where: { status: { in: CONVICTION_STATUSES } },
      }),
      // Mandate counts (current mandates only)
      db.politician.count({
        where: {
          mandates: {
            some: { type: "DEPUTE", isCurrent: true },
          },
        },
      }),
      db.politician.count({
        where: {
          mandates: {
            some: { type: "SENATEUR", isCurrent: true },
          },
        },
      }),
      db.politician.count({
        where: {
          mandates: {
            some: {
              type: { in: MANDATE_GROUPS.gouvernement },
              isCurrent: true,
            },
          },
        },
      }),
      // Status counts
      db.politician.count({
        where: { deathDate: { not: null } },
      }),
      db.politician.count({
        where: { deathDate: null },
      }),
    ]);

  return {
    withConviction,
    totalAffairs,
    deputes,
    senateurs,
    gouvernement,
    deceased,
    alive,
  };
}

export default async function PolitiquesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const search = params.search || "";
  const partyFilter = params.party || "";
  const convictionFilter = params.conviction === "true";
  const mandateFilter = (params.mandate || "") as MandateFilter;
  const statusFilter = (params.status || "") as StatusFilter;
  const sortOption = (params.sort || "alpha") as SortOption;
  const page = parseInt(params.page || "1", 10);

  const [{ politicians, total, totalPages }, parties, counts] = await Promise.all([
    getPoliticians(search, partyFilter, convictionFilter, mandateFilter, statusFilter, sortOption, page),
    getParties(),
    getFilterCounts(),
  ]);

  // Build URL with current filters
  function buildUrl(newParams: Record<string, string | undefined>) {
    const url = new URLSearchParams();
    const finalParams = {
      search: search || undefined,
      party: partyFilter || undefined,
      conviction: convictionFilter ? "true" : undefined,
      mandate: mandateFilter || undefined,
      status: statusFilter || undefined,
      sort: sortOption !== "alpha" ? sortOption : undefined,
      page: undefined, // Reset page when changing filters
      ...newParams,
    };

    Object.entries(finalParams).forEach(([key, value]) => {
      if (value) url.set(key, value);
    });

    const queryString = url.toString();
    return `/politiques${queryString ? `?${queryString}` : ""}`;
  }

  // Count active filters
  const activeFilterCount = [partyFilter, convictionFilter, mandateFilter, statusFilter].filter(
    Boolean
  ).length;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Représentants politiques</h1>
        <p className="text-muted-foreground">
          {total} représentants
          {search && ` pour "${search}"`}
          {activeFilterCount > 0 && ` (${activeFilterCount} filtre${activeFilterCount > 1 ? "s" : ""} actif${activeFilterCount > 1 ? "s" : ""})`}
        </p>
      </div>

      {/* Search with autocomplete */}
      <div className="mb-6">
        <SearchForm
          defaultSearch={search}
          partyFilter={partyFilter}
          convictionFilter={convictionFilter}
          mandateFilter={mandateFilter}
          statusFilter={statusFilter}
          sortOption={sortOption}
        />
      </div>

      {/* Filters and sort */}
      <div className="mb-6 space-y-4">
        {/* Sort and mandate/status filters */}
        <FilterBar
          currentSort={sortOption}
          currentMandate={mandateFilter}
          currentStatus={statusFilter}
          counts={{
            deputes: counts.deputes,
            senateurs: counts.senateurs,
            gouvernement: counts.gouvernement,
            deceased: counts.deceased,
            alive: counts.alive,
          }}
        />

        {/* Party filter */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Parti:</span>
            <div className="flex flex-wrap gap-1">
              <Link href={buildUrl({ party: undefined })}>
                <Badge
                  variant={partyFilter === "" ? "default" : "outline"}
                  className="cursor-pointer"
                >
                  Tous
                </Badge>
              </Link>
              {parties.slice(0, 8).map((party) => (
                <Link key={party.id} href={buildUrl({ party: party.id })}>
                  <Badge
                    variant={partyFilter === party.id ? "default" : "outline"}
                    className="cursor-pointer"
                    style={{
                      backgroundColor:
                        partyFilter === party.id ? party.color || undefined : undefined,
                      borderColor: party.color || undefined,
                    }}
                  >
                    {party.shortName}
                  </Badge>
                </Link>
              ))}
              {parties.length > 8 && (
                <PartySelect
                  parties={parties.slice(8)}
                  currentValue={partyFilter}
                />
              )}
            </div>
          </div>

          {/* Conviction filter */}
          <div className="flex items-center gap-2 border-l pl-4">
            <Link href={buildUrl({ conviction: convictionFilter ? undefined : "true" })}>
              <Badge
                variant={convictionFilter ? "destructive" : "outline"}
                className="cursor-pointer"
              >
                Avec condamnation ({counts.withConviction})
              </Badge>
            </Link>
          </div>
        </div>

        {/* Active filters summary */}
        {activeFilterCount > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Filtres actifs:</span>
            <Link
              href="/politiques"
              className="text-sm text-primary hover:underline"
            >
              Tout effacer
            </Link>
          </div>
        )}
      </div>

      {/* Results */}
      {politicians.length > 0 ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {politicians.map((politician) => (
              <PoliticianCard
                key={politician.id}
                politician={politician}
                showConvictionBadge
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-8 flex justify-center items-center gap-2">
              {page > 1 && (
                <Link
                  href={buildUrl({ page: String(page - 1) })}
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
                  href={buildUrl({ page: String(page + 1) })}
                  className="px-4 py-2 border rounded-md hover:bg-muted"
                >
                  Suivant
                </Link>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Aucun résultat trouvé</p>
          <Link href="/politiques" className="text-primary hover:underline mt-2 inline-block">
            Voir tous les représentants
          </Link>
        </div>
      )}
    </div>
  );
}
