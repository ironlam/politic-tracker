import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { cacheTag, cacheLife } from "next/cache";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatCompactCurrency } from "@/lib/utils";
import {
  MANDATE_TYPE_LABELS,
  FACTCHECK_RATING_LABELS,
  FACTCHECK_RATING_COLORS,
  PARTY_ROLE_LABELS,
  feminizePartyRole,
} from "@/config/labels";
import { ensureContrast } from "@/lib/contrast";
import { PoliticianAvatar } from "@/components/politicians/PoliticianAvatar";
import { MandateTimeline } from "@/components/politicians/MandateTimeline";
import { InteractiveTimeline } from "@/components/politicians/InteractiveTimeline";
import { PersonJsonLd, BreadcrumbJsonLd } from "@/components/seo/JsonLd";
import { DeclarationCard } from "@/components/declarations/DeclarationCard";
import type { DeclarationDetails } from "@/types/hatvp";
import { BetaDisclaimer } from "@/components/BetaDisclaimer";
import { ProfileTabs } from "@/components/politicians/ProfileTabs";
import { CareerTimeline } from "@/components/politicians/CareerTimeline";
import { AffairsSection } from "@/components/politicians/AffairsSection";
import { VotesSection } from "@/components/politicians/VotesSection";
import { getPoliticianVotingStats, getPoliticianParliamentaryCard } from "@/services/voteStats";
import { getPolitician } from "@/lib/data/politicians";

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

  // Find latest DIA declaration with details for SEO
  const latestDIA = politician.declarations.find((d) => d.type === "INTERETS" && d.details);
  const details = latestDIA?.details as DeclarationDetails | null;

  let hatvpDescription = "";
  if (details) {
    const parts: string[] = [];
    if (details.totalPortfolioValue && details.totalPortfolioValue > 0) {
      parts.push(
        `${formatCompactCurrency(details.totalPortfolioValue)} de participations financières`
      );
    }
    if (details.totalCompanies > 0) {
      parts.push(`${details.totalCompanies} sociétés déclarées`);
    }
    if (parts.length > 0) {
      hatvpDescription = ` ${parts.join(", ")}.`;
    }
  }

  const description = `${role} ${politician.currentParty ? `(${politician.currentParty.shortName})` : ""} - Consultez ses mandats, déclarations d'intérêts et affaires judiciaires.${hatvpDescription}`;

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

  const isActiveParliamentarian = politician.mandates.some(
    (m) => m.isCurrent && (m.type === "DEPUTE" || m.type === "SENATEUR")
  );

  // Get vote stats (for deputies and senators - both have votes tracked)
  const isParliamentarian =
    currentMandate?.type === "DEPUTE" || currentMandate?.type === "SENATEUR";
  const mandateType = currentMandate?.type as "DEPUTE" | "SENATEUR" | undefined;
  const [voteData, parliamentaryCard] = await Promise.all([
    isParliamentarian ? getVoteStats(politician.id) : null,
    isParliamentarian && mandateType
      ? getPoliticianParliamentaryCard(politician.id, mandateType)
      : null,
  ]);

  // Split affairs by involvement for sidebar stats and timeline
  const directAffairs = politician.affairs.filter((a) => a.involvement === "DIRECT");
  const mentionAffairs = politician.affairs.filter(
    (a) =>
      a.involvement === "INDIRECT" ||
      a.involvement === "MENTIONED_ONLY" ||
      a.involvement === "PLAINTIFF"
  );
  const victimAffairs = politician.affairs.filter((a) => a.involvement === "VICTIM");

  // Extract companies where politician is a board member for JSON-LD
  const latestDIAForLD = politician.declarations.find((d) => d.type === "INTERETS" && d.details);
  const detailsForLD = latestDIAForLD?.details as DeclarationDetails | null;
  const memberOfOrgs =
    detailsForLD?.financialParticipations
      .filter((p) => p.isBoardMember)
      .map((p) => ({ name: p.company }))
      .slice(0, 10) ?? [];

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
        memberOf={memberOfOrgs.length > 0 ? memberOfOrgs : undefined}
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
                .filter((ph) => !ph.endDate && ph.role !== "MEMBER")
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
          <div className="lg:col-span-2">
            <ProfileTabs
              profileContent={
                <div className="space-y-8">
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
                    <Card id="biographie">
                      <CardContent className="pt-6">
                        <p className="text-muted-foreground leading-relaxed">
                          {politician.biography}
                        </p>
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
                    <Card id="parcours">
                      <CardHeader>
                        <h2 className="leading-none font-semibold">Parcours politique</h2>
                        <p className="text-xs text-muted-foreground mt-1">
                          Liste des mandats nationaux et européens connus. Les mandats locaux
                          (maire, conseiller, etc.) peuvent ne pas être listés.
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

                  {/* HATVP Declarations */}
                  {politician.declarations.length > 0 ? (
                    <DeclarationCard
                      id="declarations"
                      declarations={politician.declarations.map((d) => ({
                        id: d.id,
                        type: d.type,
                        year: d.year,
                        hatvpUrl: d.hatvpUrl,
                        pdfUrl: d.pdfUrl,
                        details: d.details as DeclarationDetails | null,
                      }))}
                      politicianHatvpUrl={
                        politician.externalIds.find((e) => e.source === "HATVP")?.url ?? null
                      }
                    />
                  ) : isActiveParliamentarian ? (
                    <Card id="declarations">
                      <CardHeader>
                        <h2 className="text-lg font-semibold">
                          Déclarations d&apos;intérêts et d&apos;activités
                        </h2>
                      </CardHeader>
                      <CardContent>
                        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                          <p className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-2">
                            Aucune déclaration publiée
                          </p>
                          <p className="text-sm text-amber-700 dark:text-amber-300 leading-relaxed">
                            Tout député et sénateur est tenu de déposer une déclaration
                            d&apos;intérêts et d&apos;activités dans les 2 mois suivant son élection
                            (loi n°2013-907 du 11 octobre 2013). Le non-dépôt est passible de 3 ans
                            d&apos;emprisonnement, 45 000 € d&apos;amende et 10 ans
                            d&apos;inéligibilité. Seules les déclarations publiées par la HATVP sont
                            affichées ici.
                          </p>
                          <a
                            href="https://www.hatvp.fr/consulter-les-declarations/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-block mt-3 text-sm text-amber-700 dark:text-amber-300 underline hover:text-amber-900 dark:hover:text-amber-100"
                          >
                            Consulter le site de la HATVP →
                          </a>
                        </div>
                      </CardContent>
                    </Card>
                  ) : null}

                  {/* Fact-checks */}
                  {politician.factCheckMentions.length > 0 &&
                    (() => {
                      const directClaims = politician.factCheckMentions.filter((m) => m.isClaimant);
                      const otherMentions = politician.factCheckMentions.filter(
                        (m) => !m.isClaimant
                      );

                      // Verdict distribution for direct claims
                      const verdictCounts = directClaims.reduce(
                        (acc, m) => {
                          const r = m.factCheck.verdictRating;
                          if (r === "TRUE" || r === "MOSTLY_TRUE") acc.vrai++;
                          else if (
                            r === "HALF_TRUE" ||
                            r === "MISLEADING" ||
                            r === "OUT_OF_CONTEXT"
                          )
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
                        <Card id="factchecks">
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
                                        <span className="text-red-600">
                                          Faux : {verdictCounts.faux}
                                        </span>
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
                                      className="border-b last:border-0 pb-3 last:pb-0 space-y-1"
                                    >
                                      <div className="flex items-center gap-2">
                                        <Badge
                                          className={`shrink-0 ${FACTCHECK_RATING_COLORS[mention.factCheck.verdictRating]}`}
                                        >
                                          {FACTCHECK_RATING_LABELS[mention.factCheck.verdictRating]}
                                        </Badge>
                                        <span className="text-xs text-muted-foreground">
                                          {mention.factCheck.source} ·{" "}
                                          {formatDate(mention.factCheck.publishedAt)}
                                        </span>
                                      </div>
                                      {mention.factCheck.slug ? (
                                        <Link
                                          href={`/factchecks/${mention.factCheck.slug}`}
                                          className="text-sm font-medium hover:underline block"
                                        >
                                          {mention.factCheck.title}
                                        </Link>
                                      ) : (
                                        <a
                                          href={mention.factCheck.sourceUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-sm font-medium hover:underline block"
                                        >
                                          {mention.factCheck.title}
                                        </a>
                                      )}
                                      {mention.factCheck.claimText && (
                                        <p className="text-sm text-muted-foreground">
                                          &laquo;&nbsp;{mention.factCheck.claimText}&nbsp;&raquo;
                                        </p>
                                      )}
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
                                      className="border-b last:border-0 pb-3 last:pb-0 space-y-1"
                                    >
                                      <div className="flex items-center gap-2">
                                        <Badge
                                          className={`shrink-0 ${FACTCHECK_RATING_COLORS[mention.factCheck.verdictRating]}`}
                                        >
                                          {FACTCHECK_RATING_LABELS[mention.factCheck.verdictRating]}
                                        </Badge>
                                        <span className="text-xs text-muted-foreground">
                                          {mention.factCheck.source} ·{" "}
                                          {formatDate(mention.factCheck.publishedAt)}
                                        </span>
                                      </div>
                                      {mention.factCheck.slug ? (
                                        <Link
                                          href={`/factchecks/${mention.factCheck.slug}`}
                                          className="text-sm font-medium hover:underline block"
                                        >
                                          {mention.factCheck.title}
                                        </Link>
                                      ) : (
                                        <a
                                          href={mention.factCheck.sourceUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-sm font-medium hover:underline block"
                                        >
                                          {mention.factCheck.title}
                                        </a>
                                      )}
                                      {mention.factCheck.claimText && (
                                        <p className="text-sm text-muted-foreground">
                                          {mention.factCheck.claimant && (
                                            <span className="font-medium">
                                              {mention.factCheck.claimant} :{" "}
                                            </span>
                                          )}
                                          &laquo;&nbsp;{mention.factCheck.claimText}&nbsp;&raquo;
                                        </p>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })()}
                </div>
              }
              careerContent={
                <CareerTimeline
                  mandates={politician.mandates}
                  partyHistory={politician.partyHistory}
                  affairs={directAffairs}
                  birthDate={politician.birthDate}
                  deathDate={politician.deathDate}
                />
              }
              votesContent={
                (voteData && voteData.stats.total > 0) || parliamentaryCard ? (
                  <VotesSection
                    slug={politician.slug}
                    voteData={voteData!}
                    parliamentaryCard={parliamentaryCard}
                    currentMandate={
                      currentMandate
                        ? {
                            type: currentMandate.type,
                            title: currentMandate.title,
                            constituency: currentMandate.constituency,
                          }
                        : null
                    }
                    currentGroup={currentGroup ?? null}
                  />
                ) : null
              }
              affairsContent={
                <AffairsSection affairs={politician.affairs} civility={politician.civility} />
              }
            />
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
                  <span className="text-muted-foreground">Affaires (mis en cause)</span>
                  <span className="font-semibold">{directAffairs.length}</span>
                </div>
                {mentionAffairs.length > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Mentions</span>
                    <span className="font-semibold text-gray-500">{mentionAffairs.length}</span>
                  </div>
                )}
                {victimAffairs.length > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Victime</span>
                    <span className="font-semibold text-primary">{victimAffairs.length}</span>
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
                  className="text-xs text-primary hover:underline mt-2 inline-block"
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
