import { db } from "@/lib/db";
import { DataSource, LocalOfficialRole, MandateType } from "@/generated/prisma";
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
 * Build a 5-character INSEE code from department code + commune code.
 * Same logic as candidatures.ts buildInseeCode.
 */
function buildInseeCode(deptCode: string, communeCode: string): string {
  const trimmedDept = deptCode.trim();
  const trimmedCommune = communeCode.trim();

  let code: string;
  if (trimmedDept.length === 3) {
    // DOM-TOM: 3-digit dept + 2-digit commune = 5 chars
    code = trimmedDept + trimmedCommune.padStart(2, "0");
  } else {
    // Metropolitan or Corsica: 2-char dept + 3-digit commune = 5 chars
    code = trimmedDept + trimmedCommune.padStart(3, "0");
  }

  if (code.length !== 5) {
    console.warn(
      `buildInseeCode: unexpected length ${code.length} for dept="${deptCode}" commune="${communeCode}" -> "${code}"`
    );
  }

  return code;
}

/**
 * Normalize a name to title case, handling compound names with spaces and hyphens.
 */
function normalizeName(name: string): string {
  return name
    .split(/[\s-]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
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
  const normalizedLastName = normalizeName(nom);
  const normalizedFirstName = normalizeName(prenom);

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
 * Sync RNE maires data — 4-phase pipeline:
 *   Phase 0: Snapshot current mayors from DB
 *   Phase 1: Parse CSV + upsert all 35k LocalOfficial records
 *   Phase 2: Reconcile unmatched LocalOfficials with politicians + create mandates
 *   Phase 3: Close stale officials no longer in CSV
 */
export async function syncRNEMaires(
  options: {
    dryRun?: boolean;
    limit?: number;
    verbose?: boolean;
  } = {}
): Promise<RNESyncResult> {
  const { dryRun = false, limit, verbose = false } = options;

  let officialsCreated = 0;
  let officialsUpdated = 0;
  let officialsClosed = 0;
  let mandatesCreated = 0;
  let mandatesUpdated = 0;
  let mandatesClosed = 0;
  let politiciansMatched = 0;
  let politiciansNotFound = 0;
  const errors: string[] = [];

  // ========================================
  // Phase 0: Snapshot current MAIRE officials
  // ========================================
  console.log("\n--- Phase 0: Snapshot current mayors from DB ---");
  const currentMayorsFromDB = await db.localOfficial.findMany({
    where: {
      role: LocalOfficialRole.MAIRE,
      isCurrent: true,
    },
    select: {
      id: true,
      communeId: true,
      politicianId: true,
    },
  });

  const previousCommuneIds = new Set(
    currentMayorsFromDB.filter((m) => m.communeId).map((m) => m.communeId!)
  );
  console.log(
    `  Found ${currentMayorsFromDB.length} current mayors in DB (${previousCommuneIds.size} unique communes)`
  );

  const seenCommuneIds = new Set<string>();

  // ========================================
  // Phase 1: Parse CSV + upsert LocalOfficial
  // ========================================
  console.log("\n--- Phase 1: Parse CSV + upsert LocalOfficial ---");
  const records = await fetchRNECSV();
  const toProcess = limit ? records.slice(0, limit) : records;

  console.log(`Processing ${toProcess.length} maires...`);

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
      const genderCode = row["Code sexe"]; // M or F

      if (!nom || !prenom) {
        errors.push(`Row ${i + 1}: missing name`);
        continue;
      }

      if (!deptCode || !codeCommune) {
        errors.push(`Row ${i + 1}: missing department or commune code for ${prenom} ${nom}`);
        continue;
      }

      const inseeCode = buildInseeCode(deptCode, codeCommune);
      seenCommuneIds.add(inseeCode);

      const normalizedFirstName = normalizeName(prenom);
      const normalizedLastName = normalizeName(nom);
      const fullName = `${normalizedFirstName} ${normalizedLastName}`;
      const gender = genderCode === "M" ? "M" : genderCode === "F" ? "F" : null;

      if (dryRun) {
        if (verbose && i + 1 <= 10) {
          console.log(
            `  [DRY-RUN] Would upsert LocalOfficial: ${fullName} (${commune}, ${inseeCode})`
          );
        }
        // Still count for reporting
        officialsCreated++; // approximate in dry-run
        continue;
      }

      // Upsert LocalOfficial using unique constraint: role + communeId
      const existing = await db.localOfficial.findUnique({
        where: {
          one_official_per_role_commune: {
            role: LocalOfficialRole.MAIRE,
            communeId: inseeCode,
          },
        },
        select: { id: true },
      });

      if (existing) {
        await db.localOfficial.update({
          where: { id: existing.id },
          data: {
            firstName: normalizedFirstName,
            lastName: normalizedLastName,
            fullName,
            gender,
            birthDate,
            departmentCode: deptCode,
            mandateStart: mandateStartDate,
            functionStart: functionStartDate,
            isCurrent: true,
            mandateEnd: null, // re-open if it was closed
            source: DataSource.RNE,
          },
        });
        officialsUpdated++;
      } else {
        await db.localOfficial.create({
          data: {
            role: LocalOfficialRole.MAIRE,
            communeId: inseeCode,
            firstName: normalizedFirstName,
            lastName: normalizedLastName,
            fullName,
            gender,
            birthDate,
            departmentCode: deptCode,
            mandateStart: mandateStartDate,
            functionStart: functionStartDate,
            isCurrent: true,
            source: DataSource.RNE,
          },
        });
        officialsCreated++;
      }
    } catch (error) {
      errors.push(`Row ${i + 1}: ${error}`);
    }

    // Log progress every 1000 rows
    if ((i + 1) % 1000 === 0) {
      console.log(
        `  Progress: ${i + 1}/${toProcess.length} (created: ${officialsCreated}, updated: ${officialsUpdated}, errors: ${errors.length})`
      );
    }
  }

  console.log(
    `  Phase 1 complete: ${officialsCreated} created, ${officialsUpdated} updated, ${errors.length} errors`
  );

  if (dryRun) {
    console.log("\n[DRY-RUN] Skipping phases 2-3");
    return {
      success: errors.length === 0,
      officialsCreated,
      officialsUpdated,
      officialsClosed: 0,
      mandatesCreated: 0,
      mandatesUpdated: 0,
      mandatesClosed: 0,
      politiciansMatched: 0,
      politiciansNotFound: 0,
      errors,
    };
  }

  // ========================================
  // Phase 2: Reconcile with Politician
  // ========================================
  console.log("\n--- Phase 2: Reconcile LocalOfficials with Politicians ---");

  const unmatchedOfficials = await db.localOfficial.findMany({
    where: {
      role: LocalOfficialRole.MAIRE,
      isCurrent: true,
      politicianId: null,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      birthDate: true,
      departmentCode: true,
      communeId: true,
      mandateStart: true,
      functionStart: true,
    },
  });

  console.log(`  Found ${unmatchedOfficials.length} unmatched officials to reconcile`);

  for (let i = 0; i < unmatchedOfficials.length; i++) {
    const official = unmatchedOfficials[i];

    try {
      const politicianId = await matchPolitician(
        official.firstName,
        official.lastName,
        official.birthDate,
        official.departmentCode
      );

      if (!politicianId) {
        politiciansNotFound++;
        if (verbose && politiciansNotFound <= 20) {
          console.log(
            `  No match: ${official.firstName} ${official.lastName} (${official.communeId}, ${official.departmentCode})`
          );
        }
        continue;
      }

      politiciansMatched++;

      // Link official to politician
      await db.localOfficial.update({
        where: { id: official.id },
        data: { politicianId },
      });

      // Determine the commune name for the mandate title
      let communeName: string | null = null;
      if (official.communeId) {
        const commune = await db.commune.findUnique({
          where: { id: official.communeId },
          select: { name: true },
        });
        communeName = commune?.name ?? null;
      }

      const mandateTitle = communeName
        ? `Maire de ${communeName}`
        : `Maire (${official.communeId || official.departmentCode})`;

      const startDate = official.functionStart || official.mandateStart || new Date(2020, 4, 18); // Default: May 2020 municipal

      // Create or update mandate
      const existingMandate = await db.mandate.findFirst({
        where: {
          politicianId,
          type: MandateType.MAIRE,
          isCurrent: true,
        },
      });

      if (existingMandate) {
        await db.mandate.update({
          where: { id: existingMandate.id },
          data: {
            title: mandateTitle,
            constituency: communeName || official.communeId || undefined,
            departmentCode: official.departmentCode,
            startDate,
          },
        });
        mandatesUpdated++;
      } else {
        await db.mandate.create({
          data: {
            politicianId,
            type: MandateType.MAIRE,
            title: mandateTitle,
            institution: "Commune",
            constituency: communeName || official.communeId || undefined,
            departmentCode: official.departmentCode,
            startDate,
            isCurrent: true,
            source: DataSource.RNE,
          },
        });
        mandatesCreated++;
      }

      // Upsert ExternalId for the matched politician
      if (official.communeId) {
        await db.externalId.upsert({
          where: {
            source_externalId: {
              source: DataSource.RNE,
              externalId: official.communeId,
            },
          },
          create: {
            source: DataSource.RNE,
            externalId: official.communeId,
            politicianId,
            url: `https://www.data.gouv.fr/fr/datasets/repertoire-national-des-elus-1/`,
          },
          update: {
            politicianId,
          },
        });
      }

      if (verbose && (i + 1) % 100 === 0) {
        console.log(
          `  Reconcile progress: ${i + 1}/${unmatchedOfficials.length} (matched: ${politiciansMatched})`
        );
      }
    } catch (error) {
      errors.push(`Reconcile ${official.firstName} ${official.lastName}: ${error}`);
    }
  }

  console.log(
    `  Phase 2 complete: ${politiciansMatched} matched, ${politiciansNotFound} not found, ${mandatesCreated} mandates created, ${mandatesUpdated} mandates updated`
  );

  // ========================================
  // Phase 3: Close stale officials
  // ========================================
  console.log("\n--- Phase 3: Close stale officials ---");

  // Find officials that were current in the snapshot but whose commune is not in the CSV
  const staleOfficials = currentMayorsFromDB.filter(
    (m) => m.communeId && !seenCommuneIds.has(m.communeId)
  );

  console.log(`  Found ${staleOfficials.length} stale officials to close`);

  for (const stale of staleOfficials) {
    try {
      // Close the LocalOfficial
      await db.localOfficial.update({
        where: { id: stale.id },
        data: {
          isCurrent: false,
          mandateEnd: new Date(),
        },
      });
      officialsClosed++;

      // If they had a linked politician, also close their MAIRE mandate
      if (stale.politicianId) {
        const currentMaireMandate = await db.mandate.findFirst({
          where: {
            politicianId: stale.politicianId,
            type: MandateType.MAIRE,
            isCurrent: true,
          },
        });

        if (currentMaireMandate) {
          await db.mandate.update({
            where: { id: currentMaireMandate.id },
            data: {
              isCurrent: false,
              endDate: new Date(),
            },
          });
          mandatesClosed++;
        }
      }
    } catch (error) {
      errors.push(`Close stale official ${stale.id}: ${error}`);
    }
  }

  console.log(
    `  Phase 3 complete: ${officialsClosed} officials closed, ${mandatesClosed} mandates closed`
  );

  // ========================================
  // Summary
  // ========================================
  console.log(`\n${"=".repeat(50)}`);
  console.log(`Results:`);
  console.log(`  Officials created: ${officialsCreated}`);
  console.log(`  Officials updated: ${officialsUpdated}`);
  console.log(`  Officials closed:  ${officialsClosed}`);
  console.log(`  Mandates created:  ${mandatesCreated}`);
  console.log(`  Mandates updated:  ${mandatesUpdated}`);
  console.log(`  Mandates closed:   ${mandatesClosed}`);
  console.log(`  Politicians matched: ${politiciansMatched}`);
  console.log(`  Politicians not found: ${politiciansNotFound}`);
  console.log(`  Errors: ${errors.length}`);

  return {
    success: errors.length === 0,
    officialsCreated,
    officialsUpdated,
    officialsClosed,
    mandatesCreated,
    mandatesUpdated,
    mandatesClosed,
    politiciansMatched,
    politiciansNotFound,
    errors,
  };
}

/**
 * Get RNE sync statistics (queries LocalOfficial table)
 */
export async function getRNEStats() {
  const totalOfficials = await db.localOfficial.count({
    where: { role: LocalOfficialRole.MAIRE },
  });
  const totalMatched = await db.localOfficial.count({
    where: { role: LocalOfficialRole.MAIRE, politicianId: { not: null } },
  });
  const totalCurrent = await db.localOfficial.count({
    where: { role: LocalOfficialRole.MAIRE, isCurrent: true },
  });

  return { totalOfficials, totalMatched, totalCurrent };
}
