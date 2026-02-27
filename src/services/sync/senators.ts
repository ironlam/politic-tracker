import { db } from "@/lib/db";
import { generateSlug } from "@/lib/utils";
import { MandateType, DataSource, Chamber } from "@/generated/prisma";
import { SenateurAPI, NosSenateursAPI, SenatSyncResult } from "./types";
import { politicianService } from "@/services/politician";
import { SENATE_GROUPS, type ParliamentaryGroupConfig } from "@/config/parliamentaryGroups";
import { HTTPClient } from "@/lib/api/http-client";
import { SENAT_RATE_LIMIT_MS } from "@/config/rate-limits";

const client = new HTTPClient({ rateLimitMs: SENAT_RATE_LIMIT_MS });

const SENAT_API_URL = "https://www.senat.fr/api-senat/senateurs.json";
const NOSSENATEURS_API_URL = "https://archive.nossenateurs.fr/senateurs/json";

// French departments: name -> code mapping
const DEPARTMENT_NAME_TO_CODE: Record<string, string> = {
  Ain: "01",
  Aisne: "02",
  Allier: "03",
  "Alpes-de-Haute-Provence": "04",
  "Hautes-Alpes": "05",
  "Alpes-Maritimes": "06",
  Ardèche: "07",
  Ardennes: "08",
  Ariège: "09",
  Aube: "10",
  Aude: "11",
  Aveyron: "12",
  "Bouches-du-Rhône": "13",
  Calvados: "14",
  Cantal: "15",
  Charente: "16",
  "Charente-Maritime": "17",
  Cher: "18",
  Corrèze: "19",
  "Corse-du-Sud": "2A",
  "Haute-Corse": "2B",
  "Côte-d'Or": "21",
  "Côtes-d'Armor": "22",
  Creuse: "23",
  Dordogne: "24",
  Doubs: "25",
  Drôme: "26",
  Eure: "27",
  "Eure-et-Loir": "28",
  Finistère: "29",
  Gard: "30",
  "Haute-Garonne": "31",
  Gers: "32",
  Gironde: "33",
  Hérault: "34",
  "Ille-et-Vilaine": "35",
  Indre: "36",
  "Indre-et-Loire": "37",
  Isère: "38",
  Jura: "39",
  Landes: "40",
  "Loir-et-Cher": "41",
  Loire: "42",
  "Haute-Loire": "43",
  "Loire-Atlantique": "44",
  Loiret: "45",
  Lot: "46",
  "Lot-et-Garonne": "47",
  Lozère: "48",
  "Maine-et-Loire": "49",
  Manche: "50",
  Marne: "51",
  "Haute-Marne": "52",
  Mayenne: "53",
  "Meurthe-et-Moselle": "54",
  Meuse: "55",
  Morbihan: "56",
  Moselle: "57",
  Nièvre: "58",
  Nord: "59",
  Oise: "60",
  Orne: "61",
  "Pas-de-Calais": "62",
  "Puy-de-Dôme": "63",
  "Pyrénées-Atlantiques": "64",
  "Hautes-Pyrénées": "65",
  "Pyrénées-Orientales": "66",
  "Bas-Rhin": "67",
  "Haut-Rhin": "68",
  Rhône: "69",
  "Haute-Saône": "70",
  "Saône-et-Loire": "71",
  Sarthe: "72",
  Savoie: "73",
  "Haute-Savoie": "74",
  Paris: "75",
  "Seine-Maritime": "76",
  "Seine-et-Marne": "77",
  Yvelines: "78",
  "Deux-Sèvres": "79",
  Somme: "80",
  Tarn: "81",
  "Tarn-et-Garonne": "82",
  Var: "83",
  Vaucluse: "84",
  Vendée: "85",
  Vienne: "86",
  "Haute-Vienne": "87",
  Vosges: "88",
  Yonne: "89",
  "Territoire de Belfort": "90",
  Essonne: "91",
  "Hauts-de-Seine": "92",
  "Seine-Saint-Denis": "93",
  "Val-de-Marne": "94",
  "Val-d'Oise": "95",
  // DOM-TOM
  Guadeloupe: "971",
  Martinique: "972",
  Guyane: "973",
  "La Réunion": "974",
  Mayotte: "976",
  "Saint-Pierre-et-Miquelon": "975",
  "Saint-Barthélemy": "977",
  "Saint-Martin": "978",
  "Wallis-et-Futuna": "986",
  "Polynésie française": "987",
  "Nouvelle-Calédonie": "988",
  // Français de l'étranger
  "Français établis hors de France": "099",
};

