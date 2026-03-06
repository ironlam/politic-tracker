/**
 * Enable the MON_DEPUTE_SECTION feature flag.
 *
 * Usage: npx dotenv -e .env -- npx tsx scripts/enable-mon-depute-flag.ts
 */

import "dotenv/config";
import { db } from "../src/lib/db";

async function main() {
  const result = await db.featureFlag.upsert({
    where: { name: "MON_DEPUTE_SECTION" },
    update: { enabled: true },
    create: {
      name: "MON_DEPUTE_SECTION",
      label: "Mon député — Recherche de représentants",
      description:
        "Active la page /mon-depute permettant de trouver son député et ses sénateurs par code postal ou géolocalisation",
      enabled: true,
    },
  });

  console.log(`Feature flag "${result.name}" is now ${result.enabled ? "ENABLED" : "DISABLED"}`);
  await db.$disconnect();
}

main().catch((error) => {
  console.error("Failed to enable feature flag:", error);
  db.$disconnect();
  process.exit(1);
});
