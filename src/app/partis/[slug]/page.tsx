import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { POLITICAL_POSITION_LABELS, POLITICAL_POSITION_COLORS } from "@/config/labels";
import { PoliticianAvatar } from "@/components/politicians/PoliticianAvatar";

interface PageProps {
  params: Promise<{ slug: string }>;
}

async function getParty(slug: string) {
  return db.party.findUnique({
    where: { slug },
    include: {
      // Current members
      politicians: {
        orderBy: { fullName: "asc" },
        include: {
          mandates: {
            where: { isCurrent: true },
            take: 1,
          },
        },
      },
      // Membership history (for people who were members but aren't currently)
      partyMemberships: {
        include: {
          politician: true,
        },
        orderBy: { startDate: "desc" },
      },
      // Affairs that happened when politician was in this party
      affairsAtTime: {
        include: {
          politician: true,
        },
        orderBy: { verdictDate: "desc" },
      },
      // Party evolution
      predecessor: true,
      successors: true,
      // External IDs
      externalIds: true,
    },
  });
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const party = await getParty(slug);

  if (!party) {
    return { title: "Parti non trouvé" };
  }

  return {
    title: `${party.name} (${party.shortName})`,
    description: `Fiche du parti ${party.name} - membres, historique, évolution`,
  };
}

