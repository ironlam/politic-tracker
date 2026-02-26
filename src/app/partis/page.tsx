import Image from "next/image";
import { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PoliticalPositionBadge } from "@/components/parties/PoliticalPositionBadge";
import { AFFAIR_STATUS_NEEDS_PRESUMPTION } from "@/config/labels";
import type { AffairStatus } from "@/types";

export const revalidate = 300; // 5 minutes, cohérent avec l'API

export const metadata: Metadata = {
  title: "Partis politiques",
  description: "Liste des partis politiques français avec leurs membres et historique",
};

async function getParties() {
  const parties = await db.party.findMany({
    include: {
      _count: {
        select: {
          politicians: true,
          partyMemberships: true,
        },
      },
      // Fetch lightweight affair data to compute differentiated counts in JS
      affairsAtTime: {
        where: {
          publicationStatus: "PUBLISHED",
          involvement: { notIn: ["VICTIM", "PLAINTIFF"] },
        },
        select: { id: true, status: true },
      },
      predecessor: {
        select: { shortName: true, slug: true },
      },
    },
    orderBy: [{ politicians: { _count: "desc" } }, { name: "asc" }],
  });

  // Compute affair counts by category
  return parties.map((party) => {
    const affairs = party.affairsAtTime;
    const condamnations = affairs.filter((a) => a.status === "CONDAMNATION_DEFINITIVE").length;
    const enCours = affairs.filter(
      (a) => AFFAIR_STATUS_NEEDS_PRESUMPTION[a.status as AffairStatus]
    ).length;
    const total = affairs.length;

    return {
      ...party,
      affairCounts: { condamnations, enCours, total },
      // Remove raw affairs from the result to keep it clean
      affairsAtTime: undefined,
    };
  });
}

export default async function PartiesPage() {
  const parties = await getParties();

  // Active = not dissolved AND has at least one member or membership
  const activeParties = parties.filter((p) => !p.dissolvedDate && p._count.politicians > 0);
  // Historical = dissolved AND has some history (members, memberships, or affairs)
  const historicalParties = parties.filter(
    (p) => p.dissolvedDate && (p._count.partyMemberships > 0 || p.affairCounts.total > 0)
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">Partis politiques</h1>
      <p className="text-muted-foreground mb-8">
        {activeParties.length + historicalParties.length} partis référencés
      </p>

      {/* Active parties */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-4">Partis actuels ({activeParties.length})</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {activeParties
            .filter((p) => p.slug)
            .map((party) => (
              <Link key={party.id} href={`/partis/${party.slug}`} prefetch={false}>
                <Card className="h-full hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      {party.logoUrl ? (
                        <Image
                          src={party.logoUrl}
                          alt={party.name}
                          width={48}
                          height={48}
                          className="w-12 h-12 object-contain shrink-0"
                        />
                      ) : (
                        <div
                          className="w-12 h-12 rounded-lg flex items-center justify-center text-lg font-bold text-white shrink-0"
                          style={{ backgroundColor: party.color || "#888" }}
                        >
                          {party.shortName.substring(0, 2)}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold truncate">{party.name}</h3>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <Badge variant="outline" className="text-xs" title={party.name}>
                            {party.shortName}
                          </Badge>
                          {party.politicalPosition && (
                            <PoliticalPositionBadge
                              position={party.politicalPosition}
                              source={party.politicalPositionSource}
                              className="text-xs"
                            />
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground flex-wrap">
                          <span>{party._count.politicians} membres</span>
                          {party.affairCounts.condamnations > 0 && (
                            <span className="text-red-600 dark:text-red-400 font-medium">
                              {party.affairCounts.condamnations} condamnation
                              {party.affairCounts.condamnations > 1 ? "s" : ""}
                            </span>
                          )}
                          {party.affairCounts.enCours > 0 && (
                            <span className="text-amber-600 dark:text-amber-400">
                              {party.affairCounts.enCours} en cours
                            </span>
                          )}
                          {party.affairCounts.total > 0 &&
                            party.affairCounts.total !==
                              party.affairCounts.condamnations + party.affairCounts.enCours && (
                              <span>
                                {party.affairCounts.total} affaire
                                {party.affairCounts.total > 1 ? "s" : ""}
                              </span>
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
            {historicalParties
              .filter((p) => p.slug)
              .map((party) => (
                <Link key={party.id} href={`/partis/${party.slug}`} prefetch={false}>
                  <Card className="h-full hover:shadow-md transition-shadow opacity-75 hover:opacity-100">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        {party.logoUrl ? (
                          <Image
                            src={party.logoUrl}
                            alt={party.name}
                            width={40}
                            height={40}
                            className="w-10 h-10 object-contain shrink-0"
                          />
                        ) : (
                          <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold text-white shrink-0"
                            style={{ backgroundColor: party.color || "#888" }}
                          >
                            {party.shortName.substring(0, 2)}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <h3 className="font-medium truncate">{party.name}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs" title={party.name}>
                              {party.shortName}
                            </Badge>
                            {party.dissolvedDate && (
                              <Badge variant="secondary" className="text-xs">
                                Dissous
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                            <span>{party._count.partyMemberships} anciens membres</span>
                            {party.affairCounts.condamnations > 0 && (
                              <span className="text-red-600 dark:text-red-400 font-medium">
                                {party.affairCounts.condamnations} condamnation
                                {party.affairCounts.condamnations > 1 ? "s" : ""}
                              </span>
                            )}
                            {party.affairCounts.enCours > 0 && (
                              <span className="text-amber-600 dark:text-amber-400">
                                {party.affairCounts.enCours} en cours
                              </span>
                            )}
                            {party.affairCounts.total > 0 &&
                              party.affairCounts.total !==
                                party.affairCounts.condamnations + party.affairCounts.enCours && (
                                <span>
                                  {party.affairCounts.total} affaire
                                  {party.affairCounts.total > 1 ? "s" : ""}
                                </span>
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
