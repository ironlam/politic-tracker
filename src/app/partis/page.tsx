import Image from "next/image";
import { Metadata } from "next";
import Link from "next/link";
import { cacheTag, cacheLife } from "next/cache";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/StatCard";
import { PoliticalPositionBadge } from "@/components/parties/PoliticalPositionBadge";
import { PartiesFilterBar } from "@/components/parties/PartiesFilterBar";
import { SeoIntro } from "@/components/seo/SeoIntro";
import { AFFAIR_STATUS_NEEDS_PRESUMPTION } from "@/config/labels";
import type { AffairStatus, PoliticalPosition } from "@/types";

export const revalidate = 300; // 5 minutes, cohérent avec l'API

export const metadata: Metadata = {
  title: "Partis politiques",
  description: "Liste des partis politiques français avec leurs membres et historique",
};

type SortOption = "members" | "alpha" | "alpha-desc";
type StatusFilter = "actifs" | "historiques" | "";

// Tier 1: Core query — accepts free-text search (never cached directly)
async function queryParties(
  search?: string,
  position?: PoliticalPosition,
  status?: StatusFilter,
  sort: SortOption = "members"
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conditions: any[] = [];

  if (search) {
    conditions.push({
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { shortName: { contains: search, mode: "insensitive" } },
      ],
    });
  }

  if (position) {
    conditions.push({ politicalPosition: position });
  }

  if (status === "actifs") {
    conditions.push({ dissolvedDate: null, politicians: { some: {} } });
  } else if (status === "historiques") {
    conditions.push({ dissolvedDate: { not: null } });
  }

  const where = conditions.length > 0 ? { AND: conditions } : {};

  const orderBy =
    sort === "alpha"
      ? [{ name: "asc" as const }]
      : sort === "alpha-desc"
        ? [{ name: "desc" as const }]
        : [{ politicians: { _count: "desc" as const } }, { name: "asc" as const }];

  const parties = await db.party.findMany({
    where,
    include: {
      _count: {
        select: {
          politicians: true,
          partyMemberships: true,
        },
      },
      affairsAtTime: {
        where: {
          publicationStatus: "PUBLISHED",
          involvement: { notIn: ["VICTIM", "PLAINTIFF"] },
        },
        select: { id: true, status: true },
      },
      predecessor: {
        select: { shortName: true, slug: true },
      },
    },
    orderBy,
  });

  return parties
    .filter((p) => p.slug)
    .map((party) => {
      const affairs = party.affairsAtTime;
      const condamnations = affairs.filter((a) => a.status === "CONDAMNATION_DEFINITIVE").length;
      const enCours = affairs.filter(
        (a) => AFFAIR_STATUS_NEEDS_PRESUMPTION[a.status as AffairStatus]
      ).length;
      const total = affairs.length;

      return {
        ...party,
        affairCounts: { condamnations, enCours, total },
        affairsAtTime: undefined,
      };
    });
}

// Tier 2: Cached path — bounded params only (no free-text)
async function getPartiesFiltered(
  position?: PoliticalPosition,
  status?: StatusFilter,
  sort: SortOption = "members"
) {
  "use cache";
  cacheTag("parties");
  cacheLife("minutes");
  return queryParties(undefined, position, status, sort);
}

// Tier 3: Uncached path — free-text search
async function searchParties(
  search: string,
  position?: PoliticalPosition,
  status?: StatusFilter,
  sort: SortOption = "members"
) {
  return queryParties(search, position, status, sort);
}

// Router — decides cached vs uncached
async function getParties(
  search?: string,
  position?: PoliticalPosition,
  status?: StatusFilter,
  sort: SortOption = "members"
) {
  if (search) {
    return searchParties(search, position, status, sort);
  }
  return getPartiesFiltered(position, status, sort);
}

