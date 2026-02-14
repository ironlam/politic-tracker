import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { VOTE_POSITION_LABELS, VOTE_POSITION_DOT_COLORS } from "@/config/labels";
import { VoteComparisonFilters } from "@/components/compare/VoteComparisonFilters";
import type { VotePosition } from "@/types";

export const metadata: Metadata = {
  title: "Concordance des votes",
  description: "Détail de la concordance des votes entre deux politiques ou deux partis.",
};

interface PageProps {
  searchParams: Promise<{
    left?: string;
    right?: string;
    mode?: string;
    page?: string;
    search?: string;
    filter?: string;
  }>;
}

// ============================================
// Politician vote comparison
// ============================================

type AgreementType = "agree" | "disagree" | "partial";

interface ComparedVote {
  scrutinId: string;
  title: string;
  slug: string | null;
  votingDate: Date;
  leftPosition: VotePosition;
  rightPosition: VotePosition;
  agreement: AgreementType;
}

function getAgreement(left: VotePosition, right: VotePosition): AgreementType {
  if (left === right) return "agree";
  if (left === "ABSENT" || right === "ABSENT") return "partial";
  if (left === "NON_VOTANT" || right === "NON_VOTANT") return "partial";
  if (left === "ABSTENTION" || right === "ABSTENTION") return "partial";
  return "disagree";
}

async function getPoliticianVoteComparison(leftSlug: string, rightSlug: string) {
  const [leftPol, rightPol] = await Promise.all([
    db.politician.findUnique({
      where: { slug: leftSlug },
      select: {
        id: true,
        slug: true,
        fullName: true,
        votes: {
          include: { scrutin: true },
          orderBy: { scrutin: { votingDate: "desc" } },
        },
      },
    }),
    db.politician.findUnique({
      where: { slug: rightSlug },
      select: {
        id: true,
        slug: true,
        fullName: true,
        votes: {
          include: { scrutin: true },
          orderBy: { scrutin: { votingDate: "desc" } },
        },
      },
    }),
  ]);

  if (!leftPol || !rightPol) return null;

  const leftVoteMap = new Map(leftPol.votes.map((v) => [v.scrutinId, v]));
  const rightVoteMap = new Map(rightPol.votes.map((v) => [v.scrutinId, v]));

  const commonScrutinIds = [...leftVoteMap.keys()].filter((id) => rightVoteMap.has(id));

  const comparedVotes: ComparedVote[] = commonScrutinIds.map((scrutinId) => {
    const leftVote = leftVoteMap.get(scrutinId)!;
    const rightVote = rightVoteMap.get(scrutinId)!;
    return {
      scrutinId,
      title: leftVote.scrutin.title,
      slug: leftVote.scrutin.slug,
      votingDate: leftVote.scrutin.votingDate,
      leftPosition: leftVote.position as VotePosition,
      rightPosition: rightVote.position as VotePosition,
      agreement: getAgreement(
        leftVote.position as VotePosition,
        rightVote.position as VotePosition
      ),
    };
  });

  comparedVotes.sort((a, b) => new Date(b.votingDate).getTime() - new Date(a.votingDate).getTime());

  return {
    leftName: leftPol.fullName,
    rightName: rightPol.fullName,
    votes: comparedVotes,
  };
}

// ============================================
// Party vote comparison
// ============================================

interface PartyMajorityVoteRow {
  scrutinId: string;
  title: string;
  slug: string | null;
  votingDate: Date;
  majorityPosition: string;
  pour: bigint;
  contre: bigint;
  abstention: bigint;
}

interface PartyComparedVote {
  scrutinId: string;
  title: string;
  slug: string | null;
  votingDate: Date;
  leftPosition: string;
  rightPosition: string;
  agreement: AgreementType;
}

function getPartyAgreement(leftPosition: string, rightPosition: string): AgreementType {
  if (leftPosition === rightPosition) return "agree";
  if (
    (leftPosition === "POUR" && rightPosition === "CONTRE") ||
    (leftPosition === "CONTRE" && rightPosition === "POUR")
  ) {
    return "disagree";
  }
  return "partial";
}

