import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import {
  AFFAIR_STATUS_LABELS,
  AFFAIR_STATUS_COLORS,
  AFFAIR_STATUS_NEEDS_PRESUMPTION,
  AFFAIR_CATEGORY_LABELS,
  MANDATE_TYPE_LABELS,
} from "@/config/labels";
import { PoliticianAvatar } from "@/components/politicians/PoliticianAvatar";
import { MandateTimeline } from "@/components/politicians/MandateTimeline";
import { PersonJsonLd, BreadcrumbJsonLd } from "@/components/seo/JsonLd";
import { SentenceDetails } from "@/components/affairs/SentenceDetails";
import { AffairTimeline } from "@/components/affairs/AffairTimeline";

interface PageProps {
  params: Promise<{ slug: string }>;
}

async function getPolitician(slug: string) {
  return db.politician.findUnique({
    where: { slug },
    include: {
      currentParty: true,
      mandates: {
        orderBy: { startDate: "desc" },
      },
      affairs: {
        include: {
          sources: true,
          partyAtTime: true,
          events: {
            orderBy: { date: "asc" },
          },
        },
        orderBy: { verdictDate: "desc" },
      },
      declarations: {
        orderBy: { year: "desc" },
      },
    },
  });
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const politician = await getPolitician(slug);

  if (!politician) {
    return { title: "Politicien non trouvé" };
  }

  const currentMandate = politician.mandates.find((m) => m.isCurrent);
  const role = currentMandate
    ? `${currentMandate.type === "DEPUTE" ? "Député" : currentMandate.type === "SENATEUR" ? "Sénateur" : "Représentant"}`
    : "Représentant politique";

  const description = `${role} ${politician.currentParty ? `(${politician.currentParty.shortName})` : ""} - Consultez ses mandats, déclarations de patrimoine et affaires judiciaires.`;

  return {
    title: politician.fullName,
    description,
    openGraph: {
      title: `${politician.fullName} | Transparence Politique`,
      description,
      type: "profile",
      images: politician.photoUrl
        ? [
            {
              url: politician.photoUrl,
              width: 200,
              height: 200,
              alt: politician.fullName,
            },
          ]
        : undefined,
    },
    twitter: {
      card: "summary",
      title: politician.fullName,
      description,
      images: politician.photoUrl ? [politician.photoUrl] : undefined,
    },
  };
}

