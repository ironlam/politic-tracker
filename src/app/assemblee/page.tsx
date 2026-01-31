import { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DossierCard, StatusBadge, CategoryBadge } from "@/components/legislation";
import {
  DOSSIER_STATUS_LABELS,
  DOSSIER_STATUS_COLORS,
  DOSSIER_CATEGORY_COLORS,
  DOSSIER_CATEGORY_ICONS,
} from "@/config/labels";
import type { DossierStatus } from "@/generated/prisma";
import { ExternalLink } from "lucide-react";

export const metadata: Metadata = {
  title: "En direct de l'Assemblée",
  description:
    "Suivez les textes en discussion à l'Assemblée nationale : projets de loi, propositions, résumés simplifiés",
};

interface PageProps {
  searchParams: Promise<{
    status?: string;
    category?: string;
    page?: string;
  }>;
}

const ITEMS_PER_PAGE = 15;

async function getDossiers(
  status?: string,
  category?: string,
  page = 1
) {
  const skip = (page - 1) * ITEMS_PER_PAGE;

  const where: Record<string, unknown> = {};
  if (status) {
    where.status = status as DossierStatus;
  }
  if (category) {
    where.category = category;
  }

  const [dossiers, total] = await Promise.all([
    db.legislativeDossier.findMany({
      where,
      orderBy: [
        { status: "asc" }, // EN_COURS first
        { filingDate: "desc" },
      ],
      skip,
      take: ITEMS_PER_PAGE,
      include: {
        _count: {
          select: { amendments: true },
        },
      },
    }),
    db.legislativeDossier.count({ where }),
  ]);

  return {
    dossiers,
    total,
    page,
    totalPages: Math.ceil(total / ITEMS_PER_PAGE),
  };
}

async function getStatusCounts() {
  const counts = await db.legislativeDossier.groupBy({
    by: ["status"],
    _count: { status: true },
  });

  return Object.fromEntries(counts.map((c) => [c.status, c._count.status]));
}

async function getCategoryCounts() {
  const counts = await db.legislativeDossier.groupBy({
    by: ["category"],
    _count: { category: true },
  });

  return Object.fromEntries(
    counts
      .filter((c) => c.category)
      .map((c) => [c.category!, c._count.category])
  );
}

function buildUrl(params: Record<string, string>) {
  const filtered = Object.entries(params).filter(([, v]) => v);
  if (filtered.length === 0) return "/assemblee";
  return `/assemblee?${filtered.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&")}`;
}

