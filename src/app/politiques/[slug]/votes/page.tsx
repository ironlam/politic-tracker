import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PoliticianAvatar } from "@/components/politicians/PoliticianAvatar";
import { VoteStats, VotePositionBadge, VotingResultBadge } from "@/components/votes";
import { formatDate } from "@/lib/utils";
import { ArrowLeft, ExternalLink, Info } from "lucide-react";
import { feminizeRole } from "@/config/labels";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}

async function getPolitician(slug: string) {
  return db.politician.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      fullName: true,
      firstName: true,
      lastName: true,
      photoUrl: true,
      civility: true,
      currentParty: true,
      mandates: {
        where: { isCurrent: true, role: { not: null } },
        select: { role: true, type: true },
      },
    },
  });
}

async function getVotes(politicianId: string, page: number, limit: number) {
  const skip = (page - 1) * limit;

  const [votes, total, stats] = await Promise.all([
    db.vote.findMany({
      where: { politicianId },
      include: {
        scrutin: true,
      },
      orderBy: { scrutin: { votingDate: "desc" } },
      skip,
      take: limit,
    }),
    db.vote.count({
      where: { politicianId },
    }),
    db.vote.groupBy({
      by: ["position"],
      where: { politicianId },
      _count: true,
    }),
  ]);

  const votingStats = {
    total: 0,
    pour: 0,
    contre: 0,
    abstention: 0,
    nonVotant: 0,
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
      case "NON_VOTANT":
        votingStats.nonVotant = s._count;
        break;
      case "ABSENT":
        votingStats.absent = s._count;
        break;
    }
  }

  const expressed = votingStats.pour + votingStats.contre + votingStats.abstention;
  const countedForParticipation = votingStats.total - votingStats.nonVotant;
  votingStats.participationRate = countedForParticipation > 0
    ? Math.round((expressed / countedForParticipation) * 100)
    : 0;

  return {
    votes,
    total,
    totalPages: Math.ceil(total / limit),
    stats: votingStats,
  };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const politician = await getPolitician(slug);

  if (!politician) {
    return { title: "Politicien non trouvé" };
  }

  return {
    title: `Votes de ${politician.fullName}`,
    description: `Historique complet des votes parlementaires de ${politician.fullName} à l'Assemblée nationale.`,
  };
}

export default async function PoliticianVotesPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page || "1", 10));
  const limit = 20;

  const politician = await getPolitician(slug);

  if (!politician) {
    notFound();
  }

  const { votes, total, totalPages, stats } = await getVotes(politician.id, page, limit);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="text-sm text-muted-foreground mb-6">
        <Link href="/politiques" className="hover:text-foreground">
          Politiques
        </Link>
        <span className="mx-2">/</span>
        <Link href={`/politiques/${slug}`} className="hover:text-foreground">
          {politician.fullName}
        </Link>
        <span className="mx-2">/</span>
        <span>Votes</span>
      </nav>

      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link
          href={`/politiques/${slug}`}
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <PoliticianAvatar
          photoUrl={politician.photoUrl}
          firstName={politician.firstName}
          lastName={politician.lastName}
          size="md"
        />
        <div>
          <h1 className="text-2xl font-bold">Votes de {politician.fullName}</h1>
          <p className="text-muted-foreground">
            {total} votes enregistrés
          </p>
        </div>
      </div>

      {/* NON_VOTANT context note for president of chamber */}
      {(() => {
        const presidentMandate = politician.mandates.find(
          (m) => m.role && /^(Président|Vice-président) /.test(m.role)
        );
        if (presidentMandate && stats.nonVotant > 0) {
          const roleLabel = feminizeRole(presidentMandate.role!, politician.civility);
          return (
            <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-lg mb-8">
              <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <p className="text-sm text-blue-800 dark:text-blue-200">
                En tant que <strong>{roleLabel}</strong>, {politician.fullName} ne participe
                traditionnellement pas aux votes. Les votes &quot;Non-votant&quot;
                ({stats.nonVotant}) reflètent cette convention institutionnelle.
              </p>
            </div>
          );
        }
        return null;
      })()}

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Main content */}
        <div className="lg:col-span-2">
          {votes.length > 0 ? (
            <div className="space-y-3">
              {votes.map((vote) => (
                <Card key={vote.id} className="hover:shadow-sm transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <Link
                          href={`/votes/${vote.scrutin.id}`}
                          className="font-medium hover:underline line-clamp-2"
                        >
                          {vote.scrutin.title}
                        </Link>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span>{formatDate(vote.scrutin.votingDate)}</span>
                          <VotingResultBadge result={vote.scrutin.result} />
                          {vote.scrutin.sourceUrl && (
                            <a
                              href={vote.scrutin.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 hover:text-foreground"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      </div>
                      <VotePositionBadge position={vote.position} />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Aucun vote enregistré pour ce représentant
              </CardContent>
            </Card>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-8">
              {page > 1 && (
                <Link
                  href={`/politiques/${slug}/votes?page=${page - 1}`}
                  className="px-4 py-2 rounded-lg bg-muted hover:bg-muted/80"
                >
                  Précédent
                </Link>
              )}
              <span className="px-4 py-2 text-muted-foreground">
                Page {page} sur {totalPages}
              </span>
              {page < totalPages && (
                <Link
                  href={`/politiques/${slug}/votes?page=${page + 1}`}
                  className="px-4 py-2 rounded-lg bg-muted hover:bg-muted/80"
                >
                  Suivant
                </Link>
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div>
          <VoteStats stats={stats} />
        </div>
      </div>
    </div>
  );
}
