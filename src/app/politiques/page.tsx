import { Metadata } from "next";
import { cacheTag, cacheLife } from "next/cache";
import { db } from "@/lib/db";
import {
  type SortOption,
  type MandateFilter,
  type StatusFilter,
} from "@/components/politicians/FilterBar";
import { AffairStatus, MandateType } from "@/generated/prisma";
import { SearchForm } from "@/components/politicians/SearchForm";
import { PoliticiansGrid } from "@/components/politicians/PoliticiansGrid";
import { ExportButton } from "@/components/ui/ExportButton";

// Minimum members to show a party in filters (avoid cluttering with old/small parties)
const MIN_PARTY_MEMBERS = 2;

export const revalidate = 300; // 5 minutes — CDN edge cache with ISR

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
  president_parti: ["PRESIDENT_PARTI"],
  dirigeants: ["PRESIDENT_PARTI"], // Also includes significant party roles (handled separately)
};

// Sort configurations - using 'any' to handle complex Prisma orderBy types
const SORT_CONFIGS: Record<SortOption, unknown> = {
  prominence: [{ prominenceScore: "desc" }, { lastName: "asc" }],
  alpha: { lastName: "asc" },
  "alpha-desc": { lastName: "desc" },
  recent: { createdAt: "desc" },
  affairs: [{ affairs: { _count: "desc" } }, { lastName: "asc" }],
};

