import { cache } from "react";
import { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MunicipalesHero } from "@/components/elections/municipales/MunicipalesHero";
import { MunicipalesChiffres } from "@/components/elections/municipales/MunicipalesChiffres";
import { CommuneSearch } from "@/components/elections/municipales/CommuneSearch";
import { ELECTION_GUIDES } from "@/config/election-guides";
import { getDepartmentPartyData } from "@/lib/data/municipales";
import { PartyMap } from "@/components/elections/municipales/PartyMap";

export const revalidate = 300; // ISR: 5 minutes

interface MunicipalesStats {
  totalCandidacies: number;
  totalLists: number;
  totalCommunes: number;
  communesWithCompetition: number;
  communesUncontested: number;
  averageCompetitionIndex: number;
  parityRate: number;
  parityByParty: Record<string, number>;
  nationalPoliticiansCandidates: number;
  mostContestedCommunes: Array<{
    id: string;
    name: string;
    departmentCode: string;
    population: number | null;
    listCount: number;
  }>;
}

const getMunicipalesStats = cache(async function getMunicipalesStats() {
  const snapshot = await db.statsSnapshot.findUnique({
    where: { key: "municipales-2026" },
  });
  return snapshot?.data as MunicipalesStats | null;
});

const getElection = cache(async function getElection() {
  return db.election.findUnique({
    where: { slug: "municipales-2026" },
    select: {
      id: true,
      round1Date: true,
      round2Date: true,
      dateConfirmed: true,
      title: true,
    },
  });
});

export const metadata: Metadata = {
  title: "Municipales 2026 — Candidats, listes et résultats | Poligraph",
  description:
    "Découvrez les candidats et listes aux élections municipales 2026 dans votre commune. Recherche par ville, carte des forces politiques, parité et cumul des mandats.",
  openGraph: {
    title: "Municipales 2026 — Qui se présente chez vous ?",
    description: "Découvrez les candidats aux élections municipales 2026 dans votre commune.",
  },
};

export default async function MunicipalesLandingPage() {
  const election = await getElection();
  const stats = await getMunicipalesStats();
  const departmentData = await getDepartmentPartyData();

  const targetDate = election?.round1Date ? election.round1Date.toISOString() : null;

  const guides = ELECTION_GUIDES.MUNICIPALES;

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
          <li className="text-foreground font-medium">Municipales 2026</li>
        </ol>
      </nav>

      {/* Hero */}
      <section className="py-4">
        <MunicipalesHero
          targetDate={targetDate}
          dateConfirmed={election?.dateConfirmed ?? false}
          totalCandidacies={stats?.totalCandidacies ?? 0}
          totalCommunes={stats?.totalCommunes ?? 0}
          totalLists={stats?.totalLists ?? 0}
        />
      </section>

      {/* Search */}
      <section className="py-8">
        <CommuneSearch />
      </section>

      {/* Chiffres */}
      {stats && (
        <section className="py-8">
          <h2 className="text-xl font-bold mb-4">Les chiffres clés</h2>
          <MunicipalesChiffres
            communesWithCompetition={stats.communesWithCompetition}
            totalCommunes={stats.totalCommunes}
            averageCompetitionIndex={stats.averageCompetitionIndex}
            parityRate={stats.parityRate}
            nationalPoliticiansCandidates={stats.nationalPoliticiansCandidates}
          />
        </section>
      )}

      {/* Most contested communes */}
      {stats && stats.mostContestedCommunes.length > 0 && (
        <section className="py-8">
          <h2 className="text-xl font-bold mb-4">Les courses à suivre</h2>
          <p className="text-muted-foreground mb-6">
            Les communes avec le plus de listes en compétition
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {stats.mostContestedCommunes.map((commune) => (
              <Link
                key={commune.id}
                href={`/elections/municipales-2026/communes/${commune.id}`}
                prefetch={false}
              >
                <Card className="hover:shadow-sm transition-shadow h-full">
                  <CardContent className="pt-5">
                    <p className="font-semibold">{commune.name}</p>
                    <p className="text-sm text-muted-foreground">{commune.departmentCode}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <Badge variant="outline">{commune.listCount} listes</Badge>
                      {commune.population && (
                        <span className="text-xs text-muted-foreground">
                          {commune.population.toLocaleString("fr-FR")} hab.
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Cartographie politique */}
      {departmentData.length > 0 && (
        <section className="py-8">
          <h2 className="text-xl font-bold mb-4">Cartographie politique</h2>
          <div className="border rounded-xl overflow-hidden bg-card p-4">
            <PartyMap departments={departmentData} mini />
          </div>
          <div className="mt-3 text-right">
            <Link
              href="/elections/municipales-2026/carte"
              prefetch={false}
              className="text-sm text-primary hover:underline"
            >
              Voir la carte complète →
            </Link>
          </div>
        </section>
      )}

      {/* Uncontested communes */}
      {stats && stats.communesUncontested > 0 && (
        <section className="py-8">
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-6">
            <h2 className="text-xl font-bold mb-2">Communes sans choix</h2>
            <p className="text-muted-foreground">
              <span className="text-2xl font-bold tabular-nums text-amber-700 dark:text-amber-300">
                {stats.communesUncontested.toLocaleString("fr-FR")}
              </span>{" "}
              communes n&apos;ont qu&apos;une seule liste en lice. Les électeurs n&apos;auront pas
              de choix entre des candidatures concurrentes.
            </p>
          </div>
        </section>
      )}

      {/* Guide pratique */}
      {guides && (
        <section className="py-8">
          <h2 className="text-xl font-bold mb-4">Guide pratique</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {guides.map((guide) => (
              <Card key={guide.title}>
                <CardContent className="pt-5">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl shrink-0" aria-hidden="true">
                      {guide.icon}
                    </span>
                    <div>
                      <h3 className="font-semibold mb-1">{guide.title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {guide.content}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
