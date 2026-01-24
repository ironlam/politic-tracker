import { Metadata } from "next";
import { db } from "@/lib/db";
import { PoliticianCard } from "@/components/politicians/PoliticianCard";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { AffairStatus } from "@/generated/prisma";

export const metadata: Metadata = {
  title: "Représentants politiques",
  description: "Liste des représentants politiques français - députés, sénateurs, ministres",
};

interface PageProps {
  searchParams: Promise<{
    search?: string;
    party?: string;
    conviction?: string;
    page?: string;
  }>;
}

// Statuses that count as convictions
const CONVICTION_STATUSES: AffairStatus[] = [
  "CONDAMNATION_PREMIERE_INSTANCE",
  "CONDAMNATION_DEFINITIVE",
];

async function getPoliticians(
  search?: string,
  partyId?: string,
  withConviction?: boolean,
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
      orderBy: { lastName: "asc" },
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
  return db.party.findMany({
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
}

async function getConvictionStats() {
  const [withConviction, totalAffairs] = await Promise.all([
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
  ]);

  return { withConviction, totalAffairs };
}

export default async function PolitiquesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const search = params.search || "";
  const partyFilter = params.party || "";
  const convictionFilter = params.conviction === "true";
  const page = parseInt(params.page || "1", 10);

  const [{ politicians, total, totalPages }, parties, stats] = await Promise.all([
    getPoliticians(search, partyFilter, convictionFilter, page),
    getParties(),
    getConvictionStats(),
  ]);

  // Build URL with current filters
  function buildUrl(newParams: Record<string, string | undefined>) {
    const url = new URLSearchParams();
    const finalParams = {
      search: search || undefined,
      party: partyFilter || undefined,
      conviction: convictionFilter ? "true" : undefined,
      page: undefined, // Reset page when changing filters
      ...newParams,
    };

    Object.entries(finalParams).forEach(([key, value]) => {
      if (value) url.set(key, value);
    });

    const queryString = url.toString();
    return `/politiques${queryString ? `?${queryString}` : ""}`;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Représentants politiques</h1>
        <p className="text-muted-foreground">
          {total} représentants
          {search && ` pour "${search}"`}
          {partyFilter && ` dans ce parti`}
          {convictionFilter && ` avec condamnation`}
        </p>
      </div>

      {/* Search and filters */}
      <div className="mb-8 space-y-4">
        {/* Search bar */}
        <form className="flex gap-4 flex-wrap" action="/politiques">
          <Input
            type="search"
            name="search"
            placeholder="Rechercher par nom..."
            defaultValue={search}
            className="max-w-sm"
          />
          {partyFilter && <input type="hidden" name="party" value={partyFilter} />}
          {convictionFilter && <input type="hidden" name="conviction" value="true" />}
          <button
            type="submit"
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Rechercher
          </button>
          {(search || partyFilter || convictionFilter) && (
            <Link
              href="/politiques"
              className="px-4 py-2 border rounded-md hover:bg-gray-50 text-muted-foreground"
            >
              Réinitialiser
            </Link>
          )}
        </form>

        {/* Quick filters */}
        <div className="flex flex-wrap items-center gap-4">
          {/* Party filter */}
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
                <select
                  className="text-xs border rounded px-2 py-1"
                  value={partyFilter}
                  onChange={(e) => {
                    if (e.target.value) {
                      window.location.href = buildUrl({ party: e.target.value });
                    }
                  }}
                >
                  <option value="">+ autres...</option>
                  {parties.slice(8).map((party) => (
                    <option key={party.id} value={party.id}>
                      {party.shortName} ({party._count.politicians})
                    </option>
                  ))}
                </select>
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
                Avec condamnation ({stats.withConviction})
              </Badge>
            </Link>
          </div>
        </div>
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
                  className="px-4 py-2 border rounded-md hover:bg-gray-50"
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
                  className="px-4 py-2 border rounded-md hover:bg-gray-50"
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
