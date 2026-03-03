/**
 * Enrich communes with official website URLs from Annuaire Service Public.
 *
 * Source: api-lannuaire.service-public.fr (Opendatasoft export API)
 * ~35K mairies, ~22K with a website. Matches on INSEE code (Commune.id).
 *
 * Uses the /exports/json endpoint to download the full dataset in one request
 * (Opendatasoft pagination caps at offset=10,000).
 *
 * Idempotent: safe to re-run, overwrites previous website values.
 *
 * Usage:
 *   npx dotenv -e .env -- npx tsx scripts/enrich-commune-websites.ts
 */

import { readFileSync, existsSync } from "fs";
import { execSync } from "child_process";
import { db } from "@/lib/db";

const EXPORT_URL =
  "https://api-lannuaire.service-public.fr/api/explore/v2.1/catalog/datasets/api-lannuaire-administration/exports/json?where=pivot+LIKE+%22mairie%22&select=code_insee_commune,site_internet";
const LOCAL_CACHE = "/tmp/mairies.json";
const BATCH_SIZE = 200;

interface AnnuaireRecord {
  code_insee_commune: string;
  // Opendatasoft returns JSON fields as stringified JSON
  site_internet: string | null;
}

// --- Download full dataset via export endpoint ---

async function fetchAllMairies(): Promise<Map<string, string>> {
  // Download via curl if not already cached (Node fetch gets 403 from Opendatasoft)
  if (!existsSync(LOCAL_CACHE)) {
    console.log("Downloading mairie dataset from Annuaire Service Public...");
    execSync(`curl -s -H "User-Agent: Poligraph/1.0" -o ${LOCAL_CACHE} '${EXPORT_URL}'`, {
      timeout: 120_000,
    });
  } else {
    console.log(`Using cached dataset: ${LOCAL_CACHE}`);
  }

  const records: AnnuaireRecord[] = JSON.parse(readFileSync(LOCAL_CACHE, "utf-8"));
  console.log(`Loaded ${records.length} mairie records`);

  const websites = new Map<string, string>();

  for (const record of records) {
    const insee = record.code_insee_commune;
    if (!insee || !record.site_internet) continue;

    // Parse the stringified JSON array
    let siteArr: Array<{ valeur: string }>;
    try {
      siteArr = JSON.parse(record.site_internet);
    } catch {
      continue;
    }

    if (!Array.isArray(siteArr) || siteArr.length === 0) continue;

    const rawUrl = siteArr[0]?.valeur?.trim();
    if (!rawUrl) continue;

    // Normalize URL
    let url = rawUrl;
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = "https://" + url;
    }
    url = url.replace(/\/+$/, "");

    // Skip obvious non-URLs
    if (url.length < 10 || !url.includes(".")) continue;

    // Keep first occurrence per INSEE code (some communes have multiple mairie entries)
    if (!websites.has(insee)) {
      websites.set(insee, url);
    }
  }

  return websites;
}

// --- Batch update communes ---

async function updateCommunes(websites: Map<string, string>): Promise<number> {
  const communes = await db.commune.findMany({ select: { id: true } });
  const communeIds = new Set(communes.map((c) => c.id));
  console.log(`\n${communeIds.size} communes in DB`);

  const toUpdate: Array<{ id: string; website: string }> = [];
  for (const [insee, url] of websites) {
    if (communeIds.has(insee)) {
      toUpdate.push({ id: insee, website: url });
    }
  }
  console.log(
    `${toUpdate.length} communes to update (${websites.size - toUpdate.length} skipped — not in DB)`
  );

  let updated = 0;
  for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
    const batch = toUpdate.slice(i, i + BATCH_SIZE);

    const values = batch.map((c) => `('${c.id}', '${c.website.replace(/'/g, "''")}')`).join(",");

    await db.$executeRawUnsafe(
      `UPDATE "Commune" SET "website" = v.website
       FROM (VALUES ${values}) AS v(id, website)
       WHERE "Commune"."id" = v.id`
    );

    updated += batch.length;

    if (updated % 5000 < BATCH_SIZE || i + BATCH_SIZE >= toUpdate.length) {
      console.log(`  Updated ${updated}/${toUpdate.length}`);
    }
  }

  return updated;
}

// --- Main ---

async function main() {
  console.log("=== Enrich communes with websites from Annuaire Service Public ===\n");

  const websites = await fetchAllMairies();
  console.log(`\nExtracted ${websites.size} unique commune websites`);

  const updated = await updateCommunes(websites);

  const withWebsite = await db.commune.count({ where: { website: { not: null } } });
  const total = await db.commune.count();

  console.log("\n=== Done ===");
  console.log(`  Updated: ${updated}`);
  console.log(`  Communes with website: ${withWebsite}/${total}`);
}

main()
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
