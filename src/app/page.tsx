import Link from "next/link";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

async function getStats() {
  const [politicianCount, partyCount, affairCount, deputeCount] =
    await Promise.all([
      db.politician.count(),
      db.party.count(),
      db.affair.count(),
      db.mandate.count({
        where: { type: "DEPUTE", isCurrent: true },
      }),
    ]);

  return { politicianCount, partyCount, affairCount, deputeCount };
}

async function getRecentPoliticians() {
  return db.politician.findMany({
    take: 6,
    orderBy: { createdAt: "desc" },
    include: { currentParty: true },
  });
}

export default async function HomePage() {
  const stats = await getStats();
  const recentPoliticians = await getRecentPoliticians();

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Hero */}
      <section className="text-center py-12">
        <h1 className="text-4xl font-bold mb-4">Politic Tracker</h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
          Observatoire citoyen de la transparence politique française.
          Consultez les informations publiques sur vos élus.
        </p>
        <div className="flex gap-4 justify-center">
          <Button asChild size="lg">
            <Link href="/politiques">Voir les politiques</Link>
          </Button>
        </div>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 py-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Politiques
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats.politicianCount}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Députés en exercice
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats.deputeCount}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Partis politiques
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats.partyCount}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Affaires documentées
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats.affairCount}</p>
          </CardContent>
        </Card>
      </section>

      {/* Recent politicians */}
      <section className="py-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Derniers ajouts</h2>
          <Button variant="outline" asChild>
            <Link href="/politiques">Voir tous</Link>
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {recentPoliticians.map((politician) => (
            <Link
              key={politician.id}
              href={`/politiques/${politician.slug}`}
              className="block"
            >
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center text-lg font-semibold text-gray-600">
                      {politician.firstName[0]}
                      {politician.lastName[0]}
                    </div>
                    <div>
                      <p className="font-semibold">{politician.fullName}</p>
                      {politician.currentParty && (
                        <p className="text-sm text-muted-foreground">
                          {politician.currentParty.name}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* Info box */}
      <section className="py-8">
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <h3 className="font-semibold text-blue-900 mb-2">
              Sources des données
            </h3>
            <p className="text-sm text-blue-800">
              Toutes les informations proviennent de sources publiques :
              Assemblée nationale, Sénat, HATVP, et articles de presse. Chaque
              affaire judiciaire est documentée avec ses sources.
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
