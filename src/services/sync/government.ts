import { db } from "@/lib/db";
import { generateSlug } from "@/lib/utils";
import { MandateType, DataSource } from "@/generated/prisma";
import { parse } from "csv-parse/sync";
import { GouvernementCSV, GouvernementSyncResult, GOUV_FUNCTION_MAPPING } from "./types";

const DATA_GOUV_CSV_URL =
  "https://static.data.gouv.fr/resources/historique-des-gouvernements-de-la-veme-republique/20250313-105416/liste-membres-gouvernements-5eme-republique.csv";

// French month names for date parsing
const FRENCH_MONTHS: Record<string, number> = {
  "janvier": 0, "février": 1, "mars": 2, "avril": 3,
  "mai": 4, "juin": 5, "juillet": 6, "août": 7,
  "septembre": 8, "octobre": 9, "novembre": 10, "décembre": 11,
};

/**
 * Parse French date format: "vendredi 13 décembre 2024"
 */
function parseFrenchDate(dateStr: string): Date | null {
  if (!dateStr || dateStr.trim() === "") return null;

  try {
    // Remove day name and split
    const parts = dateStr.trim().split(" ");
    if (parts.length < 4) return null;

    // Format: "day dayNum month year" -> we need dayNum, month, year
    const dayNum = parseInt(parts[1], 10);
    const monthName = parts[2].toLowerCase();
    const year = parseInt(parts[3], 10);

    const month = FRENCH_MONTHS[monthName];
    if (month === undefined || isNaN(dayNum) || isNaN(year)) return null;

    return new Date(year, month, dayNum);
  } catch {
    return null;
  }
}

/**
 * Fetch and parse government members CSV
 */
