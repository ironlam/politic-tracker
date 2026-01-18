import Link from "next/link";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AFFAIR_STATUS_LABELS, AFFAIR_STATUS_COLORS, AFFAIR_CATEGORY_LABELS } from "@/config/labels";
import { formatDate } from "@/lib/utils";

async function getAffairs() {
  return db.affair.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      politician: { select: { id: true, fullName: true, slug: true } },
      sources: { select: { id: true } },
    },
  });
}

export default async function AdminAffairsPage() {
  const affairs = await getAffairs();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Affaires judiciaires</h1>
        <Button asChild>
          <Link href="/admin/affaires/nouveau">Ajouter une affaire</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {affairs.length} affaire{affairs.length !== 1 ? "s" : ""} documentée
            {affairs.length !== 1 ? "s" : ""}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {affairs.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-3 font-medium">Affaire</th>
                    <th className="pb-3 font-medium">Politique</th>
                    <th className="pb-3 font-medium">Catégorie</th>
                    <th className="pb-3 font-medium">Statut</th>
                    <th className="pb-3 font-medium">Sources</th>
                    <th className="pb-3 font-medium">Ajouté le</th>
                    <th className="pb-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {affairs.map((affair) => (
                    <tr key={affair.id} className="border-b last:border-0">
                      <td className="py-3 pr-4">
                        <Link
                          href={`/admin/affaires/${affair.id}`}
                          className="font-medium hover:underline"
                        >
                          {affair.title}
                        </Link>
                      </td>
                      <td className="py-3 pr-4">
                        <Link
                          href={`/politiques/${affair.politician.slug}`}
                          className="text-blue-600 hover:underline"
                        >
                          {affair.politician.fullName}
                        </Link>
                      </td>
                      <td className="py-3 pr-4 text-sm">
                        {AFFAIR_CATEGORY_LABELS[affair.category]}
                      </td>
                      <td className="py-3 pr-4">
                        <Badge className={AFFAIR_STATUS_COLORS[affair.status]}>
                          {AFFAIR_STATUS_LABELS[affair.status]}
                        </Badge>
                      </td>
                      <td className="py-3 pr-4 text-center">
                        {affair.sources.length}
                      </td>
                      <td className="py-3 pr-4 text-sm text-muted-foreground">
                        {formatDate(affair.createdAt)}
                      </td>
                      <td className="py-3">
                        <div className="flex gap-2">
                          <Link
                            href={`/admin/affaires/${affair.id}/edit`}
                            className="text-sm text-blue-600 hover:underline"
                          >
                            Modifier
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">
                Aucune affaire documentée pour le moment
              </p>
              <Button asChild>
                <Link href="/admin/affaires/nouveau">Ajouter la première affaire</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
