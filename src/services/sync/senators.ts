import { db } from "@/lib/db";
import { generateSlug } from "@/lib/utils";
import { MandateType, DataSource } from "@/generated/prisma";
import {
  SenateurAPI,
  NosSenateursAPI,
  SENATE_GROUP_MAPPINGS,
  SenatSyncResult,
  PartyMapping,
} from "./types";

const SENAT_API_URL = "https://www.senat.fr/api-senat/senateurs.json";
const NOSSENATEURS_API_URL = "https://archive.nossenateurs.fr/senateurs/json";

/**
 * Fetch senators from senat.fr API
 */
async function fetchSenatAPI(): Promise<SenateurAPI[]> {
  console.log(`Fetching senators from: ${SENAT_API_URL}`);

  const response = await fetch(SENAT_API_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch senat.fr API: ${response.status}`);
  }

  const data = await response.json();
  console.log(`Parsed ${data.length} senators from senat.fr`);
  return data;
}

/**
 * Fetch additional data from NosSenateurs (birth dates, etc.)
 */
async function fetchNosSenateursAPI(): Promise<Map<string, NosSenateursAPI>> {
  console.log(`Fetching additional data from: ${NOSSENATEURS_API_URL}`);

  try {
    const response = await fetch(NOSSENATEURS_API_URL);
    if (!response.ok) {
      console.warn(`NosSenateurs API returned ${response.status}, skipping enrichment`);
      return new Map();
    }

    const data = await response.json();
    const senators: NosSenateursAPI[] = data.senateurs || data;
    console.log(`Parsed ${senators.length} senators from NosSenateurs`);

    // Create lookup map by matricule/id_institution
    const map = new Map<string, NosSenateursAPI>();
    for (const s of senators) {
      if (s.id_institution) {
        map.set(s.id_institution, s);
      }
      // Also index by slug for fallback matching
      if (s.slug) {
        map.set(s.slug.toLowerCase(), s);
      }
    }

    return map;
  } catch (error) {
    console.warn("Could not fetch NosSenateurs data:", error);
    return new Map();
  }
}

/**
 * Sync parties from senators data
 */
async function syncSenateGroups(
  senators: SenateurAPI[]
): Promise<{ created: number; updated: number; codeToPartyId: Map<string, string> }> {
  const uniqueGroups = new Map<string, { code: string; libelle: string }>();

  // Extract unique groups
  for (const sen of senators) {
    if (sen.groupe?.code && !uniqueGroups.has(sen.groupe.code)) {
      uniqueGroups.set(sen.groupe.code, sen.groupe);
    }
  }

  let created = 0;
  let updated = 0;
  const codeToPartyId = new Map<string, string>();

  for (const [code, groupe] of uniqueGroups) {
    const mapping: PartyMapping = SENATE_GROUP_MAPPINGS[code] || {
      shortName: code,
      fullName: groupe.libelle,
      color: "#888888",
    };

    // Try to find existing party by shortName
    let existing = await db.party.findUnique({
      where: { shortName: mapping.shortName },
    });

    // Fallback: try to find by full name
    if (!existing) {
      existing = await db.party.findUnique({
        where: { name: mapping.fullName },
      });
    }

    if (existing) {
      // Update if needed
      if (!existing.color) {
        await db.party.update({
          where: { id: existing.id },
          data: { color: mapping.color },
        });
      }
      codeToPartyId.set(code, existing.id);
      updated++;
    } else {
      // Create new party
      const newParty = await db.party.create({
        data: {
          name: mapping.fullName,
          shortName: mapping.shortName,
          color: mapping.color,
        },
      });
      codeToPartyId.set(code, newParty.id);
      created++;
    }
  }

  return { created, updated, codeToPartyId };
}

/**
 * Sync a single senator
 */
async function syncSenator(
  sen: SenateurAPI,
  partyMap: Map<string, string>,
  nosSenateursData: Map<string, NosSenateursAPI>
): Promise<"created" | "updated" | "error"> {
  try {
    const slug = generateSlug(`${sen.prenom}-${sen.nom}`);
    const fullName = `${sen.prenom} ${sen.nom}`;
    const partyId = sen.groupe?.code ? partyMap.get(sen.groupe.code) : null;

    // Try to get additional data from NosSenateurs
    const extraData = nosSenateursData.get(sen.matricule) || nosSenateursData.get(slug);

    // Parse birth date if available
    let birthDate: Date | null = null;
    let birthPlace: string | null = null;

    if (extraData?.date_naissance) {
      birthDate = new Date(extraData.date_naissance);
      if (isNaN(birthDate.getTime())) birthDate = null;
    }
    if (extraData?.lieu_naissance) {
      birthPlace = extraData.lieu_naissance;
    }

    // Parse mandate start date
    let mandateStart: Date | null = null;
    if (extraData?.mandat_debut) {
      mandateStart = new Date(extraData.mandat_debut);
      if (isNaN(mandateStart.getTime())) mandateStart = null;
    }

    // Photo URL from senat.fr
    const photoUrl = sen.urlAvatar || `https://www.senat.fr/senateur/${sen.matricule}/photo.jpg`;

    // Check if politician exists (by external ID or slug)
    const existingByExtId = await db.externalId.findUnique({
      where: {
        source_externalId: {
          source: DataSource.SENAT,
          externalId: sen.matricule,
        },
      },
      include: { politician: { include: { mandates: true } } },
    });

    let existing = existingByExtId?.politician;

    // Fallback: try to find by slug
    if (!existing) {
      existing = await db.politician.findUnique({
        where: { slug },
        include: { mandates: true },
      });
    }

    // Fallback: try to find by similar name
    if (!existing) {
      existing = await db.politician.findFirst({
        where: {
          firstName: { equals: sen.prenom, mode: "insensitive" },
          lastName: { equals: sen.nom, mode: "insensitive" },
        },
        include: { mandates: true },
      });
    }

    const politicianData = {
      slug,
      civility: sen.civilite || null,
      firstName: sen.prenom,
      lastName: sen.nom,
      fullName,
      birthDate: birthDate || undefined,
      birthPlace: birthPlace || undefined,
      photoUrl,
      photoSource: "senat",
      currentPartyId: partyId,
    };

    const mandateData = {
      type: MandateType.SENATEUR,
      title: `Sénateur${sen.feminise ? "rice" : ""} ${sen.circonscription?.libelle || ""}`.trim(),
      institution: "Sénat",
      constituency: sen.circonscription?.libelle || null,
      startDate: mandateStart || new Date(),
      isCurrent: true,
      sourceUrl: sen.url || `https://www.senat.fr/senateur/${sen.matricule}/`,
      externalId: `senat-${sen.matricule}`,
    };

    if (existing) {
      // Update politician (preserve existing data if new data is empty)
      await db.politician.update({
        where: { id: existing.id },
        data: {
          ...politicianData,
          // Only update birth data if we have it and it's missing
          birthDate: existing.birthDate || politicianData.birthDate,
          birthPlace: existing.birthPlace || politicianData.birthPlace,
          // Only update photo if current photo is not from a higher priority source
          ...(shouldUpdatePhoto(existing.photoSource, "senat")
            ? { photoUrl: politicianData.photoUrl, photoSource: politicianData.photoSource }
            : {}),
        },
      });

      // Upsert external ID
      await upsertExternalIds(existing.id, sen.matricule, slug);

      // Update or create mandate
      const existingMandate = existing.mandates.find(
        (m) => m.externalId === mandateData.externalId || m.type === MandateType.SENATEUR
      );

      if (existingMandate) {
        await db.mandate.update({
          where: { id: existingMandate.id },
          data: mandateData,
        });
      } else {
        await db.mandate.create({
          data: { ...mandateData, politicianId: existing.id },
        });
      }

      return "updated";
    } else {
      // Create new politician
      const newPolitician = await db.politician.create({
        data: {
          ...politicianData,
          mandates: { create: mandateData },
        },
      });

      await upsertExternalIds(newPolitician.id, sen.matricule, slug);
      return "created";
    }
  } catch (error) {
    console.error(`Error syncing senator ${sen.prenom} ${sen.nom}:`, error);
    return "error";
  }
}

