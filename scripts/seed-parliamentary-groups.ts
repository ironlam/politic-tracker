/**
 * Seed parliamentary groups from configuration
 *
 * Creates ParliamentaryGroup records and resolves defaultPartyId
 * by looking up the party's Wikidata Q-ID in ExternalId.
 *
 * Usage:
 *   npx tsx scripts/seed-parliamentary-groups.ts
 *   npx tsx scripts/seed-parliamentary-groups.ts --dry-run
 */

import "dotenv/config";
import { db } from "../src/lib/db";
import { DataSource, Chamber } from "../src/generated/prisma";
import {
  getAllGroupConfigs,
  type ParliamentaryGroupConfig,
} from "../src/config/parliamentaryGroups";

const dryRun = process.argv.includes("--dry-run");

async function resolvePartyByWikidata(wikidataId: string): Promise<string | null> {
  const extId = await db.externalId.findFirst({
    where: {
      source: DataSource.WIKIDATA,
      externalId: wikidataId,
      partyId: { not: null },
    },
    select: { partyId: true },
  });
  return extId?.partyId ?? null;
}

async function seedGroups(
  configs: ParliamentaryGroupConfig[],
  chamber: Chamber
): Promise<{ created: number; updated: number; partyLinked: number }> {
  let created = 0;
  let updated = 0;
  let partyLinked = 0;

  for (const config of configs) {
    // Resolve default party if we have a Wikidata ID
    let defaultPartyId: string | null = null;
    if (config.partyWikidataId) {
      defaultPartyId = await resolvePartyByWikidata(config.partyWikidataId);
      if (defaultPartyId) {
        partyLinked++;
      } else {
        console.warn(
          `  [WARN] Party not found for group ${config.code} (Wikidata: ${config.partyWikidataId})`
        );
      }
    }

    const groupData = {
      name: config.name,
      shortName: config.shortName || null,
      color: config.color,
      chamber,
      politicalPosition: config.politicalPosition || null,
      wikidataId: config.wikidataId || null,
      defaultPartyId,
    };

    if (dryRun) {
      const existing = await db.parliamentaryGroup.findUnique({
        where: { code_chamber: { code: config.code, chamber } },
      });
      console.log(
        `  [DRY-RUN] ${existing ? "UPDATE" : "CREATE"} ${config.code} (${config.name})` +
          (defaultPartyId ? ` → party ${defaultPartyId}` : "")
      );
      if (!existing) created++;
      else updated++;
      continue;
    }

    const existing = await db.parliamentaryGroup.findUnique({
      where: { code_chamber: { code: config.code, chamber } },
    });

    if (existing) {
      await db.parliamentaryGroup.update({
        where: { id: existing.id },
        data: groupData,
      });
      updated++;
    } else {
      await db.parliamentaryGroup.create({
        data: {
          code: config.code,
          ...groupData,
        },
      });
      created++;
    }
  }

  return { created, updated, partyLinked };
}

async function main() {
  console.log("Seeding parliamentary groups...");
  if (dryRun) console.log("[DRY-RUN MODE]\n");

  // Assemblée nationale
  console.log("Assemblée nationale:");
  const anConfigs = getAllGroupConfigs("AN");
  const anResult = await seedGroups(anConfigs, Chamber.AN);
  console.log(
    `  Created: ${anResult.created}, Updated: ${anResult.updated}, Party linked: ${anResult.partyLinked}`
  );

  // Sénat
  console.log("\nSénat:");
  const senatConfigs = getAllGroupConfigs("SENAT");
  const senatResult = await seedGroups(senatConfigs, Chamber.SENAT);
  console.log(
    `  Created: ${senatResult.created}, Updated: ${senatResult.updated}, Party linked: ${senatResult.partyLinked}`
  );

  // Summary
  const totalCreated = anResult.created + senatResult.created;
  const totalUpdated = anResult.updated + senatResult.updated;
  const totalLinked = anResult.partyLinked + senatResult.partyLinked;
  console.log(
    `\nTotal: ${totalCreated} created, ${totalUpdated} updated, ${totalLinked} party links resolved`
  );

  process.exit(0);
}

main().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
