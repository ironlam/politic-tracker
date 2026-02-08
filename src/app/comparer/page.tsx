import { Metadata } from "next";
import { db } from "@/lib/db";
import { PoliticianSelector, ComparisonTable, VoteAgreement } from "@/components/compare";
import { MANDATE_TYPE_LABELS } from "@/config/labels";
import type { MandateType } from "@/types";

export const metadata: Metadata = {
  title: "Comparer des politiques",
  description:
    "Comparez deux représentants politiques français : mandats, votes, affaires judiciaires, patrimoine déclaré.",
};

interface PageProps {
  searchParams: Promise<{
    left?: string;
    right?: string;
  }>;
}

async function getPoliticianBySlug(slug: string) {
  const politician = await db.politician.findUnique({
    where: { slug },
    include: {
      currentParty: true,
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
        select: { shortName: true, color: true },
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

export default async function ComparerPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const leftSlug = params.left;
  const rightSlug = params.right;

  // Fetch full data if both are selected
  const [leftPolitician, rightPolitician] = await Promise.all([
    leftSlug ? getPoliticianBySlug(leftSlug) : null,
    rightSlug ? getPoliticianBySlug(rightSlug) : null,
  ]);

  // Fetch previews for selectors
  const [leftPreview, rightPreview] = await Promise.all([
    leftSlug ? getPoliticianPreview(leftSlug) : null,
    rightSlug ? getPoliticianPreview(rightSlug) : null,
  ]);

  const bothSelected = leftPolitician && rightPolitician;

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Comparer des politiques</h1>
        <p className="text-muted-foreground">
          Sélectionnez deux représentants pour comparer leurs mandats, votes, affaires et
          patrimoine.
        </p>
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
          <ComparisonTable left={leftPolitician} right={rightPolitician} />

          <section>
            <h2 className="text-xl font-semibold mb-4">Concordance des votes</h2>
            <VoteAgreement
              leftVotes={leftPolitician.votes}
              rightVotes={rightPolitician.votes}
              leftName={leftPolitician.fullName}
              rightName={rightPolitician.fullName}
            />
          </section>
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