/**
 * Determine if we should update the photo based on source priority
 * Priority: assemblee-nationale = senat = gouvernement > nosdeputes = nossenateurs > wikidata > manual
 */
function shouldUpdatePhoto(currentSource: string | null, newSource: string): boolean {
  const priority: Record<string, number> = {
    "assemblee-nationale": 10,
    "senat": 10,
    "gouvernement": 10,
    "nosdeputes": 5,
    "nossenateurs": 5,
    "wikidata": 3,
    "manual": 1,
  };

  const currentPriority = currentSource ? (priority[currentSource] || 0) : 0;
  const newPriority = priority[newSource] || 0;

  return newPriority >= currentPriority;
}

/**
 * Upsert external IDs for a senator
 */
async function upsertExternalIds(
  politicianId: string,
  matricule: string,
  slug: string
): Promise<void> {
  // Sénat ID
  await db.externalId.upsert({
    where: {
      source_externalId: {
        source: DataSource.SENAT,
        externalId: matricule,
      },
    },
    create: {
      politicianId,
      source: DataSource.SENAT,
      externalId: matricule,
      url: `https://www.senat.fr/senateur/${matricule}/`,
    },
    update: {
      politicianId,
      url: `https://www.senat.fr/senateur/${matricule}/`,
    },
  });

  // NosSénateurs ID (if different from matricule)
  // Using slug as the ID since that's how NosSénateurs URLs work
  await db.externalId.upsert({
    where: {
      source_externalId: {
        source: DataSource.NOSDEPUTES, // Reusing NOSDEPUTES for NosSénateurs (same platform)
        externalId: `senateur-${slug}`,
      },
    },
    create: {
      politicianId,
      source: DataSource.NOSDEPUTES,
      externalId: `senateur-${slug}`,
      url: `https://archive.nossenateurs.fr/${slug}`,
    },
    update: {
      politicianId,
      url: `https://archive.nossenateurs.fr/${slug}`,
    },
  });
}

