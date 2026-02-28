import { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SeoIntro } from "@/components/seo/SeoIntro";
import { MaireCard } from "@/components/elections/municipales/MaireCard";
import { getMaireStats, getMaires, getMaireParties } from "@/lib/data/municipales";
import { DEPARTMENTS } from "@/config/departments";

export const revalidate = 300; // ISR: 5 minutes

export const metadata: Metadata = {
  title: "Maires de France — Annuaire des 35 000 maires | Poligraph",
  description:
    "Explorez l'annuaire des maires de France : parité, couleur politique, ancienneté. Données issues du Répertoire National des Élus.",
  openGraph: {
    title: "Les maires de France en un coup d'œil",
    description:
      "35 000 maires passés au crible : parité, étiquette politique, ancienneté dans le poste.",
  },
};

interface PageProps {
  searchParams: Promise<{
    search?: string;
    dept?: string;
    party?: string;
    gender?: string;
    page?: string;
  }>;
}

export default async function MairesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const search = params.search || "";
  const deptFilter = params.dept || "";
  const partyFilter = params.party || "";
  const genderFilter = params.gender || "";
  const rawPage = parseInt(params.page || "1", 10);
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? rawPage : 1;

  const [stats, { maires, total, totalPages }, parties] = await Promise.all([
    getMaireStats(),
    getMaires(
      search || undefined,
      deptFilter || undefined,
      partyFilter || undefined,
      genderFilter || undefined,
      page
    ),
    getMaireParties(),
  ]);

  // Build URL helper for pagination/filters
  function buildUrl(overrides: Record<string, string>) {
    const p = new URLSearchParams();
    const merged = {
      search,
      dept: deptFilter,
      party: partyFilter,
      gender: genderFilter,
      page: String(page),
      ...overrides,
    };
    for (const [k, v] of Object.entries(merged)) {
      if (v) p.set(k, v);
    }
    if (p.get("page") === "1") p.delete("page");
    const qs = p.toString();
    return `/elections/municipales-2026/maires${qs ? `?${qs}` : ""}`;
  }

  const activeFilterCount = [deptFilter, partyFilter, genderFilter].filter(Boolean).length;

  // Department options for select
  const deptOptions = Object.entries(DEPARTMENTS)
    .map(([code, d]) => ({ code, name: d.name }))
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));

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
          <li className="text-foreground font-medium" aria-current="page">
            Maires
          </li>
        </ol>
      </nav>

      {/* Hero + stats */}
      <section className="py-4">
        <h1 className="text-3xl font-display font-extrabold tracking-tight mb-2">
          Maires de France
        </h1>
        <SeoIntro
          text={`Annuaire des ${stats.total.toLocaleString("fr-FR")} maires en exercice. Données issues du Répertoire National des Élus (RNE).`}
        />

        {/* Key stats cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
          <Card>
            <CardContent className="pt-5">
              <div className="text-3xl font-display font-extrabold tracking-tight text-primary tabular-nums">
                {stats.total.toLocaleString("fr-FR")}
              </div>
              <div className="text-sm font-medium mt-0.5">Maires en exercice</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <div className="text-3xl font-display font-extrabold tracking-tight text-primary tabular-nums">
                {(stats.femaleRate * 100).toFixed(1)}%
              </div>
              <div className="text-sm font-medium mt-0.5">Femmes maires</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <div className="text-3xl font-display font-extrabold tracking-tight text-primary tabular-nums">
                {stats.withParty.toLocaleString("fr-FR")}
              </div>
              <div className="text-sm font-medium mt-0.5">Avec étiquette politique</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <div className="text-3xl font-display font-extrabold tracking-tight text-primary tabular-nums">
                {stats.withPolitician}
              </div>
              <div className="text-sm font-medium mt-0.5">Aussi députés/sénateurs</div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Distribution charts */}
      {stats.partyDistribution.length > 0 && (
        <section className="py-6">
          <h2 className="text-lg font-bold mb-3">Couleurs politiques</h2>
          <div className="flex flex-wrap gap-2">
            {stats.partyDistribution.map((p) => (
              <Badge
                key={p.shortName}
                variant="secondary"
                className="text-sm px-3 py-1"
                style={{
                  backgroundColor: p.color ? `${p.color}20` : undefined,
                  color: p.color || undefined,
                  borderColor: p.color ? `${p.color}40` : undefined,
                }}
              >
                {p.shortName} ({p.count})
              </Badge>
            ))}
          </div>
        </section>
      )}

      {stats.mandateDistribution.length > 0 && (
        <section className="py-6">
          <h2 className="text-lg font-bold mb-3">Ancienneté</h2>
          <div className="flex flex-wrap gap-2">
            {stats.mandateDistribution.map((m) => (
              <Badge key={m.bracket} variant="outline" className="text-sm px-3 py-1">
                {m.bracket} ({m.count.toLocaleString("fr-FR")})
              </Badge>
            ))}
          </div>
        </section>
      )}

      {/* Search + Filters */}
      <section className="py-6">
        <form method="GET" action="/elections/municipales-2026/maires" className="space-y-3">
          {/* Search bar */}
          <div className="flex gap-2">
            <input
              type="search"
              name="search"
              defaultValue={search}
              placeholder="Rechercher un maire..."
              className="flex-1 px-4 py-2 border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label="Rechercher un maire"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Rechercher
            </button>
          </div>

          {/* Filter selects */}
          <div className="flex flex-wrap gap-2">
            <select
              name="dept"
              defaultValue={deptFilter}
              className="px-3 py-1.5 border rounded-md bg-background text-sm"
              aria-label="Département"
            >
              <option value="">Tous les départements</option>
              {deptOptions.map((d) => (
                <option key={d.code} value={d.code}>
                  {d.name} ({d.code})
                </option>
              ))}
            </select>

            <select
              name="party"
              defaultValue={partyFilter}
              className="px-3 py-1.5 border rounded-md bg-background text-sm"
              aria-label="Parti"
            >
              <option value="">Tous les partis</option>
              {parties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.shortName}
                </option>
              ))}
            </select>

            <select
              name="gender"
              defaultValue={genderFilter}
              className="px-3 py-1.5 border rounded-md bg-background text-sm"
              aria-label="Genre"
            >
              <option value="">Tous genres</option>
              <option value="F">Femmes</option>
              <option value="M">Hommes</option>
            </select>

            {activeFilterCount > 0 && (
              <Link
                href="/elections/municipales-2026/maires"
                className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Effacer les filtres
              </Link>
            )}
          </div>
        </form>
      </section>

      {/* Results count */}
      <div className="mb-4 text-sm text-muted-foreground">
        {total.toLocaleString("fr-FR")} maire{total > 1 ? "s" : ""}
        {search && ` pour "${search}"`}
        {activeFilterCount > 0 &&
          ` (${activeFilterCount} filtre${activeFilterCount > 1 ? "s" : ""} actif${activeFilterCount > 1 ? "s" : ""})`}
      </div>

      {/* Grid */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {maires.map((m) => (
          <MaireCard key={m.id} maire={m} />
        ))}
      </section>

      {maires.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          Aucun maire trouvé pour cette recherche.
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <nav className="mt-8 mb-12 flex justify-center items-center gap-2" aria-label="Pagination">
          {page > 1 ? (
            <Link
              href={buildUrl({ page: String(page - 1) })}
              className="inline-flex items-center gap-1 px-4 py-2 border rounded-md hover:bg-muted transition-colors text-sm"
              prefetch={false}
            >
              ← Précédent
            </Link>
          ) : (
            <span className="inline-flex items-center gap-1 px-4 py-2 border rounded-md opacity-50 cursor-not-allowed text-sm">
              ← Précédent
            </span>
          )}
          <span className="px-4 py-2 text-sm text-muted-foreground tabular-nums">
            Page <span className="font-medium text-foreground">{page}</span> sur{" "}
            <span className="font-medium text-foreground">{totalPages}</span>
          </span>
          {page < totalPages ? (
            <Link
              href={buildUrl({ page: String(page + 1) })}
              className="inline-flex items-center gap-1 px-4 py-2 border rounded-md hover:bg-muted transition-colors text-sm"
              prefetch={false}
            >
              Suivant →
            </Link>
          ) : (
            <span className="inline-flex items-center gap-1 px-4 py-2 border rounded-md opacity-50 cursor-not-allowed text-sm">
              Suivant →
            </span>
          )}
        </nav>
      )}
    </main>
  );
}
