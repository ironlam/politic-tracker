import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PoliticianAvatar } from "@/components/politicians/PoliticianAvatar";
interface PageProps {
  params: Promise<{ name: string }>;
}

async function getDeputiesByDepartment(departmentName: string) {
  return db.politician.findMany({
    where: {
      mandates: {
        some: {
          type: "DEPUTE",
          isCurrent: true,
          constituency: {
            startsWith: departmentName,
            mode: "insensitive",
          },
        },
      },
    },
    include: {
      currentParty: true,
      mandates: {
        where: {
          type: "DEPUTE",
          isCurrent: true,
        },
        select: {
          constituency: true,
        },
        take: 1,
      },
    },
    orderBy: { lastName: "asc" },
  });
}

async function getSenatorsByDepartment(departmentName: string) {
  return db.politician.findMany({
    where: {
      mandates: {
        some: {
          type: "SENATEUR",
          isCurrent: true,
          constituency: {
            contains: departmentName,
            mode: "insensitive",
          },
        },
      },
    },
    include: {
      currentParty: true,
      mandates: {
        where: {
          type: "SENATEUR",
          isCurrent: true,
        },
        select: {
          constituency: true,
        },
        take: 1,
      },
    },
    orderBy: { lastName: "asc" },
  });
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { name } = await params;
  const departmentName = decodeURIComponent(name);

  return {
    title: departmentName,
    description: `Députés et sénateurs du département ${departmentName}. Liste complète des représentants politiques.`,
    openGraph: {
      title: `${departmentName} | Transparence Politique`,
      description: `Découvrez les députés et sénateurs du département ${departmentName}.`,
    },
  };
}

export default async function DepartmentPage({ params }: PageProps) {
  const { name } = await params;
  const departmentName = decodeURIComponent(name);

  const [deputies, senators] = await Promise.all([
    getDeputiesByDepartment(departmentName),
    getSenatorsByDepartment(departmentName),
  ]);

  if (deputies.length === 0 && senators.length === 0) {
    notFound();
  }

  // Sort deputies by constituency number
  deputies.sort((a, b) => {
    const numA = a.mandates[0]?.constituency?.match(/\((\d+)\)/)?.[1];
    const numB = b.mandates[0]?.constituency?.match(/\((\d+)\)/)?.[1];
    if (numA && numB) {
      return parseInt(numA) - parseInt(numB);
    }
    return 0;
  });

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="text-sm text-muted-foreground mb-6">
        <Link href="/departements" className="hover:text-foreground">
          Départements
        </Link>
        <span className="mx-2">/</span>
        <span>{departmentName}</span>
      </nav>

      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">{departmentName}</h1>
        <p className="text-muted-foreground">
          {deputies.length} député{deputies.length > 1 ? "s" : ""} · {senators.length} sénateur
          {senators.length > 1 ? "s" : ""}
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Deputies */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span>Députés</span>
              <Badge variant="outline">{deputies.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {deputies.length > 0 ? (
              <div className="space-y-3">
                {deputies.map((deputy) => (
                  <Link
                    key={deputy.id}
                    href={`/politiques/${deputy.slug}`}
                    className="flex items-center gap-3 p-2 -mx-2 rounded-lg hover:bg-muted transition-colors group"
                  >
                    <PoliticianAvatar
                      photoUrl={deputy.photoUrl}
                      firstName={deputy.firstName}
                      lastName={deputy.lastName}
                      size="sm"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium group-hover:text-primary transition-colors truncate">
                        {deputy.fullName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {deputy.mandates[0]?.constituency || "Député"}
                      </p>
                    </div>
                    {deputy.currentParty && (
                      <Badge
                        variant="secondary"
                        className="shrink-0 text-xs"
                        style={{
                          backgroundColor: deputy.currentParty.color
                            ? `${deputy.currentParty.color}15`
                            : undefined,
                          color: deputy.currentParty.color || undefined,
                        }}
                      >
                        {deputy.currentParty.shortName}
                      </Badge>
                    )}
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">
                Aucun député enregistré pour ce département.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Senators */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span>Sénateurs</span>
              <Badge variant="outline">{senators.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {senators.length > 0 ? (
              <div className="space-y-3">
                {senators.map((senator) => (
                  <Link
                    key={senator.id}
                    href={`/politiques/${senator.slug}`}
                    className="flex items-center gap-3 p-2 -mx-2 rounded-lg hover:bg-muted transition-colors group"
                  >
                    <PoliticianAvatar
                      photoUrl={senator.photoUrl}
                      firstName={senator.firstName}
                      lastName={senator.lastName}
                      size="sm"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium group-hover:text-primary transition-colors truncate">
                        {senator.fullName}
                      </p>
                      <p className="text-xs text-muted-foreground">Sénateur</p>
                    </div>
                    {senator.currentParty && (
                      <Badge
                        variant="secondary"
                        className="shrink-0 text-xs"
                        style={{
                          backgroundColor: senator.currentParty.color
                            ? `${senator.currentParty.color}15`
                            : undefined,
                          color: senator.currentParty.color || undefined,
                        }}
                      >
                        {senator.currentParty.shortName}
                      </Badge>
                    )}
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">
                Aucun sénateur enregistré pour ce département.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Back link */}
      <div className="mt-8">
        <Link href="/departements" className="text-sm text-muted-foreground hover:text-foreground">
          ← Retour à la liste des départements
        </Link>
      </div>
    </div>
  );
}
