import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { MANDATE_TYPE_LABELS, AFFAIR_STATUS_LABELS, AFFAIR_STATUS_COLORS, AFFAIR_STATUS_NEEDS_PRESUMPTION } from "@/config/labels";

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
        include: { sources: true },
        orderBy: { createdAt: "desc" },
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
        <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center text-3xl font-semibold text-gray-600 flex-shrink-0">
          {politician.firstName[0]}
          {politician.lastName[0]}
        </div>
        <div>
          <h1 className="text-3xl font-bold mb-2">{politician.fullName}</h1>
          {politician.currentParty && (
            <Badge
              className="text-sm"
              style={{
                backgroundColor: politician.currentParty.color
                  ? `${politician.currentParty.color}20`
                  : undefined,
                color: politician.currentParty.color || undefined,
              }}
            >
              {politician.currentParty.name}
            </Badge>
          )}
          {politician.birthDate && (
            <p className="text-muted-foreground mt-2">
              Naissance le{" "}
              {formatDate(politician.birthDate)}
              {politician.birthPlace && ` à ${politician.birthPlace}`}
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
                    <div key={affair.id} className="border-b pb-4 last:border-0">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h4 className="font-semibold">{affair.title}</h4>
                          <p className="text-sm text-muted-foreground mt-1">
                            {affair.description}
                          </p>
                        </div>
                        <Badge className={AFFAIR_STATUS_COLORS[affair.status]}>
                          {AFFAIR_STATUS_LABELS[affair.status]}
                        </Badge>
                      </div>

                      {AFFAIR_STATUS_NEEDS_PRESUMPTION[affair.status] && (
                        <p className="text-xs text-amber-700 bg-amber-50 p-2 rounded mt-2">
                          Présomption d&apos;innocence : cette affaire est en cours,
                          la personne est présumée innocente.
                        </p>
                      )}

                      {affair.sources.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs text-muted-foreground">Sources :</p>
                          <ul className="text-xs">
                            {affair.sources.map((source) => (
                              <li key={source.id}>
                                <a
                                  href={source.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:underline"
                                >
                                  {source.title} ({source.publisher},{" "}
                                  {formatDate(source.publishedAt)})
                                </a>
                              </li>
                            ))}
                          </ul>
                        </div>
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
