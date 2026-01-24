import Link from "next/link";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PoliticianCard } from "@/components/politicians/PoliticianCard";
import { formatDate } from "@/lib/utils";

async function getStats() {
  const [politicianCount, partyCount, affairCount, deputeCount, senateurCount, gouvernementCount, declarationCount] =
    await Promise.all([
      db.politician.count(),
      db.party.count(),
      db.affair.count(),
      db.mandate.count({ where: { type: "DEPUTE", isCurrent: true } }),
      db.mandate.count({ where: { type: "SENATEUR", isCurrent: true } }),
      db.mandate.count({
        where: {
          type: { in: ["MINISTRE", "PREMIER_MINISTRE", "MINISTRE_DELEGUE", "SECRETAIRE_ETAT"] },
          isCurrent: true,
        },
      }),
      db.declaration.count(),
    ]);

  return { politicianCount, partyCount, affairCount, deputeCount, senateurCount, gouvernementCount, declarationCount };
}

async function getRecentPoliticians() {
  return db.politician.findMany({
    take: 6,
    orderBy: { createdAt: "desc" },
    include: { currentParty: true },
    where: { deathDate: null }, // Exclude deceased
  });
}

async function getRecentAffairs() {
  return db.affair.findMany({
    take: 4,
    // Order by most relevant date: verdict > start > facts > created
    orderBy: [
      { verdictDate: { sort: "desc", nulls: "last" } },
      { startDate: { sort: "desc", nulls: "last" } },
      { factsDate: { sort: "desc", nulls: "last" } },
      { createdAt: "desc" },
    ],
    include: {
      politician: { include: { currentParty: true } },
    },
  });
}

export default async function HomePage() {
  const stats = await getStats();
  const recentPoliticians = await getRecentPoliticians();
  const recentAffairs = await getRecentAffairs();

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-background to-accent/10">
        <div className="container mx-auto px-4 py-20 md:py-28">
          <div className="max-w-3xl mx-auto text-center">
            <Badge variant="secondary" className="mb-6 text-sm font-medium">
              Observatoire citoyen indépendant
            </Badge>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
              <span className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                Transparence Politique
              </span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
              Accédez aux informations publiques sur vos représentants politiques.
              Mandats, déclarations de patrimoine, affaires judiciaires documentées.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg" className="text-base px-8 shadow-lg shadow-primary/20">
                <Link href="/politiques">Explorer les représentants</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="text-base px-8">
                <Link href="/statistiques">Voir les statistiques</Link>
              </Button>
            </div>
          </div>
        </div>
        {/* Decorative elements */}
        <div className="absolute top-0 left-0 w-72 h-72 bg-primary/10 rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-accent/20 rounded-full translate-x-1/3 translate-y-1/3 blur-3xl" />
      </section>

      {/* Stats Section */}
      <section className="py-16 border-y bg-card">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-6">
            <StatCard value={stats.politicianCount} label="Politiques" />
            <StatCard value={stats.deputeCount} label="Députés" highlight />
            <StatCard value={stats.senateurCount} label="Sénateurs" highlight />
            <StatCard value={stats.gouvernementCount} label="Gouvernement" highlight />
            <StatCard value={stats.partyCount} label="Partis" />
            <StatCard value={stats.affairCount} label="Affaires" variant="destructive" />
            <StatCard value={stats.declarationCount} label="Déclarations" />
          </div>
        </div>
      </section>

      {/* Recent Politicians */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-end mb-8">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold mb-2">Représentants</h2>
              <p className="text-muted-foreground">Les derniers profils ajoutés</p>
            </div>
            <Button variant="ghost" asChild className="text-primary">
              <Link href="/politiques">Voir tous &rarr;</Link>
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {recentPoliticians.map((politician) => (
              <PoliticianCard key={politician.id} politician={politician} />
            ))}
          </div>
        </div>
      </section>

      {/* Recent Affairs */}
      {recentAffairs.length > 0 && (
        <section className="py-16 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="flex justify-between items-end mb-8">
              <div>
                <h2 className="text-2xl md:text-3xl font-bold mb-2">Affaires récentes</h2>
                <p className="text-muted-foreground">Dernières affaires documentées</p>
              </div>
              <Button variant="ghost" asChild className="text-primary">
                <Link href="/affaires">Voir toutes &rarr;</Link>
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {recentAffairs.map((affair) => {
                // Get the most relevant date for display
                const relevantDate = affair.verdictDate || affair.startDate || affair.factsDate;
                return (
                  <Link
                    key={affair.id}
                    href={`/politiques/${affair.politician.slug}`}
                    className="block"
                  >
                    <Card className="h-full hover:shadow-lg transition-all hover:border-primary/20">
                      <CardContent className="pt-6">
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                            <span className="text-destructive text-lg">!</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-semibold truncate">{affair.title}</p>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {affair.politician.fullName}
                              {affair.politician.currentParty && (
                                <span className="text-primary"> ({affair.politician.currentParty.shortName})</span>
                              )}
                            </p>
                            {relevantDate && (
                              <p className="text-xs text-muted-foreground mt-2 font-mono">
                                {formatDate(relevantDate)}
                              </p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-br from-primary/5 to-accent/10">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">
            Un projet citoyen transparent
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto mb-8">
            Toutes nos sources sont documentées. Notre méthodologie est publique.
            Nous respectons la présomption d&apos;innocence et le droit de réponse.
          </p>
          <Button asChild variant="outline" size="lg">
            <Link href="/sources">Découvrir notre méthodologie</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}

function StatCard({
  value,
  label,
  highlight,
  variant,
}: {
  value: number;
  label: string;
  highlight?: boolean;
  variant?: "destructive";
}) {
  return (
    <div className="text-center">
      <p
        className={`text-3xl md:text-4xl font-bold ${
          variant === "destructive"
            ? "text-destructive"
            : highlight
              ? "text-primary"
              : ""
        }`}
      >
        {value.toLocaleString("fr-FR")}
      </p>
      <p className="text-sm text-muted-foreground mt-1">{label}</p>
    </div>
  );
}