/**
 * Main sync function - imports/updates all senators
 */
export async function syncSenators(): Promise<SenatSyncResult> {
  const result: SenatSyncResult = {
    success: false,
    partiesCreated: 0,
    partiesUpdated: 0,
    senatorsCreated: 0,
    senatorsUpdated: 0,
    errors: [],
  };

  try {
    console.log("Starting senators sync...");

    // 1. Fetch data from both APIs
    const [senators, nosSenateursData] = await Promise.all([
      fetchSenatAPI(),
      fetchNosSenateursAPI(),
    ]);

    // 2. Sync parties/groups
    console.log("Syncing senate groups...");
    const { created, updated, codeToPartyId } = await syncSenateGroups(senators);
    result.partiesCreated = created;
    result.partiesUpdated = updated;

    // 3. Sync senators
    console.log("Syncing senators...");
    for (const sen of senators) {
      const status = await syncSenator(sen, codeToPartyId, nosSenateursData);
      if (status === "created") result.senatorsCreated++;
      else if (status === "updated") result.senatorsUpdated++;
      else result.errors.push(`${sen.prenom} ${sen.nom}`);
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
 * Get senator stats
 */
export async function getSenatStats() {
  const [senatorCount, currentSenatorMandates] = await Promise.all([
    db.politician.count({
      where: {
        mandates: {
          some: {
            type: MandateType.SENATEUR,
            isCurrent: true,
          },
        },
      },
    }),
    db.mandate.count({
      where: {
        type: MandateType.SENATEUR,
        isCurrent: true,
      },
    }),
  ]);

  return {
    senators: senatorCount,
    currentMandates: currentSenatorMandates,
  };
}
