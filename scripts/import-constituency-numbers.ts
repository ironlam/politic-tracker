/**
 * Import constituency numbers from INSEE circo_composition data
 *
 * Source: INSEE "Portraits des circonscriptions législatives" — circo_composition.xlsx
 * Maps COMMUNE_RESID (INSEE code) → circo (department + constituency number)
 *
 * Usage:
 *   npx dotenv -e .env -- npx tsx scripts/import-constituency-numbers.ts           # Full import
 *   npx dotenv -e .env -- npx tsx scripts/import-constituency-numbers.ts --dry-run  # Preview
 *   npx dotenv -e .env -- npx tsx scripts/import-constituency-numbers.ts --stats    # Current DB stats
 *   npx dotenv -e .env -- npx tsx scripts/import-constituency-numbers.ts --verbose  # Verbose output
 */

import "dotenv/config";
import { db } from "../src/lib/db";
import { Prisma } from "../src/generated/prisma";
import * as XLSX from "xlsx";
import { tmpdir } from "os";
import { join } from "path";
import { writeFile } from "fs/promises";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// INSEE "Portraits des circonscriptions législatives" — composition table
const CIRCO_COMPOSITION_URL =
  "https://www.insee.fr/fr/statistiques/fichier/6436476/circo_composition.xlsx";

const BATCH_SIZE = 500;

// ---------------------------------------------------------------------------
// CLI Flags
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const STATS_ONLY = args.includes("--stats");
const VERBOSE = args.includes("--verbose");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function log(msg: string) {
  console.log(msg);
}

function verbose(msg: string) {
  if (VERBOSE) console.log(`  [verbose] ${msg}`);
}

/**
 * Extract constituency number from circo code.
 * Format: department code (2-3 chars) + constituency number (zero-padded).
 * Examples: "01004" → dept "01", circo 4; "97105" → dept "971", circo 5; "2A002" → dept "2A", circo 2
 */
function parseCircoCode(circoCode: string, deptCode: string): number | null {
  if (!circoCode || !deptCode) return null;
  const circo = circoCode.trim();
  const dept = deptCode.trim();

  // circo = dept prefix + constituency number suffix
  if (!circo.startsWith(dept)) {
    verbose(`Warning: circo "${circo}" does not start with dept "${dept}"`);
    return null;
  }

  const suffix = circo.slice(dept.length);
  const num = parseInt(suffix, 10);
  return isNaN(num) || num === 0 ? null : num;
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

async function showStats() {
  const total = await db.commune.count();
  const withCirco = await db.commune.count({
    where: { constituencyNumber: { not: null } },
  });
  const withoutCirco = total - withCirco;

  log("\n=== Constituency Number Stats ===");
  log(`Total communes: ${total}`);
  log(`With constituency number: ${withCirco} (${((withCirco / total) * 100).toFixed(1)}%)`);
  log(`Without constituency number: ${withoutCirco}`);

  if (VERBOSE) {
    const byDept = await db.$queryRaw<{ departmentCode: string; count: bigint }[]>(Prisma.sql`
      SELECT "departmentCode", COUNT(*) as count
      FROM "Commune"
      WHERE "constituencyNumber" IS NULL
      GROUP BY "departmentCode"
      ORDER BY count DESC
      LIMIT 10
    `);
    if (byDept.length > 0) {
      log("\nTop departments missing constituency numbers:");
      for (const row of byDept) {
        log(`  ${row.departmentCode}: ${row.count} communes`);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  if (STATS_ONLY) {
    await showStats();
    await db.$disconnect();
    return;
  }

  log("=== INSEE Constituency Number Import ===");
  if (DRY_RUN) log("[DRY RUN] No database changes will be made.\n");

  // 1. Download XLSX
  log("Downloading INSEE circo_composition.xlsx...");
  const resp = await fetch(CIRCO_COMPOSITION_URL, {
    headers: { "User-Agent": "PoliGraph/1.0 (civic-observatory)" },
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status} fetching ${CIRCO_COMPOSITION_URL}`);

  const buf = Buffer.from(await resp.arrayBuffer());
  const tmpPath = join(tmpdir(), "circo_composition.xlsx");
  await writeFile(tmpPath, buf);
  log(`Downloaded (${(buf.length / 1024).toFixed(0)} KB)`);

  // 2. Parse XLSX — "table" sheet
  const workbook = XLSX.readFile(tmpPath);
  const sheet = workbook.Sheets["table"];
  if (!sheet) {
    throw new Error(`Sheet "table" not found. Available: ${workbook.SheetNames.join(", ")}`);
  }

  interface CircoRow {
    DEP: string;
    COMMUNE_RESID: string;
    circo: string;
    type_com: string;
  }

  const rows = XLSX.utils.sheet_to_json<CircoRow>(sheet);
  log(`Parsed ${rows.length} rows from XLSX`);

  // 3. Build mapping (prefer "entière" over "partiel" for split communes)
  const mapping = new Map<string, number>();
  let skipped = 0;
  let partial = 0;

  for (const row of rows) {
    const inseeCode = String(row.COMMUNE_RESID ?? "").trim();
    const deptCode = String(row.DEP ?? "").trim();
    const circoCode = String(row.circo ?? "").trim();
    const typeCom = String(row.type_com ?? "")
      .trim()
      .toLowerCase();

    if (!inseeCode || !circoCode) {
      skipped++;
      continue;
    }

    const circoNum = parseCircoCode(circoCode, deptCode);
    if (circoNum === null) {
      skipped++;
      continue;
    }

    // For split communes ("partiel"), only set if not already mapped by an "entière" entry
    if (typeCom === "partiel") {
      partial++;
      if (!mapping.has(inseeCode)) {
        mapping.set(inseeCode, circoNum);
      }
    } else {
      mapping.set(inseeCode, circoNum);
    }
  }

  log(`Built mapping: ${mapping.size} communes (${partial} partial entries, ${skipped} skipped)`);

  if (DRY_RUN) {
    const sample = Array.from(mapping.entries()).slice(0, 10);
    log("\nSample mappings:");
    for (const [code, circo] of sample) {
      log(`  ${code} → constituency ${circo}`);
    }
    await showStats();
    await db.$disconnect();
    return;
  }

  // 4. Batch update
  const codes = Array.from(mapping.keys());
  let updated = 0;
  let notFound = 0;

  for (let i = 0; i < codes.length; i += BATCH_SIZE) {
    const chunk = codes.slice(i, i + BATCH_SIZE);
    const values = chunk.map((code) => Prisma.sql`(${code}::text, ${mapping.get(code)!}::int)`);

    const result = await db.$executeRaw(Prisma.sql`
      UPDATE "Commune" AS c
      SET "constituencyNumber" = v.circo
      FROM (VALUES ${Prisma.join(values)}) AS v(id, circo)
      WHERE c.id = v.id
    `);

    updated += Number(result);
    const chunkNotFound = chunk.length - Number(result);
    notFound += chunkNotFound;

    if (VERBOSE || (i + BATCH_SIZE) % 5000 < BATCH_SIZE) {
      log(
        `  Progress: ${Math.min(i + BATCH_SIZE, codes.length)}/${codes.length} processed (${updated} updated)`
      );
    }
  }

  log(`\n=== Import Complete ===`);
  log(`Updated: ${updated} communes`);
  log(`Not found in DB: ${notFound} (INSEE codes without matching Commune record)`);

  // Show final stats
  await showStats();
  await db.$disconnect();
}

main().catch((error) => {
  console.error("Import failed:", error);
  db.$disconnect();
  process.exit(1);
});
