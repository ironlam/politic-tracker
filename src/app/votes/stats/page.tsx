import { Metadata } from "next";
import { db } from "@/lib/db";
import { Chamber } from "@/generated/prisma";
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import { CHAMBER_LABELS, CHAMBER_COLORS } from "@/config/labels";

export const metadata: Metadata = {
  title: "Statistiques des votes | Transparence Politique",
  description:
    "Analyse des votes parlementaires par parti : tendances, cohésion de groupe, scrutins les plus divisifs.",
};

interface PageProps {
  searchParams: Promise<{
    chamber?: string;
  }>;
}

interface PartyVoteStats {
  partyId: string;
  partyName: string;
  partyShortName: string;
  partyColor: string | null;
  totalVotes: number;
  pour: number;
  contre: number;
  abstention: number;
  nonVotant: number;
  absent: number;
  cohesionRate: number;
  participationRate: number;
}

async function getVoteStats(chamber?: Chamber) {
  const chamberFilter = chamber ? { chamber } : {};

  // Get party vote stats using raw query for performance
  const partyStats = await db.$queryRaw<
    {
      partyId: string;
      partyName: string;
      partyShortName: string;
      partyColor: string | null;
      position: string;
      count: bigint;
    }[]
  >`
    SELECT
      p.id as "partyId",
      p.name as "partyName",
      p."shortName" as "partyShortName",
      p.color as "partyColor",
      v.position,
      COUNT(v.id) as count
    FROM "Vote" v
    JOIN "Politician" pol ON v."politicianId" = pol.id
    JOIN "Party" p ON pol."currentPartyId" = p.id
    JOIN "Scrutin" s ON v."scrutinId" = s.id
    ${chamber ? db.$queryRaw`WHERE s.chamber = ${chamber}::"Chamber"` : db.$queryRaw``}
    GROUP BY p.id, p.name, p."shortName", p.color, v.position
    ORDER BY p."shortName", v.position
  `;

  // Aggregate party stats
  const partyMap = new Map<string, PartyVoteStats>();

  for (const row of partyStats) {
    if (!partyMap.has(row.partyId)) {
      partyMap.set(row.partyId, {
        partyId: row.partyId,
        partyName: row.partyName,
        partyShortName: row.partyShortName,
        partyColor: row.partyColor,
        totalVotes: 0,
        pour: 0,
        contre: 0,
        abstention: 0,
        nonVotant: 0,
        absent: 0,
        cohesionRate: 0,
        participationRate: 0,
      });
    }

    const stats = partyMap.get(row.partyId)!;
    const count = Number(row.count);
    stats.totalVotes += count;

    switch (row.position) {
      case "POUR":
        stats.pour = count;
        break;
      case "CONTRE":
        stats.contre = count;
        break;
      case "ABSTENTION":
        stats.abstention = count;
        break;
      case "NON_VOTANT":
        stats.nonVotant = count;
        break;
      case "ABSENT":
        stats.absent = count;
        break;
    }
  }

  // Calculate rates (non-votants excluded from participation denominator)
  for (const stats of partyMap.values()) {
    const participating = stats.pour + stats.contre + stats.abstention;
    const countedForParticipation = stats.totalVotes - stats.nonVotant;
    stats.participationRate =
      countedForParticipation > 0 ? Math.round((participating / countedForParticipation) * 100) : 0;

    const maxPosition = Math.max(stats.pour, stats.contre, stats.abstention);
    stats.cohesionRate = participating > 0 ? Math.round((maxPosition / participating) * 100) : 0;
  }

  const parties = Array.from(partyMap.values())
    .filter((p) => p.totalVotes >= 1000)
    .sort((a, b) => b.totalVotes - a.totalVotes);

  // Get divisive scrutins
  const divisiveScrutins = await db.$queryRaw<
    {
      id: string;
      slug: string | null;
      title: string;
      votingDate: Date;
      chamber: Chamber;
      votesFor: number;
      votesAgainst: number;
      votesAbstain: number;
    }[]
  >`
    SELECT
      s.id,
      s.slug,
      s.title,
      s."votingDate",
      s.chamber,
      s."votesFor",
      s."votesAgainst",
      s."votesAbstain"
    FROM "Scrutin" s
    WHERE s."votesFor" > 10 AND s."votesAgainst" > 10
    ${chamber ? db.$queryRaw`AND s.chamber = ${chamber}::"Chamber"` : db.$queryRaw``}
    ORDER BY
      ABS(s."votesFor" - s."votesAgainst")::float / NULLIF(s."votesFor" + s."votesAgainst", 0) ASC,
      s."votingDate" DESC
    LIMIT 15
  `;

  // Get global stats
  const globalStats = await db.scrutin.aggregate({
    where: chamberFilter,
    _count: true,
    _sum: {
      votesFor: true,
      votesAgainst: true,
      votesAbstain: true,
    },
  });

  return {
    parties,
    divisiveScrutins: divisiveScrutins.map((s) => ({
      ...s,
      divisionScore: Math.round(
        100 - (Math.abs(s.votesFor - s.votesAgainst) / (s.votesFor + s.votesAgainst)) * 100
      ),
    })),
    global: {
      totalScrutins: globalStats._count,
      totalVotesFor: globalStats._sum.votesFor || 0,
      totalVotesAgainst: globalStats._sum.votesAgainst || 0,
      totalVotesAbstain: globalStats._sum.votesAbstain || 0,
    },
  };
}

