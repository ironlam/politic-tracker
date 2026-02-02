/**
 * Migration script to populate departmentCode on existing Mandate records
 *
 * Usage:
 *   npx tsx scripts/migrate-department-codes.ts              # Run migration
 *   npx tsx scripts/migrate-department-codes.ts --dry-run    # Preview without writing
 *   npx tsx scripts/migrate-department-codes.ts --stats      # Show current stats
 *   npx tsx scripts/migrate-department-codes.ts --help       # Show help
 */

import "dotenv/config";
import { db } from "../src/lib/db";
import { MandateType } from "../src/generated/prisma";

// Parse arguments
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const showStats = args.includes("--stats");
const showHelp = args.includes("--help");

// French departments: name -> code mapping
const DEPARTMENT_NAME_TO_CODE: Record<string, string> = {
  // Métropole
  "Ain": "01",
  "Aisne": "02",
  "Allier": "03",
  "Alpes-de-Haute-Provence": "04",
  "Hautes-Alpes": "05",
  "Alpes-Maritimes": "06",
  "Ardèche": "07",
  "Ardennes": "08",
  "Ariège": "09",
  "Aube": "10",
  "Aude": "11",
  "Aveyron": "12",
  "Bouches-du-Rhône": "13",
  "Calvados": "14",
  "Cantal": "15",
  "Charente": "16",
  "Charente-Maritime": "17",
  "Cher": "18",
  "Corrèze": "19",
  "Corse-du-Sud": "2A",
  "Haute-Corse": "2B",
  "Côte-d'Or": "21",
  "Côtes-d'Armor": "22",
  "Creuse": "23",
  "Dordogne": "24",
  "Doubs": "25",
  "Drôme": "26",
  "Eure": "27",
  "Eure-et-Loir": "28",
  "Finistère": "29",
  "Gard": "30",
  "Haute-Garonne": "31",
  "Gers": "32",
  "Gironde": "33",
  "Hérault": "34",
  "Ille-et-Vilaine": "35",
  "Indre": "36",
  "Indre-et-Loire": "37",
  "Isère": "38",
  "Jura": "39",
  "Landes": "40",
  "Loir-et-Cher": "41",
  "Loire": "42",
  "Haute-Loire": "43",
  "Loire-Atlantique": "44",
  "Loiret": "45",
  "Lot": "46",
  "Lot-et-Garonne": "47",
  "Lozère": "48",
  "Maine-et-Loire": "49",
  "Manche": "50",
  "Marne": "51",
  "Haute-Marne": "52",
  "Mayenne": "53",
  "Meurthe-et-Moselle": "54",
  "Meuse": "55",
  "Morbihan": "56",
  "Moselle": "57",
  "Nièvre": "58",
  "Nord": "59",
  "Oise": "60",
  "Orne": "61",
  "Pas-de-Calais": "62",
  "Puy-de-Dôme": "63",
  "Pyrénées-Atlantiques": "64",
  "Hautes-Pyrénées": "65",
  "Pyrénées-Orientales": "66",
  "Bas-Rhin": "67",
  "Haut-Rhin": "68",
  "Rhône": "69",
  "Haute-Saône": "70",
  "Saône-et-Loire": "71",
  "Sarthe": "72",
  "Savoie": "73",
  "Haute-Savoie": "74",
  "Paris": "75",
  "Seine-Maritime": "76",
  "Seine-et-Marne": "77",
  "Yvelines": "78",
  "Deux-Sèvres": "79",
  "Somme": "80",
  "Tarn": "81",
  "Tarn-et-Garonne": "82",
  "Var": "83",
  "Vaucluse": "84",
  "Vendée": "85",
  "Vienne": "86",
  "Haute-Vienne": "87",
  "Vosges": "88",
  "Yonne": "89",
  "Territoire de Belfort": "90",
  "Essonne": "91",
  "Hauts-de-Seine": "92",
  "Seine-Saint-Denis": "93",
  "Val-de-Marne": "94",
  "Val-d'Oise": "95",
  // DOM-TOM
  "Guadeloupe": "971",
  "Martinique": "972",
  "Guyane": "973",
  "La Réunion": "974",
  "Mayotte": "976",
  "Saint-Pierre-et-Miquelon": "975",
  "Saint-Barthélemy": "977",
  "Saint-Martin": "978",
  "Wallis-et-Futuna": "986",
  "Polynésie française": "987",
  "Nouvelle-Calédonie": "988",
  // Français de l'étranger
  "Français établis hors de France": "099",
};

// Variations and aliases
const DEPARTMENT_ALIASES: Record<string, string> = {
  "Côtes d'Armor": "22",
  "Cotes d'Armor": "22",
  "Cotes-d'Armor": "22",
  "Côte d'Or": "21",
  "Côte-d'or": "21",
  "Cote-d'Or": "21",
  "Réunion": "974",
  "Reunion": "974",
  "Polynesie francaise": "987",
  "Polynésie Française": "987",
  "Nouvelle Calédonie": "988",
  "Nouvelle-Caledonie": "988",
  "Saint Pierre et Miquelon": "975",
  "Saint-Pierre et Miquelon": "975",
  "Saint Barthélemy": "977",
  "Saint Martin": "978",
  "Wallis et Futuna": "986",
  "Iles Wallis et Futuna": "986",
  "Français de l'étranger": "099",
  "Francais etablis hors de France": "099",
  "Alpes de Haute-Provence": "04",
  "Alpes de Haute Provence": "04",
};

