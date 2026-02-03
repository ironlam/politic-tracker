/**
 * CLI script to sync historical mandates from NosDéputés archives
 *
 * Sources:
 * - https://2017-2022.nosdeputes.fr/ (15e législature)
 * - https://2012-2017.nosdeputes.fr/ (14e législature)
 * - https://www.nosdeputes.fr/ (current - 16e/17e)
 *
 * Usage:
 *   npm run sync:history              # Sync all legislatures
 *   npm run sync:history -- --leg=15  # Sync specific legislature
 *   npm run sync:history -- --stats   # Show current stats
 */

import "dotenv/config";
import https from "https";
import { createCLI, type SyncHandler, type SyncResult } from "../src/lib/sync";
import { db } from "../src/lib/db";
import { MandateType } from "../src/generated/prisma";
import { generateSlug } from "../src/lib/utils";

interface Legislature {
  number: number;
  label: string;
  baseUrl: string;
  startYear: number;
  endYear: number;
}

const LEGISLATURES: Legislature[] = [
  {
    number: 17,
    label: "17e législature",
    baseUrl: "https://www.nosdeputes.fr",
    startYear: 2024,
    endYear: 2029,
  },
  {
    number: 16,
    label: "16e législature",
    baseUrl: "https://2022-2024.nosdeputes.fr",
    startYear: 2022,
    endYear: 2024,
  },
  {
    number: 15,
    label: "15e législature",
    baseUrl: "https://2017-2022.nosdeputes.fr",
    startYear: 2017,
    endYear: 2022,
  },
  {
    number: 14,
    label: "14e législature",
    baseUrl: "https://2012-2017.nosdeputes.fr",
    startYear: 2012,
    endYear: 2017,
  },
];

interface NosDéputésDeputy {
  depute: {
    id: number;
    nom: string;
    nom_de_famille: string;
    prenom: string;
    sexe: string;
    date_naissance?: string;
    num_circo?: number;
    nom_circo?: string;
    mandat_debut?: string;
    mandat_fin?: string;
  };
}

/**
 * Fetch JSON data using native https module
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
  let politician = await db.politician.findFirst({
    where: {
      firstName: { equals: firstName, mode: "insensitive" },
      lastName: { equals: lastName, mode: "insensitive" },
    },
  });

  if (politician) return politician;

  const slug = generateSlug(`${firstName}-${lastName}`);
  politician = await db.politician.findUnique({ where: { slug } });

  if (politician) return politician;

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
async function syncLegislature(leg: Legislature) {
  console.log(`\nSyncing ${leg.label} (${leg.startYear}-${leg.endYear})...`);

  const stats = {
    deputiesFound: 0,
    mandatesCreated: 0,
    mandatesUpdated: 0,
  };
  const errors: string[] = [];

  const deputies = await fetchDeputiesForLegislature(leg);
  stats.deputiesFound = deputies.length;

  if (deputies.length === 0) {
    errors.push("No deputies found");
    return { stats, errors };
  }

  console.log(`  Found ${deputies.length} deputies`);

  for (const { depute } of deputies) {
    try {
      const politician = await findPolitician(depute.prenom, depute.nom_de_famille);
      if (!politician) continue;

      const mandateStart = depute.mandat_debut ? new Date(depute.mandat_debut) : null;
      const mandateEnd = depute.mandat_fin ? new Date(depute.mandat_fin) : null;

      if (!mandateStart) continue;

      const constituency =
        depute.nom_circo && depute.num_circo
          ? `${depute.nom_circo} (${depute.num_circo}${depute.num_circo === 1 ? "ère" : "e"})`
          : depute.nom_circo || null;

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
        await db.mandate.update({
          where: { id: existingMandate.id },
          data: {
            startDate: mandateStart,
            endDate: mandateEnd,
            isCurrent,
            constituency: constituency || existingMandate.constituency,
          },
        });
        stats.mandatesUpdated++;
      } else {
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
        stats.mandatesCreated++;
      }
    } catch (error) {
      errors.push(`${depute.nom}: ${error}`);
    }
  }

  console.log(`  Created: ${stats.mandatesCreated}, Updated: ${stats.mandatesUpdated}`);
  return { stats, errors };
}

const handler: SyncHandler = {
  name: "Politic Tracker - Historical Mandate Sync",
  description: "Imports historical mandates from NosDéputés archives",

  options: [
    {
      name: "--leg",
      type: "number",
      description: "Specific legislature to sync (14, 15, 16, 17)",
    },
  ],

  showHelp() {
    console.log(`
Politic Tracker - Historical Mandate Sync

Legislatures:
  17: 2024-2029 (current)
  16: 2022-2024
  15: 2017-2022
  14: 2012-2017

Data source: NosDéputés.fr archives
    `);
  },

  async showStats() {
    const total = await db.mandate.count();
    const current = await db.mandate.count({ where: { isCurrent: true } });
    const historical = await db.mandate.count({ where: { isCurrent: false } });

    const byType = await db.mandate.groupBy({
      by: ["type"],
      _count: true,
      orderBy: { _count: { type: "desc" } },
    });

    console.log("\n" + "=".repeat(50));
    console.log("Mandate Statistics");
    console.log("=".repeat(50));
    console.log(`Total mandates: ${total}`);
    console.log(`Current: ${current}`);
    console.log(`Historical: ${historical}`);
    console.log("\nBy type:");
    for (const t of byType) {
      console.log(`  ${t.type}: ${t._count}`);
    }
  },

  async sync(options): Promise<SyncResult> {
    const targetLeg = options.leg as number | undefined;

    const stats = {
      legislaturesSynced: 0,
      totalCreated: 0,
      totalUpdated: 0,
    };
    const errors: string[] = [];

    const legislaturesToSync = targetLeg
      ? LEGISLATURES.filter((l) => l.number === targetLeg)
      : LEGISLATURES.filter((l) => l.number < 17); // Skip current

    if (legislaturesToSync.length === 0) {
      errors.push("No legislatures to sync");
      return { success: false, duration: 0, stats, errors };
    }

    for (const leg of legislaturesToSync) {
      const result = await syncLegislature(leg);
      stats.legislaturesSynced++;
      stats.totalCreated += result.stats.mandatesCreated;
      stats.totalUpdated += result.stats.mandatesUpdated;
      errors.push(...result.errors);
    }

    return {
      success: errors.length === 0,
      duration: 0,
      stats,
      errors,
    };
  },
};

createCLI(handler);
