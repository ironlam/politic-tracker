import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import {
  AFFAIR_STATUS_LABELS,
  AFFAIR_STATUS_COLORS,
  AFFAIR_STATUS_DESCRIPTIONS,
  AFFAIR_STATUS_NEEDS_PRESUMPTION,
  AFFAIR_CATEGORY_LABELS,
  AFFAIR_SUPER_CATEGORY_LABELS,
  AFFAIR_SUPER_CATEGORY_COLORS,
  CATEGORY_TO_SUPER,
  INVOLVEMENT_LABELS,
  INVOLVEMENT_COLORS,
} from "@/config/labels";
import { SentenceDetails } from "@/components/affairs/SentenceDetails";
import { StatusTooltip } from "@/components/affairs/StatusTooltip";
import { AffairTimeline } from "@/components/affairs/AffairTimeline";
import { PoliticianAvatar } from "@/components/politicians/PoliticianAvatar";
import { ArticleJsonLd, BreadcrumbJsonLd } from "@/components/seo/JsonLd";
import type { AffairCategory, Involvement } from "@/types";

interface PageProps {
  params: Promise<{ slug: string }>;
}

async function getAffair(slug: string) {
  return db.affair.findFirst({
    where: { slug, publicationStatus: "PUBLISHED" },
    include: {
      politician: {
        select: {
          id: true,
          fullName: true,
          slug: true,
          photoUrl: true,
          civility: true,
          currentParty: {
            select: { id: true, shortName: true, name: true, color: true },
          },
        },
      },
      partyAtTime: {
        select: { id: true, slug: true, shortName: true, name: true, color: true },
      },
      sources: {
        orderBy: { publishedAt: "desc" },
      },
      events: {
        orderBy: { date: "asc" },
      },
    },
  });
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const affair = await getAffair(slug);

  if (!affair) {
    return { title: "Affaire non trouvée" };
  }

  return {
    title: `${affair.title} - ${affair.politician.fullName}`,
    description: affair.description.slice(0, 160),
    openGraph: {
      title: `${affair.title} - ${affair.politician.fullName}`,
      description: affair.description.slice(0, 160),
      type: "article",
    },
  };
}

