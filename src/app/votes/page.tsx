import { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { VoteCard } from "@/components/votes";
import { Badge } from "@/components/ui/badge";
import { VOTING_RESULT_LABELS } from "@/config/labels";
import type { VotingResult } from "@/types";

export const metadata: Metadata = {
  title: "Votes parlementaires",
  description: "Suivez les votes des députés à l'Assemblée nationale. Consultez les scrutins et découvrez comment votent vos représentants.",
};

interface PageProps {
  searchParams: Promise<{
    page?: string;
    result?: string;
    legislature?: string;
    search?: string;
  }>;
}

async function getScrutins(params: {
  page: number;
  limit: number;
  result?: VotingResult;
  legislature?: number;
  search?: string;
}) {
  const { page, limit, result, legislature, search } = params;
  const skip = (page - 1) * limit;

  const where = {
    ...(result && { result }),
    ...(legislature && { legislature }),
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
  return db.scrutin.groupBy({
    by: ["legislature"],
    _count: true,
    orderBy: { legislature: "desc" },
  });
}

export default async function VotesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || "1", 10));
  const limit = 20;
  const result = params.result as VotingResult | undefined;
  const legislature = params.legislature ? parseInt(params.legislature, 10) : undefined;
  const search = params.search;

  const [{ scrutins, total, totalPages, stats }, legislatures] = await Promise.all([
    getScrutins({ page, limit, result, legislature, search }),
    getLegislatures(),
  ]);

  // Build filter URL helper
  const buildUrl = (newParams: Record<string, string | undefined>) => {
    const current = new URLSearchParams();
    if (params.search) current.set("search", params.search);
    if (params.result) current.set("result", params.result);
    if (params.legislature) current.set("legislature", params.legislature);

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

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Votes parlementaires</h1>
        <p className="text-muted-foreground">
          Consultez les scrutins de l&apos;Assemblée nationale et découvrez comment votent les députés.
        </p>
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
              !result
                ? "bg-primary text-primary-foreground"
                : "bg-muted hover:bg-muted/80"
            }`}
          >
            Tous
          </Link>
          {(["ADOPTED", "REJECTED"] as VotingResult[]).map((r) => (
            <Link
              key={r}
              href={buildUrl({ result: r })}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                result === r
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-muted/80"
              }`}
            >
              {VOTING_RESULT_LABELS[r]}
            </Link>
          ))}
        </div>

        {/* Legislature filter */}
        {legislatures.length > 1 && (
          <div className="flex gap-2">
            {legislatures.map((leg) => (
              <Link
                key={leg.legislature}
                href={buildUrl({
                  legislature:
                    legislature === leg.legislature
                      ? undefined
                      : String(leg.legislature),
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

      {/* Active filters */}
      {(result || legislature || search) && (
        <div className="flex flex-wrap gap-2 mb-6">
          {search && (
            <Badge variant="secondary" className="gap-1">
              Recherche: {search}
              <Link href={buildUrl({ search: undefined })} className="ml-1 hover:text-destructive">
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
          {legislature && (
            <Badge variant="secondary" className="gap-1">
              {legislature}e législature
              <Link href={buildUrl({ legislature: undefined })} className="ml-1 hover:text-destructive">
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
              title={scrutin.title}
              votingDate={scrutin.votingDate}
              legislature={scrutin.legislature}
              votesFor={scrutin.votesFor}
              votesAgainst={scrutin.votesAgainst}
              votesAbstain={scrutin.votesAbstain}
              result={scrutin.result}
              sourceUrl={scrutin.sourceUrl}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          <p>Aucun scrutin trouvé</p>
          {(result || legislature || search) && (
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
          </a>
          {" "}(Open Data officiel)
        </p>
      </div>
    </div>
  );
}
