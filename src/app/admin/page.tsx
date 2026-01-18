import Link from "next/link";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

async function getStats() {
  const [politicianCount, affairCount, partyCount] = await Promise.all([
    db.politician.count(),
    db.affair.count(),
    db.party.count(),
  ]);

  return { politicianCount, affairCount, partyCount };
}

async function getRecentAffairs() {
  return db.affair.findMany({
    take: 5,
    orderBy: { createdAt: "desc" },
    include: {
      politician: { select: { fullName: true, slug: true } },
    },
  });
}

export default async function AdminDashboard() {
  const stats = await getStats();
  const recentAffairs = await getRecentAffairs();

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tableau de bord</h1>
        <Button asChild>
          <Link href="/admin/affaires/nouveau">Ajouter une affaire</Link>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              Affaires documentées
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats.affairCount}</p>
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
      </div>

      {/* Recent affairs */}
      <Card>
        <CardHeader>
          <CardTitle>Dernières affaires ajoutées</CardTitle>
        </CardHeader>
        <CardContent>
          {recentAffairs.length > 0 ? (
            <ul className="space-y-3">
              {recentAffairs.map((affair) => (
                <li
                  key={affair.id}
                  className="flex items-center justify-between border-b pb-3 last:border-0"
                >
                  <div>
                    <Link
                      href={`/admin/affaires/${affair.id}`}
                      className="font-medium hover:underline"
                    >
                      {affair.title}
                    </Link>
                    <p className="text-sm text-muted-foreground">
                      {affair.politician.fullName}
                    </p>
                  </div>
                  <Link
                    href={`/admin/affaires/${affair.id}/edit`}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Modifier
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">Aucune affaire documentée</p>
          )}
        </CardContent>
      </Card>

      {/* Quick actions */}
      <Card>
        <CardHeader>
          <CardTitle>Actions rapides</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4">
          <Button asChild>
            <Link href="/admin/affaires/nouveau">Nouvelle affaire</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/admin/affaires">Voir toutes les affaires</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/admin/politiques">Gérer les politiques</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
