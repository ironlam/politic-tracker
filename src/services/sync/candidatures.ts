import { db } from "@/lib/db";
import { ElectionStatus } from "@/generated/prisma";
import { parse } from "csv-parse/sync";
import { NUANCE_POLITIQUE_MAPPING } from "@/config/labels";
import type { CandidatureMunicipaleCSV, CandidaturesSyncResult } from "./types";
import { HTTPClient } from "@/lib/api/http-client";
import { DATA_GOUV_RATE_LIMIT_MS } from "@/config/rate-limits";

// 2020 test URL (tab-separated, ISO-8859-1, comment header)
const DEFAULT_CSV_URL =
  "https://static.data.gouv.fr/resources/elections-municipales-2020-candidatures-au-1er-tour/20200304-105123/livre-des-listes-et-candidats.txt";

const DEFAULT_ELECTION_SLUG = "municipales-2026";

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
  if (candidates.length === 1) return candidates[0].id;

  // Multiple: prefer candidate with mandate in same department
  for (const c of candidates) {
    if (c.mandates.length > 0) return c.id;
  }

  return candidates[0].id;
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

  const records = await fetchCandidaturesCSV(url);
  const toProcess = limit ? records.slice(0, limit) : records;

  let candidaciesCreated = 0;
  let candidaciesUpdated = 0;
  let politiciansMatched = 0;
  let politiciansNotFound = 0;
  const errors: string[] = [];

  // Cache for party lookups (nuance code -> partyId)
  const partyCache = new Map<string, string | null>();

  console.log(`\nProcessing ${toProcess.length} candidatures...`);

  for (let i = 0; i < toProcess.length; i++) {
    const row = toProcess[i];

    try {
      const nom = row["Nom candidat"];
      const prenom = row["Prénom candidat"];
      const deptCode = row["Code du département"];
      const codeCommune = row["Code commune"];
      const commune = row["Libellé commune"];
      const nuanceCode = row["Nuance Liste"];
      const listName = row["Libellé Etendu Liste"] || row["Libellé abrégé liste"];
      const listPosition = parseInt(row["N° candidat"], 10) || null;

      if (!nom || !prenom) {
        errors.push(`Row ${i + 1}: missing candidate name`);
        continue;
      }

      // Match politician (optional)
      const politicianId = await matchPolitician(prenom, nom, deptCode);

      if (politicianId) {
        politiciansMatched++;
      } else {
        politiciansNotFound++;
        if (verbose && politiciansNotFound <= 20) {
          console.log(`  No match: ${prenom} ${nom} (${commune}, dept ${deptCode})`);
        }
      }

      // Match party via nuance code (cached)
      let partyId: string | null;
      if (partyCache.has(nuanceCode)) {
        partyId = partyCache.get(nuanceCode) ?? null;
      } else {
        partyId = await matchParty(nuanceCode);
        partyCache.set(nuanceCode, partyId);
      }

      const candidateName = `${prenom} ${nom}`;
      const constituencyCode = `${deptCode}-${codeCommune}`;
      const constituencyName = commune;
      const partyLabel = row["Libellé abrégé liste"] || nuanceCode || null;

      if (dryRun) {
        if (verbose) {
          console.log(
            `  [DRY-RUN] ${candidateName} | ${commune} | ${nuanceCode} | list: ${listName} #${listPosition}${politicianId ? " [MATCHED]" : ""}`
          );
        }
        continue;
      }

      // Upsert candidacy (unique by election + candidate name + constituency)
      const existing = await db.candidacy.findFirst({
        where: {
          electionId: electionRecord.id,
          candidateName,
          constituencyCode,
        },
      });

      if (existing) {
        await db.candidacy.update({
          where: { id: existing.id },
          data: {
            politicianId,
            partyId,
            partyLabel,
            listName,
            listPosition,
            constituencyName,
          },
        });
        candidaciesUpdated++;
      } else {
        await db.candidacy.create({
          data: {
            electionId: electionRecord.id,
            politicianId,
            partyId,
            candidateName,
            partyLabel,
            listName,
            listPosition,
            constituencyCode,
            constituencyName,
          },
        });
        candidaciesCreated++;
      }

      if (verbose && (i + 1) % 5000 === 0) {
        console.log(
          `  Progress: ${i + 1}/${toProcess.length} (created: ${candidaciesCreated}, matched: ${politiciansMatched})`
        );
      }
    } catch (error) {
      errors.push(`Row ${i + 1}: ${error}`);
    }
  }

  // Update election status if we imported candidacies
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
  console.log(`  Politicians matched: ${politiciansMatched}`);
  console.log(`  Politicians not found: ${politiciansNotFound}`);
  console.log(`  Nuance codes cached: ${partyCache.size}`);
  console.log(`  Errors: ${errors.length}`);

  return {
    success: errors.length === 0,
    candidaciesCreated,
    candidaciesUpdated,
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
