import { Metadata } from "next";
import Link from "next/link";
import { getDepartmentPartyData } from "@/lib/data/municipales";
import { PartyMap, PARTY_COLORS, getPartyColor } from "@/components/elections/municipales/PartyMap";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Carte des forces politiques — Municipales 2026 | Poligraph",
  description:
    "Cartographie des forces politiques par département pour les élections municipales 2026. Découvrez quel parti domine dans chaque département.",
};

export default async function CartePage() {
  const departmentData = await getDepartmentPartyData();

  // Compute national stats
  const totalDepartments = departmentData.length;

  // Find most dominant party nationally (most departments where it's dominant)
  const partyDominanceCount = new Map<string, number>();
  for (const dept of departmentData) {
    if (dept.dominantParty) {
      partyDominanceCount.set(
        dept.dominantParty,
        (partyDominanceCount.get(dept.dominantParty) ?? 0) + 1
      );
    }
  }
  let nationalDominantParty: string | null = null;
  let maxCount = 0;
  for (const [party, count] of partyDominanceCount) {
    if (count > maxCount) {
      maxCount = count;
      nationalDominantParty = party;
    }
  }

  // Collect all unique party labels for the legend
  const allPartyLabels = new Set<string>();
  for (const dept of departmentData) {
    for (const p of dept.parties) {
      allPartyLabels.add(p.label);
    }
  }

  // Build legend: predefined parties first (if present), then others
  const predefinedKeys = Object.keys(PARTY_COLORS);
  const legendParties: Array<{ label: string; color: string }> = [];
  for (const key of predefinedKeys) {
    if (allPartyLabels.has(key)) {
      legendParties.push({ label: key, color: PARTY_COLORS[key]! });
    }
  }
  for (const label of allPartyLabels) {
    if (!predefinedKeys.includes(label)) {
      legendParties.push({ label, color: getPartyColor(label) });
    }
  }

  return (
    <main id="main-content" className="container mx-auto px-4 max-w-6xl">
      {/* Breadcrumb */}
      <nav aria-label="Fil d'Ariane" className="py-4">
        <ol className="flex items-center gap-2 text-sm text-muted-foreground">
          <li>
            <Link href="/" className="hover:text-foreground transition-colors">
              Accueil
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link href="/elections" className="hover:text-foreground transition-colors">
              Élections
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link
              href="/elections/municipales-2026"
              className="hover:text-foreground transition-colors"
            >
              Municipales 2026
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-foreground font-medium">Carte des forces</li>
        </ol>
      </nav>

      {/* Header */}
      <section className="py-4">
        <h1 className="text-3xl font-bold mb-2">Carte des forces politiques</h1>
        <p className="text-muted-foreground text-lg">
          Répartition des listes par parti dans chaque département
        </p>
      </section>

      {/* Map */}
      <section className="py-6">
        <PartyMap departments={departmentData} />
      </section>

      {/* Legend */}
      {legendParties.length > 0 && (
        <section className="py-6 border-t">
          <h2 className="text-lg font-semibold mb-4">Légende</h2>
          <div className="flex flex-wrap gap-3">
            {legendParties.map((p) => (
              <div key={p.label} className="flex items-center gap-1.5">
                <div
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: p.color }}
                />
                <span className="text-sm">{p.label}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Stats summary */}
      <section className="py-6 border-t">
        <h2 className="text-lg font-semibold mb-4">En résumé</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-muted/50 rounded-lg p-4">
            <p className="text-sm text-muted-foreground">Départements couverts</p>
            <p className="text-2xl font-bold tabular-nums">{totalDepartments}</p>
          </div>
          {nationalDominantParty && (
            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-sm text-muted-foreground">Parti dominant au niveau national</p>
              <div className="flex items-center gap-2 mt-1">
                <div
                  className="w-4 h-4 rounded-full shrink-0"
                  style={{ backgroundColor: getPartyColor(nationalDominantParty) }}
                />
                <p className="text-2xl font-bold">{nationalDominantParty}</p>
                <span className="text-sm text-muted-foreground">
                  ({maxCount} département{maxCount > 1 ? "s" : ""})
                </span>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
