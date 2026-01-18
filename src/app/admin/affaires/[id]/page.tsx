import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AFFAIR_STATUS_LABELS,
  AFFAIR_STATUS_COLORS,
  AFFAIR_CATEGORY_LABELS,
  AFFAIR_STATUS_NEEDS_PRESUMPTION,
} from "@/config/labels";
import { formatDate } from "@/lib/utils";

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getAffair(id: string) {
  return db.affair.findUnique({
    where: { id },
    include: {
      politician: { select: { id: true, fullName: true, slug: true } },
      sources: { orderBy: { publishedAt: "desc" } },
    },
  });
}

export default async function AdminAffairDetailPage({ params }: PageProps) {
  const { id } = await params;
  const affair = await getAffair(id);

  if (!affair) {
    notFound();
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/admin/affaires"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            &larr; Retour aux affaires
          </Link>
          <h1 className="text-2xl font-bold mt-2">{affair.title}</h1>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link href={`/admin/affaires/${affair.id}/edit`}>Modifier</Link>
          </Button>
          <DeleteButton id={affair.id} />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Politique</p>
              <Link
                href={`/politiques/${affair.politician.slug}`}
                className="font-medium text-blue-600 hover:underline"
              >
                {affair.politician.fullName}
              </Link>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Catégorie</p>
              <p className="font-medium">
                {AFFAIR_CATEGORY_LABELS[affair.category]}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Statut</p>
              <Badge className={AFFAIR_STATUS_COLORS[affair.status]}>
                {AFFAIR_STATUS_LABELS[affair.status]}
              </Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Slug</p>
              <p className="font-mono text-sm">{affair.slug}</p>
            </div>
          </div>

          {AFFAIR_STATUS_NEEDS_PRESUMPTION[affair.status] && (
            <div className="bg-amber-50 text-amber-800 p-3 rounded-md text-sm">
              Cette affaire est en cours. La présomption d&apos;innocence
              s&apos;applique.
            </div>
          )}

          <div>
            <p className="text-sm text-muted-foreground mb-1">Description</p>
            <p className="whitespace-pre-wrap">{affair.description}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Chronologie</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-3 gap-4">
            <div>
              <dt className="text-sm text-muted-foreground">Date des faits</dt>
              <dd className="font-medium">
                {affair.factsDate ? formatDate(affair.factsDate) : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">
                Date de révélation
              </dt>
              <dd className="font-medium">
                {affair.startDate ? formatDate(affair.startDate) : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Date du verdict</dt>
              <dd className="font-medium">
                {affair.verdictDate ? formatDate(affair.verdictDate) : "—"}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {(affair.sentence || affair.appeal) && (
        <Card>
          <CardHeader>
            <CardTitle>Condamnation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {affair.sentence && (
              <div>
                <p className="text-sm text-muted-foreground">Peine prononcée</p>
                <p className="font-medium">{affair.sentence}</p>
              </div>
            )}
            {affair.appeal && (
              <Badge variant="outline">Appel en cours</Badge>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Sources ({affair.sources.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-4">
            {affair.sources.map((source) => (
              <li key={source.id} className="border-b pb-4 last:border-0">
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-blue-600 hover:underline"
                >
                  {source.title}
                </a>
                <p className="text-sm text-muted-foreground">
                  {source.publisher} &bull; {formatDate(source.publishedAt)}
                </p>
                {source.excerpt && (
                  <blockquote className="mt-2 text-sm italic text-muted-foreground border-l-2 pl-3">
                    {source.excerpt}
                  </blockquote>
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card className="bg-gray-50">
        <CardContent className="pt-6">
          <p className="text-xs text-muted-foreground">
            Créée le {formatDate(affair.createdAt)} &bull; Mise à jour le{" "}
            {formatDate(affair.updatedAt)}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function DeleteButton({ id }: { id: string }) {
  return (
    <form
      action={async () => {
        "use server";
        const { isAuthenticated } = await import("@/lib/auth");
        const { redirect } = await import("next/navigation");
        const { db } = await import("@/lib/db");

        const authenticated = await isAuthenticated();
        if (!authenticated) {
          redirect("/admin/login");
        }

        await db.affair.delete({ where: { id } });
        redirect("/admin/affaires");
      }}
    >
      <Button type="submit" variant="destructive">
        Supprimer
      </Button>
    </form>
  );
}
