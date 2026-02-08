import { db } from "@/lib/db";
import { generateSlug } from "@/lib/utils";
import { MandateType, DataSource } from "@/generated/prisma";
import { DeputeCSV, PARTY_MAPPINGS, SyncResult } from "./types";
import { parse } from "csv-parse/sync";
import { politicianService } from "@/services/politician";

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
 * Returns a map from CSV groupeAbrev -> party ID for linking deputies
 */
async function syncParties(
  deputies: DeputeCSV[]
): Promise<{ created: number; updated: number; csvToPartyId: Map<string, string> }> {
  const uniqueGroups = new Map<string, string>();

  // Extract unique groups from CSV
  for (const dep of deputies) {
    if (dep.groupeAbrev && !uniqueGroups.has(dep.groupeAbrev)) {
      uniqueGroups.set(dep.groupeAbrev, dep.groupe);
    }
  }

  let created = 0;
  let updated = 0;
  const csvToPartyId = new Map<string, string>();

  for (const [csvAbrev, fullName] of uniqueGroups) {
    const mapping = PARTY_MAPPINGS[csvAbrev];
    const partyData = {
      name: mapping?.fullName || fullName,
      shortName: mapping?.shortName || csvAbrev,
      color: mapping?.color || "#888888",
    };

    // Try to find by shortName first, then by name
    let existing = await db.party.findUnique({
      where: { shortName: partyData.shortName },
    });

    if (!existing) {
      existing = await db.party.findUnique({
        where: { name: partyData.name },
      });
    }

    if (existing) {
      // Update existing party (only color, keep existing name/shortName if different)
      await db.party.update({
        where: { id: existing.id },
        data: { color: partyData.color },
      });
      csvToPartyId.set(csvAbrev, existing.id);
      updated++;
    } else {
      const newParty = await db.party.create({ data: partyData });
      csvToPartyId.set(csvAbrev, newParty.id);
      created++;
    }
  }

  return { created, updated, csvToPartyId };
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
    const mandateStart = dep.datePriseFonction ? new Date(dep.datePriseFonction) : new Date();

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
    };

    const mandateData = {
      type: MandateType.DEPUTE,
      title: `Député${dep.civ === "Mme" ? "e" : ""} de la ${dep.circo}${getOrdinalSuffix(dep.circo)} circonscription`,
      institution: "Assemblée nationale",
      constituency: `${dep.departementNom} (${dep.circo})`,
      departmentCode: dep.departementCode || null,
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

      // Update party affiliation via service (ensures PartyMembership consistency)
      await politicianService.setCurrentParty(existing.id, partyId);

      // Upsert external IDs
      await upsertExternalIds(existing.id, dep.id, slug);

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
      const newPolitician = await db.politician.create({
        data: {
          ...politicianData,
          mandates: {
            create: mandateData,
          },
        },
      });

      // Set party affiliation via service (creates PartyMembership)
      await politicianService.setCurrentParty(newPolitician.id, partyId);

      // Create external IDs
      await upsertExternalIds(newPolitician.id, dep.id, slug);

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
 * Upsert external IDs for a politician
 */
async function upsertExternalIds(politicianId: string, anId: string, slug: string): Promise<void> {
  // Assemblée Nationale ID
  await db.externalId.upsert({
    where: {
      source_externalId: {
        source: DataSource.ASSEMBLEE_NATIONALE,
        externalId: anId,
      },
    },
    create: {
      politicianId,
      source: DataSource.ASSEMBLEE_NATIONALE,
      externalId: anId,
      url: `https://www.assemblee-nationale.fr/dyn/deputes/${anId}`,
    },
    update: {
      politicianId,
      url: `https://www.assemblee-nationale.fr/dyn/deputes/${anId}`,
    },
  });

  // NosDéputés ID (uses slug)
  await db.externalId.upsert({
    where: {
      source_externalId: {
        source: DataSource.NOSDEPUTES,
        externalId: slug,
      },
    },
    create: {
      politicianId,
      source: DataSource.NOSDEPUTES,
      externalId: slug,
      url: `https://www.nosdeputes.fr/${slug}`,
    },
    update: {
      politicianId,
      url: `https://www.nosdeputes.fr/${slug}`,
    },
  });
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

    // 2. Sync parties first and get CSV abbreviation -> party ID mapping
    console.log("Syncing parties...");
    const { created, updated, csvToPartyId } = await syncParties(deputies);
    result.partiesCreated = created;
    result.partiesUpdated = updated;

    // 3. Build party map (CSV groupeAbrev -> id)
    // This ensures we can look up by the CSV abbreviation, not the mapped shortName
    const partyMap = csvToPartyId;

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