// Core query logic shared by cached and uncached paths
async function queryPoliticians(
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

  // Build where clause using AND array for composability
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conditions: any[] = [];

  // Only show PUBLISHED politicians by default
  conditions.push({ publicationStatus: "PUBLISHED" as const });

  if (search) {
    conditions.push({
      OR: [
        { fullName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { firstName: { contains: search, mode: "insensitive" } },
      ],
    });
  }

  if (partyId) {
    conditions.push({ currentPartyId: partyId });
  }

  if (withConviction) {
    conditions.push({
      affairs: {
        some: {
          status: { in: CONVICTION_STATUSES },
          publicationStatus: "PUBLISHED",
        },
      },
    });
  }

  // Build mandate filter conditions
  // Note: mandate filter implies isCurrent: true (filtering by current role)
  // Status filter: active = has any current mandate OR significant party role
  if (mandateFilter === "dirigeants") {
    // Filter: party presidents + significant party roles
    conditions.push({
      OR: [
        { mandates: { some: { type: "PRESIDENT_PARTI", isCurrent: true } } },
        { partyHistory: { some: { endDate: null, role: { not: "MEMBER" } } } },
      ],
    });
  } else if (mandateFilter && MANDATE_GROUPS[mandateFilter]) {
    // Filter by specific mandate type (always current)
    conditions.push({
      mandates: {
        some: {
          type: { in: MANDATE_GROUPS[mandateFilter] },
          isCurrent: true,
        },
      },
    });
  } else if (statusFilter === "active") {
    // Has any current mandate OR significant party role
    conditions.push({
      OR: [
        { mandates: { some: { isCurrent: true } } },
        { partyHistory: { some: { endDate: null, role: { not: "MEMBER" } } } },
      ],
    });
  } else if (statusFilter === "former") {
    // No current mandate AND no significant party role
    conditions.push({
      mandates: { none: { isCurrent: true } },
      partyHistory: { none: { endDate: null, role: { not: "MEMBER" } } },
    });
  }

  const where = conditions.length > 0 ? { AND: conditions } : {};

  // Get order by config
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orderBy = (SORT_CONFIGS[sortOption] || SORT_CONFIGS.alpha) as any;

  const [politicians, total] = await Promise.all([
    db.politician.findMany({
      where,
      include: {
        currentParty: true,
        _count: {
          select: { affairs: { where: { publicationStatus: "PUBLISHED" } } },
        },
        affairs: {
          where: { status: { in: CONVICTION_STATUSES }, publicationStatus: "PUBLISHED" },
          select: { id: true },
          take: 1,
        },
        mandates: {
          where: { isCurrent: true },
          orderBy: { startDate: "desc" },
          take: 1,
          select: {
            type: true,
            title: true,
            constituency: true,
          },
        },
        partyHistory: {
          where: {
            endDate: null,
            role: { not: "MEMBER" },
          },
          take: 1,
          include: {
            party: {
              select: { name: true, shortName: true },
            },
          },
        },
      },
      orderBy,
      skip,
      take: limit,
    }),
    db.politician.count({ where }),
  ]);

  // Transform to add hasConviction flag, current mandate, and significant party role
  const politiciansWithConviction = politicians.map((p) => {
    const significantRole = p.partyHistory[0] || null;
    return {
      ...p,
      hasConviction: p.affairs.length > 0,
      affairs: undefined,
      currentMandate: p.mandates[0] || null,
      mandates: undefined,
      partyHistory: undefined,
      significantPartyRole: significantRole
        ? {
            role: significantRole.role,
            partyName: significantRole.party.name,
            partyShortName: significantRole.party.shortName,
          }
        : null,
    };
  });

  return {
    politicians: politiciansWithConviction,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

// Cached path — bounded key space (enums + page, no free-text search)
async function getPoliticiansFiltered(
  partyId?: string,
  withConviction?: boolean,
  mandateFilter?: MandateFilter,
  statusFilter?: StatusFilter,
  sortOption: SortOption = "alpha",
  page = 1
) {
  "use cache";
  cacheTag("politicians");
  cacheLife("minutes");
  return queryPoliticians(
    undefined,
    partyId,
    withConviction,
    mandateFilter,
    statusFilter,
    sortOption,
    page
  );
}

// Uncached path — free-text search creates unbounded key space
async function searchPoliticians(
  search: string,
  partyId?: string,
  withConviction?: boolean,
  mandateFilter?: MandateFilter,
  statusFilter?: StatusFilter,
  sortOption: SortOption = "alpha",
  page = 1
) {
  return queryPoliticians(
    search,
    partyId,
    withConviction,
    mandateFilter,
    statusFilter,
    sortOption,
    page
  );
}

// Router: use cached path when no search, uncached when searching
async function getPoliticians(
  search?: string,
  partyId?: string,
  withConviction?: boolean,
  mandateFilter?: MandateFilter,
  statusFilter?: StatusFilter,
  sortOption: SortOption = "alpha",
  page = 1
) {
  if (search) {
    return searchPoliticians(
      search,
      partyId,
      withConviction,
      mandateFilter,
      statusFilter,
      sortOption,
      page
    );
  }
  return getPoliticiansFiltered(
    partyId,
    withConviction,
    mandateFilter,
    statusFilter,
    sortOption,
    page
  );
}

async function getParties() {
  "use cache";
  cacheTag("politicians", "parties");
  cacheLife("minutes");

  const parties = await db.party.findMany({
    where: {
      politicians: { some: {} }, // Only parties with members
    },
    orderBy: [{ politicians: { _count: "desc" } }, { name: "asc" }],
    include: {
      _count: { select: { politicians: true } },
    },
  });

  // Filter out parties with too few members (old/merged parties)
  return parties.filter((p) => p._count.politicians >= MIN_PARTY_MEMBERS);
}

async function getFilterCounts() {
  "use cache";
  cacheTag("politicians");
  cacheLife("minutes");

  const [
    withConviction,
    totalAffairs,
    deputes,
    senateurs,
    gouvernement,
    presidentParti,
    dirigeants,
    active,
    former,
  ] = await Promise.all([
    // Conviction counts
    db.politician.count({
      where: {
        publicationStatus: "PUBLISHED",
        affairs: {
          some: { status: { in: CONVICTION_STATUSES }, publicationStatus: "PUBLISHED" },
        },
      },
    }),
    db.affair.count({
      where: { publicationStatus: "PUBLISHED", status: { in: CONVICTION_STATUSES } },
    }),
    // Mandate counts (current mandates only)
    db.politician.count({
      where: {
        publicationStatus: "PUBLISHED",
        mandates: {
          some: { type: "DEPUTE", isCurrent: true },
        },
      },
    }),
    db.politician.count({
      where: {
        publicationStatus: "PUBLISHED",
        mandates: {
          some: { type: "SENATEUR", isCurrent: true },
        },
      },
    }),
    db.politician.count({
      where: {
        publicationStatus: "PUBLISHED",
        mandates: {
          some: {
            type: { in: MANDATE_GROUPS.gouvernement },
            isCurrent: true,
          },
        },
      },
    }),
    db.politician.count({
      where: {
        publicationStatus: "PUBLISHED",
        mandates: {
          some: { type: "PRESIDENT_PARTI", isCurrent: true },
        },
      },
    }),
    // Dirigeants: PRESIDENT_PARTI + significant party roles
    db.politician.count({
      where: {
        publicationStatus: "PUBLISHED",
        OR: [
          { mandates: { some: { type: "PRESIDENT_PARTI", isCurrent: true } } },
          { partyHistory: { some: { endDate: null, role: { not: "MEMBER" } } } },
        ],
      },
    }),
    // Status counts (active = has current mandate OR significant party role)
    db.politician.count({
      where: {
        publicationStatus: "PUBLISHED",
        OR: [
          { mandates: { some: { isCurrent: true } } },
          { partyHistory: { some: { endDate: null, role: { not: "MEMBER" } } } },
        ],
      },
    }),
    db.politician.count({
      where: {
        publicationStatus: "PUBLISHED",
        AND: [
          { mandates: { none: { isCurrent: true } } },
          { partyHistory: { none: { endDate: null, role: { not: "MEMBER" } } } },
        ],
      },
    }),
  ]);

  return {
    withConviction,
    totalAffairs,
    deputes,
    senateurs,
    gouvernement,
    presidentParti,
    dirigeants,
    active,
    former,
  };
}

export default async function PolitiquesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const search = params.search || "";
  const partyFilter = params.party || "";
  const convictionFilter = params.conviction === "true";
  const mandateFilter = (params.mandate || "") as MandateFilter;
  const statusFilter = (params.status || "active") as StatusFilter;
  const sortOption = (params.sort || "prominence") as SortOption;
  const page = parseInt(params.page || "1", 10);

  const [{ politicians, total, totalPages }, parties, counts] = await Promise.all([
    getPoliticians(
      search,
      partyFilter,
      convictionFilter,
      mandateFilter,
      statusFilter,
      sortOption,
      page
    ),
    getParties(),
    getFilterCounts(),
  ]);

  // Count active filters
  const activeFilterCount = [partyFilter, convictionFilter, mandateFilter, statusFilter].filter(
    Boolean
  ).length;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">Représentants politiques</h1>
          <p className="text-muted-foreground">
            {total} représentants
            {search && ` pour "${search}"`}
            {activeFilterCount > 0 &&
              ` (${activeFilterCount} filtre${activeFilterCount > 1 ? "s" : ""} actif${activeFilterCount > 1 ? "s" : ""})`}
          </p>
        </div>
        <ExportButton
          endpoint="/api/export/politiques"
          label="Export CSV"
          params={{
            partyId: partyFilter || undefined,
            hasAffairs: convictionFilter ? "true" : undefined,
          }}
        />
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

      {/* Filters, grid, and pagination with loading states */}
      <PoliticiansGrid
        politicians={politicians}
        total={total}
        page={page}
        totalPages={totalPages}
        parties={parties}
        counts={counts}
        filters={{
          search,
          partyFilter,
          convictionFilter,
          mandateFilter,
          statusFilter,
          sortOption,
        }}
      />
    </div>
  );
}
