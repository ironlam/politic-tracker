/**
 * Seed feature flags for launch configuration.
 * Idempotent: only creates flags that don't already exist.
 *
 * Usage: npx tsx scripts/seed-feature-flags.ts
 */
import "dotenv/config";
import { PrismaClient } from "@/generated/prisma";

const db = new PrismaClient();

const FLAGS = [
  // Disabled for launch — non-core features
  { name: "CHATBOT_ENABLED", label: "Assistant IA", enabled: false },
  { name: "PRESS_SECTION", label: "Revue de presse", enabled: false },
  { name: "COMPARISON_TOOL", label: "Outil de comparaison", enabled: false },
  { name: "STATISTIQUES_SECTION", label: "Statistiques", enabled: true },
  { name: "INSTITUTIONS_SECTION", label: "Institutions", enabled: false },
  { name: "ASSEMBLEE_SECTION", label: "Dossiers législatifs", enabled: false },
  // Enabled for launch — core features
  { name: "ELECTION_BANNER", label: "Bannière élection", enabled: true },
  { name: "ELECTION_GUIDE_SECTION", label: "Guide pratique élections", enabled: true },
];

async function main() {
  for (const flag of FLAGS) {
    const existing = await db.featureFlag.findUnique({ where: { name: flag.name } });
    if (existing) {
      console.log(`  ✓ ${flag.name} already exists (enabled: ${existing.enabled})`);
    } else {
      await db.featureFlag.create({ data: flag });
      console.log(`  + ${flag.name} created (enabled: ${flag.enabled})`);
    }
  }
  console.log("\nDone.");
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
