import Link from "next/link";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

interface PageProps {
  searchParams: Promise<{ q?: string; page?: string }>;
}

async function getPoliticians(search: string, page: number) {
  const pageSize = 50;
  const skip = (page - 1) * pageSize;

  const where = search
    ? {
        OR: [
          { fullName: { contains: search, mode: "insensitive" as const } },
          { lastName: { contains: search, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [politicians, total] = await Promise.all([
    db.politician.findMany({
      where,
      select: {
        id: true,
        fullName: true,
        slug: true,
        currentParty: { select: { shortName: true, color: true } },
        _count: { select: { affairs: true } },
      },
      orderBy: { lastName: "asc" },
      skip,
      take: pageSize,
    }),
    db.politician.count({ where }),
  ]);

  return { politicians, total, pageSize };
}

export default async function AdminPoliticiansPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const search = params.q || "";
  const page = parseInt(params.page || "1", 10);

  const { politicians, total, pageSize } = await getPoliticians(search, page);
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Politiques</h1>
        <p className="text-muted-foreground">{total} politiques</p>
      </div>

      <Card>
        <CardHeader>
          <form method="GET" className="flex gap-4">
            <Input
              name="q"
              placeholder="Rechercher un politique..."
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
                    Parti
                  </th>
                  <th scope="col" className="pb-3 font-medium text-center">
                    Affaires
                  </th>
                  <th scope="col" className="pb-3 font-medium">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {politicians.map((politician) => (
                  <tr key={politician.id} className="border-b last:border-0">
                    <td className="py-3 pr-4">
                      <Link
                        href={`/politiques/${politician.slug}`}
                        className="font-medium hover:underline"
                      >
                        {politician.fullName}
                      </Link>
                    </td>
                    <td className="py-3 pr-4">
                      {politician.currentParty ? (
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
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-center">
                      {politician._count.affairs > 0 ? (
                        <Badge variant="destructive">{politician._count.affairs}</Badge>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </td>
                    <td className="py-3 space-x-3">
                      <Link
                        href={`/admin/politiques/${politician.id}`}
                        className="text-sm text-blue-600 hover:underline"
                      >
                        Voir
                      </Link>
                      <Link
                        href={`/admin/politiques/${politician.id}/edit`}
                        className="text-sm text-blue-600 hover:underline"
                      >
                        Modifier
                      </Link>
                      <Link
                        href={`/admin/affaires/nouveau?politicianId=${politician.id}`}
                        className="text-sm text-green-600 hover:underline"
                      >
                        + Affaire
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-6">
              {page > 1 && (
                <Link
                  href={`/admin/politiques?q=${search}&page=${page - 1}`}
                  className="px-3 py-1 border rounded hover:bg-gray-50"
                >
                  Précédent
                </Link>
              )}
              <span className="px-3 py-1">
                Page {page} / {totalPages}
              </span>
              {page < totalPages && (
                <Link
                  href={`/admin/politiques?q=${search}&page=${page + 1}`}
                  className="px-3 py-1 border rounded hover:bg-gray-50"
                >
                  Suivant
                </Link>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