// Hex accent colors for stat cards (inline styles per CLAUDE.md convention)
const STAT_ACCENT = {
  actifs: { border: "#2563eb", bg: "#2563eb0a" },
  gauche: { border: "#dc2626", bg: "#dc26260a" },
  centre: { border: "#eab308", bg: "#eab3080a" },
  droite: { border: "#2563eb", bg: "#2563eb0a" },
  affaires: { border: "#d97706", bg: "#d977060a" },
};

async function getPartiesStats() {
  "use cache";
  cacheTag("parties");
  cacheLife("minutes");

  const [counts] = await db.$queryRaw<
    [{ actifs: bigint; gauche: bigint; centre: bigint; droite: bigint; affaires: bigint }]
  >`
    SELECT
      COUNT(*) FILTER (
        WHERE p."dissolvedDate" IS NULL
          AND EXISTS (SELECT 1 FROM "Politician" pol WHERE pol."currentPartyId" = p.id)
      ) AS actifs,
      COUNT(*) FILTER (
        WHERE p."politicalPosition" IN ('FAR_LEFT', 'LEFT', 'CENTER_LEFT')
          AND p."dissolvedDate" IS NULL
      ) AS gauche,
      COUNT(*) FILTER (
        WHERE p."politicalPosition" IN ('CENTER')
          AND p."dissolvedDate" IS NULL
      ) AS centre,
      COUNT(*) FILTER (
        WHERE p."politicalPosition" IN ('CENTER_RIGHT', 'RIGHT', 'FAR_RIGHT')
          AND p."dissolvedDate" IS NULL
      ) AS droite,
      COUNT(DISTINCT p.id) FILTER (
        WHERE EXISTS (
          SELECT 1 FROM "Affair" a
          WHERE a."partyAtTimeId" = p.id
            AND a."publicationStatus" = 'PUBLISHED'
            AND a.involvement NOT IN ('VICTIM', 'PLAINTIFF')
        )
      ) AS affaires
    FROM "Party" p
    WHERE p.slug IS NOT NULL
  `;

  return {
    actifs: Number(counts.actifs),
    gauche: Number(counts.gauche),
    centre: Number(counts.centre),
    droite: Number(counts.droite),
    affaires: Number(counts.affaires),
  };
}

interface PageProps {
  searchParams: Promise<{
    search?: string;
    position?: string;
    status?: string;
    sort?: string;
  }>;
}