/**
 * Get department code from department name (for senators)
 */
function getDepartmentCode(deptName: string | null | undefined): string | null {
  if (!deptName) return null;

  // Direct match
  if (DEPARTMENT_NAME_TO_CODE[deptName]) {
    return DEPARTMENT_NAME_TO_CODE[deptName];
  }

  // Case-insensitive match
  const lowerName = deptName.toLowerCase();
  for (const [name, code] of Object.entries(DEPARTMENT_NAME_TO_CODE)) {
    if (name.toLowerCase() === lowerName) {
      return code;
    }
  }

  return null;
}

/**
 * Fetch senators from senat.fr API
 */
async function fetchSenatAPI(): Promise<SenateurAPI[]> {
  console.log(`Fetching senators from: ${SENAT_API_URL}`);

  const { data } = await client.get<SenateurAPI[]>(SENAT_API_URL);
  console.log(`Parsed ${data.length} senators from senat.fr`);
  return data;
}

/**
 * Fetch additional data from NosSenateurs (birth dates, etc.)
 */
async function fetchNosSenateursAPI(): Promise<Map<string, NosSenateursAPI>> {
  console.log(`Fetching additional data from: ${NOSSENATEURS_API_URL}`);

  try {
    const { data } = await client.get<{ senateurs?: NosSenateursAPI[] } | NosSenateursAPI[]>(
      NOSSENATEURS_API_URL
    );
    const senators: NosSenateursAPI[] = Array.isArray(data) ? data : data.senateurs || [];
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
 * Sync parliamentary groups from senators data.
 *
 * Creates/updates ParliamentaryGroup records (not Party records).
 * Resolves the real party via the config's partyWikidataId.
 */
async function syncSenateParliamentaryGroups(senators: SenateurAPI[]): Promise<{
  groupsCreated: number;
  groupsUpdated: number;
  codeToGroupId: Map<string, string>;
  codeToPartyId: Map<string, string | null>;
}> {
  const uniqueGroups = new Map<string, { code: string; libelle: string }>();

  // Extract unique groups
  for (const sen of senators) {
    if (sen.groupe?.code && !uniqueGroups.has(sen.groupe.code)) {
      uniqueGroups.set(sen.groupe.code, sen.groupe);
    }
  }

  let groupsCreated = 0;
  let groupsUpdated = 0;
  const codeToGroupId = new Map<string, string>();
  const codeToPartyId = new Map<string, string | null>();

  for (const [code, groupe] of uniqueGroups) {
    const config: ParliamentaryGroupConfig | undefined = SENATE_GROUPS[code];
    const groupCode = config?.code || code;
    const groupName = config?.name || groupe.libelle;

    // 1. Upsert parliamentary group
    const groupData = {
      name: groupName,
      shortName: config?.shortName || null,
      color: config?.color || "#888888",
      chamber: Chamber.SENAT,
      politicalPosition: config?.politicalPosition || null,
      wikidataId: config?.wikidataId || null,
    };

    let group = await db.parliamentaryGroup.findUnique({
      where: { code_chamber: { code: groupCode, chamber: Chamber.SENAT } },
    });

    if (group) {
      group = await db.parliamentaryGroup.update({
        where: { id: group.id },
        data: groupData,
      });
      groupsUpdated++;
    } else {
      group = await db.parliamentaryGroup.create({
        data: { code: groupCode, ...groupData },
      });
      groupsCreated++;
    }

    codeToGroupId.set(code, group.id);

    // 2. Resolve real party via defaultPartyId or Wikidata lookup
    let realPartyId: string | null = group.defaultPartyId;

    if (!realPartyId && config?.partyWikidataId) {
      const extId = await db.externalId.findFirst({
        where: {
          source: DataSource.WIKIDATA,
          externalId: config.partyWikidataId,
          partyId: { not: null },
        },
        select: { partyId: true },
      });
      realPartyId = extId?.partyId ?? null;

      if (realPartyId) {
        await db.parliamentaryGroup.update({
          where: { id: group.id },
          data: { defaultPartyId: realPartyId },
        });
      }
    }

    codeToPartyId.set(code, realPartyId);
  }

  return { groupsCreated, groupsUpdated, codeToGroupId, codeToPartyId };
}

/**
 * Sync a single senator
 */
async function syncSenator(
  sen: SenateurAPI,
  groupMap: Map<string, string>,
  partyMap: Map<string, string | null>,
  nosSenateursData: Map<string, NosSenateursAPI>
): Promise<"created" | "updated" | "error"> {
  try {
    const slug = generateSlug(`${sen.prenom}-${sen.nom}`);
    const fullName = `${sen.prenom} ${sen.nom}`;
    const partyId = sen.groupe?.code ? (partyMap.get(sen.groupe.code) ?? null) : null;
    const groupId = sen.groupe?.code ? groupMap.get(sen.groupe.code) || null : null;

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
    // Fallback: derive from senate renewal series
    // Serie 1 → elected Sept 24, 2023 | Serie 2 → elected Sept 27, 2020
    if (!mandateStart && sen.serie) {
      mandateStart = sen.serie === 1 ? new Date("2023-10-01") : new Date("2020-10-01");
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
    };

    const mandateData = {
      type: MandateType.SENATEUR,
      title: `Sénateur${sen.feminise ? "rice" : ""} ${sen.circonscription?.libelle || ""}`.trim(),
      institution: "Sénat",
      constituency: sen.circonscription?.libelle || null,
      departmentCode: getDepartmentCode(sen.circonscription?.libelle),
      startDate: mandateStart || new Date(),
      isCurrent: true,
      source: DataSource.SENAT,
      sourceUrl: sen.url
        ? `https://www.senat.fr${sen.url}`
        : `https://www.senat.fr/senateur/${sen.matricule}/`,
      officialUrl: sen.url
        ? `https://www.senat.fr${sen.url}`
        : `https://www.senat.fr/senateur/${sen.matricule}/`,
      externalId: `senat-${sen.matricule}`,
      parliamentaryGroupId: groupId,
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

      // Update party affiliation via service (real party, not group)
      await politicianService.setCurrentParty(existing.id, partyId);

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

      // Set party affiliation via service (creates PartyMembership)
      await politicianService.setCurrentParty(newPolitician.id, partyId);

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
    senat: 10,
    gouvernement: 10,
    nosdeputes: 5,
    nossenateurs: 5,
    wikidata: 3,
    manual: 1,
  };

  const currentPriority = currentSource ? priority[currentSource] || 0 : 0;
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

    // 2. Sync parliamentary groups and resolve real parties
    console.log("Syncing senate parliamentary groups...");
    const { groupsCreated, groupsUpdated, codeToGroupId, codeToPartyId } =
      await syncSenateParliamentaryGroups(senators);
    result.partiesCreated = groupsCreated;
    result.partiesUpdated = groupsUpdated;

    // 3. Sync senators (with real party ID, not group ID)
    console.log("Syncing senators...");
    for (const sen of senators) {
      const status = await syncSenator(sen, codeToGroupId, codeToPartyId, nosSenateursData);
      if (status === "created") result.senatorsCreated++;
      else if (status === "updated") result.senatorsUpdated++;
      else result.errors.push(`${sen.prenom} ${sen.nom}`);
    }

    // 4. Close mandates for senators no longer in the API
    const apiMatricules = new Set(senators.map((s) => s.matricule));

    const currentDbMandates = await db.mandate.findMany({
      where: { type: MandateType.SENATEUR, isCurrent: true },
      include: {
        politician: {
          select: {
            id: true,
            fullName: true,
            externalIds: {
              where: { source: DataSource.SENAT },
              select: { externalId: true },
            },
          },
        },
      },
    });

    let mandatesClosed = 0;
    for (const mandate of currentDbMandates) {
      const senatId = mandate.politician.externalIds[0]?.externalId;
      if (!senatId || !apiMatricules.has(senatId)) {
        await db.mandate.update({
          where: { id: mandate.id },
          data: { isCurrent: false, endDate: new Date() },
        });
        mandatesClosed++;
        console.log(`  Mandat fermé: ${mandate.politician.fullName}`);
      }
    }
    if (mandatesClosed > 0) {
      console.log(`${mandatesClosed} mandats sénatoriaux fermés (absents de l'API)`);
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
