import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { themeFromSlug, getAllThemeSlugs, themeToSlug } from "@/lib/theme-utils";
import { VoteCard } from "@/components/votes";
import { BreadcrumbJsonLd } from "@/components/seo/JsonLd";
import { SeoIntro } from "@/components/seo/SeoIntro";
import { THEME_CATEGORY_LABELS, THEME_CATEGORY_ICONS } from "@/config/labels";
import { formatDate } from "@/lib/utils";

export const revalidate = 3600;

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://poligraph.fr";
const PAGE_SIZE = 20;

export async function generateStaticParams() {
  return getAllThemeSlugs().map((theme) => ({ theme }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ theme: string }>;
}): Promise<Metadata> {
  const { theme: slug } = await params;
  const theme = themeFromSlug(slug);
  if (!theme) return { title: "Theme introuvable" };

  const label = THEME_CATEGORY_LABELS[theme];
  return {
    title: `Votes ${label}`,
    description: `Tous les scrutins parlementaires sur le theme ${label}. Resultats des votes de l'Assemblee nationale et du Senat.`,
  };
}

export default async function ThemePage({
  params,
  searchParams,
}: {
  params: Promise<{ theme: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { theme: slug } = await params;
  const { page: pageParam } = await searchParams;
  const theme = themeFromSlug(slug);
  if (!theme) notFound();

  const page = Math.max(1, parseInt(pageParam || "1", 10));
  const skip = (page - 1) * PAGE_SIZE;
  const label = THEME_CATEGORY_LABELS[theme];
  const icon = THEME_CATEGORY_ICONS[theme];

  const [scrutins, total, resultStats, lastScrutin] = await Promise.all([
    db.scrutin.findMany({
      where: { theme },
      orderBy: { votingDate: "desc" },
      skip,
      take: PAGE_SIZE,
    }),
    db.scrutin.count({ where: { theme } }),
    db.scrutin.groupBy({
      by: ["result"],
      where: { theme },
      _count: true,
    }),
    db.scrutin.findFirst({
      where: { theme },
      orderBy: { votingDate: "desc" },
      select: { votingDate: true },
    }),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const stats = resultStats.reduce(
    (acc, s) => {
      acc[s.result] = s._count;
      return acc;
    },
    {} as Record<string, number>
  );

  const adopted = stats.ADOPTED || 0;
  const rejected = stats.REJECTED || 0;
  const adoptedPercent = total > 0 ? Math.round((adopted / total) * 100) : 0;

  const introText = [
    `${total.toLocaleString("fr-FR")} scrutins sur le theme ${label}.`,
    total > 0 ? `${adoptedPercent}% adoptes.` : "",
    lastScrutin ? `Dernier vote : ${formatDate(lastScrutin.votingDate)}.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  // Pagination URL builder
  const buildPageUrl = (p: number) => {
    const base = `/votes/themes/${themeToSlug(theme)}`;
    return p > 1 ? `${base}?page=${p}` : base;
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <BreadcrumbJsonLd
        items={[
          { name: "Accueil", url: baseUrl },
          { name: "Votes", url: `${baseUrl}/votes` },
          { name: "Thematiques", url: `${baseUrl}/votes/themes` },
          { name: label, url: `${baseUrl}/votes/themes/${themeToSlug(theme)}` },
        ]}
      />

      <h1 className="text-3xl font-bold mb-2">
        {icon} {label}
      </h1>
      <SeoIntro text={introText} />

      {/* Stats summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-muted rounded-lg p-4 text-center">
          <p className="text-2xl font-bold">{total.toLocaleString("fr-FR")}</p>
          <p className="text-sm text-muted-foreground">Scrutins</p>
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{adopted}</p>
          <p className="text-sm text-muted-foreground">Adoptes</p>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-red-600">{rejected}</p>
          <p className="text-sm text-muted-foreground">Rejetes</p>
        </div>
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-primary">{adoptedPercent}%</p>
          <p className="text-sm text-muted-foreground">Taux d&apos;adoption</p>
        </div>
      </div>

      {/* Adopted/Rejected bar */}
      {total > 0 && (
        <div className="mb-8">
          <div className="flex h-3 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800">
            <div
              className="bg-green-500 transition-all"
              style={{ width: `${(adopted / total) * 100}%` }}
              title={`Adoptes: ${adopted}`}
            />
            <div
              className="bg-red-500 transition-all"
              style={{ width: `${(rejected / total) * 100}%` }}
              title={`Rejetes: ${rejected}`}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span className="text-green-600">
              Adoptes: {adopted} ({adoptedPercent}%)
            </span>
            <span className="text-red-600">
              Rejetes: {rejected} ({total > 0 ? Math.round((rejected / total) * 100) : 0}%)
            </span>
          </div>
        </div>
      )}

      {/* Scrutin list */}
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
          <p>Aucun scrutin trouve pour cette thematique.</p>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <nav aria-label="Pagination" className="flex justify-center gap-2 mt-8">
          {page > 1 && (
            <Link
              href={buildPageUrl(page - 1)}
              className="px-4 py-2 rounded-lg bg-muted hover:bg-muted/80"
            >
              Precedent
            </Link>
          )}
          <span className="px-4 py-2 text-muted-foreground">
            Page {page} sur {totalPages}
          </span>
          {page < totalPages && (
            <Link
              href={buildPageUrl(page + 1)}
              className="px-4 py-2 rounded-lg bg-muted hover:bg-muted/80"
            >
              Suivant
            </Link>
          )}
        </nav>
      )}

      {/* Back link */}
      <div className="mt-8 text-center">
        <Link href="/votes/themes" className="text-primary hover:underline text-sm">
          Voir toutes les thematiques
        </Link>
      </div>

      {/* Source */}
      <div className="mt-4 text-center text-sm text-muted-foreground">
        <p>
          Donnees issues de{" "}
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
