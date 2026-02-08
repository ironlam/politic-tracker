import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { PoliticianForm } from "@/components/admin/PoliticianForm";

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getPolitician(id: string) {
  return db.politician.findUnique({
    where: { id },
    include: {
      externalIds: {
        orderBy: { source: "asc" },
      },
    },
  });
}

async function getParties() {
  return db.party.findMany({
    select: { id: true, name: true, shortName: true },
    orderBy: { shortName: "asc" },
  });
}

export default async function EditPoliticianPage({ params }: PageProps) {
  const { id } = await params;
  const [politician, parties] = await Promise.all([getPolitician(id), getParties()]);

  if (!politician) {
    notFound();
  }

  const initialData = {
    id: politician.id,
    slug: politician.slug,
    civility: politician.civility,
    firstName: politician.firstName,
    lastName: politician.lastName,
    fullName: politician.fullName,
    birthDate: politician.birthDate ? politician.birthDate.toISOString().split("T")[0] : null,
    birthPlace: politician.birthPlace,
    photoUrl: politician.photoUrl,
    photoSource: politician.photoSource,
    currentPartyId: politician.currentPartyId,
    externalIds: politician.externalIds.map((e) => ({
      id: e.id,
      source: e.source,
      externalId: e.externalId,
      url: e.url || undefined,
    })),
  };

  return (
    <div className="max-w-3xl">
      <Link
        href={`/admin/politiques/${id}`}
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        &larr; Retour à la fiche
      </Link>
      <h1 className="text-2xl font-bold mt-2 mb-6">Modifier : {politician.fullName}</h1>
      <PoliticianForm initialData={initialData} parties={parties} />
    </div>
  );
}
