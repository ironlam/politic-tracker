import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { cacheTag, cacheLife } from "next/cache";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import {
  AFFAIR_STATUS_LABELS,
  AFFAIR_STATUS_COLORS,
  AFFAIR_STATUS_NEEDS_PRESUMPTION,
  AFFAIR_CATEGORY_LABELS,
  INVOLVEMENT_LABELS,
  INVOLVEMENT_COLORS,
  MANDATE_TYPE_LABELS,
  VOTE_POSITION_DOT_COLORS,
  FACTCHECK_RATING_LABELS,
  FACTCHECK_RATING_COLORS,
  isDirectPoliticianClaim,
  PARTY_ROLE_LABELS,
  feminizePartyRole,
} from "@/config/labels";
import { ensureContrast } from "@/lib/contrast";
import type { Involvement } from "@/types";
import { PoliticianAvatar } from "@/components/politicians/PoliticianAvatar";
import { MandateTimeline } from "@/components/politicians/MandateTimeline";
import { InteractiveTimeline } from "@/components/politicians/InteractiveTimeline";
import { PersonJsonLd, BreadcrumbJsonLd } from "@/components/seo/JsonLd";
import { SentenceDetails } from "@/components/affairs/SentenceDetails";
import { AffairTimeline } from "@/components/affairs/AffairTimeline";
import { VotePositionBadge } from "@/components/votes";
import { BetaDisclaimer } from "@/components/BetaDisclaimer";
import { getPoliticianVotingStats } from "@/services/voteStats";

export const revalidate = 3600; // ISR: revalidate every hour

export async function generateStaticParams() {
  const politicians = await db.politician.findMany({
    where: { publicationStatus: "PUBLISHED" },
    select: { slug: true },
    take: 100,
    orderBy: { prominenceScore: "desc" },
  });
  return politicians.map((p) => ({ slug: p.slug }));
}

interface PageProps {
  params: Promise<{ slug: string }>;
}

