import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { RelationsClient } from "./RelationsClient";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const politician = await db.politician.findUnique({
    where: { slug },
    select: { fullName: true },
  });

  if (!politician) {
    return { title: "Non trouvé" };
  }

  return {
    title: `Relations de ${politician.fullName} | Poligraph`,
    description: `Découvrez les relations politiques de ${politician.fullName} : collègues de parti, de gouvernement, de législature.`,
  };
}

export default async function RelationsPage({ params }: PageProps) {
  const { slug } = await params;

  const politician = await db.politician.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      fullName: true,
      photoUrl: true,
      currentParty: {
        select: { shortName: true, color: true },
      },
    },
  });

  if (!politician) {
    notFound();
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="text-sm text-muted-foreground mb-6">
        <ol className="flex items-center gap-2">
          <li>
            <Link href="/politiques" className="hover:text-foreground">
              Représentants
            </Link>
          </li>
          <li>/</li>
          <li>
            <Link href={`/politiques/${slug}`} className="hover:text-foreground">
              {politician.fullName}
            </Link>
          </li>
          <li>/</li>
          <li className="text-foreground">Relations</li>
        </ol>
      </nav>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Relations de {politician.fullName}</h1>
        <p className="text-muted-foreground">
          Visualisez les connexions politiques : collègues de parti, de gouvernement, de législature
        </p>
      </div>

      {/* Client component with graph */}
      <RelationsClient slug={slug} politicianName={politician.fullName} />
    </div>
  );
}