/**
 * Extract department code from constituency string
 *
 * Examples:
 * - "Rhône (3)" -> "69"
 * - "Paris (1)" -> "75"
 * - "Ain" -> "01"
 * - "Seine-Saint-Denis (5)" -> "93"
 * - "Gironde (5e)" -> "33"
 * - "Alpes-Maritimes (1ère)" -> "06"
 * - "Saint-Barthélemy et Saint-Martin (1)" -> "977" or "978"
 */
function extractDepartmentCode(constituency: string | null, type: MandateType): string | null {
  if (!constituency) return null;

  // For deputies: format is "DépartementNom (circo)" with various ordinal formats
  // For senators: format is just "DépartementNom"

  // Handle special case: "Saint-Barthélemy et Saint-Martin"
  if (constituency.includes("Saint-Barthélemy et Saint-Martin") || constituency.includes("Saint-Barthélémy et Saint-Martin")) {
    return "977"; // Assign to Saint-Barthélemy
  }

  // Handle "Français établis hors de France" with series
  if (constituency.includes("Français établis hors de France") || constituency.includes("Francais etablis hors de France")) {
    return "099";
  }

  // Remove circumscription number - handle formats: (5), (5e), (1ère), (1re), (Série 1)
  const nameMatch = constituency.match(/^([^(]+?)(?:\s*\((?:\d+(?:e|ère|re|ème)?|Série \d+)\))?$/);
  if (!nameMatch) return null;

  const deptName = nameMatch[1].trim();

  // Try direct match
  if (DEPARTMENT_NAME_TO_CODE[deptName]) {
    return DEPARTMENT_NAME_TO_CODE[deptName];
  }

  // Try aliases
  if (DEPARTMENT_ALIASES[deptName]) {
    return DEPARTMENT_ALIASES[deptName];
  }

  // Try case-insensitive match
  const lowerName = deptName.toLowerCase();
  for (const [name, code] of Object.entries(DEPARTMENT_NAME_TO_CODE)) {
    if (name.toLowerCase() === lowerName) {
      return code;
    }
  }

  for (const [alias, code] of Object.entries(DEPARTMENT_ALIASES)) {
    if (alias.toLowerCase() === lowerName) {
      return code;
    }
  }

  return null;
}

async function showCurrentStats(): Promise<void> {
  console.log("Fetching current stats...\n");

  const [total, withCode, withoutCode, byType] = await Promise.all([
    db.mandate.count({
      where: {
        type: { in: [MandateType.DEPUTE, MandateType.SENATEUR] },
      },
    }),
    db.mandate.count({
      where: {
        type: { in: [MandateType.DEPUTE, MandateType.SENATEUR] },
        departmentCode: { not: null },
      },
    }),
    db.mandate.count({
      where: {
        type: { in: [MandateType.DEPUTE, MandateType.SENATEUR] },
        departmentCode: null,
      },
    }),
    db.mandate.groupBy({
      by: ["type"],
      where: {
        type: { in: [MandateType.DEPUTE, MandateType.SENATEUR] },
      },
      _count: true,
    }),
  ]);

  console.log("Current database stats:");
  console.log(`  Total deputy/senator mandates: ${total}`);
  console.log(`  With departmentCode: ${withCode}`);
  console.log(`  Without departmentCode: ${withoutCode}`);
  console.log("");
  console.log("By type:");
  for (const row of byType) {
    console.log(`  ${row.type}: ${row._count}`);
  }
}

async function runMigration(): Promise<void> {
  console.log(dryRun ? "Running migration in DRY RUN mode...\n" : "Running migration...\n");

  // Fetch all deputy and senator mandates without departmentCode
  const mandates = await db.mandate.findMany({
    where: {
      type: { in: [MandateType.DEPUTE, MandateType.SENATEUR] },
      departmentCode: null,
      constituency: { not: null },
    },
    select: {
      id: true,
      type: true,
      constituency: true,
    },
  });

  console.log(`Found ${mandates.length} mandates to process\n`);

  let updated = 0;
  let skipped = 0;
  const unmatchedConstituencies = new Set<string>();

  for (const mandate of mandates) {
    const code = extractDepartmentCode(mandate.constituency, mandate.type);

    if (code) {
      if (!dryRun) {
        await db.mandate.update({
          where: { id: mandate.id },
          data: { departmentCode: code },
        });
      }
      updated++;

      if (updated % 100 === 0) {
        process.stdout.write(`\rProcessed ${updated}/${mandates.length}...`);
      }
    } else {
      skipped++;
      if (mandate.constituency) {
        unmatchedConstituencies.add(mandate.constituency);
      }
    }
  }

  console.log(`\r\nMigration ${dryRun ? "would have" : ""} updated ${updated} mandates`);
  console.log(`Skipped ${skipped} mandates (no matching department code)\n`);

  if (unmatchedConstituencies.size > 0) {
    console.log("Unmatched constituencies:");
    for (const c of [...unmatchedConstituencies].slice(0, 20)) {
      console.log(`  - "${c}"`);
    }
    if (unmatchedConstituencies.size > 20) {
      console.log(`  ... and ${unmatchedConstituencies.size - 20} more`);
    }
  }
}

async function main(): Promise<void> {
  if (showHelp) {
    console.log(`
Department Code Migration Script

Usage:
  npx tsx scripts/migrate-department-codes.ts              Run migration
  npx tsx scripts/migrate-department-codes.ts --dry-run    Preview without writing
  npx tsx scripts/migrate-department-codes.ts --stats      Show current stats
  npx tsx scripts/migrate-department-codes.ts --help       Show this help

This script populates the departmentCode field on existing Mandate records
by extracting the code from the constituency field.
    `);
    process.exit(0);
  }

  if (showStats) {
    await showCurrentStats();
    process.exit(0);
  }

  await runMigration();

  console.log("\nFinal stats:");
  await showCurrentStats();
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