async function getPolitician(slug: string) {
  "use cache";
  cacheTag(`politician:${slug}`, "politicians");
  cacheLife("minutes");

  const politician = await db.politician.findUnique({
    where: { slug },
    include: {
      currentParty: true,
      mandates: {
        orderBy: { startDate: "desc" },
        include: {
          parliamentaryGroup: {
            select: { code: true, name: true, color: true },
          },
        },
      },
      affairs: {
        where: { publicationStatus: "PUBLISHED" },
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
      factCheckMentions: {
        include: {
          factCheck: {
            select: {
              id: true,
              slug: true,
              title: true,
              claimText: true,
              claimant: true,
              verdictRating: true,
              source: true,
              sourceUrl: true,
              publishedAt: true,
            },
          },
        },
        orderBy: { factCheck: { publishedAt: "desc" } },
        take: 20,
      },
      partyHistory: {
        where: {
          role: { not: "MEMBER" },
        },
        include: {
          party: {
            select: { name: true, shortName: true, slug: true, color: true },
          },
        },
        orderBy: { startDate: "desc" },
      },
      externalIds: {
        select: { url: true },
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
  "use cache";
  cacheTag("votes", "politicians");
  cacheLife("minutes");

  const [stats, recentVotes] = await Promise.all([
    getPoliticianVotingStats(politicianId),
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

  return { stats, recentVotes };
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
      title: `${politician.fullName} | Poligraph`,
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
  const currentGroup = (
    currentMandate as typeof currentMandate & {
      parliamentaryGroup?: { code: string; name: string; color: string | null } | null;
    }
  )?.parliamentaryGroup;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://poligraph.fr";

  // Get vote stats (only for deputies - they have votes tracked)
  const isDepute = currentMandate?.type === "DEPUTE";
  const voteData = isDepute ? await getVoteStats(politician.id) : null;

  // Split affairs by involvement: accused vs victim
  const directAffairs = politician.affairs.filter(
    (a) =>
      a.involvement === "DIRECT" ||
      a.involvement === "INDIRECT" ||
      a.involvement === "MENTIONED_ONLY"
  );
  const victimAffairs = politician.affairs.filter(
    (a) => a.involvement === "VICTIM" || a.involvement === "PLAINTIFF"
  );

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
        sameAs={politician.externalIds
          .map((e) => e.url)
          .filter((url): url is string => url != null)}
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
            <div className="flex flex-wrap items-center gap-2">
              {politician.currentParty && (
                <Link
                  href={
                    politician.currentParty.slug
                      ? `/partis/${politician.currentParty.slug}`
                      : "/partis"
                  }
                >
                  <Badge
                    className="text-sm hover:opacity-80 transition-opacity cursor-pointer"
                    style={{
                      backgroundColor: politician.currentParty.color
                        ? `${politician.currentParty.color}20`
                        : undefined,
                      color: politician.currentParty.color
                        ? ensureContrast(politician.currentParty.color, "#ffffff")
                        : undefined,
                    }}
                  >
                    {politician.currentParty.name}
                  </Badge>
                </Link>
              )}
              {currentGroup && (
                <Badge
                  variant="outline"
                  className="text-sm"
                  style={{
                    borderColor: currentGroup.color || undefined,
                    color: currentGroup.color
                      ? ensureContrast(currentGroup.color, "#ffffff")
                      : undefined,
                  }}
                >
                  Groupe {currentGroup.code}
                </Badge>
              )}
              {politician.partyHistory
                .filter((ph) => !ph.endDate)
                .map((ph) => (
                  <Badge key={ph.id} variant="outline" className="text-sm">
                    {feminizePartyRole(PARTY_ROLE_LABELS[ph.role], politician.civility)}
                    {ph.party.shortName !== politician.currentParty?.shortName &&
                      ` · ${ph.party.shortName}`}
                  </Badge>
                ))}
            </div>
            {politician.birthDate && (
              <p className="text-muted-foreground mt-2">
                {politician.civility === "Mme" ? "Née" : "Né"} le {formatDate(politician.birthDate)}
                {politician.birthPlace && ` à ${politician.birthPlace}`}
                {politician.deathDate && (
                  <span className="text-gray-500">
                    {" "}
                    - Décédé{politician.civility === "Mme" ? "e" : ""} le{" "}
                    {formatDate(politician.deathDate)}
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
            {(hasMandates || directAffairs.length > 0) && (
              <div className="hidden lg:block">
                <InteractiveTimeline
                  mandates={politician.mandates}
                  affairs={directAffairs}
                  birthDate={politician.birthDate}
                  deathDate={politician.deathDate}
                />
              </div>
            )}

            {/* Biography */}
            {politician.biography && (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-muted-foreground leading-relaxed">{politician.biography}</p>
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-dashed text-xs text-muted-foreground">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 16 16"
                      fill="currentColor"
                      className="w-3.5 h-3.5 shrink-0 text-primary/50"
                      aria-hidden="true"
                    >
                      <path d="M8 1a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 8 1ZM10.5 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0ZM12.95 4.11a.75.75 0 1 0-1.06-1.06l-1.062 1.06a.75.75 0 0 0 1.061 1.062l1.06-1.062ZM15 8a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1 0-1.5h1.5A.75.75 0 0 1 15 8ZM11.889 12.95a.75.75 0 0 0 1.06-1.06l-1.06-1.062a.75.75 0 0 0-1.062 1.061l1.062 1.06ZM8 12a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 8 12ZM5.172 11.889a.75.75 0 0 0-1.061-1.062L3.05 11.89a.75.75 0 1 0 1.06 1.06l1.062-1.06ZM4 8a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1 0-1.5h1.5A.75.75 0 0 1 4 8ZM4.11 5.172A.75.75 0 0 0 5.173 4.11L4.11 3.05a.75.75 0 1 0-1.06 1.06l1.06 1.062Z" />
                    </svg>
                    <span>
                      Résumé généré automatiquement à partir de sources publiques
                      {politician.biographyGeneratedAt &&
                        ` — ${formatDate(politician.biographyGeneratedAt)}`}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Career / Mandates */}
            {hasMandates && (
              <Card>
                <CardHeader>
                  <h2 className="leading-none font-semibold">Parcours politique</h2>
                  <p className="text-xs text-muted-foreground mt-1">
                    Liste des mandats nationaux et européens connus. Les mandats locaux (maire,
                    conseiller, etc.) peuvent ne pas être listés.
                  </p>
                </CardHeader>
                <CardContent>
                  <MandateTimeline mandates={politician.mandates} civility={politician.civility} />
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
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-center">
                    <div className="p-2 bg-green-50 rounded-lg">
                      <p className="text-lg font-bold text-green-600">{voteData.stats.pour}</p>
                      <p className="text-xs text-muted-foreground">Pour</p>
                    </div>
                    <div className="p-2 bg-red-50 rounded-lg">
                      <p className="text-lg font-bold text-red-600">{voteData.stats.contre}</p>
                      <p className="text-xs text-muted-foreground">Contre</p>
                    </div>
                    <div className="p-2 bg-yellow-50 rounded-lg">
                      <p className="text-lg font-bold text-yellow-600">
                        {voteData.stats.abstention}
                      </p>
                      <p className="text-xs text-muted-foreground">Abstention</p>
                    </div>
                    <div className="p-2 bg-slate-50 rounded-lg">
                      <p className="text-lg font-bold text-slate-600">{voteData.stats.nonVotant}</p>
                      <p className="text-xs text-muted-foreground">Non-votant</p>
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
                            <span
                              className={`w-2 h-2 rounded-full ${VOTE_POSITION_DOT_COLORS[vote.position]}`}
                            />
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

            {/* Fact-checks */}
            {politician.factCheckMentions.length > 0 &&
              (() => {
                const directClaims = politician.factCheckMentions.filter((m) =>
                  isDirectPoliticianClaim(m.factCheck.claimant)
                );
                const otherMentions = politician.factCheckMentions.filter(
                  (m) => !isDirectPoliticianClaim(m.factCheck.claimant)
                );

                // Verdict distribution for direct claims
                const verdictCounts = directClaims.reduce(
                  (acc, m) => {
                    const r = m.factCheck.verdictRating;
                    if (r === "TRUE" || r === "MOSTLY_TRUE") acc.vrai++;
                    else if (r === "HALF_TRUE" || r === "MISLEADING" || r === "OUT_OF_CONTEXT")
                      acc.mitige++;
                    else if (r === "FALSE" || r === "MOSTLY_FALSE") acc.faux++;
                    else acc.autre++;
                    return acc;
                  },
                  { vrai: 0, mitige: 0, faux: 0, autre: 0 }
                );
                const verdictTotal =
                  verdictCounts.vrai +
                  verdictCounts.mitige +
                  verdictCounts.faux +
                  verdictCounts.autre;

                return (
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <h2 className="leading-none font-semibold">Fact-checks</h2>
                        <Link
                          href={`/factchecks?politician=${politician.slug}`}
                          className="text-sm text-primary hover:underline"
                        >
                          Voir tout →
                        </Link>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Verdicts émis par les organismes de fact-checking cités.
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* Direct claims with verdict bar */}
                      {directClaims.length > 0 && (
                        <div>
                          <h3 className="text-sm font-medium mb-3">
                            Ses déclarations vérifiées ({directClaims.length})
                          </h3>

                          {/* Verdict distribution bar */}
                          {verdictTotal > 0 && (
                            <div className="mb-4">
                              <div className="flex h-3 rounded-full overflow-hidden">
                                {verdictCounts.faux > 0 && (
                                  <div
                                    className="bg-red-400"
                                    style={{
                                      width: `${(verdictCounts.faux / verdictTotal) * 100}%`,
                                    }}
                                    title={`Faux : ${verdictCounts.faux}`}
                                  />
                                )}
                                {verdictCounts.mitige > 0 && (
                                  <div
                                    className="bg-yellow-400"
                                    style={{
                                      width: `${(verdictCounts.mitige / verdictTotal) * 100}%`,
                                    }}
                                    title={`Mitigé : ${verdictCounts.mitige}`}
                                  />
                                )}
                                {verdictCounts.vrai > 0 && (
                                  <div
                                    className="bg-green-400"
                                    style={{
                                      width: `${(verdictCounts.vrai / verdictTotal) * 100}%`,
                                    }}
                                    title={`Vrai : ${verdictCounts.vrai}`}
                                  />
                                )}
                                {verdictCounts.autre > 0 && (
                                  <div
                                    className="bg-gray-300"
                                    style={{
                                      width: `${(verdictCounts.autre / verdictTotal) * 100}%`,
                                    }}
                                    title={`Invérifiable : ${verdictCounts.autre}`}
                                  />
                                )}
                              </div>
                              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                                {verdictCounts.faux > 0 && (
                                  <span className="text-red-600">Faux : {verdictCounts.faux}</span>
                                )}
                                {verdictCounts.mitige > 0 && (
                                  <span className="text-yellow-600">
                                    Mitigé : {verdictCounts.mitige}
                                  </span>
                                )}
                                {verdictCounts.vrai > 0 && (
                                  <span className="text-green-600">
                                    Vrai : {verdictCounts.vrai}
                                  </span>
                                )}
                                {verdictCounts.autre > 0 && (
                                  <span className="text-gray-500">
                                    Autre : {verdictCounts.autre}
                                  </span>
                                )}
                              </div>
                            </div>
                          )}

                          <div className="space-y-3">
                            {directClaims.slice(0, 5).map((mention) => (
                              <div
                                key={mention.id}
                                className="flex items-start gap-3 border-b last:border-0 pb-3 last:pb-0"
                              >
                                <Badge
                                  className={`shrink-0 ${FACTCHECK_RATING_COLORS[mention.factCheck.verdictRating]}`}
                                >
                                  {FACTCHECK_RATING_LABELS[mention.factCheck.verdictRating]}
                                </Badge>
                                <div className="min-w-0 flex-1">
                                  {mention.factCheck.slug ? (
                                    <Link
                                      href={`/factchecks/${mention.factCheck.slug}`}
                                      className="text-sm font-medium hover:underline"
                                    >
                                      {mention.factCheck.title}
                                    </Link>
                                  ) : (
                                    <a
                                      href={mention.factCheck.sourceUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-sm font-medium hover:underline"
                                    >
                                      {mention.factCheck.title}
                                    </a>
                                  )}
                                  {mention.factCheck.claimText && (
                                    <p className="text-sm text-muted-foreground mt-1 line-clamp-3">
                                      &laquo;&nbsp;{mention.factCheck.claimText}&nbsp;&raquo;
                                    </p>
                                  )}
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    {mention.factCheck.source} ·{" "}
                                    {formatDate(mention.factCheck.publishedAt)}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Other mentions */}
                      {otherMentions.length > 0 && (
                        <div>
                          <h3 className="text-sm font-medium mb-3 text-muted-foreground">
                            Mentionné dans ({otherMentions.length})
                          </h3>
                          <div className="space-y-3">
                            {otherMentions.slice(0, 3).map((mention) => (
                              <div
                                key={mention.id}
                                className="flex items-start gap-3 border-b last:border-0 pb-3 last:pb-0"
                              >
                                <Badge
                                  className={`shrink-0 ${FACTCHECK_RATING_COLORS[mention.factCheck.verdictRating]}`}
                                >
                                  {FACTCHECK_RATING_LABELS[mention.factCheck.verdictRating]}
                                </Badge>
                                <div className="min-w-0 flex-1">
                                  {mention.factCheck.slug ? (
                                    <Link
                                      href={`/factchecks/${mention.factCheck.slug}`}
                                      className="text-sm font-medium hover:underline"
                                    >
                                      {mention.factCheck.title}
                                    </Link>
                                  ) : (
                                    <a
                                      href={mention.factCheck.sourceUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-sm font-medium hover:underline"
                                    >
                                      {mention.factCheck.title}
                                    </a>
                                  )}
                                  {mention.factCheck.claimText && (
                                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                      {mention.factCheck.claimant && (
                                        <span className="font-medium">
                                          {mention.factCheck.claimant} :{" "}
                                        </span>
                                      )}
                                      &laquo;&nbsp;{mention.factCheck.claimText}&nbsp;&raquo;
                                    </p>
                                  )}
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    {mention.factCheck.source} ·{" "}
                                    {formatDate(mention.factCheck.publishedAt)}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })()}

            {/* Affairs — Accused / Involved */}
            <Card>
              <CardHeader>
                <h2 className="leading-none font-semibold">Affaires judiciaires</h2>
              </CardHeader>
              <CardContent>
                {directAffairs.length > 0 ? (
                  <div className="space-y-6">
                    {directAffairs.map((affair) => (
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
                                  <Badge
                                    variant="secondary"
                                    className="font-mono text-base font-bold"
                                  >
                                    {new Date(
                                      affair.verdictDate || affair.startDate || affair.factsDate!
                                    ).getFullYear()}
                                  </Badge>
                                )}
                                <h3 className="font-semibold text-lg">{affair.title}</h3>
                              </div>
                            </div>
                            <Badge
                              className={`self-start whitespace-nowrap ${AFFAIR_STATUS_COLORS[affair.status]}`}
                            >
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
                                title={affair.partyAtTime.name}
                                style={{
                                  borderColor: affair.partyAtTime.color || undefined,
                                  color: affair.partyAtTime.color
                                    ? ensureContrast(affair.partyAtTime.color, "#ffffff")
                                    : undefined,
                                }}
                              >
                                {affair.partyAtTime.shortName} à l&apos;époque
                              </Badge>
                            )}
                            {affair.involvement !== "DIRECT" && (
                              <Badge
                                className={INVOLVEMENT_COLORS[affair.involvement as Involvement]}
                              >
                                {INVOLVEMENT_LABELS[affair.involvement as Involvement]}
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Description */}
                        <p className="text-sm text-muted-foreground mb-3">{affair.description}</p>

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
                            Présomption d&apos;innocence : cette affaire est en cours, la personne
                            est présumée innocente jusqu&apos;à condamnation définitive.
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
                                    {" "}
                                    — {source.publisher}
                                    {source.publisher.toLowerCase() === "wikidata"
                                      ? `, mis à jour le ${formatDate(source.publishedAt)}`
                                      : `, ${formatDate(source.publishedAt)}`}
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
                  <div>
                    <p className="text-muted-foreground">
                      Aucune affaire judiciaire documentée à ce jour.
                    </p>
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      Cela ne signifie pas l&apos;absence d&apos;affaire — nos données sont
                      enrichies progressivement.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Affairs — Victim / Plaintiff */}
            {victimAffairs.length > 0 && (
              <Card>
                <CardHeader>
                  <h2 className="leading-none font-semibold">Victime d&apos;infractions</h2>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {victimAffairs.map((affair) => (
                      <div
                        key={affair.id}
                        id={`affair-${affair.id}`}
                        className="border rounded-lg p-4 border-blue-200 bg-blue-50/30"
                      >
                        <div className="mb-3">
                          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                {(affair.verdictDate || affair.startDate || affair.factsDate) && (
                                  <Badge
                                    variant="secondary"
                                    className="font-mono text-base font-bold"
                                  >
                                    {new Date(
                                      affair.verdictDate || affair.startDate || affair.factsDate!
                                    ).getFullYear()}
                                  </Badge>
                                )}
                                <h3 className="font-semibold text-lg">{affair.title}</h3>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 self-start">
                              <Badge className="bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700 whitespace-nowrap">
                                {INVOLVEMENT_LABELS[affair.involvement]}
                              </Badge>
                              <Badge
                                className={`whitespace-nowrap ${AFFAIR_STATUS_COLORS[affair.status]}`}
                              >
                                {AFFAIR_STATUS_LABELS[affair.status]}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 mt-2">
                            <Badge variant="outline" className="text-xs">
                              {AFFAIR_CATEGORY_LABELS[affair.category]}
                            </Badge>
                          </div>
                        </div>

                        <p className="text-sm text-muted-foreground mb-3">{affair.description}</p>

                        {/* Dates */}
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
                        </div>

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
                                    {" "}
                                    — {source.publisher}, {formatDate(source.publishedAt)}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </details>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
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
                  <span className="font-semibold">{directAffairs.length}</span>
                </div>
                {victimAffairs.length > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Victime / Plaignant</span>
                    <span className="font-semibold text-blue-600">{victimAffairs.length}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Déclarations HATVP</span>
                  <span className="font-semibold">{politician.declarations.length}</span>
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

            <BetaDisclaimer variant="profile" />

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
