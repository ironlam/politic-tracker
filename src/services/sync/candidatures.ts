import { db } from "@/lib/db";
import { ElectionStatus, Prisma } from "@/generated/prisma";
import { parse } from "csv-parse/sync";
import { NUANCE_POLITIQUE_MAPPING } from "@/config/labels";
import type { CandidatureMunicipaleCSV, CandidaturesSyncResult } from "./types";
import { HTTPClient } from "@/lib/api/http-client";
import { DATA_GOUV_RATE_LIMIT_MS } from "@/config/rate-limits";

// 2020 test URL (tab-separated, ISO-8859-1, comment header)
const DEFAULT_CSV_URL =
  "https://static.data.gouv.fr/resources/elections-municipales-2020-candidatures-au-1er-tour/20200304-105123/livre-des-listes-et-candidats.txt";

const DEFAULT_ELECTION_SLUG = "municipales-2026";

// 500 rows per chunk: balances batch efficiency vs. DB round-trips.
// Within each chunk: 1 createMany (candidates) + 1 findMany + 1 createMany (candidacies) + N updates.
const CHUNK_SIZE = 500;

const dataGouvClient = new HTTPClient({
  rateLimitMs: DATA_GOUV_RATE_LIMIT_MS,
  sourceName: "data.gouv.fr (candidatures)",
});

/**
 * Fetch and parse the candidatures CSV (TXT with tab delimiter, ISO-8859-1)
 */
async function fetchCandidaturesCSV(url: string): Promise<CandidatureMunicipaleCSV[]> {
  console.log(`Fetching candidatures from: ${url}`);

  // The file is ISO-8859-1 encoded — fetch as buffer and decode manually
  const { data: buffer } = await dataGouvClient.getBuffer(url);
  const decoder = new TextDecoder("iso-8859-1");
  const text = decoder.decode(buffer);

  // The 2020 file starts with a comment line + blank line before headers
  // csv-parse from_line: 3 skips those
  const records = parse(text, {
    delimiter: "\t",
    columns: true,
    skip_empty_lines: true,
    bom: true,
    from_line: 3,
    trim: true,
    relax_column_count: true,
  }) as CandidatureMunicipaleCSV[];

  console.log(`Parsed ${records.length} candidature records`);
  return records;
}

/**
 * Match a politician by name (case-insensitive), with department fallback
 */
