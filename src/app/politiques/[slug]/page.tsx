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
  VOTE_POSITION_DOT_COLORS,
} from "@/config/labels";
import { PoliticianAvatar } from "@/components/politicians/PoliticianAvatar";
import { MandateTimeline } from "@/components/politicians/MandateTimeline";
import { InteractiveTimeline } from "@/components/politicians/InteractiveTimeline";
import { PersonJsonLd, BreadcrumbJsonLd } from "@/components/seo/JsonLd";
import { SentenceDetails } from "@/components/affairs/SentenceDetails";
import { AffairTimeline } from "@/components/affairs/AffairTimeline";
import { VotePositionBadge, VotingResultBadge } from "@/components/votes";

interface PageProps {
  params: Promise<{ slug: string }>;
}

async function getPolitician(slug: string) {
  const politician = await db.politician.findUnique({
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

  if (!politician) return null;

  // Serialize Decimal fields to numbers for client components
  return {
    ...politician,
    affairs: politician.affairs.map((affair) => ({
      ...affair,
      fineAmount: affair.fineAmount ? Number(affair.fineAmount) : null,
    })),
    mandates: politician.mandates.map((mandate) => ({
      ...mandate,
      baseSalary: mandate.baseSalary ? Number(mandate.baseSalary) : null,
      totalAllowances: mandate.totalAllowances ? Number(mandate.totalAllowances) : null,
    })),
  };
}

async function getVoteStats(politicianId: string) {
  const [stats, recentVotes] = await Promise.all([
    db.vote.groupBy({
      by: ["position"],
      where: { politicianId },
      _count: true,
    }),
    db.vote.findMany({
      where: { politicianId },
      include: {
        scrutin: {
          select: {
            id: true,
            title: true,
            votingDate: true,
            result: true,
          },
        },
      },
      orderBy: { scrutin: { votingDate: "desc" } },
      take: 5,
    }),
  ]);

  const votingStats = {
    total: 0,
    pour: 0,
    contre: 0,
    abstention: 0,
    absent: 0,
    participationRate: 0,
  };

  for (const s of stats) {
    votingStats.total += s._count;
    switch (s.position) {
      case "POUR":
        votingStats.pour = s._count;
        break;
      case "CONTRE":
        votingStats.contre = s._count;
        break;
      case "ABSTENTION":
        votingStats.abstention = s._count;
        break;
      case "ABSENT":
        votingStats.absent = s._count;
        break;
    }
  }

  const expressed = votingStats.pour + votingStats.contre + votingStats.abstention;
  votingStats.participationRate = votingStats.total > 0
    ? Math.round((expressed / votingStats.total) * 100)
    : 0;

  return { stats: votingStats, recentVotes };
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

  // Get vote stats (only for deputies - they have votes tracked)
  const isDepute = currentMandate?.type === "DEPUTE";
  const voteData = isDepute ? await getVoteStats(politician.id) : null;

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
          {/* Interactive Timeline - Desktop only */}
          {(hasMandates || politician.affairs.length > 0) && (
            <div className="hidden lg:block">
              <InteractiveTimeline
                mandates={politician.mandates}
                affairs={politician.affairs}
                birthDate={politician.birthDate}
                deathDate={politician.deathDate}
              />
            </div>
          )}

          {/* Career / Mandates */}
          {hasMandates && (
            <Card>
              <CardHeader>
                <h2 className="leading-none font-semibold">Parcours politique</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Liste des mandats nationaux et européens connus.
                  Les mandats locaux (maire, conseiller, etc.) peuvent ne pas être listés.
                </p>
              </CardHeader>
              <CardContent>
                <MandateTimeline
                  mandates={politician.mandates}
                  civility={politician.civility}
                />
              </CardContent>
            </Card>
          )}

          {/* Votes (deputies only) */}
          {voteData && voteData.stats.total > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <h2 className="leading-none font-semibold">Votes parlementaires</h2>
                  <Link
                    href={`/politiques/${politician.slug}/votes`}
                    className="text-sm text-primary hover:underline"
                  >
                    Voir tout →
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Stats summary */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                  <div className="p-2 bg-green-50 rounded-lg">
                    <p className="text-lg font-bold text-green-600">{voteData.stats.pour}</p>
                    <p className="text-xs text-muted-foreground">Pour</p>
                  </div>
                  <div className="p-2 bg-red-50 rounded-lg">
                    <p className="text-lg font-bold text-red-600">{voteData.stats.contre}</p>
                    <p className="text-xs text-muted-foreground">Contre</p>
                  </div>
                  <div className="p-2 bg-yellow-50 rounded-lg">
                    <p className="text-lg font-bold text-yellow-600">{voteData.stats.abstention}</p>
                    <p className="text-xs text-muted-foreground">Abstention</p>
                  </div>
                  <div className="p-2 bg-gray-50 rounded-lg">
                    <p className="text-lg font-bold text-gray-600">{voteData.stats.absent}</p>
                    <p className="text-xs text-muted-foreground">Absent</p>
                  </div>
                </div>

                {/* Participation bar */}
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">Participation</span>
                    <span className="font-medium">{voteData.stats.participationRate}%</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500"
                      style={{ width: `${voteData.stats.participationRate}%` }}
                    />
                  </div>
                </div>

                {/* Recent votes */}
                {voteData.recentVotes.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">Derniers votes</p>
                    <div className="space-y-2">
                      {voteData.recentVotes.map((vote) => (
                        <div key={vote.id} className="flex items-center gap-2 text-sm">
                          <span className={`w-2 h-2 rounded-full ${VOTE_POSITION_DOT_COLORS[vote.position]}`} />
                          <Link
                            href={`/votes/${vote.scrutin.id}`}
                            className="flex-1 truncate hover:underline"
                          >
                            {vote.scrutin.title}
                          </Link>
                          <VotePositionBadge position={vote.position} size="sm" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Affairs */}
          <Card>
            <CardHeader>
              <h2 className="leading-none font-semibold">Affaires judiciaires</h2>
            </CardHeader>
            <CardContent>
              {politician.affairs.length > 0 ? (
                <div className="space-y-6">
                  {politician.affairs.map((affair) => (
                    <div
                      key={affair.id}
                      id={`affair-${affair.id}`}
                      className={`border rounded-lg p-4 transition-all ${
                        affair.status === "CONDAMNATION_DEFINITIVE"
                          ? "border-red-200 bg-red-50/30"
                          : affair.status === "CONDAMNATION_PREMIERE_INSTANCE"
                            ? "border-orange-200 bg-orange-50/30"
                            : "border-gray-200"
                      }`}
                    >
                      {/* Header */}
                      <div className="mb-3">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              {(affair.verdictDate || affair.startDate || affair.factsDate) && (
                                <Badge variant="secondary" className="font-mono text-base font-bold">
                                  {new Date(affair.verdictDate || affair.startDate || affair.factsDate!).getFullYear()}
                                </Badge>
                              )}
                              <h3 className="font-semibold text-lg">{affair.title}</h3>
                            </div>
                          </div>
                          <Badge className={`self-start whitespace-nowrap ${AFFAIR_STATUS_COLORS[affair.status]}`}>
                            {AFFAIR_STATUS_LABELS[affair.status]}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-2">
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
                                  {" "}— {source.publisher}
                                  {source.publisher.toLowerCase() === "wikidata"
                                    ? `, mis à jour le ${formatDate(source.publishedAt)}`
                                    : `, ${formatDate(source.publishedAt)}`
                                  }
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
              <h2 className="leading-none font-semibold text-lg">En bref</h2>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Mandats</span>
                <span className="font-semibold">{politician.mandates.length}</span>
              </div>
              {voteData && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Votes</span>
                  <span className="font-semibold">{voteData.stats.total}</span>
                </div>
              )}
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
              {/* Relations link */}
              <div className="pt-3 border-t">
                <Link
                  href={`/politiques/${politician.slug}/relations`}
                  className="flex items-center gap-2 text-sm text-primary hover:underline"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="w-4 h-4"
                  >
                    <path d="M10 9a3 3 0 100-6 3 3 0 000 6zM6 8a2 2 0 11-4 0 2 2 0 014 0zM1.49 15.326a.78.78 0 01-.358-.442 3 3 0 014.308-3.516 6.484 6.484 0 00-1.905 3.959c-.023.222-.014.442.025.654a4.97 4.97 0 01-2.07-.655zM16.44 15.98a4.97 4.97 0 002.07-.654.78.78 0 00.357-.442 3 3 0 00-4.308-3.517 6.484 6.484 0 011.907 3.96 2.32 2.32 0 01-.026.654zM18 8a2 2 0 11-4 0 2 2 0 014 0zM5.304 16.19a.844.844 0 01-.277-.71 5 5 0 019.947 0 .843.843 0 01-.277.71A6.975 6.975 0 0110 18a6.974 6.974 0 01-4.696-1.81z" />
                  </svg>
                  Voir les relations
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Declarations */}
          {politician.declarations.length > 0 && (
            <Card>
              <CardHeader>
                <h2 className="leading-none font-semibold text-lg">Déclarations HATVP</h2>
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
                Sources : AN, Sénat, Gouvernement, HATVP, Wikidata
              </p>
              <Link
                href="/sources"
                className="text-xs text-blue-600 hover:underline mt-2 inline-block"
              >
                Voir notre méthodologie
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
      </div>
    </>
  );
}
