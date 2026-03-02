import { notFound } from "next/navigation";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { CompareCategoryPicker } from "@/components/compare/CompareCategoryPicker";
import { CompareSelector } from "@/components/compare/CompareSelector";
import { CompareHeader } from "@/components/compare/CompareHeader";
import { SuggestedComparisons } from "@/components/compare/SuggestedComparisons";
import { DeputesComparison } from "@/components/compare/categories/DeputesComparison";
import { SenateursComparison } from "@/components/compare/categories/SenateursComparison";
import { PartisComparison } from "@/components/compare/categories/PartisComparison";
import { GroupesComparison } from "@/components/compare/categories/GroupesComparison";
import { MinistresComparison } from "@/components/compare/categories/MinistresComparison";
import { COMPARE_CATEGORIES, COMPARE_CATEGORY_LABELS } from "@/types/compare";
import type { CompareCategory } from "@/types/compare";
import {
  getPreview,
  loadComparisonData,
  type PoliticianComparisonData,
  type MinistreComparisonData,
  type PartyComparisonData,
  type GroupComparisonData,
  type PartyVoteComparisonRow,
} from "@/lib/data/compare";

export const revalidate = 300;

interface PageProps {
  searchParams: Promise<{
    cat?: string;
    a?: string;
    b?: string;
  }>;
}

function parseCategory(raw?: string): CompareCategory {
  if (raw && (COMPARE_CATEGORIES as readonly string[]).includes(raw)) {
    return raw as CompareCategory;
  }
  return "deputes";
}

export async function generateMetadata({ searchParams }: PageProps) {
  const params = await searchParams;
  const cat = parseCategory(params.cat);
  const label = COMPARE_CATEGORY_LABELS[cat];

  return {
    title: `Comparer des ${label.toLowerCase()}`,
    description: `Comparez deux ${label.toLowerCase()} : votes, mandats, affaires judiciaires, fact-checks.`,
  };
}

export default async function ComparerPage({ searchParams }: PageProps) {
  if (!(await isFeatureEnabled("COMPARISON_TOOL"))) notFound();

  const params = await searchParams;
  const cat = parseCategory(params.cat);
  const slugA = params.a;
  const slugB = params.b;

  // Load previews for selectors (lightweight)
  const [previewA, previewB] = await Promise.all([
    slugA ? getPreview(cat, slugA) : null,
    slugB ? getPreview(cat, slugB) : null,
  ]);

  // Load full comparison data only when both selected
  const comparison =
    previewA && previewB && slugA && slugB ? await loadComparisonData(cat, slugA, slugB) : null;

  const selectorLabel = cat === "partis" ? "Parti" : cat === "groupes" ? "Groupe" : "Politique";

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-display font-extrabold tracking-tight mb-1">Comparer</h1>
        <p className="text-sm text-muted-foreground">
          Comparez des représentants, partis ou groupes parlementaires.
        </p>
        <div className="mt-4">
          <CompareCategoryPicker />
        </div>
      </div>

      {/* Selectors */}
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <div>
          <h2 className="text-sm font-medium mb-2 text-muted-foreground">{selectorLabel} 1</h2>
          <CompareSelector category={cat} side="a" preview={previewA} />
        </div>
        <div>
          <h2 className="text-sm font-medium mb-2 text-muted-foreground">{selectorLabel} 2</h2>
          <CompareSelector category={cat} side="b" preview={previewB} />
        </div>
      </div>

      {/* VS separator + sticky mobile bar */}
      <CompareHeader left={previewA} right={previewB} />

      {/* Comparison content */}
      {comparison ? (
        <ComparisonContent category={cat} data={comparison} />
      ) : !previewA && !previewB ? (
        <SuggestedComparisons mode="politiciens" key={cat} />
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-lg">
            Sélectionnez un deuxième {selectorLabel.toLowerCase()} pour lancer la comparaison
          </p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dispatch comparison rendering to the right category component
// ---------------------------------------------------------------------------

type ComparisonData =
  | {
      left: PoliticianComparisonData;
      right: PoliticianComparisonData;
    }
  | {
      left: MinistreComparisonData;
      right: MinistreComparisonData;
    }
  | {
      left: PartyComparisonData;
      right: PartyComparisonData;
      voteComparison: PartyVoteComparisonRow[];
    }
  | {
      left: GroupComparisonData;
      right: GroupComparisonData;
    };

function ComparisonContent({
  category,
  data,
}: {
  category: CompareCategory;
  data: ComparisonData;
}) {
  switch (category) {
    case "deputes": {
      const d = data as { left: PoliticianComparisonData; right: PoliticianComparisonData };
      return <DeputesComparison left={d.left} right={d.right} />;
    }
    case "senateurs": {
      const d = data as { left: PoliticianComparisonData; right: PoliticianComparisonData };
      return <SenateursComparison left={d.left} right={d.right} />;
    }
    case "partis": {
      const d = data as {
        left: PartyComparisonData;
        right: PartyComparisonData;
        voteComparison: PartyVoteComparisonRow[];
      };
      return <PartisComparison left={d.left} right={d.right} voteComparison={d.voteComparison} />;
    }
    case "groupes": {
      const d = data as { left: GroupComparisonData; right: GroupComparisonData };
      return <GroupesComparison left={d.left} right={d.right} />;
    }
    case "ministres": {
      const d = data as { left: MinistreComparisonData; right: MinistreComparisonData };
      return <MinistresComparison left={d.left} right={d.right} />;
    }
  }
}
