import { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AFFAIR_STATUS_LABELS,
  AFFAIR_STATUS_COLORS,
  AFFAIR_CATEGORY_LABELS,
  AFFAIR_STATUS_NEEDS_PRESUMPTION,
} from "@/config/labels";
import { formatDate } from "@/lib/utils";
import type { AffairStatus, AffairCategory } from "@/types";

export const metadata: Metadata = {
  title: "Affaires judiciaires",
  description:
    "Liste des affaires judiciaires impliquant des représentants politiques français",
};

interface PageProps {
  searchParams: Promise<{ status?: string; category?: string; page?: string }>;
}

async function getAffairs(status?: string, category?: string, page = 1) {
  const limit = 20;
  const skip = (page - 1) * limit;

  const where = {
    ...(status && { status: status as AffairStatus }),
    ...(category && { category: category as AffairCategory }),
  };

  const [affairs, total] = await Promise.all([
    db.affair.findMany({
      where,
      include: {
        politician: {
          select: { id: true, fullName: true, slug: true, currentParty: true },
        },
        sources: { select: { id: true }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
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

async function getFilterCounts() {
  const [statusCounts, categoryCounts] = await Promise.all([
    db.affair.groupBy({
      by: ["status"],
      _count: { status: true },
    }),
    db.affair.groupBy({
      by: ["category"],
      _count: { category: true },
    }),
  ]);

  return {
    statusCounts: Object.fromEntries(
      statusCounts.map((s) => [s.status, s._count.status])
    ),
    categoryCounts: Object.fromEntries(
      categoryCounts.map((c) => [c.category, c._count.category])
    ),
  };
}

export default async function AffairesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const statusFilter = params.status || "";
  const categoryFilter = params.category || "";
  const page = parseInt(params.page || "1", 10);

  const [{ affairs, total, totalPages }, { statusCounts, categoryCounts }] =
    await Promise.all([
      getAffairs(statusFilter, categoryFilter, page),
      getFilterCounts(),
    ]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Affaires judiciaires</h1>
        <p className="text-muted-foreground">
          {total} affaire{total !== 1 ? "s" : ""} documentée
          {total !== 1 ? "s" : ""} avec sources vérifiables
        </p>
      </div>

      {/* Filters */}
      <div className="mb-8 space-y-4">
        {/* Status filter */}
        <div>
          <p className="text-sm font-medium mb-2">Filtrer par statut</p>
          <div className="flex flex-wrap gap-2">
            <Link href="/affaires">
              <Badge
                variant={statusFilter === "" ? "default" : "outline"}
                className="cursor-pointer"
              >
                Tous ({total})
              </Badge>
            </Link>
            {Object.entries(AFFAIR_STATUS_LABELS).map(([key, label]) => {
              const count = statusCounts[key] || 0;
              if (count === 0) return null;
              return (
                <Link key={key} href={`/affaires?status=${key}`}>
                  <Badge
                    variant={statusFilter === key ? "default" : "outline"}
                    className={`cursor-pointer ${
                      statusFilter === key ? AFFAIR_STATUS_COLORS[key as AffairStatus] : ""
                    }`}
                  >
                    {label} ({count})
                  </Badge>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Category filter */}
        <div>
          <p className="text-sm font-medium mb-2">Filtrer par type</p>
          <div className="flex flex-wrap gap-2">
            <Link href={statusFilter ? `/affaires?status=${statusFilter}` : "/affaires"}>
              <Badge
                variant={categoryFilter === "" ? "default" : "outline"}
                className="cursor-pointer"
              >
                Tous
              </Badge>
            </Link>
            {Object.entries(AFFAIR_CATEGORY_LABELS).map(([key, label]) => {
              const count = categoryCounts[key] || 0;
              if (count === 0) return null;
              return (
                <Link
                  key={key}
                  href={`/affaires?category=${key}${statusFilter ? `&status=${statusFilter}` : ""}`}
                >
                  <Badge
                    variant={categoryFilter === key ? "default" : "outline"}
                    className="cursor-pointer"
                  >
                    {label} ({count})
                  </Badge>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* Results */}
      {affairs.length > 0 ? (
        <>
          <div className="space-y-4">
            {affairs.map((affair) => (
              <Card key={affair.id}>
                <CardContent className="pt-6">
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-start gap-3 mb-2">
                        <Badge className={AFFAIR_STATUS_COLORS[affair.status]}>
                          {AFFAIR_STATUS_LABELS[affair.status]}
                        </Badge>
                        <Badge variant="outline">
                          {AFFAIR_CATEGORY_LABELS[affair.category]}
                        </Badge>
                      </div>

                      <h2 className="text-lg font-semibold mb-1">
                        {affair.title}
                      </h2>

                      <Link
                        href={`/politiques/${affair.politician.slug}`}
                        className="text-blue-600 hover:underline text-sm"
                      >
                        {affair.politician.fullName}
                        {affair.politician.currentParty && (
                          <span className="text-muted-foreground">
                            {" "}
                            ({affair.politician.currentParty.shortName})
                          </span>
                        )}
                      </Link>

                      <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                        {affair.description}
                      </p>

                      {AFFAIR_STATUS_NEEDS_PRESUMPTION[affair.status] && (
                        <p className="text-xs text-amber-700 bg-amber-50 p-2 rounded mt-3 inline-block">
                          Présomption d&apos;innocence : affaire en cours
                        </p>
                      )}
                    </div>

                    <div className="text-sm text-muted-foreground md:text-right">
                      {affair.verdictDate && (
                        <p>Verdict : {formatDate(affair.verdictDate)}</p>
                      )}
                      {affair.sentence && (
                        <p className="font-medium text-foreground">
                          {affair.sentence}
                        </p>
                      )}
                      <p className="mt-2">
                        {affair.sources.length} source
                        {affair.sources.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-8 flex justify-center gap-2">
              {page > 1 && (
                <Link
                  href={`/affaires?page=${page - 1}${statusFilter ? `&status=${statusFilter}` : ""}${categoryFilter ? `&category=${categoryFilter}` : ""}`}
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
                  href={`/affaires?page=${page + 1}${statusFilter ? `&status=${statusFilter}` : ""}${categoryFilter ? `&category=${categoryFilter}` : ""}`}
                  className="px-4 py-2 border rounded-md hover:bg-gray-50"
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
              {statusFilter || categoryFilter ? " avec ces filtres" : ""}
            </p>
            <p className="text-sm text-muted-foreground">
              Les affaires sont ajoutées manuellement avec des sources vérifiables.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Info box */}
      <Card className="mt-8 bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <h3 className="font-semibold text-blue-900 mb-2">
            À propos des données
          </h3>
          <p className="text-sm text-blue-800">
            Chaque affaire est documentée avec au minimum une source vérifiable
            (article de presse, décision de justice). La présomption
            d&apos;innocence est systématiquement rappelée pour les affaires en
            cours. Les informations proviennent de sources publiques : Mediapart,
            Le Monde, AFP, décisions de justice publiées.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
