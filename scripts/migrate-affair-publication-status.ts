import "dotenv/config";
import { db } from "@/lib/db";

async function main() {
  // Affairs with [À VÉRIFIER] prefix → DRAFT
  const draft = await db.affair.updateMany({
    where: { title: { startsWith: "[À VÉRIFIER]" } },
    data: { publicationStatus: "DRAFT" },
  });
  console.log(`Set ${draft.count} affairs to DRAFT`);

  // Clean up title prefix
  const drafts = await db.affair.findMany({
    where: { title: { startsWith: "[À VÉRIFIER]" } },
    select: { id: true, title: true },
  });
  for (const a of drafts) {
    await db.affair.update({
      where: { id: a.id },
      data: { title: a.title.replace(/^\[À VÉRIFIER\]\s*/, "") },
    });
  }
  console.log(`Cleaned ${drafts.length} titles`);

  // All other affairs → PUBLISHED
  const published = await db.affair.updateMany({
    where: { publicationStatus: "DRAFT", title: { not: { startsWith: "[À VÉRIFIER]" } } },
    data: { publicationStatus: "PUBLISHED" },
  });
  console.log(`Set ${published.count} affairs to PUBLISHED`);

  // Seed feature flags
  const flags = [
    {
      name: "ELECTION_BANNER",
      label: "Bannière élection",
      enabled: true,
      value: { slug: "municipales-2026" },
    },
    { name: "ELECTION_GUIDE_SECTION", label: "Guide pratique élections", enabled: true },
    { name: "CHATBOT_ENABLED", label: "Chatbot IA", enabled: true },
    { name: "PRESS_SECTION", label: "Section presse", enabled: true },
    { name: "COMPARISON_TOOL", label: "Outil de comparaison", enabled: true },
  ];
  for (const flag of flags) {
    await db.featureFlag.upsert({
      where: { name: flag.name },
      create: flag,
      update: flag,
    });
  }
  console.log(`Seeded ${flags.length} feature flags`);

  process.exit(0);
}
main();
