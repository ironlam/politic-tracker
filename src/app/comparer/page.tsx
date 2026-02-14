import { Metadata } from "next";
import { db } from "@/lib/db";
import {
  PoliticianSelector,
  PartySelector,
  CompareMode,
  ComparisonTable,
  VoteAgreement,
  PartyComparisonTable,
  SuggestedComparisons,
} from "@/components/compare";
import type { PartyComparisonData } from "@/components/compare/PartyComparisonTable";
import { MANDATE_TYPE_LABELS } from "@/config/labels";
import type { MandateType, AffairStatus, FactCheckRating } from "@/types";

export const metadata: Metadata = {
  title: "Comparer des politiques",
  description:
    "Comparez deux représentants politiques ou deux partis : mandats, votes, affaires judiciaires, patrimoine déclaré.",
};

interface PageProps {
  searchParams: Promise<{
    left?: string;
    right?: string;
    mode?: string;
  }>;
}

async function getPoliticianBySlug(slug: string) {
  const politician = await db.politician.findUnique({
    where: { slug },
    include: {
      currentParty: true,
      _count: {
        select: { factCheckMentions: true },
      },
      mandates: {
        orderBy: { startDate: "desc" },
      },
      affairs: {
        orderBy: { createdAt: "desc" },
      },
      declarations: {
        orderBy: { year: "desc" },
      },
      votes: {
        include: {
          scrutin: true,
        },
        orderBy: {
          scrutin: { votingDate: "desc" },
        },
        take: 500, // Limit for performance
      },
      factCheckMentions: {
        include: {
          factCheck: {
            select: {
              id: true,
              title: true,
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
    },
  });

  if (!politician) return null;

  // Calculate vote stats
  const voteStats = {
    total: politician.votes.length,
    pour: politician.votes.filter((v) => v.position === "POUR").length,
    contre: politician.votes.filter((v) => v.position === "CONTRE").length,
    abstention: politician.votes.filter((v) => v.position === "ABSTENTION").length,
    nonVotant: politician.votes.filter((v) => v.position === "NON_VOTANT").length,
    absent: politician.votes.filter((v) => v.position === "ABSENT").length,
  };

  return {
    ...politician,
    voteStats,
  };
}

async function getPoliticianPreview(slug: string) {
  const politician = await db.politician.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      fullName: true,
      photoUrl: true,
      currentParty: {
        select: { name: true, shortName: true, color: true },
      },
      mandates: {
        where: { isCurrent: true },
        take: 1,
        select: { type: true },
      },
    },
  });

  if (!politician) return null;

  return {
    ...politician,
    currentMandate: politician.mandates[0]
      ? MANDATE_TYPE_LABELS[politician.mandates[0].type as MandateType]
      : undefined,
  };
}

async function getPartyPreview(slugOrId: string) {
  const party = await db.party.findFirst({
    where: {
      OR: [{ slug: slugOrId }, { id: slugOrId }],
    },
    select: {
      id: true,
      slug: true,
      name: true,
      shortName: true,
      color: true,
      logoUrl: true,
      _count: {
        select: { politicians: true },
      },
    },
  });

  if (!party) return null;

  return {
    ...party,
    memberCount: party._count.politicians,
  };
}

async function getPartyComparisonData(slugOrId: string): Promise<PartyComparisonData | null> {
  const party = await db.party.findFirst({
    where: {
      OR: [{ slug: slugOrId }, { id: slugOrId }],
    },
    select: {
      id: true,
      slug: true,
      name: true,
      shortName: true,
      color: true,
      logoUrl: true,
      foundedDate: true,
      politicalPosition: true,
      ideology: true,
      _count: { select: { politicians: true } },
    },
  });

  if (!party) return null;

  // Current mandates by type
  const mandateCounts = await db.mandate.groupBy({
    by: ["type"],
    where: {
      isCurrent: true,
      politician: { currentPartyId: party.id },
    },
    _count: true,
  });

  // Affairs
  const affairs = await db.affair.findMany({
    where: { politician: { currentPartyId: party.id } },
    select: { id: true, status: true },
  });

  // Fact-check mentions
  const factCheckMentions = await db.factCheckMention.findMany({
    where: { politician: { currentPartyId: party.id } },
    include: {
      factCheck: { select: { verdictRating: true } },
    },
  });

  return {
    party: {
      ...party,
      memberCount: party._count.politicians,
    },
    mandateCounts: mandateCounts.map((m) => ({
      type: m.type as MandateType,
      count: m._count,
    })),
    affairs: affairs.map((a) => ({
      id: a.id,
      status: a.status as AffairStatus,
    })),
    factCheckMentions: factCheckMentions.map((m) => ({
      factCheck: {
        verdictRating: m.factCheck.verdictRating as FactCheckRating,
      },
    })),
  };
}

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

async function getPartyVoteComparison(leftPartyId: string, rightPartyId: string) {
  // Get majority position per scrutin for each party
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
      WHERE pol."currentPartyId" = ${leftPartyId}
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
      WHERE pol."currentPartyId" = ${rightPartyId}
        AND v.position IN ('POUR', 'CONTRE', 'ABSTENTION')
      GROUP BY v."scrutinId", s.title, s.slug, s."votingDate"
    `,
  ]);

  // Build map for right party
  const rightMap = new Map(rightRows.map((r) => [r.scrutinId, r]));

  // Find common scrutins and compare
  return leftRows
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
        leftPour: Number(l.pour),
        leftContre: Number(l.contre),
        leftAbstention: Number(l.abstention),
        rightPour: Number(r.pour),
        rightContre: Number(r.contre),
        rightAbstention: Number(r.abstention),
      };
    });
}

export default async function ComparerPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const leftSlug = params.left;
  const rightSlug = params.right;
  const isPartyMode = params.mode === "partis";

  if (isPartyMode) {
    // Party mode — load previews first, then full data if both selected
    const [leftPartyPreview, rightPartyPreview] = await Promise.all([
      leftSlug ? getPartyPreview(leftSlug) : null,
      rightSlug ? getPartyPreview(rightSlug) : null,
    ]);

    const bothPartiesSelected = leftPartyPreview && rightPartyPreview;

    // Load full comparison data only if both parties are selected
    const [leftPartyData, rightPartyData] = bothPartiesSelected
      ? await Promise.all([getPartyComparisonData(leftSlug!), getPartyComparisonData(rightSlug!)])
      : [null, null];

    // Load vote comparison only if both parties have data
    const voteComparison =
      leftPartyData && rightPartyData
        ? await getPartyVoteComparison(leftPartyData.party.id, rightPartyData.party.id)
        : [];

    return (
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Comparer</h1>
          <p className="text-muted-foreground">
            Comparez deux partis ou deux représentants politiques.
          </p>
          <div className="mt-4">
            <CompareMode />
          </div>
        </div>

        {/* Party Selectors */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div>
            <h2 className="text-sm font-medium mb-2 text-muted-foreground">Parti 1</h2>
            <PartySelector
              position="left"
              selectedParty={leftPartyPreview}
              otherPartyId={rightPartyPreview?.id}
            />
          </div>
          <div>
            <h2 className="text-sm font-medium mb-2 text-muted-foreground">Parti 2</h2>
            <PartySelector
              position="right"
              selectedParty={rightPartyPreview}
              otherPartyId={leftPartyPreview?.id}
            />
          </div>
        </div>

        {/* Sticky mobile bar — party mode */}
        {leftPartyPreview && rightPartyPreview && (
          <div className="md:hidden sticky top-16 z-30 -mx-4 px-4 py-2 mb-4 bg-background/80 backdrop-blur-md border-b">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="flex items-center gap-1.5 min-w-0">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: leftPartyPreview.color || "#888" }}
                />
                <span className="font-medium truncate">{leftPartyPreview.shortName}</span>
              </span>
              <span className="text-muted-foreground font-bold shrink-0">VS</span>
              <span className="flex items-center gap-1.5 min-w-0 justify-end">
                <span className="font-medium truncate">{rightPartyPreview.shortName}</span>
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: rightPartyPreview.color || "#888" }}
                />
              </span>
            </div>
          </div>
        )}

        {/* VS separator */}
        {(leftPartyPreview || rightPartyPreview) && (
          <div className="flex items-center justify-center mb-8">
            <div className="flex-1 h-px bg-border" />
            <span className="px-4 text-2xl font-bold text-muted-foreground">VS</span>
            <div className="flex-1 h-px bg-border" />
          </div>
        )}

        {/* Party comparison content */}
        {leftPartyData && rightPartyData ? (
          <PartyComparisonTable
            left={leftPartyData}
            right={rightPartyData}
            voteComparison={voteComparison}
          />
        ) : !leftPartyPreview && !rightPartyPreview ? (
          <SuggestedComparisons mode="partis" />
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-lg">Sélectionnez un deuxième parti pour lancer la comparaison</p>
          </div>
        )}
      </div>
    );
  }

  // Politician mode (default)
  const [leftPolitician, rightPolitician] = await Promise.all([
    leftSlug ? getPoliticianBySlug(leftSlug) : null,
    rightSlug ? getPoliticianBySlug(rightSlug) : null,
  ]);

  const [leftPreview, rightPreview] = await Promise.all([
    leftSlug ? getPoliticianPreview(leftSlug) : null,
    rightSlug ? getPoliticianPreview(rightSlug) : null,
  ]);

  const bothSelected = leftPolitician && rightPolitician;

  // Determine which sections have data (for hiding empty ones)
  const hasVotes =
    bothSelected && (leftPolitician.voteStats.total > 0 || rightPolitician.voteStats.total > 0);
  const hasFactChecks =
    bothSelected &&
    (leftPolitician._count.factCheckMentions > 0 || rightPolitician._count.factCheckMentions > 0);
  const hasAffairs =
    bothSelected && (leftPolitician.affairs.length > 0 || rightPolitician.affairs.length > 0);
  const hasDeclarations =
    bothSelected &&
    (leftPolitician.declarations.length > 0 || rightPolitician.declarations.length > 0);
  const hasCommonVotes =
    bothSelected &&
    hasVotes &&
    leftPolitician.votes.some((lv) =>
      rightPolitician.votes.some((rv) => rv.scrutinId === lv.scrutinId)
    );

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Comparer</h1>
        <p className="text-muted-foreground">
          Comparez deux partis ou deux représentants politiques.
        </p>
        <div className="mt-4">
          <CompareMode />
        </div>
      </div>

      {/* Selectors */}
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <div>
          <h2 className="text-sm font-medium mb-2 text-muted-foreground">Politique 1</h2>
          <PoliticianSelector
            position="left"
            selectedPolitician={
              leftPreview
                ? {
                    ...leftPreview,
                    currentMandate: leftPreview.currentMandate,
                  }
                : null
            }
            otherPoliticianId={rightPreview?.id}
          />
        </div>
        <div>
          <h2 className="text-sm font-medium mb-2 text-muted-foreground">Politique 2</h2>
          <PoliticianSelector
            position="right"
            selectedPolitician={
              rightPreview
                ? {
                    ...rightPreview,
                    currentMandate: rightPreview.currentMandate,
                  }
                : null
            }
            otherPoliticianId={leftPreview?.id}
          />
        </div>
      </div>

      {/* Sticky mobile bar — politician mode */}
      {leftPreview && rightPreview && (
        <div className="md:hidden sticky top-16 z-30 -mx-4 px-4 py-2 mb-4 bg-background/80 backdrop-blur-md border-b">
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="flex items-center gap-1.5 min-w-0">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: leftPreview.currentParty?.color || "#888" }}
              />
              <span className="font-medium truncate">{leftPreview.fullName}</span>
            </span>
            <span className="text-muted-foreground font-bold shrink-0">VS</span>
            <span className="flex items-center gap-1.5 min-w-0 justify-end">
              <span className="font-medium truncate">{rightPreview.fullName}</span>
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: rightPreview.currentParty?.color || "#888" }}
              />
            </span>
          </div>
        </div>
      )}

      {/* VS separator */}
      {(leftPreview || rightPreview) && (
        <div className="flex items-center justify-center mb-8">
          <div className="flex-1 h-px bg-border" />
          <span className="px-4 text-2xl font-bold text-muted-foreground">VS</span>
          <div className="flex-1 h-px bg-border" />
        </div>
      )}

      {/* Comparison content */}
      {bothSelected ? (
        <div className="space-y-8">
          <ComparisonTable
            left={leftPolitician}
            right={rightPolitician}
            hideVotes={!hasVotes}
            hideFactChecks={!hasFactChecks}
            hideAffairs={!hasAffairs}
            hideDeclarations={!hasDeclarations}
          />

          {hasCommonVotes && (
            <section>
              <h2 className="text-xl font-semibold mb-4">Concordance des votes</h2>
              <VoteAgreement
                leftVotes={leftPolitician.votes}
                rightVotes={rightPolitician.votes}
                leftName={leftPolitician.fullName}
                rightName={rightPolitician.fullName}
                leftSlug={leftPolitician.slug}
                rightSlug={rightPolitician.slug}
              />
            </section>
          )}
        </div>
      ) : !leftPreview && !rightPreview ? (
        <SuggestedComparisons mode="politiciens" />
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-lg">Sélectionnez un deuxième politique pour lancer la comparaison</p>
        </div>
      )}
    </div>
  );
}