export default async function PoliticianPage({ params }: PageProps) {
  const { slug } = await params;
  const politician = await getPolitician(slug);

  if (!politician) {
    notFound();
  }

  const hasMandates = politician.mandates.length > 0;
  const currentMandate = politician.mandates.find((m) => m.isCurrent);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://transparence-politique.fr";

  return (
    <>
      {/* JSON-LD Structured Data */}
      <PersonJsonLd
        name={politician.fullName}
        givenName={politician.firstName}
        familyName={politician.lastName}
        jobTitle={currentMandate ? MANDATE_TYPE_LABELS[currentMandate.type] : undefined}
        affiliation={politician.currentParty?.name}
        image={politician.photoUrl || undefined}
        birthDate={politician.birthDate?.toISOString().split("T")[0]}
        deathDate={politician.deathDate?.toISOString().split("T")[0]}
        birthPlace={politician.birthPlace || undefined}
        url={`${siteUrl}/politiques/${politician.slug}`}
      />
      <BreadcrumbJsonLd
        items={[
          { name: "Accueil", url: siteUrl },
          { name: "Politiques", url: `${siteUrl}/politiques` },
          { name: politician.fullName, url: `${siteUrl}/politiques/${politician.slug}` },
        ]}
      />

      <div className="container mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <nav className="text-sm text-muted-foreground mb-6">
        <Link href="/politiques" className="hover:text-foreground">
          Politiques
        </Link>
        <span className="mx-2">/</span>
        <span>{politician.fullName}</span>
      </nav>

      {/* Header */}
      <div className="flex items-start gap-6 mb-8">
        <PoliticianAvatar
          photoUrl={politician.photoUrl}
          firstName={politician.firstName}
          lastName={politician.lastName}
          size="lg"
        />
        <div>
          <h1 className="text-3xl font-bold mb-2">{politician.fullName}</h1>
          {politician.currentParty && (
            <Link href={`/partis/${politician.currentParty.slug}`}>
              <Badge
                className="text-sm hover:opacity-80 transition-opacity cursor-pointer"
                style={{
                  backgroundColor: politician.currentParty.color
                    ? `${politician.currentParty.color}20`
                    : undefined,
                  color: politician.currentParty.color || undefined,
                }}
              >
                {politician.currentParty.name}
              </Badge>
            </Link>
          )}
          {politician.birthDate && (
            <p className="text-muted-foreground mt-2">
              {politician.civility === "Mme" ? "Née" : "Né"} le{" "}
              {formatDate(politician.birthDate)}
              {politician.birthPlace && ` à ${politician.birthPlace}`}
              {politician.deathDate && (
                <span className="text-gray-500">
                  {" "}- Décédé{politician.civility === "Mme" ? "e" : ""} le {formatDate(politician.deathDate)}
                </span>
              )}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-8">
          {/* Career / Mandates */}
          {hasMandates && (
            <Card>
              <CardHeader>
                <CardTitle>Parcours politique</CardTitle>
              </CardHeader>
              <CardContent>
                <MandateTimeline
                  mandates={politician.mandates}
                  civility={politician.civility}
                />
              </CardContent>
            </Card>
          )}

          {/* Affairs */}
          <Card>
            <CardHeader>
              <CardTitle>Affaires judiciaires</CardTitle>
            </CardHeader>
            <CardContent>
              {politician.affairs.length > 0 ? (
                <div className="space-y-6">
                  {politician.affairs.map((affair) => (
                    <div
                      key={affair.id}
                      className={`border rounded-lg p-4 ${
                        affair.status === "CONDAMNATION_DEFINITIVE"
                          ? "border-red-200 bg-red-50/30"
                          : affair.status === "CONDAMNATION_PREMIERE_INSTANCE"
                            ? "border-orange-200 bg-orange-50/30"
                            : "border-gray-200"
                      }`}
                    >
                      {/* Header */}
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div className="flex-1">
                          <h4 className="font-semibold text-lg">{affair.title}</h4>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">
                              {AFFAIR_CATEGORY_LABELS[affair.category]}
                            </Badge>
                            {affair.partyAtTime && (
                              <Badge
                                variant="outline"
                                className="text-xs"
                                style={{
                                  borderColor: affair.partyAtTime.color || undefined,
                                  color: affair.partyAtTime.color || undefined,
                                }}
                              >
                                {affair.partyAtTime.shortName} à l&apos;époque
                              </Badge>
                            )}
                          </div>
                        </div>
                        <Badge className={`shrink-0 ${AFFAIR_STATUS_COLORS[affair.status]}`}>
                          {AFFAIR_STATUS_LABELS[affair.status]}
                        </Badge>
                      </div>

                      {/* Description */}
                      <p className="text-sm text-muted-foreground mb-3">
                        {affair.description}
                      </p>

                      {/* Dates & details */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs mb-3">
                        {affair.factsDate && (
                          <div>
                            <span className="text-muted-foreground">Faits :</span>{" "}
                            <span className="font-medium">{formatDate(affair.factsDate)}</span>
                          </div>
                        )}
                        {affair.startDate && (
                          <div>
                            <span className="text-muted-foreground">Révélation :</span>{" "}
                            <span className="font-medium">{formatDate(affair.startDate)}</span>
                          </div>
                        )}
                        {affair.verdictDate && (
                          <div>
                            <span className="text-muted-foreground">Verdict :</span>{" "}
                            <span className="font-medium">{formatDate(affair.verdictDate)}</span>
                          </div>
                        )}
                        {affair.appeal && (
                          <div>
                            <Badge variant="outline" className="text-xs bg-orange-50">
                              En appel
                            </Badge>
                          </div>
                        )}
                      </div>

                      {/* Jurisdiction info */}
                      {(affair.court || affair.caseNumber) && (
                        <div className="text-xs text-muted-foreground mb-3">
                          {affair.court && <span>{affair.court}</span>}
                          {affair.chamber && <span> - {affair.chamber}</span>}
                          {affair.caseNumber && (
                            <span className="ml-2 font-mono">({affair.caseNumber})</span>
                          )}
                        </div>
                      )}

                      {/* Sentence details */}
                      <div className="mb-3">
                        <SentenceDetails affair={affair} />
                      </div>

                      {/* Timeline */}
                      {affair.events && affair.events.length > 0 && (
                        <div className="mb-3 border-t pt-3">
                          <AffairTimeline events={affair.events} />
                        </div>
                      )}

                      {/* Presumption of innocence */}
                      {AFFAIR_STATUS_NEEDS_PRESUMPTION[affair.status] && (
                        <p className="text-xs text-amber-700 bg-amber-50 p-2 rounded mb-3">
                          Présomption d&apos;innocence : cette affaire est en cours,
                          la personne est présumée innocente jusqu&apos;à condamnation définitive.
                        </p>
                      )}

                      {/* Sources */}
                      {affair.sources.length > 0 && (
                        <details className="text-xs">
                          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                            Sources ({affair.sources.length})
                          </summary>
                          <ul className="mt-2 space-y-1 pl-4">
                            {affair.sources.map((source) => (
                              <li key={source.id}>
                                <a
                                  href={source.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:underline"
                                >
                                  {source.title}
                                </a>
                                <span className="text-muted-foreground">
                                  {" "}— {source.publisher}, {formatDate(source.publishedAt)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">
                  Aucune affaire judiciaire documentée
                </p>
              )}
            </CardContent>
          </Card>

        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick stats */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">En bref</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Mandats</span>
                <span className="font-semibold">{politician.mandates.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Affaires</span>
                <span className="font-semibold">{politician.affairs.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Déclarations HATVP</span>
                <span className="font-semibold">
                  {politician.declarations.length}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Declarations */}
          {politician.declarations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Déclarations HATVP</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {politician.declarations.map((decl) => (
                    <li key={decl.id}>
                      <a
                        href={decl.hatvpUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline"
                      >
                        {decl.type.replace(/_/g, " ")} ({decl.year})
                      </a>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Data source */}
          <Card className="bg-muted">
            <CardContent className="pt-6">
              <p className="text-xs text-muted-foreground">
                Dernière mise à jour : {formatDate(politician.updatedAt)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Source : Assemblée nationale, data.gouv.fr
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
      </div>
    </>
  );
}
