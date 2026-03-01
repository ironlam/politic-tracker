/**
 * Import législatives 2024 — 2nd tour results
 *
 * Source: data.gouv.fr — résultats définitifs du 2nd tour par circonscription
 * CSV: semicolon-separated, UTF-8, "wide" format (repeating candidate columns)
 *
 * Usage:
 *   npx tsx scripts/import-legislatives-2024.ts                # Full import
 *   npx tsx scripts/import-legislatives-2024.ts --dry-run      # Preview without saving
 *   npx tsx scripts/import-legislatives-2024.ts --verbose       # Verbose output
 *   npx tsx scripts/import-legislatives-2024.ts --limit=10      # Process only N rows
 *   npx tsx scripts/import-legislatives-2024.ts --stats         # Show current stats
 */

import "dotenv/config";
import { db } from "../src/lib/db";
import { parse } from "csv-parse/sync";
import { NUANCE_POLITIQUE_MAPPING } from "../src/config/labels";
import type { ElectionStatus } from "../src/generated/prisma";
import { HTTPClient } from "../src/lib/api/http-client";
import { DATA_GOUV_RATE_LIMIT_MS } from "../src/config/rate-limits";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CSV_URL = "https://www.data.gouv.fr/api/1/datasets/r/41ed46cd-77c2-4ecc-b8eb-374aa953ca39";

const ELECTION_SLUG = "legislatives-2024";

const dataGouvClient = new HTTPClient({
  rateLimitMs: DATA_GOUV_RATE_LIMIT_MS,
  sourceName: "data.gouv.fr",
});

// Maximum number of candidates per row in the wide-format CSV
const MAX_CANDIDATES = 10;