async function matchPolitician(
  prenom: string,
  nom: string,
  deptCode: string
): Promise<string | null> {
  // Normalize: "NOM" -> "Nom"
  const normalizedLastName = nom
    .split(/[\s-]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");

  const normalizedFirstName = prenom
    .split(/[\s-]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");

  const candidates = await db.politician.findMany({
    where: {
      lastName: { equals: normalizedLastName, mode: "insensitive" },
      firstName: { equals: normalizedFirstName, mode: "insensitive" },
    },
    select: {
      id: true,
      mandates: {
        where: { departmentCode: deptCode },
        select: { id: true },
        take: 1,
      },
    },
  });

  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0]!.id;

  // Multiple: prefer candidate with mandate in same department
  for (const c of candidates) {
    if (c.mandates.length > 0) return c.id;
  }

  return candidates[0]!.id;
}

/**
 * Match party by nuance code using NUANCE_POLITIQUE_MAPPING
 */
async function matchParty(nuanceCode: string): Promise<string | null> {
  const shortName = NUANCE_POLITIQUE_MAPPING[nuanceCode];
  if (!shortName) return null;

  const party = await db.party.findFirst({
    where: { shortName },
    select: { id: true },
  });

  return party?.id ?? null;
}

/**
 * Normalize a name from CSV (all-caps or mixed) to title case,
 * preserving hyphens and spaces.
 * "JEAN-PIERRE" -> "Jean-Pierre", "DE LA FONTAINE" -> "De La Fontaine"
 */
function normalizeName(raw: string): string {
  return raw.replace(/[A-Za-zÀ-ÿ]+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

/**
 * Build the INSEE code from department code and commune code.
 * INSEE code = departmentCode + communeCode (padded to 3 digits).
 * Examples:
 *   dept "13", commune "055" -> "13055" (Marseille)
 *   dept "75", commune "056" -> "75056" (Paris)
 *   dept "971", commune "05" -> "97105" (DOM-TOM — dept is 3 digits, commune padded to 2)
 *
 * Standard: metropolitan depts are 2 digits (or "2A"/"2B" for Corsica),
 * commune code is 3 digits. DOM depts are 3 digits, commune code is 2 digits.
 * The total INSEE code is always 5 characters.
 */
function buildInseeCode(deptCode: string, communeCode: string): string {
  // The CSV commune code may already be properly formatted.
  // For metropolitan France (2-char dept), commune code should be 3 digits.
  // For DOM-TOM (3-char dept like "971"), commune code should be 2 digits.
  // Corsica: "2A" or "2B" are 2-char dept codes.
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

/** Parsed row data extracted from a CSV row, ready for processing */
interface ParsedRow {
  /** Index in the toProcess array (for error reporting) */
  index: number;
  firstName: string;
  lastName: string;
  normalizedFirstName: string;
  normalizedLastName: string;
  gender: string | null;
  nationality: string | null;
  deptCode: string;
  codeCommune: string;
  communeName: string;
  nuanceCode: string;
  listName: string | null;
  listPosition: number | null;
  partyLabel: string | null;
  candidateName: string;
  constituencyCode: string;
  inseeCode: string;
}

/**
 * Pre-load all communes into a Map<inseeCode, true> for fast lookup.
 * Commune.id IS the INSEE code.
 */
async function loadCommuneMap(): Promise<Set<string>> {
  const communes = await db.commune.findMany({
    select: { id: true },
  });
  const set = new Set<string>();
  for (const c of communes) {
    set.add(c.id);
  }
  console.log(`  Pre-loaded ${set.size} communes`);
  return set;
}

/**
 * Pre-load all existing candidacies for a given election into a Map
 * keyed by "candidateName|constituencyCode" -> candidacyId.
 */
async function loadExistingCandidacies(electionId: string): Promise<Map<string, string>> {
  const existing = await db.candidacy.findMany({
    where: { electionId },
    select: { id: true, candidateName: true, constituencyCode: true },
  });
  const map = new Map<string, string>();
  for (const c of existing) {
    if (c.constituencyCode) {
      map.set(`${c.candidateName}|${c.constituencyCode}`, c.id);
    }
  }
  console.log(`  Pre-loaded ${map.size} existing candidacies`);
  return map;
}

/**
 * Pre-warm the party cache by resolving all nuance codes upfront.
 * There are only ~20-30 distinct nuance codes, so this is cheap.
 */
async function preWarmPartyCache(): Promise<Map<string, string | null>> {
  const cache = new Map<string, string | null>();
  const nuanceCodes = Object.keys(NUANCE_POLITIQUE_MAPPING);

  for (const code of nuanceCodes) {
    const partyId = await matchParty(code);
    cache.set(code, partyId);
  }

  console.log(`  Pre-warmed party cache: ${cache.size} nuance codes`);
  return cache;
}

/**
 * Sync candidatures municipales from a data.gouv.fr CSV
 */
export async function syncCandidaturesMunicipales(
  options: {
    url?: string;
    election?: string;
    dryRun?: boolean;
    limit?: number;
    verbose?: boolean;
  } = {}
): Promise<CandidaturesSyncResult> {
  const {
    url = DEFAULT_CSV_URL,
    election: electionSlug = DEFAULT_ELECTION_SLUG,
    dryRun = false,
    limit,
    verbose = false,
  } = options;

  // Find the target election
  const electionRecord = await db.election.findUnique({
    where: { slug: electionSlug },
  });

  if (!electionRecord) {
    throw new Error(`Election "${electionSlug}" not found. Run 'npm run seed:elections' first.`);
  }

  console.log(`Target election: ${electionRecord.title} (${electionRecord.slug})`);

  // ─── Phase A: Pre-load reference data ───────────────────────────────
  console.log("\nPhase A: Pre-loading reference data...");

  // Sequential to avoid pool starvation (pool max: 2, these are 3 queries)
  const communeSet = await loadCommuneMap();
  const existingCandidacyMap = await loadExistingCandidacies(electionRecord.id);
  const partyCache = await preWarmPartyCache();

  // Cache for politician lookups: "firstName|lastName|deptCode" -> politicianId | null
  const politicianCache = new Map<string, string | null>();

  // ─── Fetch and parse CSV ────────────────────────────────────────────
  const records = await fetchCandidaturesCSV(url);
  const toProcess = limit ? records.slice(0, limit) : records;

  // ─── Parse all rows upfront (CPU-only, no DB) ──────────────────────
  console.log(`\nParsing ${toProcess.length} rows...`);
  const parsedRows: ParsedRow[] = [];
  const parseErrors: string[] = [];

  for (let i = 0; i < toProcess.length; i++) {
    const row = toProcess[i];
    const nom = row!["Nom candidat"];
    const prenom = row!["Prénom candidat"];

    if (!nom || !prenom) {
      parseErrors.push(`Row ${i + 1}: missing candidate name`);
      continue;
    }

    const deptCode = row!["Code du département"];
    const codeCommune = row!["Code commune"];
    const nuanceCode = row!["Nuance Liste"];
    const rawListName = row!["Libellé Etendu Liste"] || row!["Libellé abrégé liste"];
    const rawListPosition = parseInt(row!["N° candidat"], 10);
    const gender = row!["Sexe candidat"] || null;
    const nationality = row!["Nationalité"] || null;

    parsedRows.push({
      index: i,
      firstName: prenom,
      lastName: nom,
      normalizedFirstName: normalizeName(prenom),
      normalizedLastName: normalizeName(nom),
      gender: gender === "M" || gender === "F" ? gender : null,
      nationality: nationality || null,
      deptCode,
      codeCommune,
      communeName: row!["Libellé commune"],
      nuanceCode,
      listName: rawListName || null,
      listPosition: isNaN(rawListPosition) ? null : rawListPosition,
      partyLabel: row!["Libellé abrégé liste"] || nuanceCode || null,
      candidateName: `${prenom} ${nom}`,
      constituencyCode: `${deptCode}-${codeCommune}`,
      inseeCode: buildInseeCode(deptCode, codeCommune),
    });
  }

  console.log(`  Parsed: ${parsedRows.length} valid rows, ${parseErrors.length} parse errors`);

  if (dryRun) {
    // Dry run: just report what we'd do
    const politiciansMatched = 0;
    const politiciansNotFound = 0;
    let candidaciesWithCommune = 0;

    for (const row of parsedRows) {
      if (communeSet.has(row.inseeCode)) candidaciesWithCommune++;

      if (verbose) {
        const communeMatch = communeSet.has(row.inseeCode) ? "[COMMUNE]" : "";
        console.log(
          `  [DRY-RUN] ${row.candidateName} | ${row.communeName} | ${row.nuanceCode} | list: ${row.listName} #${row.listPosition} ${communeMatch}`
        );
      }
    }

    return {
      success: parseErrors.length === 0,
      candidaciesCreated: 0,
      candidaciesUpdated: 0,
      candidatesCreated: 0,
      candidaciesWithCommune,
      politiciansMatched,
      politiciansNotFound,
      errors: parseErrors,
    };
  }

  // ─── Phase B: Process in chunks ─────────────────────────────────────
  console.log(`\nPhase B: Processing ${parsedRows.length} rows in chunks of ${CHUNK_SIZE}...`);

  let candidaciesCreated = 0;
  let candidaciesUpdated = 0;
  let candidatesCreated = 0;
  let candidaciesWithCommune = 0;
  let politiciansMatched = 0;
  let politiciansNotFound = 0;
  const errors: string[] = [...parseErrors];

  const totalChunks = Math.ceil(parsedRows.length / CHUNK_SIZE);

  for (let chunkIdx = 0; chunkIdx < totalChunks; chunkIdx++) {
    const chunkStart = chunkIdx * CHUNK_SIZE;
    const chunk = parsedRows.slice(chunkStart, chunkStart + CHUNK_SIZE);

    try {
      // ── Step 1: Collect unique candidate identities in this chunk ──
      // Key: "normalizedFirstName|normalizedLastName" (for candidates without politicianId)
      const uniqueCandidates = new Map<
        string,
        { firstName: string; lastName: string; gender: string | null; nationality: string | null }
      >();

      for (const row of chunk) {
        const key = `${row.normalizedFirstName}|${row.normalizedLastName}`;
        if (!uniqueCandidates.has(key)) {
          uniqueCandidates.set(key, {
            firstName: row.normalizedFirstName,
            lastName: row.normalizedLastName,
            gender: row.gender,
            nationality: row.nationality,
          });
        }
      }

      // ── Step 2: Batch-create Candidate records ─────────────────────
      // We create candidates with politicianId = null initially.
      // The partial unique index (firstName, lastName WHERE politicianId IS NULL)
      // ensures deduplication. skipDuplicates handles conflicts gracefully.
      const candidateData: Prisma.CandidateCreateManyInput[] = [];
      for (const c of uniqueCandidates.values()) {
        candidateData.push({
          firstName: c.firstName,
          lastName: c.lastName,
          gender: c.gender,
          nationality: c.nationality,
        });
      }

      if (candidateData.length > 0) {
        const result = await db.candidate.createMany({
          data: candidateData,
          skipDuplicates: true,
        });
        candidatesCreated += result.count;
      }

      // ── Step 3: Fetch back Candidate IDs for this chunk ────────────
      // We need to resolve candidate IDs for linking to candidacies.
      // Query by all unique (firstName, lastName) pairs in this chunk.
      const namePairs = Array.from(uniqueCandidates.values());
      const candidateRecords = await db.candidate.findMany({
        where: {
          OR: namePairs.map((c) => ({
            firstName: c.firstName,
            lastName: c.lastName,
            politicianId: null,
          })),
        },
        select: { id: true, firstName: true, lastName: true },
      });

      // Build lookup: "firstName|lastName" -> candidateId
      const candidateIdMap = new Map<string, string>();
      for (const c of candidateRecords) {
        candidateIdMap.set(`${c.firstName}|${c.lastName}`, c.id);
      }

      // ── Step 4: Resolve politicians for this chunk (cached) ────────
      // Process politician lookups sequentially to avoid pool starvation.
      const rowPoliticianIds: (string | null)[] = [];
      for (const row of chunk) {
        const cacheKey = `${row.normalizedFirstName}|${row.normalizedLastName}|${row.deptCode}`;
        let politicianId: string | null;

        if (politicianCache.has(cacheKey)) {
          politicianId = politicianCache.get(cacheKey) ?? null;
        } else {
          politicianId = await matchPolitician(
            row.normalizedFirstName,
            row.normalizedLastName,
            row.deptCode
          );
          politicianCache.set(cacheKey, politicianId);
        }

        rowPoliticianIds.push(politicianId);

        if (politicianId) {
          politiciansMatched++;
        } else {
          politiciansNotFound++;
          if (verbose && politiciansNotFound <= 20) {
            console.log(
              `  No match: ${row.firstName} ${row.lastName} (${row.communeName}, dept ${row.deptCode})`
            );
          }
        }
      }

      // ── Step 5: Upsert candidacies for this chunk ──────────────────
      const toCreate: Prisma.CandidacyCreateManyInput[] = [];

      for (let j = 0; j < chunk.length; j++) {
        const row = chunk[j];
        const politicianId = rowPoliticianIds[j];

        try {
          const candidateKey = `${row!.normalizedFirstName}|${row!.normalizedLastName}`;
          const candidateId = candidateIdMap.get(candidateKey) ?? null;

          // Resolve commune
          const communeId = communeSet.has(row!.inseeCode) ? row!.inseeCode : null;
          if (communeId) candidaciesWithCommune++;

          // Resolve party from cache
          const partyId = partyCache.get(row!.nuanceCode) ?? null;

          const existingKey = `${row!.candidateName}|${row!.constituencyCode}`;
          const existingId = existingCandidacyMap.get(existingKey);

          if (existingId) {
            // Update existing candidacy (must be individual — no batch update in Prisma)
            await db.candidacy.update({
              where: { id: existingId },
              data: {
                politicianId,
                partyId,
                partyLabel: row!.partyLabel,
                listName: row!.listName,
                listPosition: row!.listPosition,
                constituencyName: row!.communeName,
                candidateId,
                communeId,
              },
            });
            candidaciesUpdated++;
          } else {
            // Accumulate for batch createMany
            toCreate.push({
              electionId: electionRecord.id,
              politicianId,
              partyId,
              candidateName: row!.candidateName,
              partyLabel: row!.partyLabel,
              listName: row!.listName,
              listPosition: row!.listPosition,
              constituencyCode: row!.constituencyCode,
              constituencyName: row!.communeName,
              candidateId,
              communeId,
            });
          }
        } catch (error) {
          errors.push(`Row ${row!.index + 1}: ${error}`);
        }
      }

      // Batch-create all new candidacies for this chunk
      if (toCreate.length > 0) {
        await db.candidacy.createMany({ data: toCreate, skipDuplicates: true });
        candidaciesCreated += toCreate.length;
      }
    } catch (error) {
      // Chunk-level error — record it and continue to next chunk
      errors.push(`Chunk ${chunkIdx + 1}: ${error}`);
    }

    // Progress logging
    const processedCount = Math.min((chunkIdx + 1) * CHUNK_SIZE, parsedRows.length);
    if (verbose || (chunkIdx + 1) % 10 === 0 || chunkIdx === totalChunks - 1) {
      console.log(
        `  Chunk ${chunkIdx + 1}/${totalChunks} — ${processedCount}/${parsedRows.length} rows ` +
          `(created: ${candidaciesCreated}, candidates: ${candidatesCreated}, communes: ${candidaciesWithCommune})`
      );
    }
  }

  // ─── Update election status ─────────────────────────────────────────
  if (!dryRun && candidaciesCreated > 0) {
    await db.election.update({
      where: { id: electionRecord.id },
      data: { status: ElectionStatus.CANDIDACIES },
    });
    console.log(`\nElection status updated to CANDIDACIES`);
  }

  console.log(`\nResults:`);
  console.log(`  Candidacies created: ${candidaciesCreated}`);
  console.log(`  Candidacies updated: ${candidaciesUpdated}`);
  console.log(`  Candidates created: ${candidatesCreated}`);
  console.log(`  Communes linked: ${candidaciesWithCommune}`);
  console.log(`  Politicians matched: ${politiciansMatched}`);
  console.log(`  Politicians not found: ${politiciansNotFound}`);
  console.log(`  Party nuances cached: ${partyCache.size}`);
  console.log(`  Politician lookups cached: ${politicianCache.size}`);
  console.log(`  Errors: ${errors.length}`);

  return {
    success: errors.length === 0,
    candidaciesCreated,
    candidaciesUpdated,
    candidatesCreated,
    candidaciesWithCommune,
    politiciansMatched,
    politiciansNotFound,
    errors,
  };
}

/**
 * Get candidatures statistics
 */
export async function getCandidaturesStats() {
  const [totalCandidacies, candidaciesByElection, matchedCandidacies] = await Promise.all([
    db.candidacy.count(),
    db.candidacy.groupBy({
      by: ["electionId"],
      _count: { id: true },
    }),
    db.candidacy.count({
      where: { politicianId: { not: null } },
    }),
  ]);

  // Fetch election titles for display
  const electionIds = candidaciesByElection.map((g) => g.electionId);
  const elections = await db.election.findMany({
    where: { id: { in: electionIds } },
    select: { id: true, title: true, slug: true, status: true },
  });

  const electionMap = new Map(elections.map((e) => [e.id, e]));

  return {
    totalCandidacies,
    matchedCandidacies,
    byElection: candidaciesByElection.map((g) => ({
      election: electionMap.get(g.electionId),
      count: g._count.id,
    })),
  };
}
