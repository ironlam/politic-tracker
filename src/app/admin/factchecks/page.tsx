import Link from "next/link";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDateShort } from "@/lib/utils";
import { AdminDeleteButton } from "@/components/admin/AdminDeleteButton";
import { FACTCHECK_RATING_LABELS, FACTCHECK_RATING_COLORS } from "@/config/labels";
import type { FactCheckRating, Prisma } from "@/generated/prisma";

interface PageProps {
  searchParams: Promise<{
    search?: string;
    source?: string;
    rating?: string;
    page?: string;
  }>;
}

const ITEMS_PER_PAGE = 20;

async function getFactChecks(params: {
  search?: string;
  source?: string;
  rating?: FactCheckRating;
  page: number;
}) {
  const where: Prisma.FactCheckWhereInput = {};

  if (params.search) {
    where.title = { contains: params.search, mode: "insensitive" };
  }

  if (params.source) {
    where.source = params.source;
  }

  if (params.rating) {
    where.verdictRating = params.rating;
  }

  const [factChecks, total] = await Promise.all([
    db.factCheck.findMany({
      where,
      orderBy: { publishedAt: "desc" },
      skip: (params.page - 1) * ITEMS_PER_PAGE,
      take: ITEMS_PER_PAGE,
      select: {
        id: true,
        title: true,
        sourceUrl: true,
        source: true,
        verdictRating: true,
        publishedAt: true,
        mentions: {
          select: {
            id: true,
            isClaimant: true,
            politician: { select: { slug: true, fullName: true } },
          },
        },
        _count: { select: { mentions: true } },
      },
    }),
    db.factCheck.count({ where }),
  ]);

  return { factChecks, total, totalPages: Math.ceil(total / ITEMS_PER_PAGE) };
}

async function getStats() {
  const [total, totalMentions, byRating] = await Promise.all([
    db.factCheck.count(),
    db.factCheckMention.count(),
    db.factCheck.groupBy({
      by: ["verdictRating"],
      _count: true,
      orderBy: { _count: { verdictRating: "desc" } },
    }),
  ]);

  return {
    total,
    totalMentions,
    byRating: Object.fromEntries(byRating.map((r) => [r.verdictRating, r._count])) as Record<
      string,
      number
    >,
  };
}

async function getSources() {
  const sources = await db.factCheck.groupBy({
    by: ["source"],
    _count: true,
    orderBy: { _count: { source: "desc" } },
  });
  return sources.map((s) => ({ name: s.source, count: s._count }));
}

const RATING_OPTIONS: FactCheckRating[] = [
  "TRUE",
  "MOSTLY_TRUE",
  "HALF_TRUE",
  "MISLEADING",
  "OUT_OF_CONTEXT",
  "MOSTLY_FALSE",
  "FALSE",
  "UNVERIFIABLE",
];

