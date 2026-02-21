import Image from "next/image";
import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PoliticianAvatar } from "@/components/politicians/PoliticianAvatar";
import { normalizeImageUrl } from "@/lib/utils";
import {
  DATA_SOURCE_LABELS,
  AFFAIR_STATUS_LABELS,
  AFFAIR_STATUS_COLORS,
  AFFAIR_CATEGORY_LABELS,
  MANDATE_TYPE_LABELS,
} from "@/config/labels";
import { MandateUrlEditor } from "@/components/admin/MandateUrlEditor";
import { SyncPanel } from "@/components/admin/SyncPanel";
import { DuplicateDetector } from "@/components/admin/DuplicateDetector";
import { ensureContrast } from "@/lib/contrast";
import type { AffairStatus, AffairCategory, MandateType } from "@/types";

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
        orderBy: [{ isCurrent: "desc" }, { startDate: "desc" }],
        select: {
          id: true,
          type: true,
          title: true,
          institution: true,
          isCurrent: true,
          startDate: true,
          endDate: true,
          officialUrl: true,
          sourceUrl: true,
        },
      },
      affairs: {
        orderBy: { verdictDate: "desc" },
        select: {
          id: true,
          title: true,
          slug: true,
          status: true,
          category: true,
          verdictDate: true,
          startDate: true,
          factsDate: true,
        },
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
        <PoliticianAvatar photoUrl={politician.photoUrl} fullName={politician.fullName} size="xl" />
        <div>
          <h1 className="text-2xl font-bold">{politician.fullName}</h1>
          {politician.currentParty && (
            <Badge
              variant="secondary"
              style={{
                backgroundColor: politician.currentParty.color
                  ? `${politician.currentParty.color}20`
                  : undefined,
                color: politician.currentParty.color
                  ? ensureContrast(politician.currentParty.color, "#ffffff")
                  : undefined,
              }}
              title={politician.currentParty.name}
            >
              {politician.currentParty.shortName}
            </Badge>
          )}
          {politician.mandates.find((m) => m.isCurrent) && (
            <p className="text-muted-foreground mt-1">
              {politician.mandates.find((m) => m.isCurrent)!.title}
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
              <span className="font-mono text-xs break-all">{politician.photoUrl || "—"}</span>

              <span className="text-muted-foreground">Source</span>
              <span>{politician.photoSource || "—"}</span>
            </div>
            {politician.photoUrl && (
              <div className="mt-4">
                <Image
                  src={normalizeImageUrl(politician.photoUrl) || ""}
                  alt={politician.fullName}
                  width={128}
                  height={128}
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
                      <th scope="col" className="text-left pb-2 font-medium">
                        Source
                      </th>
                      <th scope="col" className="text-left pb-2 font-medium">
                        ID
                      </th>
                      <th scope="col" className="text-left pb-2 font-medium">
                        URL
                      </th>
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

      {/* Mandats */}
      <Card>
        <CardHeader>
          <CardTitle>Mandats ({politician.mandates.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {politician.mandates.length > 0 ? (
            <div className="space-y-4">
              {politician.mandates.map((mandate) => {
                const start = new Date(mandate.startDate).toLocaleDateString("fr-FR");
                const end = mandate.endDate
                  ? new Date(mandate.endDate).toLocaleDateString("fr-FR")
                  : "en cours";
                return (
                  <div key={mandate.id} className="border p-4 rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {mandate.isCurrent && (
                          <Badge variant="default" className="text-xs">
                            Actif
                          </Badge>
                        )}
                        <Badge variant="outline">
                          {MANDATE_TYPE_LABELS[mandate.type as MandateType] || mandate.type}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {start} — {end}
                      </span>
                    </div>
                    <p className="text-sm font-medium">{mandate.title}</p>
                    <p className="text-xs text-muted-foreground">{mandate.institution}</p>
                    <MandateUrlEditor
                      mandateId={mandate.id}
                      officialUrl={mandate.officialUrl}
                      sourceUrl={mandate.sourceUrl}
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-4">Aucun mandat enregistré.</p>
          )}
        </CardContent>
      </Card>

      {/* Affaires judiciaires */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Affaires judiciaires ({politician.affairs.length})</CardTitle>
          <Button asChild size="sm">
            <Link href={`/admin/affaires/nouveau?politicianId=${politician.id}`}>+ Ajouter</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {politician.affairs.length > 0 ? (
            <div className="space-y-3">
              {politician.affairs.map((affair) => {
                const date = affair.verdictDate || affair.startDate || affair.factsDate;
                const year = date ? new Date(date).getFullYear() : null;
                return (
                  <div
                    key={affair.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {year && (
                          <Badge variant="outline" className="font-mono">
                            {year}
                          </Badge>
                        )}
                        <span className="font-medium truncate">{affair.title}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge
                          variant="secondary"
                          className={AFFAIR_STATUS_COLORS[affair.status as AffairStatus]}
                        >
                          {AFFAIR_STATUS_LABELS[affair.status as AffairStatus]}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {AFFAIR_CATEGORY_LABELS[affair.category as AffairCategory]}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/admin/affaires/${affair.id}`}>Voir</Link>
                      </Button>
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/admin/affaires/${affair.id}/edit`}>Modifier</Link>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-4">
              Aucune affaire documentée pour ce représentant politique.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Détection de doublons */}
      <DuplicateDetector politicianId={politician.id} affairCount={politician.affairs.length} />

      {/* Synchronisation */}
      <SyncPanel politicianId={politician.id} affairCount={politician.affairs.length} />

      {/* Actions rapides */}
      <Card>
        <CardHeader>
          <CardTitle>Actions rapides</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4">
          <Button variant="outline" asChild>
            <Link href={`/politiques/${politician.slug}`} target="_blank">
              Voir la page publique
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/affaires?politician=${politician.slug}`} target="_blank">
              Voir les affaires (public)
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
