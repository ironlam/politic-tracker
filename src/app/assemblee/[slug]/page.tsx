import { cache } from "react";
import { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MarkdownText } from "@/components/ui/markdown";
import { StatusBadge, CategoryBadge } from "@/components/legislation";
import { AMENDMENT_STATUS_LABELS, AMENDMENT_STATUS_COLORS } from "@/config/labels";
import { ExternalLink, ArrowLeft, Calendar, FileText } from "lucide-react";
import { LegislationJsonLd, BreadcrumbJsonLd } from "@/components/seo/JsonLd";

export const revalidate = 3600; // ISR: revalidate every hour

interface PageProps {
  params: Promise<{ slug: string }>;
}

const includeOptions = {
  amendments: {
    orderBy: { number: "asc" },
    take: 50,
  },
} as const;

/**
 * Get dossier with redirect support for legacy URLs
 * Returns { dossier, redirect } where redirect is the slug to redirect to
 */
const getDossierWithRedirect = cache(async function getDossierWithRedirect(slugOrId: string) {
  // 1. Try by slug first (canonical URL - most common case)
  let dossier = await db.legislativeDossier.findUnique({
    where: { slug: slugOrId },
    include: includeOptions,
  });
  if (dossier) {
    return { dossier, redirect: null };
  }

  // 2. Try by internal ID (CUID) - legacy URL
  dossier = await db.legislativeDossier.findUnique({
    where: { id: slugOrId },
    include: includeOptions,
  });
  if (dossier) {
    return { dossier, redirect: dossier.slug };
  }

  // 3. Try by externalId (e.g., DLR5L17N12345) - legacy URL
  dossier = await db.legislativeDossier.findUnique({
    where: { externalId: slugOrId },
    include: includeOptions,
  });
  if (dossier) {
    return { dossier, redirect: dossier.slug };
  }

  // 4. Try by exact number (e.g., "PPL 3196") - legacy URL
  dossier = await db.legislativeDossier.findFirst({
    where: { number: slugOrId },
    include: includeOptions,
  });
  if (dossier) {
    return { dossier, redirect: dossier.slug };
  }

  // 5. Try by partial number match (e.g., "3196" matches "PPL 3196") - legacy URL
  // This handles cases where the chatbot extracts just the numeric part
  if (/^\d+$/.test(slugOrId)) {
    dossier = await db.legislativeDossier.findFirst({
      where: {
        number: { endsWith: slugOrId },
      },
      include: includeOptions,
    });
    if (dossier) {
      return { dossier, redirect: dossier.slug };
    }
  }

  return { dossier: null, redirect: null };
});

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const { dossier } = await getDossierWithRedirect(slug);

  if (!dossier) {
    return { title: "Dossier non trouvé" };
  }

  return {
    title: dossier.shortTitle || dossier.title,
    description: dossier.summary || `Dossier législatif ${dossier.number || dossier.externalId}`,
  };
}

export default async function DossierDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const { dossier, redirect } = await getDossierWithRedirect(slug);

  // Redirect legacy URLs to canonical slug URL
  if (redirect && redirect !== slug) {
    permanentRedirect(`/assemblee/${redirect}`);
  }

  if (!dossier) {
    notFound();
  }

  const formatDate = (date: Date | null) => {
    if (!date) return null;
    return new Date(date).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://poligraph.fr";

  return (
    <>
      <LegislationJsonLd
        name={dossier.shortTitle || dossier.title}
        description={dossier.summary || undefined}
        datePublished={dossier.filingDate?.toISOString().split("T")[0]}
        legislationIdentifier={dossier.number || dossier.externalId}
        url={`${siteUrl}/assemblee/${dossier.slug || dossier.externalId}`}
      />
      <BreadcrumbJsonLd
        items={[
          { name: "Accueil", url: siteUrl },
          { name: "Assemblée", url: `${siteUrl}/assemblee` },
          {
            name: dossier.shortTitle || dossier.title,
            url: `${siteUrl}/assemblee/${dossier.slug || dossier.externalId}`,
          },
        ]}
      />
      <div className="container mx-auto px-4 py-8">
        {/* Back link */}
        <Link
          href="/assemblee"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour aux dossiers
        </Link>

        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {dossier.number && (
              <Badge variant="secondary" className="font-mono text-base">
                {dossier.number}
              </Badge>
            )}
            <StatusBadge status={dossier.status} showIcon />
            <CategoryBadge category={dossier.category} theme={dossier.theme} />
          </div>

          <h1 className="text-2xl md:text-3xl font-bold mb-4">
            {dossier.shortTitle || dossier.title}
          </h1>

          {dossier.shortTitle && dossier.shortTitle !== dossier.title && (
            <p className="text-muted-foreground mb-4">{dossier.title}</p>
          )}

          {/* Dates */}
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            {dossier.filingDate && (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Déposé le {formatDate(dossier.filingDate)}
              </div>
            )}
            {dossier.adoptionDate && (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Adopté le {formatDate(dossier.adoptionDate)}
              </div>
            )}
          </div>
        </div>

        {/* Summary */}
        {dossier.summary && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="text-lg">En bref</CardTitle>
            </CardHeader>
            <CardContent>
              <MarkdownText className="text-foreground">{dossier.summary}</MarkdownText>
              {dossier.summaryDate && (
                <p className="text-xs text-muted-foreground mt-4">
                  Résumé généré le {formatDate(dossier.summaryDate)}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Amendments */}
        {dossier.amendments.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Amendements ({dossier.amendments.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {dossier.amendments.map((amendment) => (
                  <div
                    key={amendment.id}
                    className="flex items-start justify-between gap-4 py-3 border-b last:border-0"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="font-mono">
                          N° {amendment.number}
                        </Badge>
                        <Badge className={AMENDMENT_STATUS_COLORS[amendment.status]}>
                          {AMENDMENT_STATUS_LABELS[amendment.status]}
                        </Badge>
                      </div>
                      {amendment.authorName && (
                        <p className="text-sm text-muted-foreground">
                          Par {amendment.authorName}
                          {amendment.authorType && ` (${amendment.authorType})`}
                        </p>
                      )}
                      {amendment.article && (
                        <p className="text-sm text-muted-foreground">Article {amendment.article}</p>
                      )}
                      {amendment.summary && <p className="text-sm mt-2">{amendment.summary}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* External link */}
        {dossier.sourceUrl && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium mb-1">Consulter le dossier complet</h3>
                  <p className="text-sm text-muted-foreground">
                    Retrouvez tous les détails sur le site de l&apos;Assemblée nationale
                  </p>
                </div>
                <a
                  href={dossier.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  Voir sur AN.fr
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Info */}
        <p className="text-xs text-muted-foreground mt-8 text-center">
          Données issues du portail Open Data de l&apos;Assemblée nationale
          (data.assemblee-nationale.fr)
        </p>
      </div>
    </>
  );
}
