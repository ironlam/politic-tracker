import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { cacheTag, cacheLife } from "next/cache";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PoliticianAvatar } from "@/components/politicians/PoliticianAvatar";
import { BreadcrumbJsonLd, CollectionPageJsonLd } from "@/components/seo/JsonLd";
import { ensureContrast } from "@/lib/contrast";
import {
  AFFAIR_STATUS_LABELS,
  AFFAIR_STATUS_COLORS,
  AFFAIR_STATUS_NEEDS_PRESUMPTION,
  AFFAIR_SUPER_CATEGORY_LABELS,
  AFFAIR_SUPER_CATEGORY_COLORS,
  CATEGORY_TO_SUPER,
  INVOLVEMENT_LABELS,
  INVOLVEMENT_COLORS,
} from "@/config/labels";
import type { AffairCategory, AffairStatus, Involvement } from "@/types";

export const revalidate = 300;

interface PageProps {
  params: Promise<{ slug: string }>;
}

async function getPartyAffairsData(slug: string) {
  "use cache";
  cacheTag("affairs", "parties");
  cacheLife("minutes");

  const party = await db.party.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      shortName: true,
      slug: true,
      color: true,
      logoUrl: true,
      affairsAtTime: {
        where: { publicationStatus: "PUBLISHED" },
        include: {
          politician: {
            select: {
              id: true,
              fullName: true,
              slug: true,
              photoUrl: true,
            },
          },
        },
        orderBy: [
          { verdictDate: { sort: "desc", nulls: "last" } },
          { startDate: { sort: "desc", nulls: "last" } },
          { createdAt: "desc" },
        ],
      },
    },
  });

  if (!party) return null;

  const affairs = party.affairsAtTime;
  const totalAffairs = affairs.length;

  // Super-category breakdown
  const superCatCounts: Record<string, number> = {};
  for (const a of affairs) {
    const sc = CATEGORY_TO_SUPER[a.category as AffairCategory];
    superCatCounts[sc] = (superCatCounts[sc] || 0) + 1;
  }

  // Status counts
  const condamnations = affairs.filter(
    (a) => a.status === "CONDAMNATION_DEFINITIVE" || a.status === "CONDAMNATION_PREMIERE_INSTANCE"
  ).length;
  const enCours = affairs.filter((a) =>
    [
      "ENQUETE_PRELIMINAIRE",
      "INSTRUCTION",
      "MISE_EN_EXAMEN",
      "RENVOI_TRIBUNAL",
      "PROCES_EN_COURS",
      "APPEL_EN_COURS",
    ].includes(a.status)
  ).length;

  // Involved politicians deduplicated
  const polMap = new Map<
    string,
    {
      id: string;
      fullName: string;
      slug: string;
      photoUrl: string | null;
      count: number;
    }
  >();
  for (const a of affairs) {
    const p = a.politician;
    const existing = polMap.get(p.id);
    if (existing) {
      existing.count++;
    } else {
      polMap.set(p.id, { ...p, count: 1 });
    }
  }
  const involvedPoliticians = [...polMap.values()].sort((a, b) => b.count - a.count);

  return {
    party: {
      id: party.id,
      name: party.name,
      shortName: party.shortName,
      slug: party.slug,
      color: party.color,
      logoUrl: party.logoUrl,
    },
    affairs,
    totalAffairs,
    superCatCounts,
    condamnations,
    enCours,
    involvedPoliticians,
  };
}

