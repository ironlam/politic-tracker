/**
 * Backfill publicId (PG-XXXXXX) on all existing politicians.
 * Run: npx dotenv -e .env -- npx tsx scripts/backfill-public-ids.ts
 */
import { db } from "@/lib/db";

async function main() {
  // Get all politicians ordered by creation date (earliest first)
  const politicians = await db.politician.findMany({
    where: { publicId: null },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });

  console.log(`Found ${politicians.length} politicians without publicId`);

  if (politicians.length === 0) {
    console.log("Nothing to do.");
    await db.$disconnect();
    return;
  }

  // Find current max publicId to continue sequence
  const maxExisting = await db.politician.findFirst({
    where: { publicId: { not: null } },
    orderBy: { publicId: "desc" },
    select: { publicId: true },
  });

  let counter = maxExisting?.publicId
    ? parseInt(maxExisting.publicId.replace("PG-", ""), 10) + 1
    : 1;

  // Batch update in chunks of 100
  for (let i = 0; i < politicians.length; i += 100) {
    const chunk = politicians.slice(i, i + 100);
    await Promise.all(
      chunk.map((p) => {
        const publicId = `PG-${String(counter++).padStart(6, "0")}`;
        return db.politician.update({
          where: { id: p.id },
          data: { publicId },
        });
      })
    );
    console.log(`Updated ${Math.min(i + 100, politicians.length)}/${politicians.length}`);
  }

  console.log(`Done. Last publicId: PG-${String(counter - 1).padStart(6, "0")}`);
  await db.$disconnect();
}

main();