async function getPartyVoteComparisonData(leftSlug: string, rightSlug: string) {
  const [leftParty, rightParty] = await Promise.all([
    db.party.findFirst({
      where: { OR: [{ slug: leftSlug }, { id: leftSlug }] },
      select: { id: true, name: true, shortName: true },
    }),
    db.party.findFirst({
      where: { OR: [{ slug: rightSlug }, { id: rightSlug }] },
      select: { id: true, name: true, shortName: true },
    }),
  ]);

  if (!leftParty || !rightParty) return null;

  const [leftRows, rightRows] = await Promise.all([
    db.$queryRaw<PartyMajorityVoteRow[]>`
      SELECT
        v."scrutinId" as "scrutinId",
        s.title,
        s.slug,
        s."votingDate" as "votingDate",
        SUM(CASE WHEN v.position = 'POUR' THEN 1 ELSE 0 END)::bigint as "pour",
        SUM(CASE WHEN v.position = 'CONTRE' THEN 1 ELSE 0 END)::bigint as "contre",
        SUM(CASE WHEN v.position = 'ABSTENTION' THEN 1 ELSE 0 END)::bigint as "abstention",
        CASE
          WHEN SUM(CASE WHEN v.position = 'POUR' THEN 1 ELSE 0 END) >= SUM(CASE WHEN v.position = 'CONTRE' THEN 1 ELSE 0 END)
           AND SUM(CASE WHEN v.position = 'POUR' THEN 1 ELSE 0 END) >= SUM(CASE WHEN v.position = 'ABSTENTION' THEN 1 ELSE 0 END)
          THEN 'POUR'
          WHEN SUM(CASE WHEN v.position = 'CONTRE' THEN 1 ELSE 0 END) >= SUM(CASE WHEN v.position = 'ABSTENTION' THEN 1 ELSE 0 END)
          THEN 'CONTRE'
          ELSE 'ABSTENTION'
        END as "majorityPosition"
      FROM "Vote" v
      JOIN "Politician" pol ON v."politicianId" = pol.id
      JOIN "Scrutin" s ON v."scrutinId" = s.id
      WHERE pol."currentPartyId" = ${leftParty.id}
        AND v.position IN ('POUR', 'CONTRE', 'ABSTENTION')
      GROUP BY v."scrutinId", s.title, s.slug, s."votingDate"
    `,
    db.$queryRaw<PartyMajorityVoteRow[]>`
      SELECT
        v."scrutinId" as "scrutinId",
        s.title,
        s.slug,
        s."votingDate" as "votingDate",
        SUM(CASE WHEN v.position = 'POUR' THEN 1 ELSE 0 END)::bigint as "pour",
        SUM(CASE WHEN v.position = 'CONTRE' THEN 1 ELSE 0 END)::bigint as "contre",
        SUM(CASE WHEN v.position = 'ABSTENTION' THEN 1 ELSE 0 END)::bigint as "abstention",
        CASE
          WHEN SUM(CASE WHEN v.position = 'POUR' THEN 1 ELSE 0 END) >= SUM(CASE WHEN v.position = 'CONTRE' THEN 1 ELSE 0 END)
           AND SUM(CASE WHEN v.position = 'POUR' THEN 1 ELSE 0 END) >= SUM(CASE WHEN v.position = 'ABSTENTION' THEN 1 ELSE 0 END)
          THEN 'POUR'
          WHEN SUM(CASE WHEN v.position = 'CONTRE' THEN 1 ELSE 0 END) >= SUM(CASE WHEN v.position = 'ABSTENTION' THEN 1 ELSE 0 END)
          THEN 'CONTRE'
          ELSE 'ABSTENTION'
        END as "majorityPosition"
      FROM "Vote" v
      JOIN "Politician" pol ON v."politicianId" = pol.id
      JOIN "Scrutin" s ON v."scrutinId" = s.id
      WHERE pol."currentPartyId" = ${rightParty.id}
        AND v.position IN ('POUR', 'CONTRE', 'ABSTENTION')
      GROUP BY v."scrutinId", s.title, s.slug, s."votingDate"
    `,
  ]);

  const rightMap = new Map(rightRows.map((r) => [r.scrutinId, r]));

  const votes: PartyComparedVote[] = leftRows
    .filter((l) => rightMap.has(l.scrutinId))
    .map((l) => {
      const r = rightMap.get(l.scrutinId)!;
      return {
        scrutinId: l.scrutinId,
        title: l.title,
        slug: l.slug,
        votingDate: l.votingDate,
        leftPosition: l.majorityPosition,
        rightPosition: r.majorityPosition,
        agreement: getPartyAgreement(l.majorityPosition, r.majorityPosition),
      };
    });

  votes.sort((a, b) => new Date(b.votingDate).getTime() - new Date(a.votingDate).getTime());

  return {
    leftName: leftParty.shortName,
    rightName: rightParty.shortName,
    votes,
  };
}

