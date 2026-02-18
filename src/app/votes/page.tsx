import { Metadata } from "next";
import Link from "next/link";
import { cacheTag, cacheLife } from "next/cache";
import { db } from "@/lib/db";
import { VoteCard } from "@/components/votes";
import { Badge } from "@/components/ui/badge";
import { ExportButton } from "@/components/ui/ExportButton";
import {
  VOTING_RESULT_LABELS,
  CHAMBER_LABELS,
  THEME_CATEGORY_LABELS,
  THEME_CATEGORY_ICONS,
  THEME_CATEGORY_COLORS,
} from "@/config/labels";
import type { VotingResult, Chamber, ThemeCategory } from "@/types";

export const metadata: Metadata = {
  title: "Votes parlementaires",
  description:
    "Suivez les votes de l'Assemblée nationale et du Sénat. Consultez les scrutins et découvrez comment votent vos représentants.",
};

interface PageProps {
  searchParams: Promise<{
    page?: string;
    result?: string;
    legislature?: string;
    chamber?: string;
    theme?: string;
    search?: string;
  }>;
}

async function getScrutins(params: {
  page: number;
  limit: number;
  result?: VotingResult;
  legislature?: number;
  chamber?: Chamber;
  theme?: ThemeCategory;
  search?: string;
}) {
  // No "use cache" here — free-text `search` param creates unbounded key space.
  // Bounded-param functions (getLegislatures, getChambers, getThemeCounts) keep their cache.

  const { page, limit, result, legislature, chamber, theme, search } = params;
  const skip = (page - 1) * limit;

  const where = {
    ...(result && { result }),
    ...(legislature && { legislature }),
    ...(chamber && { chamber }),
    ...(theme && { theme }),
    ...(search && {
      title: { contains: search, mode: "insensitive" as const },
    }),
  };

  const [scrutins, total, stats] = await Promise.all([
    db.scrutin.findMany({
      where,
      orderBy: { votingDate: "desc" },
      skip,
      take: limit,
    }),
    db.scrutin.count({ where }),
    db.scrutin.groupBy({
      by: ["result"],
      _count: true,
    }),
  ]);

  return {
    scrutins,
    total,
    totalPages: Math.ceil(total / limit),
    stats: stats.reduce(
      (acc, s) => {
        acc[s.result] = s._count;
        return acc;
      },
      {} as Record<string, number>
    ),
  };
}

async function getLegislatures() {
  "use cache";
  cacheTag("votes");
  cacheLife("minutes");

  return db.scrutin.groupBy({
    by: ["legislature"],
    _count: true,
    orderBy: { legislature: "desc" },
  });
}

async function getChambers() {
  "use cache";
  cacheTag("votes");
  cacheLife("minutes");

  return db.scrutin.groupBy({
    by: ["chamber"],
    _count: true,
  });
}

async function getThemeCounts() {
  "use cache";
  cacheTag("votes");
  cacheLife("minutes");

  const counts = await db.scrutin.groupBy({
    by: ["theme"],
    _count: true,
    orderBy: { _count: { theme: "desc" } },
  });
  return counts.filter((c) => c.theme !== null) as { theme: ThemeCategory; _count: number }[];
}

