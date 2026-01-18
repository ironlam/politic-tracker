import { db } from "@/lib/db";
import { AffairForm } from "@/components/admin/AffairForm";

async function getPoliticians() {
  return db.politician.findMany({
    select: { id: true, fullName: true, slug: true },
    orderBy: { lastName: "asc" },
  });
}

export default async function NewAffairPage() {
  const politicians = await getPoliticians();

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold mb-6">Nouvelle affaire judiciaire</h1>
      <AffairForm politicians={politicians} />
    </div>
  );
}
