import { db } from "@/lib/db";
import { generateSlug } from "@/lib/utils";
import { MandateType } from "@/generated/prisma";
import { DeputeCSV, PARTY_MAPPINGS, SyncResult } from "./types";
import { parse } from "csv-parse/sync";

const DATA_GOUV_URL =
  "https://static.data.gouv.fr/resources/deputes-actifs-de-lassemblee-nationale-informations-et-statistiques/20260118-063755/deputes-active.csv";

// Fallback URL pattern (latest resource)
const DATA_GOUV_DATASET_API =
  "https://www.data.gouv.fr/api/1/datasets/deputes-actifs-de-lassemblee-nationale-informations-et-statistiques/";

/**
 * Fetch the latest CSV URL from data.gouv.fr API
 */
async function getLatestCsvUrl(): Promise<string> {
  try {
    const response = await fetch(DATA_GOUV_DATASET_API);
    if (!response.ok) throw new Error("Failed to fetch dataset info");

    const data = await response.json();
    const csvResource = data.resources?.find(
      (r: { format: string }) => r.format?.toLowerCase() === "csv"
    );

    if (csvResource?.url) {
      return csvResource.url;
    }
  } catch (error) {
    console.warn("Could not fetch latest URL, using default:", error);
  }

  return DATA_GOUV_URL;
}

/**
 * Fetch and parse deputies CSV from data.gouv.fr
 */
async function fetchDeputiesCSV(): Promise<DeputeCSV[]> {
  const url = await getLatestCsvUrl();
  console.log(`Fetching deputies from: ${url}`);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch CSV: ${response.status}`);
  }

  const csvText = await response.text();
  const records = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as DeputeCSV[];

  console.log(`Parsed ${records.length} deputies from CSV`);
  return records;
}

/**
 * Sync parties from deputies data
 */
async function syncParties(
  deputies: DeputeCSV[]
): Promise<{ created: number; updated: number }> {
  const uniqueGroups = new Map<string, string>();

  // Extract unique groups
  for (const dep of deputies) {
    if (dep.groupeAbrev && !uniqueGroups.has(dep.groupeAbrev)) {
      uniqueGroups.set(dep.groupeAbrev, dep.groupe);
    }
  }

  let created = 0;
  let updated = 0;

  for (const [shortName, fullName] of uniqueGroups) {
    const mapping = PARTY_MAPPINGS[shortName];
    const partyData = {
      name: mapping?.fullName || fullName,
      shortName: mapping?.shortName || shortName,
      color: mapping?.color || "#888888",
    };

    const existing = await db.party.findUnique({
      where: { shortName: partyData.shortName },
    });

    if (existing) {
      await db.party.update({
        where: { id: existing.id },
        data: partyData,
      });
      updated++;
    } else {
      await db.party.create({ data: partyData });
      created++;
    }
  }

  return { created, updated };
}

/**
 * Sync a single deputy
 */
async function syncDeputy(
  dep: DeputeCSV,
  partyMap: Map<string, string>
): Promise<"created" | "updated" | "error"> {
  try {
    const slug = generateSlug(`${dep.prenom}-${dep.nom}`);
    const fullName = `${dep.prenom} ${dep.nom}`;
    const partyId = partyMap.get(dep.groupeAbrev) || null;

    const birthDate = dep.naissance ? new Date(dep.naissance) : null;
    const mandateStart = dep.datePriseFonction
      ? new Date(dep.datePriseFonction)
      : new Date();

    // Check if politician exists
    const existing = await db.politician.findFirst({
      where: {
        OR: [{ officialId: dep.id }, { slug }],
      },
      include: { mandates: true },
    });

    // Photo URL from NosDéputés.fr (more reliable than AN)
    const photoUrl = `https://www.nosdeputes.fr/depute/photo/${slug}/120`;

    const politicianData = {
      slug,
      civility: dep.civ || null,
      firstName: dep.prenom,
      lastName: dep.nom,
      fullName,
      birthDate,
      birthPlace: dep.villeNaissance || null,
      photoUrl,
      photoSource: "nosdeputes",
      officialId: dep.id,
      currentPartyId: partyId,
    };

    const mandateData = {
      type: MandateType.DEPUTE,
      title: `Député${dep.civ === "Mme" ? "e" : ""} de la ${dep.circo}${getOrdinalSuffix(dep.circo)} circonscription`,
      institution: "Assemblée nationale",
      constituency: `${dep.departementNom} (${dep.circo})`,
      startDate: mandateStart,
      isCurrent: true,
      sourceUrl: `https://www.assemblee-nationale.fr/dyn/deputes/${dep.id}`,
      externalId: `${dep.id}-leg${dep.legislature}`,
    };

    if (existing) {
      // Update politician
      await db.politician.update({
        where: { id: existing.id },
        data: politicianData,
      });

      // Update or create current mandate
      const existingMandate = existing.mandates.find(
        (m) => m.externalId === mandateData.externalId
      );

      if (existingMandate) {
        await db.mandate.update({
          where: { id: existingMandate.id },
          data: mandateData,
        });
      } else {
        // Mark old mandates as not current
        await db.mandate.updateMany({
          where: { politicianId: existing.id, isCurrent: true },
          data: { isCurrent: false },
        });

        await db.mandate.create({
          data: { ...mandateData, politicianId: existing.id },
        });
      }

      return "updated";
    } else {
      // Create new politician with mandate
      await db.politician.create({
        data: {
          ...politicianData,
          mandates: {
            create: mandateData,
          },
        },
      });

      return "created";
    }
  } catch (error) {
    console.error(`Error syncing deputy ${dep.prenom} ${dep.nom}:`, error);
    return "error";
  }
}

/**
 * Get ordinal suffix for French numbers
 */
function getOrdinalSuffix(n: string): string {
  const num = parseInt(n, 10);
  if (num === 1) return "ère";
  return "ème";
}

/**
 * Main sync function - imports/updates all deputies
 */
export async function syncDeputies(): Promise<SyncResult> {
  const result: SyncResult = {
    success: false,
    partiesCreated: 0,
    partiesUpdated: 0,
    deputiesCreated: 0,
    deputiesUpdated: 0,
    errors: [],
  };

  try {
    console.log("Starting deputies sync...");

    // 1. Fetch data
    const deputies = await fetchDeputiesCSV();

    // 2. Sync parties first
    console.log("Syncing parties...");
    const partyResult = await syncParties(deputies);
    result.partiesCreated = partyResult.created;
    result.partiesUpdated = partyResult.updated;

    // 3. Build party map (shortName -> id)
    const parties = await db.party.findMany();
    const partyMap = new Map(parties.map((p) => [p.shortName, p.id]));

    // 4. Sync deputies
    console.log("Syncing deputies...");
    for (const dep of deputies) {
      const status = await syncDeputy(dep, partyMap);
      if (status === "created") result.deputiesCreated++;
      else if (status === "updated") result.deputiesUpdated++;
      else result.errors.push(`${dep.prenom} ${dep.nom}`);
    }

    result.success = true;
    console.log("Sync completed:", result);
  } catch (error) {
    result.errors.push(String(error));
    console.error("Sync failed:", error);
  }

  return result;
}

/**
 * Get sync status/stats
 */
export async function getSyncStats() {
  const [politicianCount, partyCount, mandateCount] = await Promise.all([
    db.politician.count(),
    db.party.count(),
    db.mandate.count({ where: { isCurrent: true } }),
  ]);

  return {
    politicians: politicianCount,
    parties: partyCount,
    currentMandates: mandateCount,
  };
}
