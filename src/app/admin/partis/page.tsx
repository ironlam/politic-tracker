import Link from "next/link";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { POLITICAL_POSITION_LABELS, POLITICAL_POSITION_COLORS } from "@/config/labels";

interface PageProps {
  searchParams: Promise<{ q?: string }>;
}

async function getParties(search: string) {
  const where = search
    ? {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { shortName: { contains: search, mode: "insensitive" as const } },
        ],
      }
    : {};

  const parties = await db.party.findMany({
    where,
    include: {
      _count: {
        select: {
          politicians: true,
          partyMemberships: true,
          affairsAtTime: true,
        },
      },
      predecessor: { select: { shortName: true } },
      successors: { select: { shortName: true } },
    },
    orderBy: [{ politicians: { _count: "desc" } }, { name: "asc" }],
  });

  return parties;
}

export default async function AdminPartiesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const search = params.q || "";
  const parties = await getParties(search);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Partis</h1>
        <p className="text-muted-foreground">{parties.length} partis</p>
      </div>

      <Card>
        <CardHeader>
          <form method="GET" className="flex gap-4">
            <Input
              name="q"
              placeholder="Rechercher un parti..."
              defaultValue={search}
              className="max-w-sm"
            />
          </form>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b text-left">
                  <th scope="col" className="pb-3 font-medium">
                    Nom
                  </th>
                  <th scope="col" className="pb-3 font-medium">
                    Position
                  </th>
                  <th scope="col" className="pb-3 font-medium text-center">
                    Membres
                  </th>
                  <th scope="col" className="pb-3 font-medium text-center">
                    Historique
                  </th>
                  <th scope="col" className="pb-3 font-medium">
                    Évolution
                  </th>
                  <th scope="col" className="pb-3 font-medium">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {parties.map((party) => (
                  <tr key={party.id} className="border-b last:border-0">
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-4 h-4 rounded"
                          style={{ backgroundColor: party.color || "#888" }}
                        />
                        <Link
                          href={`/partis/${party.slug}`}
                          className="font-medium hover:underline"
                        >
                          {party.name}
                        </Link>
                        <Badge variant="outline" className="text-xs">
                          {party.shortName}
                        </Badge>
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      {party.politicalPosition ? (
                        <Badge
                          className={`text-xs ${POLITICAL_POSITION_COLORS[party.politicalPosition]}`}
                        >
                          {POLITICAL_POSITION_LABELS[party.politicalPosition]}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-center">{party._count.politicians}</td>
                    <td className="py-3 pr-4 text-center">{party._count.partyMemberships}</td>
                    <td className="py-3 pr-4">
                      {party.predecessor && (
                        <span className="text-xs text-muted-foreground">
                          ← {party.predecessor.shortName}
                        </span>
                      )}
                      {party.successors.length > 0 && (
                        <span className="text-xs text-muted-foreground">
                          → {party.successors.map((s) => s.shortName).join(", ")}
                        </span>
                      )}
                      {!party.predecessor && party.successors.length === 0 && (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-3 space-x-3">
                      <Link
                        href={`/admin/partis/${party.id}`}
                        className="text-sm text-blue-600 hover:underline"
                      >
                        Voir
                      </Link>
                      <Link
                        href={`/admin/partis/${party.id}/edit`}
                        className="text-sm text-blue-600 hover:underline"
                      >
                        Modifier
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