async function fetchGovernmentCSV(): Promise<GouvernementCSV[]> {
  console.log(`Fetching government data from: ${DATA_GOUV_CSV_URL}`);

  const response = await fetch(DATA_GOUV_CSV_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch CSV: ${response.status}`);
  }

  const csvText = await response.text();
  const records = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    delimiter: ";",
    bom: true,
  }) as GouvernementCSV[];

  console.log(`Parsed ${records.length} government member records`);
  return records;
}

/**
 * Get current government members (those without end date)
 */
function getCurrentGovernment(records: GouvernementCSV[]): GouvernementCSV[] {
  // Find records without end date (current government)
  const current = records.filter((r) => !r.date_fin_fonction || r.date_fin_fonction.trim() === "");
  console.log(`Found ${current.length} current government members`);
  return current;
}

/**
 * Map function code to MandateType
 */
function getMandateType(code: string): MandateType {
  const mapping = GOUV_FUNCTION_MAPPING[code];
  switch (mapping) {
    case "PREMIER_MINISTRE":
      return MandateType.PREMIER_MINISTRE;
    case "MINISTRE":
      return MandateType.MINISTRE;
    case "MINISTRE_DELEGUE":
      return MandateType.MINISTRE_DELEGUE;
    case "SECRETAIRE_ETAT":
      return MandateType.SECRETAIRE_ETAT;
    default:
      return MandateType.MINISTRE;
  }
}

/**
 * Sync a single government member
 */
async function syncGovernmentMember(
  member: GouvernementCSV
): Promise<{ status: "created" | "updated" | "error"; mandateCreated: boolean }> {
  try {
    const slug = generateSlug(`${member.prenom}-${member.nom}`);
    const fullName = `${member.prenom} ${member.nom}`;

    // Parse dates
    const startDate = parseFrenchDate(member.date_debut_fonction);
    const endDate = parseFrenchDate(member.date_fin_fonction);

    if (!startDate) {
      console.warn(`Could not parse start date for ${fullName}: ${member.date_debut_fonction}`);
      return { status: "error", mandateCreated: false };
    }

    // Check if politician exists by external ID first
    const existingByExtId = await db.externalId.findFirst({
      where: {
        source: DataSource.GOUVERNEMENT,
        externalId: { startsWith: `gouv-${member.id}-` },
        politician: {
          OR: [
            { slug },
            {
              firstName: { equals: member.prenom, mode: "insensitive" },
              lastName: { equals: member.nom, mode: "insensitive" },
            },
          ],
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

    // Fallback: try by name
    if (!existing) {
      existing = await db.politician.findFirst({
        where: {
          firstName: { equals: member.prenom, mode: "insensitive" },
          lastName: { equals: member.nom, mode: "insensitive" },
        },
        include: { mandates: true },
      });
    }

    const mandateType = getMandateType(member.code_fonction);
    const isCurrent = !endDate;
    const externalId = `gouv-${member.id}-${member.code_fonction}-${startDate.toISOString().split("T")[0]}`;

    // Photo URL from gouvernement.fr (if available)
    // Note: gouvernement.fr doesn't have a reliable photo API, so we'll rely on other sources
    const photoUrl = null;

    const politicianData = {
      slug,
      firstName: member.prenom,
      lastName: member.nom,
      fullName,
    };

    const mandateData = {
      type: mandateType,
      title: member.fonction,
      institution: `Gouvernement ${member.gouvernement}`,
      startDate,
      endDate,
      isCurrent,
      sourceUrl: "https://www.info.gouv.fr/composition-du-gouvernement",
      externalId,
    };

    let status: "created" | "updated" = "updated";
    let mandateCreated = false;

    if (existing) {
      // Check if this specific mandate already exists
      const existingMandate = existing.mandates.find(
        (m) => m.externalId === externalId
      );

      if (!existingMandate) {
        // Create new mandate for existing politician
        await db.mandate.create({
          data: { ...mandateData, politicianId: existing.id },
        });
        mandateCreated = true;
      } else {
        // Update existing mandate
        await db.mandate.update({
          where: { id: existingMandate.id },
          data: mandateData,
        });
      }

      // Upsert external ID
      await upsertExternalId(existing.id, externalId);
    } else {
      // Create new politician with mandate
      const newPolitician = await db.politician.create({
        data: {
          ...politicianData,
          photoSource: photoUrl ? "gouvernement" : null,
          mandates: { create: mandateData },
        },
      });

      await upsertExternalId(newPolitician.id, externalId);
      status = "created";
      mandateCreated = true;
    }

    return { status, mandateCreated };
  } catch (error) {
    console.error(`Error syncing ${member.prenom} ${member.nom}:`, error);
    return { status: "error", mandateCreated: false };
  }
}

/**
 * Upsert external ID for government member
 */
async function upsertExternalId(politicianId: string, externalId: string): Promise<void> {
  await db.externalId.upsert({
    where: {
      source_externalId: {
        source: DataSource.GOUVERNEMENT,
        externalId,
      },
    },
    create: {
      politicianId,
      source: DataSource.GOUVERNEMENT,
      externalId,
      url: "https://www.info.gouv.fr/composition-du-gouvernement",
    },
    update: {
      politicianId,
    },
  });
}

/**
 * Main sync function - imports current government members
 */
export async function syncGovernment(options: { currentOnly?: boolean } = {}): Promise<GouvernementSyncResult> {
  const { currentOnly = true } = options;

  const result: GouvernementSyncResult = {
    success: false,
    membersCreated: 0,
    membersUpdated: 0,
    mandatesCreated: 0,
    errors: [],
  };

  try {
    console.log("Starting government sync...");

    // 1. Fetch all government data
    const allRecords = await fetchGovernmentCSV();

    // 2. Filter to current government if requested
    const records = currentOnly ? getCurrentGovernment(allRecords) : allRecords;

    // 3. Sync members
    console.log(`Syncing ${records.length} government members...`);
    for (const member of records) {
      const { status, mandateCreated } = await syncGovernmentMember(member);
      if (status === "created") result.membersCreated++;
      else if (status === "updated") result.membersUpdated++;
      else result.errors.push(`${member.prenom} ${member.nom}`);

      if (mandateCreated) result.mandatesCreated++;
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
 * Get government stats
 */
export async function getGovernmentStats() {
  const ministerTypes = [
    MandateType.PREMIER_MINISTRE,
    MandateType.MINISTRE,
    MandateType.MINISTRE_DELEGUE,
    MandateType.SECRETAIRE_ETAT,
  ];

  const [currentMembers, allMandates] = await Promise.all([
    db.mandate.count({
      where: {
        type: { in: ministerTypes },
        isCurrent: true,
      },
    }),
    db.mandate.count({
      where: {
        type: { in: ministerTypes },
      },
    }),
  ]);

  return {
    currentGovernmentMembers: currentMembers,
    totalGovernmentMandates: allMandates,
  };
}
