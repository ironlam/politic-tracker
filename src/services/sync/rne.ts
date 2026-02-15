import { db } from "@/lib/db";
import { DataSource, MandateType } from "@/generated/prisma";
import { parse } from "csv-parse/sync";
import type { MaireRNECSV, RNESyncResult } from "./types";
import { HTTPClient } from "@/lib/api/http-client";
import { DATA_GOUV_RATE_LIMIT_MS } from "@/config/rate-limits";

const client = new HTTPClient({ rateLimitMs: DATA_GOUV_RATE_LIMIT_MS });

const RNE_MAIRES_CSV_URL =
  "https://static.data.gouv.fr/resources/repertoire-national-des-elus-1/20251223-104211/elus-maires-mai.csv";

/**
 * Parse a French date string (DD/MM/YYYY) to a Date object
 */
function parseFrenchDate(str: string): Date | null {
  if (!str || str.trim() === "") return null;
  const parts = str.trim().split("/");
  if (parts.length !== 3) return null;
  const [day, month, year] = parts.map(Number);
  if (!day || !month || !year) return null;
  const date = new Date(year, month - 1, day);
  // Validate the date is reasonable
  if (isNaN(date.getTime()) || year < 1900 || year > 2100) return null;
  return date;
}

/**
 * Fetch and parse RNE maires CSV
 */
async function fetchRNECSV(): Promise<MaireRNECSV[]> {
  console.log(`Fetching RNE maires data from: ${RNE_MAIRES_CSV_URL}`);

  const { data: csvText } = await client.getText(RNE_MAIRES_CSV_URL);
  const records = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    delimiter: ";",
    bom: true,
  }) as MaireRNECSV[];

  console.log(`Parsed ${records.length} maire records`);
  return records;
}

/**
 * Match a politician in our database by name and birth date
 */
async function matchPolitician(
  prenom: string,
  nom: string,
  birthDate: Date | null,
  deptCode: string
): Promise<string | null> {
  // Normalize name: "NOM" -> "Nom", handle compound names
  const normalizedLastName = nom
    .split(/[\s-]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");

  const normalizedFirstName = prenom
    .split(/[\s-]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");

  // Search by name (case-insensitive)
  const candidates = await db.politician.findMany({
    where: {
      lastName: { equals: normalizedLastName, mode: "insensitive" },
      firstName: { equals: normalizedFirstName, mode: "insensitive" },
    },
    select: {
      id: true,
      birthDate: true,
      mandates: {
        where: { departmentCode: deptCode },
        select: { id: true },
        take: 1,
      },
    },
  });

  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0].id;

  // Multiple matches: prefer by birthDate match
  if (birthDate) {
    for (const c of candidates) {
      if (c.birthDate) {
        const diff = Math.abs(c.birthDate.getTime() - birthDate.getTime());
        // Tolerance of 1 day (86400000 ms)
        if (diff <= 86400000) return c.id;
      }
    }
  }

  // Prefer candidate with existing mandate in same department
  for (const c of candidates) {
    if (c.mandates.length > 0) return c.id;
  }

  // Fall back to first match
  return candidates[0].id;
}

/**
 * Sync RNE maires data
 */
export async function syncRNEMaires(
  options: {
    dryRun?: boolean;
    limit?: number;
    verbose?: boolean;
  } = {}
): Promise<RNESyncResult> {
  const { dryRun = false, limit, verbose = false } = options;

  const records = await fetchRNECSV();
  const toProcess = limit ? records.slice(0, limit) : records;

  let mandatesCreated = 0;
  let mandatesUpdated = 0;
  let politiciansMatched = 0;
  let politiciansNotFound = 0;
  const errors: string[] = [];

  console.log(`\nProcessing ${toProcess.length} maires...`);

  for (let i = 0; i < toProcess.length; i++) {
    const row = toProcess[i];

    try {
      const nom = row["Nom de l'élu"];
      const prenom = row["Prénom de l'élu"];
      const commune = row["Libellé de la commune"];
      const codeCommune = row["Code de la commune"];
      const deptCode = row["Code du département"];
      const birthDate = parseFrenchDate(row["Date de naissance"]);
      const mandateStartDate = parseFrenchDate(row["Date de début du mandat"]);
      const functionStartDate = parseFrenchDate(row["Date de début de la fonction"]);

      if (!nom || !prenom) {
        errors.push(`Row ${i + 1}: missing name`);
        continue;
      }

      // Try to match with existing politician
      const politicianId = await matchPolitician(prenom, nom, birthDate, deptCode);

      if (!politicianId) {
        politiciansNotFound++;
        if (verbose && politiciansNotFound <= 20) {
          console.log(`  No match: ${prenom} ${nom} (${commune}, ${deptCode})`);
        }
        continue;
      }

      politiciansMatched++;

      if (dryRun) {
        if (verbose) {
          console.log(
            `  [DRY-RUN] Would create/update MAIRE mandate for ${prenom} ${nom} (${commune})`
          );
        }
        continue;
      }

      // Check if mandate already exists
      const existingMandate = await db.mandate.findFirst({
        where: {
          politicianId,
          type: MandateType.MAIRE,
          isCurrent: true,
        },
      });

      const startDate = functionStartDate || mandateStartDate || new Date(2020, 4, 18); // Default: May 2020 municipal

      if (existingMandate) {
        // Update existing mandate
        await db.mandate.update({
          where: { id: existingMandate.id },
          data: {
            title: `Maire de ${commune}`,
            constituency: commune,
            departmentCode: deptCode,
            startDate,
          },
        });
        mandatesUpdated++;
      } else {
        // Create new mandate
        await db.mandate.create({
          data: {
            politicianId,
            type: MandateType.MAIRE,
            title: `Maire de ${commune}`,
            institution: "Commune",
            constituency: commune,
            departmentCode: deptCode,
            startDate,
            isCurrent: true,
            source: DataSource.RNE,
          },
        });
        mandatesCreated++;
      }

      // Create/update ExternalId
      await db.externalId.upsert({
        where: {
          source_externalId: {
            source: DataSource.RNE,
            externalId: codeCommune,
          },
        },
        create: {
          source: DataSource.RNE,
          externalId: codeCommune,
          politicianId,
          url: `https://www.data.gouv.fr/fr/datasets/repertoire-national-des-elus-1/`,
        },
        update: {
          politicianId,
        },
      });

      if (verbose && (i + 1) % 1000 === 0) {
        console.log(`  Progress: ${i + 1}/${toProcess.length} (matched: ${politiciansMatched})`);
      }
    } catch (error) {
      errors.push(`Row ${i + 1}: ${error}`);
    }
  }

  console.log(`\nResults:`);
  console.log(`  Matched: ${politiciansMatched}`);
  console.log(`  Not found: ${politiciansNotFound}`);
  console.log(`  Mandates created: ${mandatesCreated}`);
  console.log(`  Mandates updated: ${mandatesUpdated}`);
  console.log(`  Errors: ${errors.length}`);

  return {
    success: errors.length === 0,
    mandatesCreated,
    mandatesUpdated,
    politiciansMatched,
    politiciansNotFound,
    errors,
  };
}

/**
 * Get RNE sync statistics
 */
export async function getRNEStats() {
  const [totalMaireMandates, totalRNEExternalIds] = await Promise.all([
    db.mandate.count({
      where: { type: MandateType.MAIRE, isCurrent: true },
    }),
    db.externalId.count({
      where: { source: DataSource.RNE },
    }),
  ]);

  return {
    totalMaireMandates,
    totalRNEExternalIds,
  };
}
