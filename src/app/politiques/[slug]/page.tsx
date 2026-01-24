import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import {
  MANDATE_TYPE_LABELS,
  AFFAIR_STATUS_LABELS,
  AFFAIR_STATUS_COLORS,
  AFFAIR_STATUS_NEEDS_PRESUMPTION,
  AFFAIR_CATEGORY_LABELS,
} from "@/config/labels";
import { PoliticianAvatar } from "@/components/politicians/PoliticianAvatar";

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

  return {
    title: politician.fullName,
    description: `Fiche de ${politician.fullName} - mandats, déclarations, affaires judiciaires`,
  };
}

export default async function PoliticianPage({ params }: PageProps) {
  const { slug } = await params;
  const politician = await getPolitician(slug);

  if (!politician) {
    notFound();
  }

  const currentMandates = politician.mandates.filter((m) => m.isCurrent);
  const pastMandates = politician.mandates.filter((m) => !m.isCurrent);

  return (
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
          {/* Current mandates */}
          {currentMandates.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Mandat actuel</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {currentMandates.map((mandate) => (
                  <div key={mandate.id} className="border-l-4 border-primary pl-4">
                    <p className="font-semibold">
                      {MANDATE_TYPE_LABELS[mandate.type] || mandate.type}
                    </p>
                    <p className="text-muted-foreground">{mandate.title}</p>
                    <p className="text-sm text-muted-foreground">
                      Depuis le {formatDate(mandate.startDate)}
                    </p>
                    {mandate.sourceUrl && (
                      <a
                        href={mandate.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline"
                      >
                        Voir sur le site officiel
                      </a>
                    )}
                  </div>
                ))}
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

                      {/* Sentence if convicted */}
                      {affair.sentence && (
                        <div className="bg-gray-100 rounded p-2 mb-3">
                          <p className="text-xs text-muted-foreground mb-1">Condamnation :</p>
                          <p className="text-sm font-medium">{affair.sentence}</p>
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

          {/* Past mandates */}
          {pastMandates.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Mandats précédents</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {pastMandates.map((mandate) => (
                    <li key={mandate.id} className="text-sm">
                      <span className="font-medium">
                        {MANDATE_TYPE_LABELS[mandate.type] || mandate.type}
                      </span>{" "}
                      - {mandate.title}
                      <span className="text-muted-foreground">
                        {" "}
                        ({formatDate(mandate.startDate)} -{" "}
                        {mandate.endDate ? formatDate(mandate.endDate) : "..."})
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
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
          <Card className="bg-gray-50">
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
  );
}