// ============================================
// Page component
// ============================================

const PAGE_SIZE = 20;

export default async function VotesComparisonPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { left, right, mode, search, filter } = params;
  const page = Math.max(1, parseInt(params.page || "1", 10));

  if (!left || !right) {
    notFound();
  }

  const isPartyMode = mode === "partis";

  // Fetch all compared votes
  const data = isPartyMode
    ? await getPartyVoteComparisonData(left, right)
    : await getPoliticianVoteComparison(left, right);

  if (!data) {
    notFound();
  }

  const { leftName, rightName, votes: allVotes } = data;

  // Apply filters
  let filteredVotes = allVotes;

  if (search) {
    const searchLower = search.toLowerCase();
    filteredVotes = filteredVotes.filter((v) => v.title.toLowerCase().includes(searchLower));
  }

  if (filter && filter !== "all") {
    filteredVotes = filteredVotes.filter((v) => v.agreement === filter);
  }

  // Stats on full (unfiltered) dataset
  const stats = {
    total: allVotes.length,
    agree: allVotes.filter((v) => v.agreement === "agree").length,
    disagree: allVotes.filter((v) => v.agreement === "disagree").length,
    partial: allVotes.filter((v) => v.agreement === "partial").length,
  };
  const agreementRate = stats.total > 0 ? Math.round((stats.agree / stats.total) * 100) : 0;

  // Paginate
  const totalFiltered = filteredVotes.length;
  const totalPages = Math.ceil(totalFiltered / PAGE_SIZE);
  const paginatedVotes = filteredVotes.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Build URL helper
  const buildUrl = (newParams: Record<string, string | undefined>) => {
    const current = new URLSearchParams();
    current.set("left", left);
    current.set("right", right);
    if (mode) current.set("mode", mode);
    if (search) current.set("search", search);
    if (filter && filter !== "all") current.set("filter", filter);

    for (const [key, value] of Object.entries(newParams)) {
      if (value) {
        current.set(key, value);
      } else {
        current.delete(key);
      }
    }

    if (Object.keys(newParams).some((k) => k !== "page")) {
      current.delete("page");
    }

    return `/comparer/votes?${current.toString()}`;
  };

  // Back link
  const backParams = new URLSearchParams();
  backParams.set("left", left);
  backParams.set("right", right);
  if (mode) backParams.set("mode", mode);
  const backUrl = `/comparer?${backParams.toString()}`;

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Back link */}
      <Link
        href={backUrl}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Retour à la comparaison
      </Link>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Concordance des votes</h1>
        <p className="text-lg text-muted-foreground">
          {leftName} vs {rightName}
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-muted rounded-lg p-4 text-center">
          <p className="text-2xl font-bold">{stats.total}</p>
          <p className="text-sm text-muted-foreground">
            {isPartyMode ? "Scrutins comparés" : "Votes en commun"}
          </p>
        </div>
        <div className="bg-green-500/10 dark:bg-green-500/20 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.agree}</p>
          <p className="text-sm text-muted-foreground">D&apos;accord</p>
        </div>
        <div className="bg-red-500/10 dark:bg-red-500/20 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.disagree}</p>
          <p className="text-sm text-muted-foreground">En désaccord</p>
        </div>
        <div className="bg-yellow-500/10 dark:bg-yellow-500/20 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{stats.partial}</p>
          <p className="text-sm text-muted-foreground">Partiellement</p>
        </div>
      </div>

      {/* Agreement bar */}
      {stats.total > 0 && (
        <div className="bg-muted rounded-lg p-4 mb-6">
          <div className="flex justify-between mb-2 text-sm">
            <span>Taux de concordance</span>
            <span className="font-bold">{agreementRate}%</span>
          </div>
          <div className="h-4 rounded-full overflow-hidden bg-gray-200 flex">
            <div
              className="bg-green-500 transition-all"
              style={{ width: `${(stats.agree / stats.total) * 100}%` }}
              title={`D'accord: ${stats.agree}`}
            />
            <div
              className="bg-yellow-500 transition-all"
              style={{ width: `${(stats.partial / stats.total) * 100}%` }}
              title={`Partiellement: ${stats.partial}`}
            />
            <div
              className="bg-red-500 transition-all"
              style={{ width: `${(stats.disagree / stats.total) * 100}%` }}
              title={`En désaccord: ${stats.disagree}`}
            />
          </div>
          <div className="flex justify-between mt-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-green-500" /> D&apos;accord
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-yellow-500" /> Partiellement
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-red-500" /> Désaccord
            </span>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="mb-6">
        <VoteComparisonFilters />
      </div>

      {/* Filtered count */}
      {(search || (filter && filter !== "all")) && (
        <p className="text-sm text-muted-foreground mb-4">
          {totalFiltered} résultat{totalFiltered !== 1 ? "s" : ""}
          {search && <> pour &quot;{search}&quot;</>}
          {filter && filter !== "all" && (
            <>
              {" "}
              — filtre :{" "}
              {filter === "agree"
                ? "d'accord"
                : filter === "disagree"
                  ? "désaccord"
                  : "partiellement"}
            </>
          )}
        </p>
      )}

      {/* Vote list */}
      {paginatedVotes.length > 0 ? (
        <div className="space-y-2">
          {paginatedVotes.map((cv) => (
            <div
              key={cv.scrutinId}
              className={`p-3 rounded-lg border ${
                cv.agreement === "agree"
                  ? "bg-green-500/10 border-green-500/30 dark:bg-green-500/10 dark:border-green-500/20"
                  : cv.agreement === "disagree"
                    ? "bg-red-500/10 border-red-500/30 dark:bg-red-500/10 dark:border-red-500/20"
                    : "bg-yellow-500/10 border-yellow-500/30 dark:bg-yellow-500/10 dark:border-yellow-500/20"
              }`}
            >
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/votes/${cv.slug || cv.scrutinId}`}
                    className="font-medium text-sm hover:underline line-clamp-2"
                  >
                    {cv.title}
                  </Link>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDate(new Date(cv.votingDate))}
                  </p>
                </div>
                <div className="flex gap-4 flex-shrink-0">
                  <div className="text-center">
                    <p className="text-xs font-medium text-muted-foreground mb-0.5 md:hidden">
                      {leftName.split(" ").pop()}
                    </p>
                    <span
                      className={`inline-block w-3 h-3 rounded-full ${VOTE_POSITION_DOT_COLORS[cv.leftPosition as VotePosition] || "bg-gray-400"}`}
                    />
                    <p className="text-xs mt-1">
                      {VOTE_POSITION_LABELS[cv.leftPosition as VotePosition] || cv.leftPosition}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-medium text-muted-foreground mb-0.5 md:hidden">
                      {rightName.split(" ").pop()}
                    </p>
                    <span
                      className={`inline-block w-3 h-3 rounded-full ${VOTE_POSITION_DOT_COLORS[cv.rightPosition as VotePosition] || "bg-gray-400"}`}
                    />
                    <p className="text-xs mt-1">
                      {VOTE_POSITION_LABELS[cv.rightPosition as VotePosition] || cv.rightPosition}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          <p>Aucun vote trouvé</p>
          {(search || (filter && filter !== "all")) && (
            <Link
              href={buildUrl({ search: undefined, filter: undefined })}
              className="text-primary hover:underline mt-2 inline-block"
            >
              Effacer les filtres
            </Link>
          )}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-8">
          {page > 1 && (
            <Link
              href={buildUrl({ page: String(page - 1) })}
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
              href={buildUrl({ page: String(page + 1) })}
              className="px-4 py-2 rounded-lg bg-muted hover:bg-muted/80"
            >
              Suivant
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
