import { Metadata } from "next";
import { db } from "@/lib/db";
import {
  PoliticianSelector,
  PartySelector,
  CompareMode,
  ComparisonTable,
  VoteAgreement,
} from "@/components/compare";
import { MANDATE_TYPE_LABELS } from "@/config/labels";
import type { MandateType } from "@/types";

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

export default async function ComparerPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const leftSlug = params.left;
  const rightSlug = params.right;
  const isPartyMode = params.mode === "partis";

  if (isPartyMode) {
    // Party mode
    const [leftParty, rightParty] = await Promise.all([
      leftSlug ? getPartyPreview(leftSlug) : null,
      rightSlug ? getPartyPreview(rightSlug) : null,
    ]);

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
              selectedParty={leftParty}
              otherPartyId={rightParty?.id}
            />
          </div>
          <div>
            <h2 className="text-sm font-medium mb-2 text-muted-foreground">Parti 2</h2>
            <PartySelector
              position="right"
              selectedParty={rightParty}
              otherPartyId={leftParty?.id}
            />
          </div>
        </div>

        {/* VS separator */}
        {(leftParty || rightParty) && (
          <div className="flex items-center justify-center mb-8">
            <div className="flex-1 h-px bg-border" />
            <span className="px-4 text-2xl font-bold text-muted-foreground">VS</span>
            <div className="flex-1 h-px bg-border" />
          </div>
        )}

        {/* Party comparison content */}
        {leftParty && rightParty ? (
          <div className="text-center py-12 border-2 border-dashed rounded-lg">
            <div className="text-4xl mb-4">🏗</div>
            <h2 className="text-xl font-semibold mb-2">Comparaison par parti</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              La comparaison détaillée entre partis (concordance de votes, scrutins divisifs,
              répartition des affaires) arrive bientôt.
            </p>
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-lg">
              {!leftParty && !rightParty
                ? "Sélectionnez deux partis pour les comparer"
                : "Sélectionnez un deuxième parti pour lancer la comparaison"}
            </p>
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
              />
            </section>
          )}
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-lg">
            {!leftPreview && !rightPreview
              ? "Sélectionnez deux politiques pour les comparer"
              : "Sélectionnez un deuxième politique pour lancer la comparaison"}
          </p>
        </div>
      )}
    </div>
  );
}