export default async function PartiesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const search = params.search || "";
  const position = (params.position || "") as PoliticalPosition | "";
  const statusFilter = (params.status || "actifs") as StatusFilter;
  const sort = (params.sort || "members") as SortOption;

  const [parties, stats] = await Promise.all([
    getParties(search || undefined, position || undefined, statusFilter, sort),
    getPartiesStats(),
  ]);

  const isFiltered = !!(search || position || statusFilter !== "actifs" || sort !== "members");

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-display font-extrabold tracking-tight mb-1">
          Partis politiques
        </h1>
        <p className="text-sm text-muted-foreground">
          Partis politiques français avec leurs membres et historique
        </p>
        <div className="sr-only">
          <SeoIntro
            text={`${stats.actifs} partis politiques français actifs référencés sur Poligraph, avec leurs membres, orientation politique et affaires judiciaires.`}
          />
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <StatCard
          count={stats.actifs}
          label="Partis actifs"
          description="Avec au moins un membre"
          accent={STAT_ACCENT.actifs}
        />
        <StatCard
          count={stats.gauche}
          label="Gauche"
          description="Extrême gauche à centre-gauche"
          accent={STAT_ACCENT.gauche}
        />
        <StatCard
          count={stats.centre}
          label="Centre"
          description="Partis centristes"
          accent={STAT_ACCENT.centre}
        />
        <StatCard
          count={stats.droite}
          label="Droite"
          description="Centre-droit à extrême droite"
          accent={STAT_ACCENT.droite}
        />
        <StatCard
          count={stats.affaires}
          label="Affaires judiciaires"
          description="Partis avec au moins une affaire"
          accent={STAT_ACCENT.affaires}
        />
      </div>

      <PartiesFilterBar
        currentFilters={{
          search,
          position: position || "",
          status: statusFilter,
          sort,
        }}
        total={parties.length}
      />

      {/* Active filters summary */}
      {isFiltered && (
        <div className="mb-6 flex items-center gap-2 text-sm flex-wrap">
          <span className="text-muted-foreground">Filtres actifs :</span>
          {search && <Badge variant="outline">Recherche : {search}</Badge>}
          {position && <Badge variant="outline">Orientation : {position}</Badge>}
          {statusFilter && statusFilter !== "actifs" && (
            <Badge variant="outline">
              {statusFilter === "historiques" ? "Historiques" : "Tous"}
            </Badge>
          )}
          {sort !== "members" && (
            <Badge variant="outline">Tri : {sort === "alpha" ? "A-Z" : "Z-A"}</Badge>
          )}
          <Link href="/partis" className="text-primary hover:underline ml-2">
            Réinitialiser
          </Link>
        </div>
      )}

      {/* Results grid */}
      {parties.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {parties.map((party) => (
            <Link key={party.id} href={`/partis/${party.slug}`} prefetch={false}>
              <Card
                className={`h-full hover:shadow-md transition-shadow ${
                  party.dissolvedDate ? "opacity-75 hover:opacity-100" : ""
                }`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    {party.logoUrl ? (
                      <Image
                        src={party.logoUrl}
                        alt={party.name}
                        width={48}
                        height={48}
                        className="w-12 h-12 object-contain shrink-0"
                      />
                    ) : (
                      <div
                        className="w-12 h-12 rounded-lg flex items-center justify-center text-lg font-bold text-white shrink-0"
                        style={{ backgroundColor: party.color || "#888" }}
                      >
                        {party.shortName.substring(0, 2)}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold truncate">{party.name}</h3>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge variant="outline" className="text-xs" title={party.name}>
                          {party.shortName}
                        </Badge>
                        {party.politicalPosition && (
                          <PoliticalPositionBadge
                            position={party.politicalPosition}
                            source={party.politicalPositionSource}
                            className="text-xs"
                          />
                        )}
                        {party.dissolvedDate && (
                          <Badge variant="secondary" className="text-xs">
                            Dissous
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground flex-wrap">
                        {party._count.politicians > 0 && (
                          <span>{party._count.politicians} membres</span>
                        )}
                        {party.dissolvedDate && party._count.partyMemberships > 0 && (
                          <span>{party._count.partyMemberships} anciens membres</span>
                        )}
                        {party.affairCounts.condamnations > 0 && (
                          <span className="text-amber-600 dark:text-amber-400 font-medium">
                            {party.affairCounts.condamnations} condamnation
                            {party.affairCounts.condamnations > 1 ? "s" : ""} définitive
                            {party.affairCounts.condamnations > 1 ? "s" : ""}
                          </span>
                        )}
                        {party.affairCounts.enCours > 0 && (
                          <span className="text-amber-600 dark:text-amber-400">
                            {party.affairCounts.enCours} procédure
                            {party.affairCounts.enCours > 1 ? "s" : ""} en cours
                          </span>
                        )}
                        {party.affairCounts.total > 0 &&
                          party.affairCounts.total !==
                            party.affairCounts.condamnations + party.affairCounts.enCours && (
                            <span>
                              {party.affairCounts.total} affaire
                              {party.affairCounts.total > 1 ? "s" : ""} judiciaire
                              {party.affairCounts.total > 1 ? "s" : ""}
                            </span>
                          )}
                      </div>
                      {party.predecessor ? (
                        <p className="text-xs text-muted-foreground mt-1">
                          Succède à {party.predecessor.shortName}
                        </p>
                      ) : party.foundedDate ? (
                        <p className="text-xs text-muted-foreground mt-1">
                          Fondé en {new Date(party.foundedDate).getFullYear()}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-2">Aucun parti trouvé</p>
            <p className="text-sm text-muted-foreground">
              Essayez de modifier vos filtres ou{" "}
              <Link href="/partis" className="text-primary hover:underline">
                réinitialisez la recherche
              </Link>
              .
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
