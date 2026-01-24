/**
 * CLI script to sync historical mandates from NosDéputés archives
 *
 * Sources:
 * - https://2017-2022.nosdeputes.fr/ (15e législature)
 * - https://2012-2017.nosdeputes.fr/ (14e législature)
 * - https://www.nosdeputes.fr/ (current - 16e/17e)
 *
 * Usage:
 *   npx tsx scripts/sync-mandate-history.ts              # Sync all legislatures
 *   npx tsx scripts/sync-mandate-history.ts --leg=15     # Sync specific legislature
 *   npx tsx scripts/sync-mandate-history.ts --stats      # Show current stats
 */

import "dotenv/config";
import https from "https";
import { db } from "../src/lib/db";
import { MandateType } from "../src/generated/prisma";
import { generateSlug } from "../src/lib/utils";

/**
 * Fetch JSON data using native https module (more reliable than fetch in some environments)
 */
function httpsGet(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const request = https.get(url, { timeout: 30000 }, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve(data));
    });
    request.on("error", reject);
    request.on("timeout", () => {
      request.destroy();
      reject(new Error("Request timeout"));
    });
  });
}

interface Legislature {
  number: number;
  label: string;
  baseUrl: string;
  startYear: number;
  endYear: number;
}

const LEGISLATURES: Legislature[] = [
  { number: 17, label: "17e législature", baseUrl: "https://www.nosdeputes.fr", startYear: 2024, endYear: 2029 },
  { number: 16, label: "16e législature", baseUrl: "https://2022-2024.nosdeputes.fr", startYear: 2022, endYear: 2024 },
  { number: 15, label: "15e législature", baseUrl: "https://2017-2022.nosdeputes.fr", startYear: 2017, endYear: 2022 },
  { number: 14, label: "14e législature", baseUrl: "https://2012-2017.nosdeputes.fr", startYear: 2012, endYear: 2017 },
];

interface NosDéputésDeputy {
  depute: {
    id: number;
    nom: string;
    nom_de_famille: string;
    prenom: string;
    sexe: string;
    date_naissance?: string;
    lieu_naissance?: string;
    num_deptmt?: string;
    nom_circo?: string;
    num_circo?: number;
    mandat_debut?: string;
    mandat_fin?: string;
    ancien_depute?: number;
    groupe_sigle?: string;
    slug?: string;
  };
}

interface SyncResult {
  legislature: number;
  deputiesFound: number;
  mandatesCreated: number;
  mandatesUpdated: number;
  errors: string[];
}

/**
 * Fetch all deputies for a legislature
 */
async function fetchDeputiesForLegislature(leg: Legislature): Promise<NosDéputésDeputy[]> {
  const url = `${leg.baseUrl}/deputes/json`;
  console.log(`  Fetching from ${url}...`);

  try {
    const data = await httpsGet(url);
    const json = JSON.parse(data);
    return json.deputes || [];
  } catch (error) {
    console.error(`  Failed to fetch: ${error}`);
    return [];
  }
}

/**
 * Find politician by name matching
 */
async function findPolitician(firstName: string, lastName: string) {
  // Try exact match first
  let politician = await db.politician.findFirst({
    where: {
      firstName: { equals: firstName, mode: "insensitive" },
      lastName: { equals: lastName, mode: "insensitive" },
    },
  });

  if (politician) return politician;

  // Try by slug
  const slug = generateSlug(`${firstName}-${lastName}`);
  politician = await db.politician.findUnique({ where: { slug } });

  if (politician) return politician;

  // Try fuzzy match with full name
  const fullName = `${firstName} ${lastName}`;
  politician = await db.politician.findFirst({
    where: {
      fullName: { equals: fullName, mode: "insensitive" },
    },
  });

  return politician;
}

/**
 * Sync mandates for a single legislature
 */