export default async function AffairDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const affair = await getAffair(slug);

  if (!affair) {
    notFound();
  }

  const superCategory = CATEGORY_TO_SUPER[affair.category as AffairCategory];
  const partyToShow = affair.partyAtTime || affair.politician.currentParty;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://poligraph.fr";

  return (
    <>
      <ArticleJsonLd
        headline={`${affair.title} - ${affair.politician.fullName}`}
        description={affair.description.slice(0, 300)}
        datePublished={affair.factsDate?.toISOString().split("T")[0]}
        dateModified={affair.updatedAt?.toISOString().split("T")[0]}
        url={`${siteUrl}/affaires/${affair.slug}`}
        about={{
          name: affair.politician.fullName,
          url: `${siteUrl}/politiques/${affair.politician.slug}`,
        }}
      />
      <BreadcrumbJsonLd
        items={[
          { name: "Accueil", url: siteUrl },
          { name: "Affaires", url: `${siteUrl}/affaires` },
          { name: affair.title, url: `${siteUrl}/affaires/${affair.slug}` },
        ]}
      />
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Breadcrumb */}
        <nav className="text-sm text-muted-foreground mb-6">
          <ol className="flex items-center gap-2">
            <li>
              <Link href="/" className="hover:text-foreground">
                Accueil
              </Link>
            </li>
            <li>/</li>
            <li>
              <Link href="/affaires" className="hover:text-foreground">
                Affaires
              </Link>
            </li>
            <li>/</li>
            <li className="text-foreground truncate max-w-[200px]">{affair.title}</li>
          </ol>
        </nav>

        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <Badge className={AFFAIR_SUPER_CATEGORY_COLORS[superCategory]}>
              {AFFAIR_SUPER_CATEGORY_LABELS[superCategory]}
            </Badge>
            <StatusTooltip
              status={affair.status}
              label={AFFAIR_STATUS_LABELS[affair.status]}
              description={AFFAIR_STATUS_DESCRIPTIONS[affair.status]}
              colorClass={AFFAIR_STATUS_COLORS[affair.status]}
            />
            <Badge variant="outline">{AFFAIR_CATEGORY_LABELS[affair.category]}</Badge>
            {affair.involvement !== "DIRECT" && (
              <Badge className={INVOLVEMENT_COLORS[affair.involvement as Involvement]}>
                {INVOLVEMENT_LABELS[affair.involvement as Involvement]}
              </Badge>
            )}
          </div>

          <h1 className="text-3xl font-bold mb-4">{affair.title}</h1>

          {/* Politician card */}
          <Link
            href={`/politiques/${affair.politician.slug}`}
            className="inline-flex items-center gap-3 p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
          >
            <PoliticianAvatar
              fullName={affair.politician.fullName}
              photoUrl={affair.politician.photoUrl}
              size="md"
            />
            <div>
              <p className="font-semibold">{affair.politician.fullName}</p>
              {partyToShow && (
                <p className="text-sm text-muted-foreground">
                  {affair.partyAtTime?.slug ? (
                    <Link
                      href={`/affaires/parti/${affair.partyAtTime.slug}`}
                      className="hover:underline hover:text-foreground"
                    >
                      {partyToShow.name}
                    </Link>
                  ) : (
                    partyToShow.name
                  )}
                  {affair.partyAtTime &&
                    affair.partyAtTime.id !== affair.politician.currentParty?.id && (
                      <span className="text-xs"> (à l&apos;époque)</span>
                    )}
                </p>
              )}
            </div>
          </Link>
        </div>

        {/* Presumption of innocence */}
        {AFFAIR_STATUS_NEEDS_PRESUMPTION[affair.status] && (
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-6">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              <strong>Présomption d&apos;innocence :</strong> Cette affaire est en cours. La
              personne concernée est présumée innocente jusqu&apos;à condamnation définitive.
            </p>
          </div>
        )}

        {/* Description */}
        <Card className="mb-6">
          <CardHeader>
            <h2 className="text-lg font-semibold">Description</h2>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground whitespace-pre-line">{affair.description}</p>
          </CardContent>
        </Card>

        {/* Dates & Jurisdiction */}
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          {/* Dates */}
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">Dates clés</h2>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3">
                {affair.factsDate && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Date des faits</dt>
                    <dd className="font-medium">{formatDate(affair.factsDate)}</dd>
                  </div>
                )}
                {affair.startDate && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Révélation publique</dt>
                    <dd className="font-medium">{formatDate(affair.startDate)}</dd>
                  </div>
                )}
                {affair.verdictDate && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Date du verdict</dt>
                    <dd className="font-medium">{formatDate(affair.verdictDate)}</dd>
                  </div>
                )}
                {!affair.factsDate && !affair.startDate && !affair.verdictDate && (
                  <p className="text-muted-foreground text-sm">Dates non renseignées</p>
                )}
              </dl>
            </CardContent>
          </Card>

          {/* Jurisdiction */}
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">Juridiction</h2>
            </CardHeader>
            <CardContent>
              {affair.court || affair.chamber || affair.caseNumber ? (
                <dl className="space-y-3">
                  {affair.court && (
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Tribunal</dt>
                      <dd className="font-medium text-right">{affair.court}</dd>
                    </div>
                  )}
                  {affair.chamber && (
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Chambre</dt>
                      <dd className="font-medium">{affair.chamber}</dd>
                    </div>
                  )}
                  {affair.caseNumber && (
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">N° dossier</dt>
                      <dd className="font-mono text-sm">{affair.caseNumber}</dd>
                    </div>
                  )}
                </dl>
              ) : (
                <p className="text-muted-foreground text-sm">Informations non renseignées</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sentence */}
        <Card className="mb-6">
          <CardHeader>
            <h2 className="text-lg font-semibold">Peine</h2>
          </CardHeader>
          <CardContent>
            <SentenceDetails affair={affair} />
            {!affair.sentence &&
              !affair.prisonMonths &&
              !affair.fineAmount &&
              !affair.ineligibilityMonths &&
              !affair.communityService &&
              !affair.otherSentence && (
                <p className="text-muted-foreground text-sm">
                  {AFFAIR_STATUS_NEEDS_PRESUMPTION[affair.status]
                    ? "Affaire en cours - pas encore de verdict"
                    : "Peine non renseignée"}
                </p>
              )}
          </CardContent>
        </Card>

        {/* Timeline */}
        {affair.events.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <h2 className="text-lg font-semibold">Chronologie</h2>
            </CardHeader>
            <CardContent>
              <AffairTimeline events={affair.events} />
            </CardContent>
          </Card>
        )}

        {/* Sources */}
        <Card className="mb-6">
          <CardHeader>
            <h2 className="text-lg font-semibold">Sources ({affair.sources.length})</h2>
          </CardHeader>
          <CardContent>
            {affair.sources.length > 0 ? (
              <ul className="space-y-3">
                {affair.sources.map((source) => (
                  <li key={source.id} className="border-b last:border-b-0 pb-3 last:pb-0">
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline font-medium"
                    >
                      {source.title || source.url}
                    </a>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                      {source.publisher && <span>{source.publisher}</span>}
                      {source.publishedAt && (
                        <>
                          {source.publisher && <span>•</span>}
                          <span>
                            {source.publisher?.toLowerCase() === "wikidata"
                              ? `mis à jour le ${formatDate(source.publishedAt)}`
                              : formatDate(source.publishedAt)}
                          </span>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-sm">Aucune source documentée</p>
            )}
          </CardContent>
        </Card>

        {/* Verification info */}
        {affair.verifiedAt && (
          <Card className="bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-green-800 dark:text-green-200">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="w-5 h-5"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.403 12.652a3 3 0 000-5.304 3 3 0 00-3.75-3.751 3 3 0 00-5.305 0 3 3 0 00-3.751 3.75 3 3 0 000 5.305 3 3 0 003.75 3.751 3 3 0 005.305 0 3 3 0 003.751-3.75zm-2.546-4.46a.75.75 0 00-1.214-.883l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="font-medium">Information vérifiée</span>
              </div>
              <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                Vérifié le {formatDate(affair.verifiedAt)}
                {affair.verifiedBy && ` par Poligraph Moderation`}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="mt-8 flex flex-wrap gap-4">
          <Link
            href={`/politiques/${affair.politician.slug}`}
            className="text-sm text-blue-600 hover:underline"
          >
            ← Voir la fiche de {affair.politician.fullName}
          </Link>
          <Link href="/affaires" className="text-sm text-blue-600 hover:underline">
            ← Retour à la liste des affaires
          </Link>
          {affair.partyAtTime?.slug && (
            <Link
              href={`/affaires/parti/${affair.partyAtTime.slug}`}
              className="text-sm text-blue-600 hover:underline"
            >
              ← Affaires {affair.partyAtTime.shortName}
            </Link>
          )}
        </div>
      </div>
    </>
  );
}
