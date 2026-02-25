import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DossierCard, StatusBadge, CategoryBadge } from "@/components/legislation";
import {
  DOSSIER_STATUS_LABELS,
  DOSSIER_STATUS_COLORS,
  DOSSIER_STATUS_ICONS,
  DOSSIER_STATUS_DESCRIPTIONS,
  THEME_CATEGORY_LABELS,
  THEME_CATEGORY_ICONS,
  THEME_CATEGORY_COLORS,
} from "@/config/labels";
import type { DossierStatus, ThemeCategory } from "@/generated/prisma";
import { ExternalLink } from "lucide-react";
import { SeoIntro } from "@/components/seo/SeoIntro";

export const revalidate = 300; // ISR: re-check feature flag every 5 minutes

export const metadata: Metadata = {
  title: "En direct de l'Assemblée",
  description:
    "Suivez les textes en discussion à l'Assemblée nationale : projets de loi, propositions, résumés simplifiés",
};

interface PageProps {
  searchParams: Promise<{
    status?: string;
    theme?: string;
    page?: string;
  }>;
}

const ITEMS_PER_PAGE = 15;

async function getDossiers(status?: string, theme?: string, page = 1) {
  const skip = (page - 1) * ITEMS_PER_PAGE;

  const where: Record<string, unknown> = {};
  if (status) {
    where.status = status as DossierStatus;
  }
  if (theme) {
    where.theme = theme as ThemeCategory;
  }

  const [dossiers, total] = await Promise.all([
    db.legislativeDossier.findMany({
      where,
      orderBy: [
        { status: "asc" }, // DEPOSE, EN_COURS first (active dossiers)
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

async function getThemeCounts() {
  const counts = await db.legislativeDossier.groupBy({
    by: ["theme"],
    _count: { theme: true },
    orderBy: { _count: { theme: "desc" } },
  });

  return counts
    .filter((c) => c.theme !== null)
    .map((c) => ({ theme: c.theme as ThemeCategory, count: c._count.theme }));
}

function buildUrl(params: Record<string, string>) {
  const filtered = Object.entries(params).filter(([, v]) => v);
  if (filtered.length === 0) return "/assemblee";
  return `/assemblee?${filtered.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&")}`;
}

export default async function AssembleePage({ searchParams }: PageProps) {
  if (!(await isFeatureEnabled("ASSEMBLEE_SECTION"))) notFound();

  const params = await searchParams;
  const statusFilter = params.status || "";
  const themeFilter = params.theme || "";
  const page = parseInt(params.page || "1", 10);

  const [{ dossiers, total, totalPages }, statusCounts, themeCounts] = await Promise.all([
    getDossiers(statusFilter, themeFilter, page),
    getStatusCounts(),
    getThemeCounts(),
  ]);

  const totalDossiers = Object.values(statusCounts).reduce((a, b) => a + b, 0);
  const activeStatuses: DossierStatus[] = [
    "DEPOSE",
    "EN_COMMISSION",
    "EN_COURS",
    "CONSEIL_CONSTITUTIONNEL",
  ];
  const activeCount = activeStatuses.reduce((sum, s) => sum + (statusCounts[s] || 0), 0);

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
            <strong className="text-blue-600">{activeCount}</strong> en cours
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
        <SeoIntro
          text={`${totalDossiers.toLocaleString("fr-FR")} dossiers législatifs suivis à l'Assemblée nationale, dont ${activeCount} en discussion. Résumés simplifiés et suivi en temps réel.`}
        />
      </div>

      {/* Status filter cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {(Object.keys(DOSSIER_STATUS_LABELS) as DossierStatus[]).map((status) => {
          const count = statusCounts[status] || 0;
          const isActive = statusFilter === status;
          const colorClasses = DOSSIER_STATUS_COLORS[status];

          return (
            <Link
              key={status}
              href={
                isActive
                  ? buildUrl({ theme: themeFilter })
                  : buildUrl({ status, theme: themeFilter })
              }
            >
              <Card
                className={`cursor-pointer transition-all hover:shadow-md ${
                  isActive ? "ring-2 ring-primary" : ""
                }`}
              >
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <span>{DOSSIER_STATUS_ICONS[status]}</span>
                    <div>
                      <div className={`text-xl font-bold ${colorClasses.split(" ")[1]}`}>
                        {count}
                      </div>
                      <div className="text-xs font-medium">{DOSSIER_STATUS_LABELS[status]}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Theme filter */}
      {themeCounts.length > 0 && (
        <div className="mb-6">
          <p className="text-sm font-medium mb-2">Filtrer par thème</p>
          <div className="flex flex-wrap gap-2">
            <Link href={buildUrl({ status: statusFilter })}>
              <Badge
                variant={themeFilter === "" ? "default" : "outline"}
                className="cursor-pointer"
              >
                Tous
              </Badge>
            </Link>
            {themeCounts.map(({ theme: t, count }) => {
              const isActive = themeFilter === t;
              const colorClass = THEME_CATEGORY_COLORS[t];
              const icon = THEME_CATEGORY_ICONS[t];
              const label = THEME_CATEGORY_LABELS[t];

              return (
                <Link
                  key={t}
                  href={
                    isActive
                      ? buildUrl({ status: statusFilter })
                      : buildUrl({ status: statusFilter, theme: t })
                  }
                >
                  <Badge
                    variant={isActive ? "default" : "outline"}
                    className={`cursor-pointer ${isActive ? colorClass : ""}`}
                  >
                    {icon} {label} ({count})
                  </Badge>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Active filters */}
      {(statusFilter || themeFilter) && (
        <div className="mb-6 flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Filtres actifs :</span>
          {statusFilter && <StatusBadge status={statusFilter as DossierStatus} />}
          {themeFilter && <CategoryBadge theme={themeFilter as ThemeCategory} />}
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
                slug={dossier.slug}
                title={dossier.title}
                shortTitle={dossier.shortTitle}
                number={dossier.number}
                status={dossier.status}
                category={dossier.category}
                theme={dossier.theme}
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
                    theme: themeFilter,
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
                    theme: themeFilter,
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
              {statusFilter || themeFilter ? " avec ces filtres" : ""}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Status legend */}
      <Card className="mt-8">
        <CardContent className="pt-6">
          <h2 className="font-semibold mb-3">Comprendre les statuts</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            {(Object.keys(DOSSIER_STATUS_LABELS) as DossierStatus[]).map((status) => (
              <div key={status} className="flex items-start gap-2">
                <span className="shrink-0">{DOSSIER_STATUS_ICONS[status]}</span>
                <div>
                  <span className="font-medium">{DOSSIER_STATUS_LABELS[status]}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    &mdash; {DOSSIER_STATUS_DESCRIPTIONS[status]}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Info box */}
      <Card className="mt-4 bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800">
        <CardContent className="pt-6">
          <h2 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
            À propos des données
          </h2>
          <p className="text-sm text-blue-800 dark:text-blue-200">
            Les dossiers législatifs sont importés depuis le portail Open Data de l&apos;Assemblée
            nationale (data.assemblee-nationale.fr). Cette page présente une vue simplifiée pour
            faciliter la compréhension citoyenne. Pour les détails complets, consultez directement
            le site de l&apos;Assemblée.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