function VoteBar({ pour, contre, abstention, absent }: PartyVoteStats) {
  const total = pour + contre + abstention + absent;
  if (total === 0) return null;

  const pourcent = (v: number) => ((v / total) * 100).toFixed(1);

  return (
    <div className="flex h-4 w-full overflow-hidden rounded-full bg-gray-200">
      <div
        className="bg-green-500 transition-all"
        style={{ width: `${pourcent(pour)}%` }}
        title={`Pour: ${pour.toLocaleString("fr-FR")} (${pourcent(pour)}%)`}
      />
      <div
        className="bg-red-500 transition-all"
        style={{ width: `${pourcent(contre)}%` }}
        title={`Contre: ${contre.toLocaleString("fr-FR")} (${pourcent(contre)}%)`}
      />
      <div
        className="bg-yellow-500 transition-all"
        style={{ width: `${pourcent(abstention)}%` }}
        title={`Abstention: ${abstention.toLocaleString("fr-FR")} (${pourcent(abstention)}%)`}
      />
      <div
        className="bg-gray-400 transition-all"
        style={{ width: `${pourcent(absent)}%` }}
        title={`Absent: ${absent.toLocaleString("fr-FR")} (${pourcent(absent)}%)`}
      />
    </div>
  );
}

function CohesionBadge({ rate }: { rate: number }) {
  let color = "bg-red-100 text-red-800";
  if (rate >= 90) color = "bg-green-100 text-green-800";
  else if (rate >= 75) color = "bg-yellow-100 text-yellow-800";
  else if (rate >= 60) color = "bg-orange-100 text-orange-800";

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${color}`}>
      {rate}%
    </span>
  );
}

export default async function VoteStatsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const chamber = params.chamber as Chamber | undefined;

  const { parties, divisiveScrutins, global } = await getVoteStats(chamber);

  const totalVotes = global.totalVotesFor + global.totalVotesAgainst + global.totalVotesAbstain;

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
          <Link href="/votes" className="hover:underline">
            Votes
          </Link>
          <span>/</span>
          <span>Statistiques</span>
        </div>
        <h1 className="text-3xl font-bold mb-2">Statistiques des votes</h1>
        <p className="text-muted-foreground">
          Analyse des tendances de vote par parti politique au Parlement français.
        </p>
      </div>

      {/* Chamber filter */}
      <div className="flex gap-2 mb-8">
        <Link
          href="/votes/stats"
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            !chamber ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"
          }`}
        >
          Tous
        </Link>
        <Link
          href="/votes/stats?chamber=AN"
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            chamber === "AN" ? "bg-blue-600 text-white" : "bg-muted hover:bg-muted/80"
          }`}
        >
          Assemblée nationale
        </Link>
        <Link
          href="/votes/stats?chamber=SENAT"
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            chamber === "SENAT" ? "bg-rose-600 text-white" : "bg-muted hover:bg-muted/80"
          }`}
        >
          Sénat
        </Link>
      </div>

      {/* Global stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-muted rounded-lg p-4 text-center">
          <p className="text-3xl font-bold">{global.totalScrutins.toLocaleString("fr-FR")}</p>
          <p className="text-sm text-muted-foreground">Scrutins</p>
        </div>
        <div className="bg-green-50 rounded-lg p-4 text-center">
          <p className="text-3xl font-bold text-green-600">
            {global.totalVotesFor.toLocaleString("fr-FR")}
          </p>
          <p className="text-sm text-muted-foreground">Votes Pour</p>
        </div>
        <div className="bg-red-50 rounded-lg p-4 text-center">
          <p className="text-3xl font-bold text-red-600">
            {global.totalVotesAgainst.toLocaleString("fr-FR")}
          </p>
          <p className="text-sm text-muted-foreground">Votes Contre</p>
        </div>
        <div className="bg-yellow-50 rounded-lg p-4 text-center">
          <p className="text-3xl font-bold text-yellow-600">
            {global.totalVotesAbstain.toLocaleString("fr-FR")}
          </p>
          <p className="text-sm text-muted-foreground">Abstentions</p>
        </div>
      </div>

      {/* Party stats */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-4">Votes par parti</h2>
        <div className="bg-card rounded-lg border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-medium">Parti</th>
                  <th className="text-left p-3 font-medium hidden md:table-cell">Répartition</th>
                  <th className="text-right p-3 font-medium">Votes</th>
                  <th className="text-right p-3 font-medium">Cohésion</th>
                  <th className="text-right p-3 font-medium hidden sm:table-cell">Participation</th>
                </tr>
              </thead>
              <tbody>
                {parties.map((party) => (
                  <tr key={party.partyId} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        {party.partyColor && (
                          <span
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: party.partyColor }}
                          />
                        )}
                        <span className="font-medium">{party.partyShortName}</span>
                      </div>
                    </td>
                    <td className="p-3 hidden md:table-cell min-w-[200px]">
                      <VoteBar {...party} />
                    </td>
                    <td className="p-3 text-right tabular-nums">
                      {party.totalVotes.toLocaleString("fr-FR")}
                    </td>
                    <td className="p-3 text-right">
                      <CohesionBadge rate={party.cohesionRate} />
                    </td>
                    <td className="p-3 text-right tabular-nums hidden sm:table-cell">
                      {party.participationRate}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 mt-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-green-500" /> Pour
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-red-500" /> Contre
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-yellow-500" /> Abstention
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-gray-400" /> Absent
          </span>
        </div>
      </section>

      {/* Cohesion explanation */}
      <section className="mb-12 bg-muted/50 rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-2">Qu&apos;est-ce que la cohésion de groupe ?</h2>
        <p className="text-muted-foreground text-sm">
          La cohésion mesure à quel point les membres d&apos;un parti votent de la même manière.
          Un taux de 100% signifie que tous les membres présents votent identiquement.
          Un taux plus faible indique des divisions internes sur certains sujets.
        </p>
      </section>

      {/* Divisive scrutins */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Scrutins les plus serrés</h2>
        <p className="text-muted-foreground text-sm mb-4">
          Les votes où l&apos;écart entre Pour et Contre était le plus faible.
        </p>
        <div className="space-y-2">
          {divisiveScrutins.map((s) => (
            <Link
              key={s.id}
              href={`/votes/${s.slug || s.id}`}
              className="block bg-card rounded-lg border p-4 hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full border ${CHAMBER_COLORS[s.chamber]}`}
                    >
                      {CHAMBER_LABELS[s.chamber]}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(new Date(s.votingDate))}
                    </span>
                  </div>
                  <p className="font-medium line-clamp-1">{s.title}</p>
                </div>
                <div className="flex items-center gap-4 flex-shrink-0">
                  <div className="text-right">
                    <span className="text-green-600 font-medium">{s.votesFor}</span>
                    <span className="text-muted-foreground mx-1">-</span>
                    <span className="text-red-600 font-medium">{s.votesAgainst}</span>
                  </div>
                  <div className="bg-orange-100 text-orange-800 text-xs font-medium px-2 py-1 rounded">
                    {s.divisionScore}% divisif
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
