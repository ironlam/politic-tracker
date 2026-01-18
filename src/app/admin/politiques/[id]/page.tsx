import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PoliticianAvatar } from "@/components/politicians/PoliticianAvatar";
import { DATA_SOURCE_LABELS } from "@/config/labels";

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getPolitician(id: string) {
  return db.politician.findUnique({
    where: { id },
    include: {
      currentParty: true,
      externalIds: {
        orderBy: { source: "asc" },
      },
      mandates: {
        where: { isCurrent: true },
        take: 1,
      },
      _count: { select: { affairs: true } },
    },
  });
}

export default async function AdminPoliticianPage({ params }: PageProps) {
  const { id } = await params;
  const politician = await getPolitician(id);

  if (!politician) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/admin/politiques"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          &larr; Retour à la liste
        </Link>
        <Button asChild>
          <Link href={`/admin/politiques/${id}/edit`}>Modifier</Link>
        </Button>
      </div>

      <div className="flex items-start gap-6">
        <PoliticianAvatar
          photoUrl={politician.photoUrl}
          fullName={politician.fullName}
          size="xl"
        />
        <div>
          <h1 className="text-2xl font-bold">{politician.fullName}</h1>
          {politician.currentParty && (
            <Badge
              variant="secondary"
              style={{
                backgroundColor: politician.currentParty.color
                  ? `${politician.currentParty.color}20`
                  : undefined,
                color: politician.currentParty.color || undefined,
              }}
            >
              {politician.currentParty.shortName}
            </Badge>
          )}
          {politician.mandates[0] && (
            <p className="text-muted-foreground mt-1">
              {politician.mandates[0].title}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Informations générales */}
        <Card>
          <CardHeader>
            <CardTitle>Informations générales</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-muted-foreground">Slug</span>
              <span className="font-mono">{politician.slug}</span>

              <span className="text-muted-foreground">Civilité</span>
              <span>{politician.civility || "—"}</span>

              <span className="text-muted-foreground">Prénom</span>
              <span>{politician.firstName}</span>

              <span className="text-muted-foreground">Nom</span>
              <span>{politician.lastName}</span>

              <span className="text-muted-foreground">Date de naissance</span>
              <span>
                {politician.birthDate
                  ? new Date(politician.birthDate).toLocaleDateString("fr-FR")
                  : "—"}
              </span>

              <span className="text-muted-foreground">Lieu de naissance</span>
              <span>{politician.birthPlace || "—"}</span>

              <span className="text-muted-foreground">Affaires</span>
              <span>
                {politician._count.affairs > 0 ? (
                  <Badge variant="destructive">{politician._count.affairs}</Badge>
                ) : (
                  "0"
                )}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Photo */}
        <Card>
          <CardHeader>
            <CardTitle>Photo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-muted-foreground">URL</span>
              <span className="font-mono text-xs break-all">
                {politician.photoUrl || "—"}
              </span>

              <span className="text-muted-foreground">Source</span>
              <span>{politician.photoSource || "—"}</span>
            </div>
            {politician.photoUrl && (
              <div className="mt-4">
                <img
                  src={politician.photoUrl}
                  alt={politician.fullName}
                  className="w-32 h-32 object-cover rounded-lg border"
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* External IDs */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Identifiants externes ({politician.externalIds.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {politician.externalIds.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left pb-2 font-medium">Source</th>
                      <th className="text-left pb-2 font-medium">ID</th>
                      <th className="text-left pb-2 font-medium">URL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {politician.externalIds.map((extId) => (
                      <tr key={extId.id} className="border-b last:border-0">
                        <td className="py-2 pr-4">
                          <Badge variant="outline">
                            {DATA_SOURCE_LABELS[extId.source] || extId.source}
                          </Badge>
                        </td>
                        <td className="py-2 pr-4 font-mono">{extId.externalId}</td>
                        <td className="py-2">
                          {extId.url ? (
                            <a
                              href={extId.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline text-xs"
                            >
                              {extId.url}
                            </a>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-muted-foreground">Aucun identifiant externe</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Actions rapides */}
      <Card>
        <CardHeader>
          <CardTitle>Actions rapides</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4">
          <Button asChild>
            <Link href={`/admin/affaires/nouveau?politicianId=${politician.id}`}>
              Ajouter une affaire
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/politiques/${politician.slug}`} target="_blank">
              Voir la page publique
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