export default async function PartyPage({ params }: PageProps) {
  const { slug } = await params;
  const party = await getParty(slug);

  if (!party) {
    notFound();
  }

  // Get all politicians who were ever in this party (current + historical)
  const currentMemberIds = new Set(party.politicians.map((p) => p.id));
  const historicalMembers = party.partyMemberships
    .filter((m) => !currentMemberIds.has(m.politicianId))
    .reduce((acc, m) => {
      // Deduplicate by politician
      if (!acc.find((x) => x.politician.id === m.politician.id)) {
        acc.push(m);
      }
      return acc;
    }, [] as typeof party.partyMemberships);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="text-sm text-muted-foreground mb-6">
        <Link href="/partis" className="hover:text-foreground">
          Partis
        </Link>
        <span className="mx-2">/</span>
        <span>{party.shortName}</span>
      </nav>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          {party.logoUrl ? (
            <img
              src={party.logoUrl}
              alt={party.name}
              className="w-16 h-16 object-contain"
            />
          ) : (
            <div
              className="w-16 h-16 rounded-lg flex items-center justify-center text-2xl font-bold text-white"
              style={{ backgroundColor: party.color || "#888" }}
            >
              {party.shortName.substring(0, 2)}
            </div>
          )}
          <div>
            <h1 className="text-3xl font-bold">{party.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge
                style={{
                  backgroundColor: party.color ? `${party.color}20` : undefined,
                  color: party.color || undefined,
                }}
              >
                {party.shortName}
              </Badge>
              {party.politicalPosition && (
                <Badge className={POLITICAL_POSITION_COLORS[party.politicalPosition]}>
                  {POLITICAL_POSITION_LABELS[party.politicalPosition]}
                </Badge>
              )}
              {party.dissolvedDate && (
                <Badge variant="outline" className="text-muted-foreground">
                  Dissous
                </Badge>
              )}
            </div>
          </div>
        </div>

        {party.description && (
          <p className="text-muted-foreground">{party.description}</p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-8">
          {/* Current members */}
          <Card>
            <CardHeader>
              <CardTitle>
                Membres actuels ({party.politicians.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {party.politicians.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {party.politicians.map((politician) => (
                    <Link
                      key={politician.id}
                      href={`/politiques/${politician.slug}`}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors"
                    >
                      <PoliticianAvatar
                        photoUrl={politician.photoUrl}
                        firstName={politician.firstName}
                        lastName={politician.lastName}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <p className="font-medium truncate">{politician.fullName}</p>
                        {politician.mandates[0] && (
                          <p className="text-xs text-muted-foreground truncate">
                            {politician.mandates[0].title}
                          </p>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">Aucun membre actuel</p>
              )}
            </CardContent>
          </Card>

          {/* Historical members */}
          {historicalMembers.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>
                  Anciens membres ({historicalMembers.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {historicalMembers.slice(0, 20).map((membership) => (
                    <Link
                      key={membership.id}
                      href={`/politiques/${membership.politician.slug}`}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-muted transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <PoliticianAvatar
                          photoUrl={membership.politician.photoUrl}
                          firstName={membership.politician.firstName}
                          lastName={membership.politician.lastName}
                          size="sm"
                        />
                        <span className="font-medium">
                          {membership.politician.fullName}
                        </span>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {formatDate(membership.startDate)}
                        {membership.endDate && ` - ${formatDate(membership.endDate)}`}
                      </span>
                    </Link>
                  ))}
                  {historicalMembers.length > 20 && (
                    <p className="text-sm text-muted-foreground text-center pt-2">
                      Et {historicalMembers.length - 20} autres...
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Affairs */}
          {party.affairsAtTime.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>
                  Affaires judiciaires ({party.affairsAtTime.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Affaires impliquant des membres du parti au moment des faits
                </p>
                <div className="space-y-3">
                  {party.affairsAtTime.slice(0, 10).map((affair) => (
                    <Link
                      key={affair.id}
                      href={`/politiques/${affair.politician.slug}`}
                      className="block p-3 rounded-lg border hover:bg-muted transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium">{affair.politician.fullName}</p>
                          <p className="text-sm text-muted-foreground">
                            {affair.title}
                          </p>
                        </div>
                        {affair.verdictDate && (
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {formatDate(affair.verdictDate)}
                          </span>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Informations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {party.foundedDate && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fondé</span>
                  <span className="font-semibold">{formatDate(party.foundedDate)}</span>
                </div>
              )}
              {party.dissolvedDate && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Dissous</span>
                  <span className="font-semibold">{formatDate(party.dissolvedDate)}</span>
                </div>
              )}
              {party.ideology && (
                <div>
                  <span className="text-muted-foreground block mb-1">Idéologie</span>
                  <span className="text-sm">{party.ideology}</span>
                </div>
              )}
              {party.headquarters && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Siège</span>
                  <span className="text-sm">{party.headquarters}</span>
                </div>
              )}
              {party.website && (
                <div>
                  <a
                    href={party.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Site officiel
                  </a>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Party evolution */}
          {(party.predecessor || party.successors.length > 0) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Évolution</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {party.predecessor && (
                  <div>
                    <span className="text-sm text-muted-foreground block mb-1">
                      Succède à
                    </span>
                    <Link
                      href={`/partis/${party.predecessor.slug}`}
                      className="inline-flex items-center gap-2 text-blue-600 hover:underline"
                    >
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: party.predecessor.color || "#888" }}
                      />
                      {party.predecessor.name}
                    </Link>
                  </div>
                )}
                {party.successors.length > 0 && (
                  <div>
                    <span className="text-sm text-muted-foreground block mb-1">
                      Précède
                    </span>
                    <div className="space-y-1">
                      {party.successors.map((successor) => (
                        <Link
                          key={successor.id}
                          href={`/partis/${successor.slug}`}
                          className="flex items-center gap-2 text-blue-600 hover:underline"
                        >
                          <span
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: successor.color || "#888" }}
                          />
                          {successor.name}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">En bref</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Membres actuels</span>
                <span className="font-semibold">{party.politicians.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Anciens membres</span>
                <span className="font-semibold">{historicalMembers.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Affaires</span>
                <span className="font-semibold">{party.affairsAtTime.length}</span>
              </div>
            </CardContent>
          </Card>

          {/* External links */}
          {party.externalIds.length > 0 && (
            <Card className="bg-gray-50">
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground mb-2">Liens externes</p>
                <div className="flex flex-wrap gap-2">
                  {party.externalIds.map((ext) => (
                    ext.url && (
                      <a
                        key={ext.id}
                        href={ext.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline"
                      >
                        {ext.source.replace("_", " ")}
                      </a>
                    )
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