export default async function AssembleePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const statusFilter = params.status || "";
  const categoryFilter = params.category || "";
  const page = parseInt(params.page || "1", 10);

  const [{ dossiers, total, totalPages }, statusCounts, categoryCounts] =
    await Promise.all([
      getDossiers(statusFilter, categoryFilter, page),
      getStatusCounts(),
      getCategoryCounts(),
    ]);

  const totalDossiers = Object.values(statusCounts).reduce((a, b) => a + b, 0);
  const enCoursCount = statusCounts["EN_COURS"] || 0;

  // Get unique categories sorted by count
  const categories = Object.entries(categoryCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([cat]) => cat);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-3xl">🏛️</span>
          <h1 className="text-3xl font-bold">En direct de l&apos;Assemblée</h1>
        </div>
        <p className="text-muted-foreground text-lg">
          Comprendre simplement ce qui se vote à l&apos;Assemblée nationale
        </p>
        <div className="flex items-center gap-4 mt-4 text-sm text-muted-foreground">
          <span>
            <strong className="text-foreground">{totalDossiers}</strong> dossiers
          </span>
          <span>
            <strong className="text-blue-600">{enCoursCount}</strong> en discussion
          </span>
          <a
            href="https://www.assemblee-nationale.fr/dyn/17/dossiers"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 hover:text-blue-600"
          >
            Source : assemblee-nationale.fr
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>

      {/* Status filter cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {(Object.keys(DOSSIER_STATUS_LABELS) as DossierStatus[]).map((status) => {
          const count = statusCounts[status] || 0;
          const isActive = statusFilter === status;
          const colorClasses = DOSSIER_STATUS_COLORS[status];

          return (
            <Link
              key={status}
              href={isActive ? buildUrl({ category: categoryFilter }) : buildUrl({ status, category: categoryFilter })}
            >
              <Card
                className={`cursor-pointer transition-all hover:shadow-md ${
                  isActive ? "ring-2 ring-primary" : ""
                }`}
              >
                <CardContent className="p-4">
                  <div className={`text-2xl font-bold ${colorClasses.split(" ")[1]}`}>
                    {count}
                  </div>
                  <div className="text-sm font-medium">
                    {DOSSIER_STATUS_LABELS[status]}
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Category filter */}
      <div className="mb-6">
        <p className="text-sm font-medium mb-2">Filtrer par thème</p>
        <div className="flex flex-wrap gap-2">
          <Link href={buildUrl({ status: statusFilter })}>
            <Badge
              variant={categoryFilter === "" ? "default" : "outline"}
              className="cursor-pointer"
            >
              Tous
            </Badge>
          </Link>
          {categories.map((cat) => {
            const count = categoryCounts[cat] || 0;
            const isActive = categoryFilter === cat;
            const colorClass = DOSSIER_CATEGORY_COLORS[cat] || "";
            const icon = DOSSIER_CATEGORY_ICONS[cat] || "";

            return (
              <Link
                key={cat}
                href={
                  isActive
                    ? buildUrl({ status: statusFilter })
                    : buildUrl({ status: statusFilter, category: cat })
                }
              >
                <Badge
                  variant={isActive ? "default" : "outline"}
                  className={`cursor-pointer ${isActive ? colorClass : ""}`}
                >
                  {icon} {cat} ({count})
                </Badge>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Active filters */}
      {(statusFilter || categoryFilter) && (
        <div className="mb-6 flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Filtres actifs :</span>
          {statusFilter && <StatusBadge status={statusFilter as DossierStatus} />}
          {categoryFilter && <CategoryBadge category={categoryFilter} />}
          <Link href="/assemblee" className="text-blue-600 hover:underline ml-2">
            Effacer les filtres
          </Link>
        </div>
      )}

      {/* Results count */}
      <p className="text-sm text-muted-foreground mb-4">
        {total} résultat{total !== 1 ? "s" : ""}
      </p>

      {/* Dossiers list */}
      {dossiers.length > 0 ? (
        <>
          <div className="space-y-4">
            {dossiers.map((dossier) => (
              <DossierCard
                key={dossier.id}
                id={dossier.id}
                externalId={dossier.externalId}
                title={dossier.title}
                shortTitle={dossier.shortTitle}
                number={dossier.number}
                status={dossier.status}
                category={dossier.category}
                summary={dossier.summary}
                filingDate={dossier.filingDate}
                adoptionDate={dossier.adoptionDate}
                sourceUrl={dossier.sourceUrl}
                amendmentCount={dossier._count.amendments}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-8 flex justify-center gap-2">
              {page > 1 && (
                <Link
                  href={buildUrl({
                    page: String(page - 1),
                    status: statusFilter,
                    category: categoryFilter,
                  })}
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
                  href={buildUrl({
                    page: String(page + 1),
                    status: statusFilter,
                    category: categoryFilter,
                  })}
                  className="px-4 py-2 border rounded-md hover:bg-muted"
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
              Aucun dossier trouvé
              {statusFilter || categoryFilter ? " avec ces filtres" : ""}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Info box */}
      <Card className="mt-8 bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800">
        <CardContent className="pt-6">
          <h2 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
            À propos des données
          </h2>
          <p className="text-sm text-blue-800 dark:text-blue-200">
            Les dossiers législatifs sont importés depuis le portail Open Data de
            l&apos;Assemblée nationale (data.assemblee-nationale.fr). Cette page
            présente une vue simplifiée pour faciliter la compréhension citoyenne.
            Pour les détails complets, consultez directement le site de
            l&apos;Assemblée.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
