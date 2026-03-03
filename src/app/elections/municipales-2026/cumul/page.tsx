import { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { getCumulCandidates, getMissingMayors } from "@/lib/data/municipales";
import { CumulTable } from "@/components/elections/municipales/CumulTable";
import { MissingMayorsTable } from "@/components/elections/municipales/MissingMayorsTable";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Cumul des mandats — Municipales 2026 | Poligraph",
  description:
    "Quels députés, sénateurs et ministres se présentent aux élections municipales 2026 ? Découvrez les cumuls de mandats et les maires sortants absents.",
  alternates: { canonical: "/elections/municipales-2026/cumul" },
};

// ---------------------------------------------------------------------------
// Inclusive French labels for the stats bar
// ---------------------------------------------------------------------------
const MANDATE_STATS_LABELS: Record<string, string> = {
  DEPUTE: "député·es",
  SENATEUR: "sénateur·ices",
  DEPUTE_EUROPEEN: "député·es européen·nes",
  MINISTRE: "ministres",
  SECRETAIRE_ETAT: "secrétaires d'État",
  PREMIER_MINISTRE: "premier·ères ministres",
};

export default async function CumulPage() {
  // Sequential queries to respect DB pool limit of 2
  const candidates = await getCumulCandidates();
  const missingMayors = await getMissingMayors();

  // Compute stats by mandate type
  const statsByType = new Map<string, number>();
  for (const c of candidates) {
    if (!c.politician) continue;
    for (const m of c.politician.mandates) {
      statsByType.set(m.type, (statsByType.get(m.type) || 0) + 1);
    }
  }

  // Order stats consistently
  const statsOrder = [
    "DEPUTE",
    "SENATEUR",
    "DEPUTE_EUROPEEN",
    "MINISTRE",
    "SECRETAIRE_ETAT",
    "PREMIER_MINISTRE",
  ];
  const statsEntries = statsOrder
    .filter((type) => statsByType.has(type))
    .map((type) => ({
      type,
      label: MANDATE_STATS_LABELS[type] ?? type,
      count: statsByType.get(type)!,
    }));

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
          <li className="text-foreground font-medium">Cumul des mandats</li>
        </ol>
      </nav>

      {/* Hero */}
      <section className="py-4">
        <div className="bg-gradient-to-br from-amber-50 via-background to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border rounded-2xl p-6 md:p-8">
          <h1 className="font-display text-3xl md:text-4xl font-bold mb-2">Cumul des mandats</h1>
          <p className="text-muted-foreground text-lg mb-6">
            Députés, sénateurs et ministres candidats aux municipales 2026
          </p>

          {/* Stats bar */}
          {statsEntries.length > 0 && (
            <div className="flex flex-wrap items-center gap-3">
              <span className="tabular-nums text-3xl font-bold text-foreground">
                {candidates.length}
              </span>
              <span className="text-muted-foreground">
                candidat{candidates.length > 1 ? "s" : ""} en cumul
              </span>
              <span className="text-muted-foreground hidden sm:inline" aria-hidden="true">
                |
              </span>
              <div className="flex flex-wrap gap-2">
                {statsEntries.map((s) => (
                  <Badge key={s.type} variant="outline" className="text-sm">
                    {s.count} {s.label}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {candidates.length === 0 && (
            <p className="text-muted-foreground">Aucun cumul de mandat détecté pour le moment.</p>
          )}
        </div>
      </section>

      {/* Cumul table */}
      {candidates.length > 0 && (
        <section className="py-8">
          <CumulTable candidates={candidates} />
        </section>
      )}

      {/* Missing mayors */}
      <section className="py-8 border-t">
        <h2 className="text-2xl font-bold mb-2">Qui manque à l&apos;appel ?</h2>
        <p className="text-muted-foreground mb-6">
          Ces maires en exercice ne se représentent pas (ou n&apos;ont pas encore déclaré leur
          candidature).
        </p>
        {missingMayors.length > 0 ? (
          <>
            <p className="text-sm text-muted-foreground mb-4">
              {missingMayors.length} maire{missingMayors.length > 1 ? "s" : ""} absent
              {missingMayors.length > 1 ? "s" : ""} des listes
            </p>
            <MissingMayorsTable mayors={missingMayors} />
          </>
        ) : (
          <p className="text-muted-foreground text-center py-8">
            Tous les maires en exercice se représentent.
          </p>
        )}
      </section>
    </main>
  );
}