export default async function VotesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || "1", 10));
  const limit = 20;
  const result = params.result as VotingResult | undefined;
  const legislature = params.legislature ? parseInt(params.legislature, 10) : undefined;
  const chamber = params.chamber as Chamber | undefined;
  const theme = params.theme as ThemeCategory | undefined;
  const search = params.search;

  const [{ scrutins, total, totalPages, stats }, legislatures, chambers, themeCounts] =
    await Promise.all([
      getScrutins({ page, limit, result, legislature, chamber, theme, search }),
      getLegislatures(),
      getChambers(),
      getThemeCounts(),
    ]);

  // Build filter URL helper
  const buildUrl = (newParams: Record<string, string | undefined>) => {
    const current = new URLSearchParams();
    if (params.search) current.set("search", params.search);
    if (params.result) current.set("result", params.result);
    if (params.legislature) current.set("legislature", params.legislature);
    if (params.chamber) current.set("chamber", params.chamber);
    if (params.theme) current.set("theme", params.theme);

    for (const [key, value] of Object.entries(newParams)) {
      if (value) {
        current.set(key, value);
      } else {
        current.delete(key);
      }
    }

    // Reset page when filters change
    if (Object.keys(newParams).some((k) => k !== "page")) {
      current.delete("page");
    }

    const qs = current.toString();
    return `/votes${qs ? `?${qs}` : ""}`;
  };

  // Check if we have multiple chambers
  const hasMultipleChambers = chambers.length > 1;

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">Votes parlementaires</h1>
          <p className="text-muted-foreground">
            Consultez les scrutins de l&apos;Assemblée nationale et du Sénat. Découvrez comment
            votent vos représentants.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/statistiques?tab=votes"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-muted hover:bg-muted/80 text-sm font-medium transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
            Statistiques
          </Link>
          <ExportButton
            endpoint="/api/export/votes"
            label="Export CSV"
            params={{
              chamber: chamber,
              result: result,
              legislature: legislature?.toString(),
            }}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-muted rounded-lg p-4 text-center">
          <p className="text-2xl font-bold">{total}</p>
          <p className="text-sm text-muted-foreground">Scrutins</p>
        </div>
        <div className="bg-green-50 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{stats.ADOPTED || 0}</p>
          <p className="text-sm text-muted-foreground">Adoptés</p>
        </div>
        <div className="bg-red-50 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-red-600">{stats.REJECTED || 0}</p>
          <p className="text-sm text-muted-foreground">Rejetés</p>
        </div>
        <div className="bg-blue-50 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-blue-600">{legislatures.length}</p>
          <p className="text-sm text-muted-foreground">Législatures</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        {/* Search */}
        <form className="flex-1 min-w-[200px]">
          <input
            type="text"
            name="search"
            placeholder="Rechercher un scrutin..."
            defaultValue={search}
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <input type="hidden" name="result" value={result || ""} />
          <input type="hidden" name="legislature" value={legislature || ""} />
        </form>

        {/* Result filter */}
        <div className="flex gap-2">
          <Link
            href={buildUrl({ result: undefined })}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              !result ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"
            }`}
          >
            Tous
          </Link>
          {(["ADOPTED", "REJECTED"] as VotingResult[]).map((r) => (
            <Link
              key={r}
              href={buildUrl({ result: r })}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                result === r ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"
              }`}
            >
              {VOTING_RESULT_LABELS[r]}
            </Link>
          ))}
        </div>

        {/* Chamber filter */}
        {hasMultipleChambers && (
          <div className="flex gap-2">
            <Link
              href={buildUrl({ chamber: undefined })}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                !chamber ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"
              }`}
            >
              Toutes
            </Link>
            {chambers.map((c) => (
              <Link
                key={c.chamber}
                href={buildUrl({
                  chamber: chamber === c.chamber ? undefined : c.chamber,
                })}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  chamber === c.chamber
                    ? c.chamber === "AN"
                      ? "bg-blue-600 text-white"
                      : "bg-rose-600 text-white"
                    : c.chamber === "AN"
                      ? "bg-blue-50 text-blue-700 hover:bg-blue-100"
                      : "bg-rose-50 text-rose-700 hover:bg-rose-100"
                }`}
              >
                {CHAMBER_LABELS[c.chamber]} ({c._count})
              </Link>
            ))}
          </div>
        )}

        {/* Legislature filter */}
        {legislatures.length > 1 && (
          <div className="flex gap-2">
            {legislatures.map((leg) => (
              <Link
                key={leg.legislature}
                href={buildUrl({
                  legislature:
                    legislature === leg.legislature ? undefined : String(leg.legislature),
                })}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  legislature === leg.legislature
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted hover:bg-muted/80"
                }`}
              >
                {leg.legislature}e ({leg._count})
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Theme filter */}
      {themeCounts.length > 0 && (
        <div className="mb-6">
          <p className="text-sm font-medium mb-2">Filtrer par thème</p>
          <div className="flex flex-wrap gap-2">
            <Link href={buildUrl({ theme: undefined })}>
              <Badge variant={!theme ? "default" : "outline"} className="cursor-pointer">
                Tous
              </Badge>
            </Link>
            {themeCounts.map((t) => {
              const isActive = theme === t.theme;
              const colorClass = THEME_CATEGORY_COLORS[t.theme];
              const icon = THEME_CATEGORY_ICONS[t.theme];
              const label = THEME_CATEGORY_LABELS[t.theme];

              return (
                <Link
                  key={t.theme}
                  href={buildUrl({
                    theme: isActive ? undefined : t.theme,
                  })}
                >
                  <Badge
                    variant={isActive ? "default" : "outline"}
                    className={`cursor-pointer ${isActive ? colorClass : ""}`}
                  >
                    {icon} {label} ({t._count})
                  </Badge>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Active filters */}
      {(result || legislature || chamber || theme || search) && (
        <div className="flex flex-wrap gap-2 mb-6">
          {search && (
            <Badge variant="secondary" className="gap-1">
              Recherche: {search}
              <Link href={buildUrl({ search: undefined })} className="ml-1 hover:text-destructive">
                ×
              </Link>
            </Badge>
          )}
          {chamber && (
            <Badge variant="secondary" className="gap-1">
              {CHAMBER_LABELS[chamber]}
              <Link href={buildUrl({ chamber: undefined })} className="ml-1 hover:text-destructive">
                ×
              </Link>
            </Badge>
          )}
          {result && (
            <Badge variant="secondary" className="gap-1">
              {VOTING_RESULT_LABELS[result]}
              <Link href={buildUrl({ result: undefined })} className="ml-1 hover:text-destructive">
                ×
              </Link>
            </Badge>
          )}
          {theme && (
            <Badge variant="secondary" className="gap-1">
              {THEME_CATEGORY_ICONS[theme]} {THEME_CATEGORY_LABELS[theme]}
              <Link href={buildUrl({ theme: undefined })} className="ml-1 hover:text-destructive">
                ×
              </Link>
            </Badge>
          )}
          {legislature && (
            <Badge variant="secondary" className="gap-1">
              {legislature}e législature
              <Link
                href={buildUrl({ legislature: undefined })}
                className="ml-1 hover:text-destructive"
              >
                ×
              </Link>
            </Badge>
          )}
          <Link href="/votes" className="text-sm text-muted-foreground hover:text-foreground">
            Effacer tout
          </Link>
        </div>
      )}

      {/* List */}
      {scrutins.length > 0 ? (
        <div className="space-y-4">
          {scrutins.map((scrutin) => (
            <VoteCard
              key={scrutin.id}
              id={scrutin.id}
              externalId={scrutin.externalId}
              slug={scrutin.slug}
              title={scrutin.title}
              votingDate={scrutin.votingDate}
              legislature={scrutin.legislature}
              chamber={scrutin.chamber}
              votesFor={scrutin.votesFor}
              votesAgainst={scrutin.votesAgainst}
              votesAbstain={scrutin.votesAbstain}
              result={scrutin.result}
              sourceUrl={scrutin.sourceUrl}
              theme={scrutin.theme}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          <p>Aucun scrutin trouvé</p>
          {(result || legislature || search || theme) && (
            <Link href="/votes" className="text-primary hover:underline mt-2 inline-block">
              Effacer les filtres
            </Link>
          )}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-8">
          {page > 1 && (
            <Link
              href={buildUrl({ page: String(page - 1) })}
              className="px-4 py-2 rounded-lg bg-muted hover:bg-muted/80"
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
              className="px-4 py-2 rounded-lg bg-muted hover:bg-muted/80"
            >
              Suivant
            </Link>
          )}
        </div>
      )}

      {/* Source */}
      <div className="mt-8 text-center text-sm text-muted-foreground">
        <p>
          Données issues de{" "}
          <a
            href="https://data.assemblee-nationale.fr"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            data.assemblee-nationale.fr
          </a>{" "}
          et{" "}
          <a
            href="https://www.senat.fr/scrutin-public/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            senat.fr
          </a>{" "}
          (Open Data officiel)
        </p>
      </div>
    </div>
  );
}
