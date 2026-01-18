import { Metadata } from "next";
import { db } from "@/lib/db";
import { PoliticianCard } from "@/components/politicians/PoliticianCard";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Représentants politiques",
  description: "Liste des représentants politiques français - députés, sénateurs, ministres",
};

interface PageProps {
  searchParams: Promise<{ search?: string; party?: string; page?: string }>;
}

async function getPoliticians(search?: string, partyId?: string, page = 1) {
  const limit = 24;
  const skip = (page - 1) * limit;

  const where = {
    ...(search && {
      OR: [
        { fullName: { contains: search, mode: "insensitive" as const } },
        { lastName: { contains: search, mode: "insensitive" as const } },
      ],
    }),
    ...(partyId && { currentPartyId: partyId }),
  };

  const [politicians, total] = await Promise.all([
    db.politician.findMany({
      where,
      include: { currentParty: true },
      orderBy: { lastName: "asc" },
      skip,
      take: limit,
    }),
    db.politician.count({ where }),
  ]);

  return {
    politicians,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

async function getParties() {
  return db.party.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { politicians: true } },
    },
  });
}

export default async function PolitiquesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const search = params.search || "";
  const partyFilter = params.party || "";
  const page = parseInt(params.page || "1", 10);

  const [{ politicians, total, totalPages }, parties] = await Promise.all([
    getPoliticians(search, partyFilter, page),
    getParties(),
  ]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Représentants politiques</h1>
        <p className="text-muted-foreground">
          {total} représentants référencés dans notre base
        </p>
      </div>

      {/* Filters */}
      <div className="mb-8 space-y-4">
        <form className="flex gap-4">
          <Input
            type="search"
            name="search"
            placeholder="Rechercher par nom..."
            defaultValue={search}
            className="max-w-sm"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Rechercher
          </button>
        </form>

        {/* Party filters */}
        <div className="flex flex-wrap gap-2">
          <Link href="/politiques">
            <Badge
              variant={partyFilter === "" ? "default" : "outline"}
              className="cursor-pointer"
            >
              Tous
            </Badge>
          </Link>
          {parties.map((party) => (
            <Link key={party.id} href={`/politiques?party=${party.id}`}>
              <Badge
                variant={partyFilter === party.id ? "default" : "outline"}
                className="cursor-pointer"
                style={{
                  backgroundColor:
                    partyFilter === party.id ? party.color || undefined : undefined,
                  borderColor: party.color || undefined,
                }}
              >
                {party.shortName} ({party._count.politicians})
              </Badge>
            </Link>
          ))}
        </div>
      </div>

      {/* Results */}
      {politicians.length > 0 ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {politicians.map((politician) => (
              <PoliticianCard key={politician.id} politician={politician} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-8 flex justify-center gap-2">
              {page > 1 && (
                <Link
                  href={`/politiques?page=${page - 1}${search ? `&search=${search}` : ""}${partyFilter ? `&party=${partyFilter}` : ""}`}
                  className="px-4 py-2 border rounded-md hover:bg-gray-50"
                >
                  Précédent
                </Link>
              )}
              <span className="px-4 py-2 text-muted-foreground">
                Page {page} sur {totalPages}
              </span>
              {page < totalPages && (
                <Link
                  href={`/politiques?page=${page + 1}${search ? `&search=${search}` : ""}${partyFilter ? `&party=${partyFilter}` : ""}`}
                  className="px-4 py-2 border rounded-md hover:bg-gray-50"
                >
                  Suivant
                </Link>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Aucun résultat trouvé</p>
        </div>
      )}
    </div>
  );
}
