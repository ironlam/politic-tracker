import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import {
  ELECTION_TYPE_LABELS,
  ELECTION_TYPE_ICONS,
  ELECTION_STATUS_LABELS,
  ELECTION_STATUS_COLORS,
  ELECTION_SCOPE_LABELS,
  SUFFRAGE_TYPE_LABELS,
} from "@/config/labels";
import { ElectionCountdown } from "@/components/elections/ElectionCountdown";
import { ElectionKeyDates } from "@/components/elections/ElectionKeyDates";
import { ElectionScrutinInfo } from "@/components/elections/ElectionScrutinInfo";
import { AddToCalendar } from "@/components/elections/AddToCalendar";
import { FEATURES } from "@/config/features";
import { ELECTION_GUIDES } from "@/config/election-guides";
import { EventJsonLd, BreadcrumbJsonLd } from "@/components/seo/JsonLd";
import type { ElectionStatus } from "@/types";

interface PageProps {
  params: Promise<{ slug: string }>;
}

const STATUS_ORDER: ElectionStatus[] = [
  "UPCOMING",
  "REGISTRATION",
  "CANDIDACIES",
  "CAMPAIGN",
  "ROUND_1",
  "BETWEEN_ROUNDS",
  "ROUND_2",
  "COMPLETED",
];

function isPhaseAtLeast(current: ElectionStatus, target: ElectionStatus): boolean {
  return STATUS_ORDER.indexOf(current) >= STATUS_ORDER.indexOf(target);
}

async function getElection(slug: string) {
  return db.election.findUnique({
    where: { slug },
    include: {
      candidacies: {
        include: {
          politician: {
            select: {
              id: true,
              slug: true,
              fullName: true,
              photoUrl: true,
              civility: true,
            },
          },
          party: {
            select: {
              id: true,
              slug: true,
              shortName: true,
              color: true,
            },
          },
        },
        orderBy: { candidateName: "asc" },
      },
      rounds: {
        orderBy: { round: "asc" },
      },
    },
  });
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const election = await getElection(slug);

  if (!election) {
    return { title: "Élection non trouvée" };
  }

  const typeLabel = ELECTION_TYPE_LABELS[election.type];
  const title = `${election.title} | Transparence Politique`;
  const description =
    election.description ||
    `${typeLabel} - ${ELECTION_SCOPE_LABELS[election.scope]}. Dates, candidatures et résultats.`;

  return {
    title,
    description,
    openGraph: {
      title: election.title,
      description,
    },
  };
}