async function syncLegislature(leg: Legislature): Promise<SyncResult> {
  console.log(`\n📜 Syncing ${leg.label} (${leg.startYear}-${leg.endYear})...`);

  const result: SyncResult = {
    legislature: leg.number,
    deputiesFound: 0,
    mandatesCreated: 0,
    mandatesUpdated: 0,
    errors: [],
  };

  const deputies = await fetchDeputiesForLegislature(leg);
  result.deputiesFound = deputies.length;

  if (deputies.length === 0) {
    result.errors.push("No deputies found");
    return result;
  }

  console.log(`  Found ${deputies.length} deputies`);

  for (const { depute } of deputies) {
    try {
      // Find the politician in our database
      const politician = await findPolitician(depute.prenom, depute.nom_de_famille);

      if (!politician) {
        // Skip deputies not in our database (they may be from older times)
        continue;
      }

      // Parse mandate dates
      const mandateStart = depute.mandat_debut ? new Date(depute.mandat_debut) : null;
      const mandateEnd = depute.mandat_fin ? new Date(depute.mandat_fin) : null;

      if (!mandateStart) continue;

      // Build constituency string
      const constituency = depute.nom_circo && depute.num_circo
        ? `${depute.nom_circo} (${depute.num_circo}${depute.num_circo === 1 ? "ère" : "e"})`
        : depute.nom_circo || null;

      // Check if this mandate already exists (avoid duplicates)
      const existingMandate = await db.mandate.findFirst({
        where: {
          politicianId: politician.id,
          type: MandateType.DEPUTE,
          startDate: {
            gte: new Date(leg.startYear, 0, 1),
            lt: new Date(leg.endYear + 1, 0, 1),
          },
        },
      });

      const isCurrent = !mandateEnd || mandateEnd > new Date();

      if (existingMandate) {
        // Update existing mandate with more complete data
        await db.mandate.update({
          where: { id: existingMandate.id },
          data: {
            startDate: mandateStart,
            endDate: mandateEnd,
            isCurrent,
            constituency: constituency || existingMandate.constituency,
          },
        });
        result.mandatesUpdated++;
      } else {
        // Create new historical mandate
        await db.mandate.create({
          data: {
            politicianId: politician.id,
            type: MandateType.DEPUTE,
            title: `Député${depute.sexe === "F" ? "e" : ""} de la ${depute.num_circo}${depute.num_circo === 1 ? "ère" : "e"} circonscription`,
            institution: "Assemblée nationale",
            constituency,
            startDate: mandateStart,
            endDate: mandateEnd,
            isCurrent,
            externalId: String(depute.id),
            sourceUrl: `${leg.baseUrl}/${generateSlug(`${depute.prenom}-${depute.nom_de_famille}`)}`,
          },
        });
        result.mandatesCreated++;
      }
    } catch (error) {
      result.errors.push(`${depute.nom}: ${error}`);
    }
  }

  console.log(`  Created: ${result.mandatesCreated}, Updated: ${result.mandatesUpdated}`);
  return result;
}

/**
 * Show current mandate statistics
 */
async function showStats() {
  const total = await db.mandate.count();
  const current = await db.mandate.count({ where: { isCurrent: true } });
  const historical = await db.mandate.count({ where: { isCurrent: false } });

  const byType = await db.mandate.groupBy({
    by: ["type"],
    _count: true,
    orderBy: { _count: { type: "desc" } },
  });

  console.log("\n📊 Mandate Statistics:");
  console.log(`  Total mandates: ${total}`);
  console.log(`  Current: ${current}`);
  console.log(`  Historical: ${historical}`);
  console.log("\n  By type:");
  for (const t of byType) {
    console.log(`    ${t.type}: ${t._count}`);
  }

  // Check a sample politician
  const eric = await db.politician.findFirst({
    where: { lastName: { equals: "Coquerel", mode: "insensitive" } },
    include: { mandates: { orderBy: { startDate: "asc" } } },
  });

  if (eric) {
    console.log(`\n  Sample: ${eric.fullName}`);
    console.log(`    Mandates: ${eric.mandates.length}`);
    for (const m of eric.mandates) {
      const start = m.startDate?.toISOString().split("T")[0];
      const end = m.endDate?.toISOString().split("T")[0] || "En cours";
      console.log(`      - ${m.type}: ${start} → ${end}`);
    }
  }
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
Politic Tracker - Historical Mandate Sync

Usage:
  npx tsx scripts/sync-mandate-history.ts              Full sync (all legislatures)
  npx tsx scripts/sync-mandate-history.ts --leg=15     Sync specific legislature
  npx tsx scripts/sync-mandate-history.ts --stats      Show current statistics
  npx tsx scripts/sync-mandate-history.ts --help       Show this help

Legislatures:
  17: 2024-2029 (current)
  16: 2022-2024
  15: 2017-2022
  14: 2012-2017

Data source: NosDéputés.fr archives
    `);
    process.exit(0);
  }

  console.log("=".repeat(50));
  console.log("Politic Tracker - Historical Mandate Sync");
  console.log("=".repeat(50));

  if (args.includes("--stats")) {
    await showStats();
    process.exit(0);
  }

  const startTime = Date.now();

  // Parse --leg=N argument
  const legArg = args.find((a) => a.startsWith("--leg="));
  const targetLeg = legArg ? parseInt(legArg.split("=")[1], 10) : null;

  const legislaturesToSync = targetLeg
    ? LEGISLATURES.filter((l) => l.number === targetLeg)
    : LEGISLATURES.filter((l) => l.number < 17); // Skip current (already synced)

  if (legislaturesToSync.length === 0) {
    console.log("No legislatures to sync");
    process.exit(1);
  }

  const results: SyncResult[] = [];

  for (const leg of legislaturesToSync) {
    const result = await syncLegislature(leg);
    results.push(result);
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log("\n" + "=".repeat(50));
  console.log("Sync Results:");
  console.log("=".repeat(50));
  console.log(`Duration: ${duration}s\n`);

  for (const r of results) {
    console.log(`Legislature ${r.legislature}:`);
    console.log(`  Deputies found: ${r.deputiesFound}`);
    console.log(`  Mandates created: ${r.mandatesCreated}`);
    console.log(`  Mandates updated: ${r.mandatesUpdated}`);
    if (r.errors.length > 0) {
      console.log(`  Errors: ${r.errors.length}`);
    }
  }

  const totalCreated = results.reduce((sum, r) => sum + r.mandatesCreated, 0);
  const totalUpdated = results.reduce((sum, r) => sum + r.mandatesUpdated, 0);

  console.log(`\nTotal: ${totalCreated} created, ${totalUpdated} updated`);

  await showStats();

  console.log("\n" + "=".repeat(50));
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
