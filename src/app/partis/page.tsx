import { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { POLITICAL_POSITION_LABELS, POLITICAL_POSITION_COLORS } from "@/config/labels";

export const metadata: Metadata = {
  title: "Partis politiques",
  description: "Liste des partis politiques français avec leurs membres et historique",
};

async function getParties() {
  return db.party.findMany({
    include: {
      _count: {
        select: {
          politicians: true,
          partyMemberships: true,
          affairsAtTime: true,
        },
      },
      predecessor: {
        select: { shortName: true, slug: true },
      },
    },
    orderBy: [{ politicians: { _count: "desc" } }, { name: "asc" }],
  });
}

export default async function PartiesPage() {
  const parties = await getParties();

  // Active = not dissolved AND has at least one member or membership
  const activeParties = parties.filter(
    (p) => !p.dissolvedDate && (p._count.politicians > 0 || p._count.partyMemberships > 0)
  );
  // Historical = dissolved AND has some history (members, memberships, or affairs)
  const historicalParties = parties.filter(
    (p) =>
      p.dissolvedDate &&
      (p._count.politicians > 0 || p._count.partyMemberships > 0 || p._count.affairsAtTime > 0)
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">Partis politiques</h1>
      <p className="text-muted-foreground mb-8">{parties.length} partis référencés</p>

      {/* Active parties */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-4">Partis actuels ({activeParties.length})</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {activeParties.map((party) => (
            <Link key={party.id} href={`/partis/${party.slug}`}>
              <Card className="h-full hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div
                      className="w-12 h-12 rounded-lg flex items-center justify-center text-lg font-bold text-white shrink-0"
                      style={{ backgroundColor: party.color || "#888" }}
                    >
                      {party.shortName.substring(0, 2)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold truncate">{party.name}</h3>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge variant="outline" className="text-xs">
                          {party.shortName}
                        </Badge>
                        {party.politicalPosition && (
                          <Badge
                            className={`text-xs ${POLITICAL_POSITION_COLORS[party.politicalPosition]}`}
                          >
                            {POLITICAL_POSITION_LABELS[party.politicalPosition]}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                        <span>{party._count.politicians} membres</span>
                        {party._count.affairsAtTime > 0 && (
                          <span>{party._count.affairsAtTime} affaires</span>
                        )}
                      </div>
                      {party.predecessor && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Succède à {party.predecessor.shortName}
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

      {/* Historical parties */}
      {historicalParties.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold mb-4">
            Partis historiques ({historicalParties.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {historicalParties.map((party) => (
              <Link key={party.id} href={`/partis/${party.slug}`}>
                <Card className="h-full hover:shadow-md transition-shadow opacity-75 hover:opacity-100">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold text-white shrink-0"
                        style={{ backgroundColor: party.color || "#888" }}
                      >
                        {party.shortName.substring(0, 2)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-medium truncate">{party.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {party.shortName}
                          </Badge>
                          {party.dissolvedDate && (
                            <Badge variant="secondary" className="text-xs">
                              Dissous
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span>{party._count.partyMemberships} anciens membres</span>
                          {party._count.affairsAtTime > 0 && (
                            <span>{party._count.affairsAtTime} affaires</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
