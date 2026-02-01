import { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { VotingResultBadge, VotePositionBadge } from "@/components/votes";
import { PoliticianAvatar } from "@/components/politicians/PoliticianAvatar";
import { formatDate } from "@/lib/utils";
import { ExternalLink, Calendar, Users } from "lucide-react";
import type { VotePosition } from "@/types";

interface PageProps {
  params: Promise<{ slug: string }>;
}

/**
 * Get scrutin with redirect support for legacy URLs
 * Returns { scrutin, redirect } where redirect is the slug to redirect to
 */
async function getScrutinWithRedirect(slugOrId: string) {
  const includeOptions = {
    votes: {
      include: {
        politician: {
          include: {
            currentParty: true,
          },
        },
      },
      orderBy: {
        politician: { lastName: "asc" },
      },
    },
  } as const;

  // 1. Try by slug first (canonical URL - most common case)
  let scrutin = await db.scrutin.findUnique({
    where: { slug: slugOrId },
    include: includeOptions,
  });
  if (scrutin) {
    return { scrutin, redirect: null };
  }

  // 2. Try by internal ID (CUID) - legacy URL
  scrutin = await db.scrutin.findUnique({
    where: { id: slugOrId },
    include: includeOptions,
  });
  if (scrutin) {
    return { scrutin, redirect: scrutin.slug };
  }

  // 3. Try by exact externalId (e.g., "VTANR5L17V5283") - legacy URL
  scrutin = await db.scrutin.findUnique({
    where: { externalId: slugOrId },
    include: includeOptions,
  });
  if (scrutin) {
    return { scrutin, redirect: scrutin.slug };
  }

  // 4. Try by numeric part of externalId (e.g., "5283") - legacy URL
  // External IDs are like "VTANR5L17V5283" - we match the number part
  if (/^\d+$/.test(slugOrId)) {
    scrutin = await db.scrutin.findFirst({
      where: {
        externalId: { endsWith: `V${slugOrId}` },
      },
      include: includeOptions,
    });
    if (scrutin) {
      return { scrutin, redirect: scrutin.slug };
    }
  }

  return { scrutin: null, redirect: null };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const { scrutin } = await getScrutinWithRedirect(slug);

  if (!scrutin) {
    return { title: "Scrutin non trouvé" };
  }

  return {
    title: scrutin.title,
    description: `Scrutin du ${formatDate(scrutin.votingDate)} - ${scrutin.result === "ADOPTED" ? "Adopté" : "Rejeté"} avec ${scrutin.votesFor} pour, ${scrutin.votesAgainst} contre et ${scrutin.votesAbstain} abstentions.`,
  };
}

export default async function ScrutinPage({ params }: PageProps) {
  const { slug } = await params;
  const { scrutin, redirect } = await getScrutinWithRedirect(slug);

  // Redirect legacy URLs to canonical slug URL
  if (redirect && redirect !== slug) {
    permanentRedirect(`/votes/${redirect}`);
  }

  if (!scrutin) {
    notFound();
  }

  // Group votes by position
  const votesByPosition = scrutin.votes.reduce(
    (acc, vote) => {
      if (!acc[vote.position]) {
        acc[vote.position] = [];
      }
      acc[vote.position].push(vote);
      return acc;
    },
    {} as Record<VotePosition, typeof scrutin.votes>
  );

  const total = scrutin.votesFor + scrutin.votesAgainst + scrutin.votesAbstain;
  const forPercent = total > 0 ? (scrutin.votesFor / total) * 100 : 0;
  const againstPercent = total > 0 ? (scrutin.votesAgainst / total) * 100 : 0;
  const abstainPercent = total > 0 ? (scrutin.votesAbstain / total) * 100 : 0;

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="text-sm text-muted-foreground mb-6">
        <Link href="/votes" className="hover:text-foreground">
          Votes
        </Link>
        <span className="mx-2">/</span>
        <span className="truncate">Scrutin n°{scrutin.externalId}</span>
      </nav>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between gap-4 mb-4">
          <h1 className="text-2xl font-bold">{scrutin.title}</h1>
          <VotingResultBadge result={scrutin.result} />
        </div>

        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            {formatDate(scrutin.votingDate)}
          </span>
          <span className="flex items-center gap-1">
            <Users className="h-4 w-4" />
            {total} votants
          </span>
          <Badge variant="outline">{scrutin.legislature}e législature</Badge>
          {scrutin.sourceUrl && (
            <a
              href={scrutin.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-primary hover:underline"
            >
              <ExternalLink className="h-4 w-4" />
              {scrutin.sourceUrl.includes("assemblee-nationale.fr")
                ? "Voir sur Assemblée nationale"
                : scrutin.sourceUrl.includes("nosdeputes.fr")
                  ? "Voir sur NosDéputés.fr"
                  : "Voir la source"}
            </a>
          )}
        </div>
      </div>

      {/* Results summary */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Résultat du vote</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Vote bar */}
            <div className="flex h-8 rounded-lg overflow-hidden">
              <div
                className="bg-green-500 flex items-center justify-center text-white text-sm font-medium"
                style={{ width: `${forPercent}%` }}
              >
                {scrutin.votesFor > 0 && scrutin.votesFor}
              </div>
              <div
                className="bg-red-500 flex items-center justify-center text-white text-sm font-medium"
                style={{ width: `${againstPercent}%` }}
              >
                {scrutin.votesAgainst > 0 && scrutin.votesAgainst}
              </div>
              <div
                className="bg-yellow-500 flex items-center justify-center text-white text-sm font-medium"
                style={{ width: `${abstainPercent}%` }}
              >
                {scrutin.votesAbstain > 0 && scrutin.votesAbstain}
              </div>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap justify-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-green-500" />
                <span>Pour: {scrutin.votesFor} ({forPercent.toFixed(1)}%)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-500" />
                <span>Contre: {scrutin.votesAgainst} ({againstPercent.toFixed(1)}%)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-yellow-500" />
                <span>Abstention: {scrutin.votesAbstain} ({abstainPercent.toFixed(1)}%)</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Votes by position */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        {(["POUR", "CONTRE", "ABSTENTION", "ABSENT"] as VotePosition[]).map((position) => {
          const votes = votesByPosition[position] || [];
          return (
            <Card key={position}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    <VotePositionBadge position={position} />
                  </CardTitle>
                  <span className="text-sm text-muted-foreground">{votes.length}</span>
                </div>
              </CardHeader>
              <CardContent>
                {votes.length > 0 ? (
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {votes.map((vote) => (
                      <Link
                        key={vote.id}
                        href={`/politiques/${vote.politician.slug}`}
                        className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted transition-colors"
                      >
                        <PoliticianAvatar
                          photoUrl={vote.politician.photoUrl}
                          firstName={vote.politician.firstName}
                          lastName={vote.politician.lastName}
                          size="sm"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {vote.politician.fullName}
                          </p>
                          {vote.politician.currentParty && (
                            <p className="text-xs text-muted-foreground truncate">
                              {vote.politician.currentParty.shortName}
                            </p>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Aucun député
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Back link */}
      <div className="mt-8 text-center">
        <Link href="/votes" className="text-primary hover:underline">
          ← Retour aux scrutins
        </Link>
      </div>
    </div>
  );
}
