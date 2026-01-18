import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { AffairForm } from "@/components/admin/AffairForm";

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getAffair(id: string) {
  return db.affair.findUnique({
    where: { id },
    include: {
      politician: { select: { id: true, fullName: true } },
      sources: true,
    },
  });
}

async function getPoliticians() {
  return db.politician.findMany({
    select: { id: true, fullName: true, slug: true },
    orderBy: { lastName: "asc" },
  });
}

export default async function EditAffairPage({ params }: PageProps) {
  const { id } = await params;
  const [affair, politicians] = await Promise.all([
    getAffair(id),
    getPoliticians(),
  ]);

  if (!affair) {
    notFound();
  }

  // Format data for the form
  const initialData = {
    id: affair.id,
    politicianId: affair.politicianId,
    title: affair.title,
    description: affair.description,
    status: affair.status,
    category: affair.category,
    factsDate: affair.factsDate?.toISOString().split("T")[0],
    startDate: affair.startDate?.toISOString().split("T")[0],
    verdictDate: affair.verdictDate?.toISOString().split("T")[0],
    sentence: affair.sentence || undefined,
    appeal: affair.appeal,
    sources: affair.sources.map((s) => ({
      id: s.id,
      url: s.url,
      title: s.title,
      publisher: s.publisher,
      publishedAt: s.publishedAt.toISOString().split("T")[0],
      excerpt: s.excerpt || "",
    })),
  };

  return (
    <div className="max-w-3xl">
      <Link
        href={`/admin/affaires/${id}`}
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        &larr; Retour à l&apos;affaire
      </Link>
      <h1 className="text-2xl font-bold mt-2 mb-6">Modifier l&apos;affaire</h1>
      <AffairForm politicians={politicians} initialData={initialData} />
    </div>
  );
}