// Column name patterns (with candidate index placeholder)
const COL = {
  nuance: (n: number) => `Nuance candidat ${n}`,
  nom: (n: number) => `Nom candidat ${n}`,
  prenom: (n: number) => `Prénom candidat ${n}`,
  voix: (n: number) => `Voix ${n}`,
  pctExprimes: (n: number) => `% Voix/exprimés ${n}`,
  elu: (n: number) => `Elu ${n}`,
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CandidateRow {
  nuance: string;
  nom: string;
  prenom: string;
  voix: number;
  pctExprimes: number;
  isElected: boolean;
}

interface CirconscriptionRow {
  deptCode: string;
  deptName: string;
  circoCode: string;
  circoName: string;
  candidates: CandidateRow[];
}

// ---------------------------------------------------------------------------
// CSV fetching & parsing
// ---------------------------------------------------------------------------

async function fetchCSV(): Promise<string> {
  console.log(`Fetching CSV from: ${CSV_URL}`);

  const { data: text } = await dataGouvClient.getText(CSV_URL);
  console.log(`Downloaded ${(text.length / 1024).toFixed(0)} KB`);
  return text;
}

function parseCSV(text: string): CirconscriptionRow[] {
  const records = parse(text, {
    delimiter: ";",
    columns: true,
    skip_empty_lines: true,
    bom: true,
    trim: true,
    relax_column_count: true,
  }) as Record<string, string>[];

  console.log(`Parsed ${records.length} constituency rows`);

  const rows: CirconscriptionRow[] = [];

  for (const record of records) {
    const deptCode = record["Code département"]?.replace(/^"/, "").replace(/"$/, "").trim();
    const deptName = record["Libellé département"]?.trim();
    const circoCode = record["Code circonscription législative"]
      ?.replace(/^"/, "")
      .replace(/"$/, "")
      .trim();
    const circoName = record["Libellé circonscription législative"]?.trim();

    if (!deptCode || !circoCode) continue;

    // Extract candidates from wide-format columns
    const candidates: CandidateRow[] = [];

    for (let n = 1; n <= MAX_CANDIDATES; n++) {
      const nom = record[COL.nom(n)]?.trim();
      const prenom = record[COL.prenom(n)]?.trim();

      // No more candidates in this row
      if (!nom && !prenom) break;

      const nuance = record[COL.nuance(n)]?.trim() || "";
      const voixStr = record[COL.voix(n)]?.trim() || "0";
      const pctStr = record[COL.pctExprimes(n)]?.trim() || "0";
      const eluStr = record[COL.elu(n)]?.trim().toLowerCase() || "";

      // Parse vote count (may contain spaces as thousands separator)
      const voix = parseInt(voixStr.replace(/\s/g, ""), 10) || 0;

      // Parse percentage (may use comma as decimal separator)
      const pctExprimes = parseFloat(pctStr.replace(",", ".")) || 0;

      const isElected =
        eluStr === "élu" || eluStr === "elu" || eluStr === "élue" || eluStr === "elue";

      candidates.push({
        nuance,
        nom: nom || "",
        prenom: prenom || "",
        voix,
        pctExprimes,
        isElected,
      });
    }

    rows.push({
      deptCode,
      deptName: deptName || "",
      circoCode,
      circoName: circoName || "",
      candidates,
    });
  }

  return rows;
}

// ---------------------------------------------------------------------------
// Election upsert
// ---------------------------------------------------------------------------

async function ensureElection(): Promise<string> {
  const existing = await db.election.findUnique({
    where: { slug: ELECTION_SLUG },
  });

  if (existing) {
    console.log(`Election found: ${existing.title} (${existing.slug})`);
    return existing.id;
  }

  // Create the 2024 legislatives election
  const created = await db.election.create({
    data: {
      slug: ELECTION_SLUG,
      type: "LEGISLATIVES",
      title: "Élections législatives de 2024",
      shortTitle: "Législatives 2024",
      description:
        "Élections législatives anticipées des 30 juin et 7 juillet 2024, " +
        "consécutives à la dissolution de l'Assemblée nationale par le président Macron " +
        "le 9 juin 2024 après les élections européennes.",
      scope: "NATIONAL",
      round1Date: new Date("2024-06-30"),
      round2Date: new Date("2024-07-07"),
      dateConfirmed: true,
      totalSeats: 577,
      suffrage: "DIRECT",
      status: "COMPLETED" as ElectionStatus,
      sourceUrl:
        "https://www.data.gouv.fr/fr/datasets/elections-legislatives-des-30-juin-et-7-juillet-2024-resultats-definitifs-du-2nd-tour/",
    },
  });

  console.log(`Election created: ${created.title} (${created.slug})`);
  return created.id;
}

// ---------------------------------------------------------------------------
// Politician matching
// ---------------------------------------------------------------------------

async function matchPolitician(
  prenom: string,
  nom: string,
  deptCode: string
): Promise<string | null> {
  // Normalize case while preserving original separators (spaces, hyphens, mixed)
  // e.g. "DE COURSON-LEDUC" -> "De Courson-Leduc", "JEAN-PIERRE" -> "Jean-Pierre"
  const normalizedLastName = nom.replace(
    /[\wÀ-ÿ]+/g,
    (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
  );
  const normalizedFirstName = prenom.replace(
    /[\wÀ-ÿ]+/g,
    (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
  );

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

  // Multiple matches: prefer the one with a mandate in the same department
  for (const c of candidates) {
    if (c.mandates.length > 0) return c.id;
  }

  return candidates[0]!.id;
}

// ---------------------------------------------------------------------------
// Party matching
// ---------------------------------------------------------------------------

async function matchParty(nuanceCode: string): Promise<string | null> {
  // Try with L prefix first (municipales format), then direct
  const shortName =
    NUANCE_POLITIQUE_MAPPING[`L${nuanceCode}`] || NUANCE_POLITIQUE_MAPPING[nuanceCode];

  if (!shortName) return null;

  const party = await db.party.findFirst({
    where: { shortName },
    select: { id: true },
  });

  return party?.id ?? null;
}

// ---------------------------------------------------------------------------
// Main import
// ---------------------------------------------------------------------------

interface ImportOptions {
  dryRun?: boolean;
  verbose?: boolean;
  limit?: number;
}

interface ImportResult {
  candidaciesCreated: number;
  candidaciesUpdated: number;
  politiciansMatched: number;
  politiciansNotFound: number;
  constituenciesProcessed: number;
  totalCandidates: number;
  electedCount: number;
  unmappedNuances: Map<string, number>;
  errors: string[];
}

async function importLegislatives2024(options: ImportOptions = {}): Promise<ImportResult> {
  const { dryRun = false, verbose = false, limit } = options;

  const result: ImportResult = {
    candidaciesCreated: 0,
    candidaciesUpdated: 0,
    politiciansMatched: 0,
    politiciansNotFound: 0,
    constituenciesProcessed: 0,
    totalCandidates: 0,
    electedCount: 0,
    unmappedNuances: new Map(),
    errors: [],
  };

  // Ensure the election exists
  const electionId = dryRun
    ? (await db.election.findUnique({ where: { slug: ELECTION_SLUG } }))?.id || "DRY-RUN"
    : await ensureElection();

  // Fetch and parse CSV
  const text = await fetchCSV();
  const rows = parseCSV(text);

  const toProcess = limit ? rows.slice(0, limit) : rows;
  console.log(`\nProcessing ${toProcess.length} constituencies...`);
  if (dryRun) console.log("  [DRY-RUN MODE — no database changes]\n");

  // Cache for party lookups (nuance code -> partyId)
  const partyCache = new Map<string, string | null>();

  for (let i = 0; i < toProcess.length; i++) {
    const row = toProcess[i];
    result.constituenciesProcessed++;

    // Constituency code: "dept-circo" (e.g. "01-01", "75-01", "ZZ-01")
    const constituencyCode = `${row!.deptCode}-${row!.circoCode}`;
    const constituencyName = `${row!.circoName} (${row!.deptName})`;

    for (const candidate of row!.candidates) {
      result.totalCandidates++;

      try {
        const candidateName = `${candidate.prenom} ${candidate.nom}`;

        // Match politician
        const politicianId = await matchPolitician(candidate.prenom, candidate.nom, row!.deptCode);

        if (politicianId) {
          result.politiciansMatched++;
        } else {
          result.politiciansNotFound++;
          if (verbose && result.politiciansNotFound <= 30) {
            console.log(`  No match: ${candidateName} (${constituencyCode})`);
          }
        }

        // Match party via nuance code (cached)
        let partyId: string | null;
        if (partyCache.has(candidate.nuance)) {
          partyId = partyCache.get(candidate.nuance) ?? null;
        } else {
          partyId = await matchParty(candidate.nuance);
          partyCache.set(candidate.nuance, partyId);
        }

        // Track unmapped nuances (count all occurrences)
        if (!partyId && candidate.nuance) {
          result.unmappedNuances.set(
            candidate.nuance,
            (result.unmappedNuances.get(candidate.nuance) || 0) + 1
          );
        }

        // Count even in dry-run for reporting
        if (candidate.isElected) result.electedCount++;

        const partyLabel = candidate.nuance || null;

        if (dryRun) {
          if (verbose) {
            const elected = candidate.isElected ? " [ELU]" : "";
            const matched = politicianId ? " [MATCHED]" : "";
            console.log(
              `  ${candidateName} | ${constituencyCode} | ${candidate.nuance} | ${candidate.voix} voix (${candidate.pctExprimes}%)${elected}${matched}`
            );
          }
          continue;
        }

        // Upsert candidacy (unique by election + candidate name + constituency)
        const existing = await db.candidacy.findFirst({
          where: {
            electionId,
            candidateName,
            constituencyCode,
          },
        });

        const data = {
          politicianId,
          partyId,
          partyLabel,
          constituencyName,
          round2Votes: candidate.voix,
          round2Pct: candidate.pctExprimes,
          isElected: candidate.isElected,
        };

        if (existing) {
          await db.candidacy.update({
            where: { id: existing.id },
            data,
          });
          result.candidaciesUpdated++;
        } else {
          await db.candidacy.create({
            data: {
              electionId,
              candidateName,
              constituencyCode,
              ...data,
            },
          });
          result.candidaciesCreated++;
        }
      } catch (error) {
        result.errors.push(
          `${row!.deptCode}-${row!.circoCode} ${candidate.prenom} ${candidate.nom}: ${error}`
        );
      }
    }

    // Progress log
    if (verbose && (i + 1) % 100 === 0) {
      console.log(
        `  Progress: ${i + 1}/${toProcess.length} circos (${result.candidaciesCreated} created, ${result.politiciansMatched} matched)`
      );
    }
  }

  // Update election status to COMPLETED if we imported data
  if (!dryRun && result.candidaciesCreated > 0) {
    await db.election.update({
      where: { slug: ELECTION_SLUG },
      data: { status: "COMPLETED" as ElectionStatus },
    });
  }

  return result;
}

// ---------------------------------------------------------------------------
// Stats display
// ---------------------------------------------------------------------------

async function showStats(): Promise<void> {
  const election = await db.election.findUnique({
    where: { slug: ELECTION_SLUG },
  });

  if (!election) {
    console.log(`Election "${ELECTION_SLUG}" not found in database.`);
    return;
  }

  const [total, elected, matched] = await Promise.all([
    db.candidacy.count({ where: { electionId: election.id } }),
    db.candidacy.count({ where: { electionId: election.id, isElected: true } }),
    db.candidacy.count({ where: { electionId: election.id, politicianId: { not: null } } }),
  ]);

  console.log("\n" + "=".repeat(50));
  console.log("Législatives 2024 — Stats");
  console.log("=".repeat(50));
  console.log(`Election: ${election.title} [${election.status}]`);
  console.log(`Total candidacies: ${total}`);
  console.log(`Elected: ${elected}`);
  console.log(`Matched to politicians: ${matched}`);
  console.log(`Unmatched: ${total - matched}`);
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(args: string[]): ImportOptions & { help?: boolean; stats?: boolean } {
  const options: ImportOptions & { help?: boolean; stats?: boolean } = {};

  for (const arg of args) {
    if (arg === "--help" || arg === "-h") options.help = true;
    else if (arg === "--stats") options.stats = true;
    else if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--verbose" || arg === "-v") options.verbose = true;
    else if (arg.startsWith("--limit=")) {
      options.limit = parseInt(arg.split("=")[1]!, 10);
    }
  }

  return options;
}

async function main() {
  const args = process.argv.slice(2);
  const options = parseArgs(args);

  if (options.help) {
    console.log(`
Import législatives 2024 — 2nd tour results

Source: data.gouv.fr (résultats définitifs du 2nd tour par circonscription)
Format: Semicolon-separated CSV, UTF-8, wide format (repeating candidate columns)
Imports: 2nd round results (votes, percentages, elected status) for ~500 constituencies

Options:
  --help, -h       Show this help
  --stats          Show current import statistics
  --dry-run        Preview import without saving to database
  --verbose, -v    Show detailed output per candidate
  --limit=N        Process only the first N constituencies
`);
    process.exit(0);
  }

  if (options.stats) {
    await showStats();
    return;
  }

  console.log("=".repeat(50));
  console.log("Import législatives 2024 — 2nd tour");
  console.log("=".repeat(50));
  if (options.dryRun) console.log("Mode: DRY RUN");
  if (options.limit) console.log(`Limit: ${options.limit} constituencies`);
  console.log("");

  const result = await importLegislatives2024(options);

  // Print results
  console.log("\n" + "=".repeat(50));
  console.log("Results");
  console.log("=".repeat(50));
  console.log(`Constituencies processed: ${result.constituenciesProcessed}`);
  console.log(`Total candidates: ${result.totalCandidates}`);
  console.log(`Elected: ${result.electedCount}`);
  console.log(`Candidacies created: ${result.candidaciesCreated}`);
  console.log(`Candidacies updated: ${result.candidaciesUpdated}`);
  console.log(`Politicians matched: ${result.politiciansMatched}`);
  console.log(`Politicians not found: ${result.politiciansNotFound}`);
  console.log(`Errors: ${result.errors.length}`);

  if (result.unmappedNuances.size > 0) {
    console.log(`\nUnmapped nuance codes:`);
    for (const [nuance, count] of Array.from(result.unmappedNuances)) {
      console.log(`  ${nuance}: ${count} candidates`);
    }
  }

  if (result.errors.length > 0) {
    console.log(`\nFirst 10 errors:`);
    for (const error of result.errors.slice(0, 10)) {
      console.log(`  ${error}`);
    }
  }
}

main()
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