export async function generateStaticParams() {
  const parties = await db.party.findMany({
    where: {
      slug: { not: null },
      affairsAtTime: { some: { publicationStatus: "PUBLISHED" } },
    },
    select: { slug: true },
  });
  return parties.filter((p) => p.slug).map((p) => ({ slug: p.slug as string }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await getPartyAffairsData(slug);

  if (!data) return { title: "Parti non trouvé" };

  const { party, totalAffairs, condamnations, enCours } = data;

  const parts: string[] = [];
  if (condamnations > 0) parts.push(`${condamnations} condamnation${condamnations > 1 ? "s" : ""}`);
  if (enCours > 0) parts.push(`${enCours} procédure${enCours > 1 ? "s" : ""} en cours`);

  const description = `${totalAffairs} affaire${totalAffairs > 1 ? "s" : ""} judiciaire${totalAffairs > 1 ? "s" : ""} impliquant des élus ${party.name}${parts.length > 0 ? `. ${parts.join(", ")}.` : "."} Sources vérifiées.`;

  return {
    title: `Affaires judiciaires — ${party.name} (${party.shortName})`,
    description,
    openGraph: {
      title: `Affaires judiciaires — ${party.name} (${party.shortName}) | Poligraph`,
      description,
      type: "website",
    },
  };
}

export default async function PartyAffairsPage({ params }: PageProps) {
  const { slug } = await params;
  const data = await getPartyAffairsData(slug);

  if (!data) notFound();

  const {
    party,
    affairs,
    totalAffairs,
    superCatCounts,
    condamnations,
    enCours,
    involvedPoliticians,
  } = data;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://poligraph.fr";

  // Build factual summary
  const summaryParts: string[] = [];
  summaryParts.push(
    `${party.name} est associé à ${totalAffairs} affaire${totalAffairs > 1 ? "s" : ""} judiciaire${totalAffairs > 1 ? "s" : ""} impliquant ${involvedPoliticians.length} élu${involvedPoliticians.length > 1 ? "s" : ""} ou ancien${involvedPoliticians.length > 1 ? "s" : ""} élu${involvedPoliticians.length > 1 ? "s" : ""}.`
  );
  if (condamnations > 0 || enCours > 0) {
    const statusParts: string[] = [];
    if (condamnations > 0)
      statusParts.push(`${condamnations} condamnation${condamnations > 1 ? "s" : ""}`);
    if (enCours > 0) statusParts.push(`${enCours} procédure${enCours > 1 ? "s" : ""} en cours`);
    summaryParts.push(statusParts.join(", ") + ".");
  }

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Accueil", url: siteUrl },
          { name: "Affaires judiciaires", url: `${siteUrl}/affaires` },
          {
            name: party.name,
            url: `${siteUrl}/affaires/parti/${party.slug}`,
          },
        ]}
      />
      <CollectionPageJsonLd
        name={`Affaires judiciaires — ${party.name}`}
        description={summaryParts.join(" ")}
        url={`${siteUrl}/affaires/parti/${party.slug}`}
        numberOfItems={totalAffairs}
        about={{
          name: party.name,
          url: `${siteUrl}/partis/${party.slug}`,
        }}
      />

      <div className="container mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <nav className="text-sm text-muted-foreground mb-6">
          <ol className="flex items-center gap-2">
            <li>
              <Link href="/" className="hover:text-foreground">
                Accueil
              </Link>
            </li>
            <li>/</li>
            <li>
              <Link href="/affaires" className="hover:text-foreground">
                Affaires judiciaires
              </Link>
            </li>
            <li>/</li>
            <li className="text-foreground">{party.shortName}</li>
          </ol>
        </nav>

        {/* Party header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            {party.logoUrl ? (
              <Image
                src={party.logoUrl}
                alt={party.name}
                width={64}
                height={64}
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
              <h1 className="text-3xl font-bold">Affaires judiciaires — {party.name}</h1>
              <div className="flex items-center gap-2 mt-1">
                <Badge
                  style={{
                    backgroundColor: party.color ? `${party.color}20` : undefined,
                    color: party.color ? ensureContrast(party.color, "#ffffff") : undefined,
                  }}
                >
                  {party.shortName}
                </Badge>
                <Link
                  href={`/partis/${party.slug}`}
                  className="text-sm text-blue-600 hover:underline"
                >
                  Voir la fiche du parti →
                </Link>
              </div>
            </div>
          </div>

          <p className="text-muted-foreground">{summaryParts.join(" ")}</p>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="text-3xl font-bold tabular-nums">{totalAffairs}</div>
              <div className="text-sm text-muted-foreground mt-1">Affaires</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="text-3xl font-bold tabular-nums">{involvedPoliticians.length}</div>
              <div className="text-sm text-muted-foreground mt-1">Élus impliqués</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="text-3xl font-bold tabular-nums text-red-600">{condamnations}</div>
              <div className="text-sm text-muted-foreground mt-1">Condamnations</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="text-3xl font-bold tabular-nums text-orange-600">{enCours}</div>
              <div className="text-sm text-muted-foreground mt-1">En cours</div>
            </CardContent>
          </Card>
        </div>

        {/* Super-category breakdown */}
        {Object.keys(superCatCounts).length > 0 && (
          <div className="flex flex-wrap gap-2 mb-8">
            {Object.entries(superCatCounts)
              .sort((a, b) => b[1] - a[1])
              .map(([key, count]) => (
                <Badge
                  key={key}
                  className={
                    AFFAIR_SUPER_CATEGORY_COLORS[key as keyof typeof AFFAIR_SUPER_CATEGORY_COLORS]
                  }
                >
                  {AFFAIR_SUPER_CATEGORY_LABELS[key as keyof typeof AFFAIR_SUPER_CATEGORY_LABELS]} (
                  {count})
                </Badge>
              ))}
          </div>
        )}

        {/* Involved politicians */}
        {involvedPoliticians.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Élus impliqués ({involvedPoliticians.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {involvedPoliticians.map((pol) => (
                  <Link
                    key={pol.id}
                    href={`/politiques/${pol.slug}`}
                    className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <PoliticianAvatar photoUrl={pol.photoUrl} fullName={pol.fullName} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{pol.fullName}</p>
                      <p className="text-xs text-muted-foreground">
                        {pol.count} affaire{pol.count > 1 ? "s" : ""}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Affairs list */}
        <Card>
          <CardHeader>
            <CardTitle>Toutes les affaires ({totalAffairs})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {affairs.map((affair) => {
                const superCat = CATEGORY_TO_SUPER[affair.category as AffairCategory];
                const relevantDate = affair.verdictDate || affair.startDate || affair.factsDate;
                return (
                  <div key={affair.id} className="border-b last:border-b-0 pb-4 last:pb-0">
                    <div className="flex items-start gap-2 mb-2 flex-wrap">
                      {relevantDate && (
                        <Badge variant="secondary" className="font-mono">
                          {new Date(relevantDate).getFullYear()}
                        </Badge>
                      )}
                      <Badge className={AFFAIR_SUPER_CATEGORY_COLORS[superCat]}>
                        {AFFAIR_SUPER_CATEGORY_LABELS[superCat]}
                      </Badge>
                      <Badge className={AFFAIR_STATUS_COLORS[affair.status as AffairStatus]}>
                        {AFFAIR_STATUS_LABELS[affair.status as AffairStatus]}
                      </Badge>
                      {affair.involvement !== "DIRECT" && (
                        <Badge className={INVOLVEMENT_COLORS[affair.involvement as Involvement]}>
                          {INVOLVEMENT_LABELS[affair.involvement as Involvement]}
                        </Badge>
                      )}
                    </div>
                    <Link
                      href={`/affaires/${affair.slug}`}
                      className="text-lg font-semibold hover:underline"
                    >
                      {affair.title}
                    </Link>
                    <div className="mt-1">
                      <Link
                        href={`/politiques/${affair.politician.slug}`}
                        className="text-sm text-blue-600 hover:underline"
                      >
                        {affair.politician.fullName}
                      </Link>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                      {affair.description}
                    </p>
                    {AFFAIR_STATUS_NEEDS_PRESUMPTION[affair.status as AffairStatus] && (
                      <p className="text-xs text-amber-700 bg-amber-50 p-2 rounded mt-2 inline-block">
                        Présomption d&apos;innocence : affaire en cours
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Back links */}
        <div className="mt-8 flex flex-wrap gap-4">
          <Link href={`/partis/${party.slug}`} className="text-sm text-blue-600 hover:underline">
            ← Fiche du parti {party.shortName}
          </Link>
          <Link href="/affaires" className="text-sm text-blue-600 hover:underline">
            ← Toutes les affaires
          </Link>
        </div>
      </div>
    </>
  );
}