export default async function ElectionDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const election = await getElection(slug);

  if (!election) {
    notFound();
  }

  const icon = ELECTION_TYPE_ICONS[election.type];
  const statusLabel = ELECTION_STATUS_LABELS[election.status];
  const statusColor = ELECTION_STATUS_COLORS[election.status];
  const showCountdown = !isPhaseAtLeast(election.status, "ROUND_1") && election.round1Date;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://transparence-politique.fr";
  const typeLabel = ELECTION_TYPE_LABELS[election.type];

  return (
    <>
      <EventJsonLd
        name={election.title}
        description={
          election.description || `${typeLabel} - ${ELECTION_SCOPE_LABELS[election.scope]}`
        }
        startDate={election.round1Date?.toISOString() || ""}
        location="France"
        url={`${siteUrl}/elections/${election.slug}`}
      />
      <BreadcrumbJsonLd
        items={[
          { name: "Accueil", url: siteUrl },
          { name: "Élections", url: `${siteUrl}/elections` },
          {
            name: election.shortTitle || election.title,
            url: `${siteUrl}/elections/${election.slug}`,
          },
        ]}
      />
      <main id="main-content" className="container mx-auto px-4 py-8 max-w-6xl">
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
            <li className="text-foreground font-medium truncate">
              {election.shortTitle || election.title}
            </li>
          </ol>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main column */}
          <div className="lg:col-span-2 space-y-8">
            {/* Header */}
            <div>
              <div className="flex items-start gap-3 mb-3">
                <span className="text-3xl" aria-hidden="true">
                  {icon}
                </span>
                <h1 className="text-2xl md:text-3xl font-bold">{election.title}</h1>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge className={statusColor}>{statusLabel}</Badge>
                <Badge variant="outline">{ELECTION_SCOPE_LABELS[election.scope]}</Badge>
                <Badge variant="outline">{SUFFRAGE_TYPE_LABELS[election.suffrage]}</Badge>
                {!election.dateConfirmed && (
                  <Badge variant="outline" className="border-amber-300 text-amber-700">
                    Dates provisoires
                  </Badge>
                )}
              </div>
            </div>

            {/* Countdown */}
            {showCountdown && (
              <ElectionCountdown
                targetDate={election.round1Date!.toISOString()}
                electionTitle={election.title}
                electionIcon={icon}
                dateConfirmed={election.dateConfirmed}
              />
            )}

            {/* Description */}
            {election.description && (
              <section>
                <h2 className="text-lg font-semibold mb-2">À propos</h2>
                <p className="text-muted-foreground leading-relaxed">{election.description}</p>
              </section>
            )}

            {/* Practical guide */}
            {FEATURES.ELECTION_GUIDE_SECTION && ELECTION_GUIDES[election.type] && (
              <section>
                <h2 className="text-lg font-semibold mb-4">Guide pratique</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {ELECTION_GUIDES[election.type]!.map((guide) => (
                    <Card key={guide.title}>
                      <CardContent className="pt-5">
                        <div className="flex items-start gap-3">
                          <span className="text-2xl shrink-0" aria-hidden="true">
                            {guide.icon}
                          </span>
                          <div>
                            <h3 className="font-semibold mb-1">{guide.title}</h3>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                              {guide.content}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}

            {/* Key dates */}
            <ElectionKeyDates
              registrationDeadline={election.registrationDeadline}
              candidacyOpenDate={election.candidacyOpenDate}
              candidacyDeadline={election.candidacyDeadline}
              campaignStartDate={election.campaignStartDate}
              round1Date={election.round1Date}
              round2Date={election.round2Date}
              dateConfirmed={election.dateConfirmed}
              status={election.status}
            />

            {/* Candidacies */}
            {isPhaseAtLeast(election.status, "CANDIDACIES") && (
              <section>
                <h2 className="text-lg font-semibold mb-4">Candidatures</h2>
                {election.candidacies.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {election.candidacies.map((candidacy) => (
                      <Card key={candidacy.id} className="hover:shadow-sm transition-shadow">
                        <CardContent className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            {candidacy.party?.color && (
                              <span
                                className="w-3 h-3 rounded-full flex-shrink-0"
                                style={{ backgroundColor: candidacy.party.color }}
                                aria-hidden="true"
                              />
                            )}
                            <div className="min-w-0">
                              <p className="font-medium truncate">
                                {candidacy.politician ? (
                                  <Link
                                    href={`/politiques/${candidacy.politician.slug}`}
                                    className="hover:text-primary transition-colors"
                                  >
                                    {candidacy.candidateName}
                                  </Link>
                                ) : (
                                  candidacy.candidateName
                                )}
                              </p>
                              {candidacy.partyLabel && (
                                <p className="text-sm text-muted-foreground truncate">
                                  {candidacy.partyLabel}
                                </p>
                              )}
                              {candidacy.constituencyName && (
                                <p className="text-xs text-muted-foreground">
                                  {candidacy.constituencyName}
                                </p>
                              )}
                            </div>
                            {candidacy.isElected && (
                              <Badge className="bg-green-100 text-green-800 ml-auto flex-shrink-0">
                                Élu(e)
                              </Badge>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      <p>Aucune candidature déclarée pour le moment.</p>
                      <p className="text-sm mt-1">
                        Les candidatures seront affichées dès leur officialisation.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </section>
            )}

            {/* Results */}
            {isPhaseAtLeast(election.status, "ROUND_1") && (
              <section>
                <h2 className="text-lg font-semibold mb-4">Résultats</h2>
                {election.rounds.length > 0 ? (
                  <div className="space-y-4">
                    {election.rounds.map((round) => (
                      <Card key={round.id}>
                        <CardContent className="pt-6">
                          <h3 className="font-semibold mb-3">
                            {round.round === 1 ? "1er tour" : "2nd tour"} — {formatDate(round.date)}
                          </h3>
                          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                            {round.registeredVoters && (
                              <div>
                                <dt className="text-muted-foreground">Inscrits</dt>
                                <dd className="font-medium">
                                  {round.registeredVoters.toLocaleString("fr-FR")}
                                </dd>
                              </div>
                            )}
                            {round.actualVoters && (
                              <div>
                                <dt className="text-muted-foreground">Votants</dt>
                                <dd className="font-medium">
                                  {round.actualVoters.toLocaleString("fr-FR")}
                                </dd>
                              </div>
                            )}
                            {round.participationRate && (
                              <div>
                                <dt className="text-muted-foreground">Participation</dt>
                                <dd className="font-medium">
                                  {Number(round.participationRate).toFixed(1)} %
                                </dd>
                              </div>
                            )}
                            {round.blankVotes != null && (
                              <div>
                                <dt className="text-muted-foreground">Votes blancs</dt>
                                <dd className="font-medium">
                                  {round.blankVotes.toLocaleString("fr-FR")}
                                </dd>
                              </div>
                            )}
                            {round.nullVotes != null && (
                              <div>
                                <dt className="text-muted-foreground">Votes nuls</dt>
                                <dd className="font-medium">
                                  {round.nullVotes.toLocaleString("fr-FR")}
                                </dd>
                              </div>
                            )}
                          </dl>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      <p>Les résultats seront disponibles après le scrutin.</p>
                    </CardContent>
                  </Card>
                )}
              </section>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Scrutin info */}
            <ElectionScrutinInfo
              type={election.type}
              scope={election.scope}
              suffrage={election.suffrage}
              totalSeats={election.totalSeats}
            />

            {/* Sources */}
            {(election.decreeUrl || election.sourceUrl) && (
              <Card>
                <CardContent className="pt-6">
                  <h2 className="text-lg font-semibold mb-3">Sources</h2>
                  <ul className="space-y-2 text-sm">
                    {election.decreeUrl && (
                      <li>
                        <a
                          href={election.decreeUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline inline-flex items-center gap-1"
                        >
                          Décret de convocation
                          <span className="sr-only">(ouvre un nouvel onglet)</span>
                          <svg
                            className="w-3.5 h-3.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            aria-hidden="true"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                            />
                          </svg>
                        </a>
                      </li>
                    )}
                    {election.sourceUrl && (
                      <li>
                        <a
                          href={election.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline inline-flex items-center gap-1"
                        >
                          Source officielle
                          <span className="sr-only">(ouvre un nouvel onglet)</span>
                          <svg
                            className="w-3.5 h-3.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            aria-hidden="true"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                            />
                          </svg>
                        </a>
                      </li>
                    )}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Add to calendar */}
            {election.round1Date && (
              <Card>
                <CardContent className="pt-6">
                  <h2 className="text-lg font-semibold mb-3">Ajouter au calendrier</h2>
                  <AddToCalendar
                    title={election.title}
                    round1Date={election.round1Date}
                    round2Date={election.round2Date}
                    slug={election.slug}
                    dateConfirmed={election.dateConfirmed}
                  />
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
