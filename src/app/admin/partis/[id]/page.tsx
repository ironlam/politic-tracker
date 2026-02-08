import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import {
  POLITICAL_POSITION_LABELS,
  POLITICAL_POSITION_COLORS,
  DATA_SOURCE_LABELS,
} from "@/config/labels";

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getParty(id: string) {
  return db.party.findUnique({
    where: { id },
    include: {
      politicians: {
        select: { id: true, fullName: true, slug: true },
        take: 10,
      },
      partyMemberships: {
        include: { politician: { select: { id: true, fullName: true, slug: true } } },
        take: 10,
        orderBy: { startDate: "desc" },
      },
      predecessor: true,
      successors: true,
      externalIds: true,
      _count: {
        select: {
          politicians: true,
          partyMemberships: true,
          affairsAtTime: true,
        },
      },
    },
  });
}

export default async function AdminPartyPage({ params }: PageProps) {
  const { id } = await params;
  const party = await getParty(id);

  if (!party) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div
            className="w-12 h-12 rounded-lg flex items-center justify-center text-lg font-bold text-white"
            style={{ backgroundColor: party.color || "#888" }}
          >
            {party.shortName.substring(0, 2)}
          </div>
          <div>
            <h1 className="text-2xl font-bold">{party.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline">{party.shortName}</Badge>
              {party.politicalPosition && (
                <Badge className={POLITICAL_POSITION_COLORS[party.politicalPosition]}>
                  {POLITICAL_POSITION_LABELS[party.politicalPosition]}
                </Badge>
              )}
              {party.dissolvedDate && <Badge variant="secondary">Dissous</Badge>}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={party.slug ? `/partis/${party.slug}` : "/partis"}>
            <Button variant="outline">Voir page publique</Button>
          </Link>
          <Link href={`/admin/partis/${party.id}/edit`}>
            <Button>Modifier</Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Info card */}
        <Card>
          <CardHeader>
            <CardTitle>Informations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Slug</p>
                <p className="font-mono">{party.slug}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Couleur</p>
                <div className="flex items-center gap-2">
                  <div
                    className="w-4 h-4 rounded border"
                    style={{ backgroundColor: party.color || "#888" }}
                  />
                  <span className="font-mono">{party.color || "—"}</span>
                </div>
              </div>
              <div>
                <p className="text-muted-foreground">Fondé</p>
                <p>{party.foundedDate ? formatDate(party.foundedDate) : "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Dissous</p>
                <p>{party.dissolvedDate ? formatDate(party.dissolvedDate) : "—"}</p>
              </div>
              <div className="col-span-2">
                <p className="text-muted-foreground">Description</p>
                <p>{party.description || "—"}</p>
              </div>
              <div className="col-span-2">
                <p className="text-muted-foreground">Idéologie</p>
                <p>{party.ideology || "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Siège</p>
                <p>{party.headquarters || "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Site web</p>
                <p>
                  {party.website ? (
                    <a
                      href={party.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      {party.website}
                    </a>
                  ) : (
                    "—"
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats card */}
        <Card>
          <CardHeader>
            <CardTitle>Statistiques</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-4 bg-blue-50 rounded-lg">
                <p className="text-2xl font-bold text-blue-600">{party._count.politicians}</p>
                <p className="text-sm text-muted-foreground">Membres actuels</p>
              </div>
              <div className="p-4 bg-green-50 rounded-lg">
                <p className="text-2xl font-bold text-green-600">{party._count.partyMemberships}</p>
                <p className="text-sm text-muted-foreground">Adhésions</p>
              </div>
              <div className="p-4 bg-red-50 rounded-lg">
                <p className="text-2xl font-bold text-red-600">{party._count.affairsAtTime}</p>
                <p className="text-sm text-muted-foreground">Affaires</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Evolution card */}
        <Card>
          <CardHeader>
            <CardTitle>Évolution du parti</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {party.predecessor ? (
              <div>
                <p className="text-sm text-muted-foreground mb-1">Succède à</p>
                <Link
                  href={`/admin/partis/${party.predecessor.id}`}
                  className="flex items-center gap-2 text-blue-600 hover:underline"
                >
                  <div
                    className="w-3 h-3 rounded"
                    style={{ backgroundColor: party.predecessor.color || "#888" }}
                  />
                  {party.predecessor.name} ({party.predecessor.shortName})
                </Link>
              </div>
            ) : (
              <p className="text-muted-foreground">Aucun prédécesseur</p>
            )}

            {party.successors.length > 0 ? (
              <div>
                <p className="text-sm text-muted-foreground mb-1">Précède</p>
                <div className="space-y-1">
                  {party.successors.map((successor) => (
                    <Link
                      key={successor.id}
                      href={`/admin/partis/${successor.id}`}
                      className="flex items-center gap-2 text-blue-600 hover:underline"
                    >
                      <div
                        className="w-3 h-3 rounded"
                        style={{ backgroundColor: successor.color || "#888" }}
                      />
                      {successor.name} ({successor.shortName})
                    </Link>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground">Aucun successeur</p>
            )}
          </CardContent>
        </Card>

        {/* External IDs */}
        <Card>
          <CardHeader>
            <CardTitle>Identifiants externes</CardTitle>
          </CardHeader>
          <CardContent>
            {party.externalIds.length > 0 ? (
              <div className="space-y-2">
                {party.externalIds.map((ext) => (
                  <div key={ext.id} className="flex items-center justify-between text-sm">
                    <Badge variant="outline">{DATA_SOURCE_LABELS[ext.source]}</Badge>
                    <span className="font-mono">{ext.externalId}</span>
                    {ext.url && (
                      <a
                        href={ext.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        Lien
                      </a>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">Aucun identifiant externe</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Members preview */}
      <Card>
        <CardHeader>
          <CardTitle>Membres actuels (aperçu)</CardTitle>
        </CardHeader>
        <CardContent>
          {party.politicians.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {party.politicians.map((p) => (
                <Link key={p.id} href={`/admin/politiques/${p.id}`}>
                  <Badge variant="secondary" className="cursor-pointer hover:bg-gray-200">
                    {p.fullName}
                  </Badge>
                </Link>
              ))}
              {party._count.politicians > 10 && (
                <Badge variant="outline">+{party._count.politicians - 10} autres</Badge>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground">Aucun membre actuel</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