export default async function AdminFactchecksPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = parseInt(params.page || "1", 10);
  const rating = RATING_OPTIONS.includes(params.rating as FactCheckRating)
    ? (params.rating as FactCheckRating)
    : undefined;

  const [{ factChecks, total, totalPages }, stats, sources] = await Promise.all([
    getFactChecks({ search: params.search, source: params.source, rating, page }),
    getStats(),
    getSources(),
  ]);

  const hasFilters = !!(params.search || params.source || params.rating);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-bold tracking-tight">Fact-checks</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {stats.total} fact-checks — {stats.totalMentions} mentions
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold tabular-nums">{stats.total}</div>
            <p className="text-xs text-muted-foreground mt-0.5">Total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold tabular-nums text-primary">
              {stats.totalMentions}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">Mentions</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold tabular-nums text-red-600">
              {(stats.byRating["FALSE"] || 0) + (stats.byRating["MOSTLY_FALSE"] || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">Faux / Plutôt faux</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold tabular-nums text-green-600">
              {(stats.byRating["TRUE"] || 0) + (stats.byRating["MOSTLY_TRUE"] || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">Vrai / Plutôt vrai</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <form className="flex-1 min-w-[200px]">
          <input
            type="search"
            name="search"
            placeholder="Rechercher un fact-check..."
            defaultValue={params.search}
            className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background"
          />
          {params.source && <input type="hidden" name="source" value={params.source} />}
          {params.rating && <input type="hidden" name="rating" value={params.rating} />}
        </form>

        {/* Source filter chips */}
        <div className="flex flex-wrap gap-1.5">
          <Link
            href={{
              pathname: "/admin/factchecks",
              query: { ...params, source: undefined, page: undefined },
            }}
            className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
              !params.source
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border hover:bg-muted"
            }`}
          >
            Toutes sources
          </Link>
          {sources.slice(0, 6).map((s) => (
            <Link
              key={s.name}
              href={{
                pathname: "/admin/factchecks",
                query: { ...params, source: s.name, page: undefined },
              }}
              className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                params.source === s.name
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border hover:bg-muted"
              }`}
            >
              {s.name} ({s.count})
            </Link>
          ))}
        </div>

        {/* Rating filter chips */}
        <div className="flex flex-wrap gap-1.5">
          <Link
            href={{
              pathname: "/admin/factchecks",
              query: { ...params, rating: undefined, page: undefined },
            }}
            className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
              !params.rating
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border hover:bg-muted"
            }`}
          >
            Tous verdicts
          </Link>
          {RATING_OPTIONS.map((r) => (
            <Link
              key={r}
              href={{
                pathname: "/admin/factchecks",
                query: { ...params, rating: r, page: undefined },
              }}
              className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                params.rating === r
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border hover:bg-muted"
              }`}
            >
              {FACTCHECK_RATING_LABELS[r]}
            </Link>
          ))}
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="text-sm text-muted-foreground">
              {total} fact-check{total !== 1 ? "s" : ""} trouvé{total !== 1 ? "s" : ""}
            </span>
            {totalPages > 1 && (
              <span className="text-xs text-muted-foreground">
                Page {page}/{totalPages}
              </span>
            )}
          </div>

          {factChecks.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="px-4 py-3 font-medium text-muted-foreground">Titre</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground">Source</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground">Verdict</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground">Mentions</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground">Date</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {factChecks.map((fc) => (
                    <tr key={fc.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 max-w-md">
                        <a
                          href={fc.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium hover:underline line-clamp-2 text-primary"
                        >
                          {fc.title}
                        </a>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline">{fc.source}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={FACTCHECK_RATING_COLORS[fc.verdictRating]}>
                          {FACTCHECK_RATING_LABELS[fc.verdictRating]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        {fc.mentions.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {fc.mentions.map((m) => (
                              <span
                                key={m.id}
                                className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-muted rounded-full"
                              >
                                <Link
                                  href={`/politiques/${m.politician.slug}`}
                                  className="hover:underline"
                                  prefetch={false}
                                >
                                  {m.politician.fullName}
                                </Link>
                                {m.isClaimant && (
                                  <span
                                    className="text-[10px] text-amber-600"
                                    title="Auteur de la déclaration"
                                  >
                                    auteur
                                  </span>
                                )}
                                <AdminDeleteButton
                                  endpoint={`/api/admin/factchecks/mentions/${m.id}`}
                                  label="Délier"
                                  confirmMessage={`Délier ${m.politician.fullName} de ce fact-check ?`}
                                  size="icon"
                                />
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {formatDateShort(fc.publishedAt)}
                      </td>
                      <td className="px-4 py-3">
                        <AdminDeleteButton
                          endpoint={`/api/admin/factchecks/${fc.id}`}
                          confirmMessage={`Supprimer le fact-check "${fc.title.slice(0, 60)}..." et toutes ses mentions ?`}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center text-sm text-muted-foreground">
              {hasFilters
                ? "Aucun fact-check trouvé avec ces critères"
                : "Aucun fact-check enregistré"}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {total} résultat{total !== 1 ? "s" : ""} — page {page}/{totalPages}
          </p>
          <div className="flex items-center gap-1">
            {page > 1 && (
              <Link
                href={{
                  pathname: "/admin/factchecks",
                  query: { ...params, page: page - 1 },
                }}
                className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-muted transition-colors"
              >
                Précédent
              </Link>
            )}
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const pageNum = Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
              if (pageNum > totalPages) return null;
              return (
                <Link
                  key={pageNum}
                  href={{
                    pathname: "/admin/factchecks",
                    query: { ...params, page: pageNum },
                  }}
                  className={`px-3 py-1.5 text-sm border rounded-lg transition-colors ${
                    pageNum === page
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border hover:bg-muted"
                  }`}
                >
                  {pageNum}
                </Link>
              );
            })}
            {page < totalPages && (
              <Link
                href={{
                  pathname: "/admin/factchecks",
                  query: { ...params, page: page + 1 },
                }}
                className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-muted transition-colors"
              >
                Suivant
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
