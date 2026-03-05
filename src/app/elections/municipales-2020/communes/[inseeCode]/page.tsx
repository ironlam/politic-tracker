import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getCommuneResults2020 } from "@/lib/data/elections";
import { BreadcrumbJsonLd } from "@/components/seo/JsonLd";
import { SITE_URL } from "@/config/site";
import { CheckCircle2 } from "lucide-react";

export const revalidate = 3600;

// ISR only — too many communes for SSG
export async function generateStaticParams() {
  return [];
}

interface PageProps {
  params: Promise<{ inseeCode: string }>;
}

/** Normalize ALL-CAPS list names to title case */
function normalizeLabel(raw: string): string {
  const letters = raw.replace(/[^A-Za-zÀ-ÿ]/g, "");
  if (letters.length === 0 || letters !== letters.toUpperCase()) return raw;
  return raw
    .toLowerCase()
    .replace(/(^|\s|['\-])([a-zà-ÿ])/g, (_, sep, char) => sep + char.toUpperCase());
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { inseeCode } = await params;
  const commune = await getCommuneResults2020(inseeCode);

  if (!commune) {
    return { title: "Commune non trouvée" };
  }

  const title = `Municipales 2020 à ${commune.communeName} — Résultats | Poligraph`;
  const description =
    `Résultats des élections municipales 2020 à ${commune.communeName}` +
    ` (${commune.departmentName}) : ${commune.lists.length} listes en compétition.`;

  return {
    title,
    description,
    alternates: { canonical: `/elections/municipales-2020/communes/${inseeCode}` },
  };
}

export default async function Commune2020DetailPage({ params }: PageProps) {
  const { inseeCode } = await params;
  const commune = await getCommuneResults2020(inseeCode);

  if (!commune) {
    notFound();
  }

  const communeUrl = `${SITE_URL}/elections/municipales-2020/communes/${commune.inseeCode}`;

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Accueil", url: SITE_URL },
          { name: "Élections", url: `${SITE_URL}/elections` },
          { name: "Municipales 2020", url: `${SITE_URL}/elections/municipales-2020` },
          { name: commune.communeName, url: communeUrl },
        ]}
      />
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Breadcrumb */}
        <nav aria-label="Fil d'Ariane" className="mb-6">
          <ol className="flex items-center gap-2 text-sm text-muted-foreground">
            <li>
              <Link href="/" className="hover:text-foreground transition-colors">
                Accueil
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link href="/elections" className="hover:text-foreground transition-colors">
                Élections
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link
                href="/elections/municipales-2020"
                className="hover:text-foreground transition-colors"
                prefetch={false}
              >
                Municipales 2020
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li className="text-foreground font-medium truncate">{commune.communeName}</li>
          </ol>
        </nav>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold mb-3">
            Municipales 2020 — {commune.communeName}
          </h1>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">
              {commune.departmentName} ({commune.departmentCode})
            </Badge>
            {commune.population != null && (
              <Badge variant="outline">
                {commune.population.toLocaleString("fr-FR")} habitants
              </Badge>
            )}
            {commune.totalSeats != null && (
              <Badge variant="outline">{commune.totalSeats} sièges</Badge>
            )}
          </div>
        </div>

        {/* Lists / Results */}
        <section>
          <h2 className="text-lg font-semibold mb-4">
            Résultats ({commune.lists.length} liste{commune.lists.length > 1 ? "s" : ""})
          </h2>

          {commune.lists.length > 0 ? (
            <div className="space-y-4">
              {commune.lists.map((list) => (
                <Card
                  key={list.listName}
                  className={list.isElected ? "border-green-300 dark:border-green-800" : undefined}
                >
                  <CardContent className="pt-5">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold truncate" title={list.listName}>
                            {normalizeLabel(list.listName)}
                          </h3>
                          {list.isElected && (
                            <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              Élue
                            </Badge>
                          )}
                        </div>
                        {list.partyLabel && (
                          <p className="text-sm text-muted-foreground mt-0.5">{list.partyLabel}</p>
                        )}
                        <p className="text-sm text-muted-foreground">
                          Tête de liste : {list.candidateName} · {list.candidateCount} candidat
                          {list.candidateCount > 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>

                    {/* Round results */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                      {/* Round 1 */}
                      <div className="bg-muted/30 rounded-lg p-3">
                        <p className="font-medium mb-1">1er tour</p>
                        <div className="flex items-baseline gap-3">
                          {list.round1Pct != null && (
                            <span className="text-xl font-bold tabular-nums">
                              {list.round1Pct.toFixed(2)} %
                            </span>
                          )}
                          {list.round1Votes != null && (
                            <span className="text-muted-foreground tabular-nums">
                              {list.round1Votes.toLocaleString("fr-FR")} voix
                            </span>
                          )}
                        </div>
                        {list.round1Qualified != null && (
                          <Badge
                            variant="outline"
                            className={
                              list.round1Qualified
                                ? "mt-1 text-green-700 border-green-300 dark:text-green-400 dark:border-green-800"
                                : "mt-1 text-muted-foreground"
                            }
                          >
                            {list.round1Qualified ? "Qualifiée" : "Non qualifiée"}
                          </Badge>
                        )}
                      </div>

                      {/* Round 2 */}
                      {list.round2Votes != null && (
                        <div className="bg-muted/30 rounded-lg p-3">
                          <p className="font-medium mb-1">2nd tour</p>
                          <div className="flex items-baseline gap-3">
                            {list.round2Pct != null && (
                              <span className="text-xl font-bold tabular-nums">
                                {list.round2Pct.toFixed(2)} %
                              </span>
                            )}
                            <span className="text-muted-foreground tabular-nums">
                              {list.round2Votes.toLocaleString("fr-FR")} voix
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">Aucun résultat disponible pour cette commune.</p>
          )}
        </section>

        {/* Comparison link to 2026 */}
        <section className="mt-8">
          <Link href={`/elections/municipales-2026/communes/${commune.inseeCode}`} prefetch={false}>
            <Card className="bg-gradient-to-r from-primary/10 to-accent/10 border-primary/20 hover:shadow-sm transition-shadow">
              <CardContent className="pt-5 flex items-center gap-4">
                <div>
                  <p className="font-semibold">
                    Voir les candidatures 2026 à {commune.communeName}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Comparez avec les listes et candidats pour les prochaines municipales.
                  </p>
                </div>
              </CardContent>
            </Card>
          </Link>
        </section>
      </main>
    </>
  );
}
