import Link from "next/link";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DOSSIER_STATUS_LABELS,
  DOSSIER_STATUS_COLORS,
  DOSSIER_CATEGORY_COLORS,
  THEME_CATEGORY_LABELS,
  THEME_CATEGORY_COLORS,
} from "@/config/labels";
import { formatDate } from "@/lib/utils";
import { DossierFilters } from "@/components/admin/DossierFilters";
import type { DossierStatus, ThemeCategory, Prisma } from "@/generated/prisma";

interface PageProps {
  searchParams: Promise<{
    status?: string;
    category?: string;
    theme?: string;
    search?: string;
    page?: string;
    hasSummary?: string;
  }>;
}

const ITEMS_PER_PAGE = 20;

async function getDossiers(params: {
  status?: DossierStatus;
  category?: string;
  theme?: ThemeCategory;
  search?: string;
  page: number;
  hasSummary?: boolean;
}) {
  const where: Prisma.LegislativeDossierWhereInput = {};

  if (params.status) {
    where.status = params.status;
  }

  if (params.category) {
    where.category = params.category;
  }

  if (params.theme) {
    where.theme = params.theme;
  }

  if (params.search) {
    where.OR = [
      { title: { contains: params.search, mode: "insensitive" } },
      { shortTitle: { contains: params.search, mode: "insensitive" } },
      { number: { contains: params.search, mode: "insensitive" } },
    ];
  }

  if (params.hasSummary === true) {
    where.summary = { not: null };
  } else if (params.hasSummary === false) {
    where.summary = null;
  }

  const [dossiers, total] = await Promise.all([
    db.legislativeDossier.findMany({
      where,
      orderBy: [{ filingDate: "desc" }, { createdAt: "desc" }],
      skip: (params.page - 1) * ITEMS_PER_PAGE,
      take: ITEMS_PER_PAGE,
      select: {
        id: true,
        externalId: true,
        title: true,
        shortTitle: true,
        number: true,
        status: true,
        category: true,
        theme: true,
        filingDate: true,
        summary: true,
        summaryDate: true,
        sourceUrl: true,
      },
    }),
    db.legislativeDossier.count({ where }),
  ]);

  return { dossiers, total, totalPages: Math.ceil(total / ITEMS_PER_PAGE) };
}

async function getCategories() {
  const result = await db.legislativeDossier.groupBy({
    by: ["category"],
    _count: true,
    orderBy: { _count: { category: "desc" } },
  });
  return result.filter((r) => r.category).map((r) => ({ name: r.category!, count: r._count }));
}

async function getStats() {
  const [total, withSummary, byStatus] = await Promise.all([
    db.legislativeDossier.count(),
    db.legislativeDossier.count({ where: { summary: { not: null } } }),
    db.legislativeDossier.groupBy({
      by: ["status"],
      _count: true,
    }),
  ]);

  return {
    total,
    withSummary,
    withoutSummary: total - withSummary,
    byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count])),
  };
}

export default async function AdminDossiersPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = parseInt(params.page || "1", 10);
  const status = params.status as DossierStatus | undefined;
  const hasSummary =
    params.hasSummary === "true" ? true : params.hasSummary === "false" ? false : undefined;

  const themeParam = params.theme as ThemeCategory | undefined;

  const [{ dossiers, total, totalPages }, categories, stats] = await Promise.all([
    getDossiers({
      status,
      category: params.category,
      theme: themeParam,
      search: params.search,
      page,
      hasSummary,
    }),
    getCategories(),
    getStats(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dossiers législatifs</h1>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-sm text-muted-foreground">Total dossiers</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-green-600">{stats.withSummary}</div>
            <p className="text-sm text-muted-foreground">Avec résumé IA</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-orange-600">{stats.withoutSummary}</div>
            <p className="text-sm text-muted-foreground">Sans résumé</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-blue-600">
              {stats.byStatus["EN_COURS"] || 0}
            </div>
            <p className="text-sm text-muted-foreground">En discussion</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <DossierFilters categories={categories} />

      {/* Results */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>
              {total} dossier{total !== 1 ? "s" : ""} trouvé{total !== 1 ? "s" : ""}
            </span>
            {totalPages > 1 && (
              <span className="text-sm font-normal text-muted-foreground">
                Page {page} / {totalPages}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {dossiers.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left">
                    <th scope="col" className="pb-3 font-medium">
                      Dossier
                    </th>
                    <th scope="col" className="pb-3 font-medium">
                      Thème
                    </th>
                    <th scope="col" className="pb-3 font-medium">
                      Statut
                    </th>
                    <th scope="col" className="pb-3 font-medium">
                      Résumé IA
                    </th>
                    <th scope="col" className="pb-3 font-medium">
                      Date
                    </th>
                    <th scope="col" className="pb-3 font-medium">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {dossiers.map((dossier) => (
                    <tr key={dossier.id} className="border-b last:border-0">
                      <td className="py-3 pr-4 max-w-md">
                        <Link
                          href={`/admin/dossiers/${dossier.id}`}
                          className="font-medium hover:underline line-clamp-2"
                        >
                          {dossier.shortTitle || dossier.title}
                        </Link>
                        {dossier.number && (
                          <span className="text-xs text-muted-foreground ml-2">
                            {dossier.number}
                          </span>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        {dossier.theme ? (
                          <Badge className={THEME_CATEGORY_COLORS[dossier.theme]}>
                            {THEME_CATEGORY_LABELS[dossier.theme]}
                          </Badge>
                        ) : dossier.category ? (
                          <Badge
                            className={
                              DOSSIER_CATEGORY_COLORS[dossier.category] ||
                              "bg-gray-100 text-gray-800"
                            }
                          >
                            {dossier.category}
                          </Badge>
                        ) : null}
                      </td>
                      <td className="py-3 pr-4">
                        <Badge className={DOSSIER_STATUS_COLORS[dossier.status]}>
                          {DOSSIER_STATUS_LABELS[dossier.status]}
                        </Badge>
                      </td>
                      <td className="py-3 pr-4">
                        {dossier.summary ? (
                          <Badge className="bg-green-100 text-green-800">
                            Oui
                            {dossier.summaryDate && (
                              <span className="ml-1 opacity-70">
                                ({formatDate(dossier.summaryDate)})
                              </span>
                            )}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-orange-600 border-orange-300">
                            Non
                          </Badge>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-sm text-muted-foreground">
                        {dossier.filingDate ? formatDate(dossier.filingDate) : "-"}
                      </td>
                      <td className="py-3">
                        <div className="flex gap-2">
                          <Link
                            href={`/admin/dossiers/${dossier.id}`}
                            className="text-sm text-blue-600 hover:underline"
                          >
                            Voir / Éditer
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Aucun dossier trouvé avec ces critères</p>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-6">
              {page > 1 && (
                <Link
                  href={{
                    pathname: "/admin/dossiers",
                    query: { ...params, page: page - 1 },
                  }}
                  className="px-3 py-1 border rounded hover:bg-gray-100"
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
                      pathname: "/admin/dossiers",
                      query: { ...params, page: pageNum },
                    }}
                    className={`px-3 py-1 border rounded ${
                      pageNum === page ? "bg-blue-600 text-white" : "hover:bg-gray-100"
                    }`}
                  >
                    {pageNum}
                  </Link>
                );
              })}
              {page < totalPages && (
                <Link
                  href={{
                    pathname: "/admin/dossiers",
                    query: { ...params, page: page + 1 },
                  }}
                  className="px-3 py-1 border rounded hover:bg-gray-100"
                >
                  Suivant
                </Link>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
