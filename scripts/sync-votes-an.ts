/**
 * CLI script to sync parliamentary votes from data.assemblee-nationale.fr
 *
 * Usage:
 *   npm run sync:votes-an              # Full sync (17th legislature)
 *   npm run sync:votes-an -- --leg=17  # Sync specific legislature
 *   npm run sync:votes-an -- --stats   # Show current stats
 *
 * Data source: data.assemblee-nationale.fr (official Open Data)
 */

import "dotenv/config";
import { createCLI, type SyncHandler, type SyncResult } from "../src/lib/sync";
import { db } from "../src/lib/db";
import { generateDateSlug } from "../src/lib/utils";
import { VotePosition, VotingResult, DataSource } from "../src/generated/prisma";
import * as fs from "fs";
import * as path from "path";
import * as https from "https";
import { createWriteStream, mkdirSync, rmSync, readdirSync, readFileSync } from "fs";
import { execSync } from "child_process";

// Configuration
const LEGISLATURE = 17;
const TEMP_DIR = "/tmp/scrutins-an";
const ZIP_URL_TEMPLATE = "https://data.assemblee-nationale.fr/static/openData/repository/{leg}/loi/scrutins/Scrutins.json.zip";

// Progress tracking
const isTTY = process.stdout.isTTY === true;
let lastMessageLength = 0;

function updateLine(message: string): void {
  if (isTTY) {
    process.stdout.write(`\r\x1b[K${message}`);
  } else {
    const padding = " ".repeat(Math.max(0, lastMessageLength - message.length));
    process.stdout.write(`\r${message}${padding}`);
  }
  lastMessageLength = message.length;
}

function renderProgressBar(current: number, total: number, width: number = 30): string {
  const percent = Math.round((current / total) * 100);
  const filled = Math.round((current / total) * width);
  const empty = width - filled;
  const bar = "█".repeat(filled) + "░".repeat(empty);
  return `[${bar}] ${percent}%`;
}

/**
 * Download a file from URL
 */
async function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(dest);
    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Follow redirect
        const redirectUrl = response.headers.location;
        if (redirectUrl) {
          downloadFile(redirectUrl, dest).then(resolve).catch(reject);
          return;
        }
      }
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode} for ${url}`));
        return;
      }
      response.pipe(file);
      file.on("finish", () => {
        file.close();
        resolve();
      });
    }).on("error", (err) => {
      fs.unlinkSync(dest);
      reject(err);
    });
  });
}

/**
 * Parse AN scrutin JSON format
 */
interface ANScrutin {
  scrutin: {
    uid: string;
    numero: string;
    legislature: string;
    dateScrutin: string;
    titre: string;
    sort: {
      code: string;
      libelle: string;
    };
    syntheseVote: {
      nombreVotants: string;
      suffragesExprimes: string;
      decompte: {
        pour: string;
        contre: string;
        abstentions: string;
        nonVotants: string;
      };
    };
    ventilationVotes: {
      organe: {
        groupes: {
          groupe: ANGroupeVote[];
        };
      };
    };
  };
}

interface ANGroupeVote {
  organeRef: string;
  nombreMembresGroupe: string;
  vote: {
    decompteNominatif: {
      pours?: { votant: ANVotant | ANVotant[] } | null;
      contres?: { votant: ANVotant | ANVotant[] } | null;
      abstentions?: { votant: ANVotant | ANVotant[] } | null;
      nonVotants?: { votant: ANVotant | ANVotant[] } | null;
    };
  };
}

interface ANVotant {
  acteurRef: string;
  mandatRef: string;
}

/**
 * Extract votes from AN format
 */
function extractVotes(scrutin: ANScrutin): Array<{ acteurRef: string; position: VotePosition }> {
  const votes: Array<{ acteurRef: string; position: VotePosition }> = [];

  const groupes = scrutin.scrutin.ventilationVotes?.organe?.groupes?.groupe;
  if (!groupes) return votes;

  for (const groupe of groupes) {
    const decompte = groupe.vote?.decompteNominatif;
    if (!decompte) continue;

    // Helper to extract votants
    const extractVotants = (data: { votant: ANVotant | ANVotant[] } | null | undefined, position: VotePosition) => {
      if (!data?.votant) return;
      const votants = Array.isArray(data.votant) ? data.votant : [data.votant];
      for (const v of votants) {
        if (v.acteurRef) {
          votes.push({ acteurRef: v.acteurRef, position });
        }
      }
    };

    extractVotants(decompte.pours, "POUR");
    extractVotants(decompte.contres, "CONTRE");
    extractVotants(decompte.abstentions, "ABSTENTION");
    extractVotants(decompte.nonVotants, "NON_VOTANT");
  }

  return votes;
}

/**
 * Build map of AN acteur ID -> politician ID
 */
async function buildActeurToIdMap(): Promise<Map<string, string>> {
  const externalIds = await db.externalId.findMany({
    where: {
      source: DataSource.ASSEMBLEE_NATIONALE,
      politicianId: { not: null }
    },
    select: { externalId: true, politicianId: true },
  });

  const map = new Map<string, string>();
  for (const ext of externalIds) {
    if (ext.politicianId) {
      map.set(ext.externalId, ext.politicianId);
    }
  }

  return map;
}

/**
 * Parse voting result
 */
function parseVotingResult(code: string): VotingResult {
  return code.toLowerCase().includes("adopt") ? "ADOPTED" : "REJECTED";
}

/**
 * Generate a unique slug for a scrutin
 */
async function generateUniqueScrutinSlug(date: Date, title: string): Promise<string> {
  const baseSlug = generateDateSlug(date, title);

  // Check if slug already exists
  const existing = await db.scrutin.findUnique({ where: { slug: baseSlug } });
  if (!existing) return baseSlug;

  // Try with suffix
  let counter = 2;
  while (counter < 100) {
    const suffix = `-${counter}`;
    const maxBaseLength = 80 - suffix.length;
    const truncatedBase = baseSlug.slice(0, maxBaseLength).replace(/-$/, "");
    const slugWithSuffix = `${truncatedBase}${suffix}`;

    const existsWithSuffix = await db.scrutin.findUnique({ where: { slug: slugWithSuffix } });
    if (!existsWithSuffix) return slugWithSuffix;

    counter++;
  }

  // Fallback: use timestamp
  return `${baseSlug.slice(0, 60)}-${Date.now()}`;
}

/**
 * Main sync function
 */
async function syncVotesAN(legislature: number = LEGISLATURE, dryRun: boolean = false) {
  const stats = {
    scrutinsProcessed: 0,
    scrutinsCreated: 0,
    scrutinsUpdated: 0,
    votesCreated: 0,
    errors: [] as string[],
    politiciansNotFound: new Set<string>(),
  };

  try {
    // Step 1: Download ZIP
    updateLine("Downloading scrutins ZIP from data.assemblee-nationale.fr...");
    const zipUrl = ZIP_URL_TEMPLATE.replace("{leg}", String(legislature));
    const zipPath = path.join(TEMP_DIR, "scrutins.zip");

    // Clean and create temp dir
    if (fs.existsSync(TEMP_DIR)) {
      rmSync(TEMP_DIR, { recursive: true });
    }
    mkdirSync(TEMP_DIR, { recursive: true });

    await downloadFile(zipUrl, zipPath);
    console.log("\n✓ Downloaded ZIP file");

    // Step 2: Extract ZIP
    updateLine("Extracting ZIP...");
    const jsonDir = path.join(TEMP_DIR, "json");
    mkdirSync(jsonDir, { recursive: true });
    execSync(`unzip -o "${zipPath}" -d "${TEMP_DIR}"`, { stdio: "pipe" });
    console.log("✓ Extracted ZIP file");

    // Step 3: List JSON files
    const jsonFiles = readdirSync(jsonDir).filter(f => f.endsWith(".json"));
    const total = jsonFiles.length;
    console.log(`Found ${total} scrutins to process\n`);

    // Step 4: Build acteur map
    updateLine("Building acteur ID to politician map...");
    const acteurToId = await buildActeurToIdMap();
    console.log(`\n✓ Found ${acteurToId.size} deputies with AN IDs in database\n`);

    // Step 5: Process each scrutin
    for (let i = 0; i < jsonFiles.length; i++) {
      const file = jsonFiles[i];
      const progressMsg = `${renderProgressBar(i + 1, total)} Processing ${i + 1}/${total}`;

      if ((i + 1) % 100 === 0 || i === 0 || i === jsonFiles.length - 1) {
        updateLine(progressMsg);
      }

      try {
        const filePath = path.join(jsonDir, file);
        const content = readFileSync(filePath, "utf-8");
        const data: ANScrutin = JSON.parse(content);
        const s = data.scrutin;

        const externalId = s.uid;
        const votingDate = new Date(s.dateScrutin);
        const votesFor = parseInt(s.syntheseVote?.decompte?.pour || "0", 10);
        const votesAgainst = parseInt(s.syntheseVote?.decompte?.contre || "0", 10);
        const votesAbstain = parseInt(s.syntheseVote?.decompte?.abstentions || "0", 10);

        // Extract scrutin number from UID (e.g., VTANR5L17V5283 -> 5283)
        const scrutinNumber = s.numero || s.uid.replace(/^VTANR5L\d+V/, '');
        const sourceUrl = `https://www.assemblee-nationale.fr/dyn/${legislature}/scrutins/${scrutinNumber}`;

        // Extract individual votes
        const individualVotes = extractVotes(data);

        if (!dryRun) {
          // Upsert scrutin
          const existing = await db.scrutin.findUnique({
            where: { externalId },
          });

          const scrutinData = {
            externalId,
            title: s.titre,
            description: null,
            votingDate,
            legislature: parseInt(s.legislature, 10),
            votesFor,
            votesAgainst,
            votesAbstain,
            result: parseVotingResult(s.sort?.code || "rejeté"),
            sourceUrl,
          };

          let scrutin;
          if (existing) {
            // Update existing scrutin, generate slug if missing
            const updateData: typeof scrutinData & { slug?: string } = { ...scrutinData };
            if (!existing.slug) {
              updateData.slug = await generateUniqueScrutinSlug(votingDate, s.titre);
            }
            scrutin = await db.scrutin.update({
              where: { id: existing.id },
              data: updateData,
            });
            stats.scrutinsUpdated++;
          } else {
            // Create new scrutin with slug
            const slug = await generateUniqueScrutinSlug(votingDate, s.titre);
            scrutin = await db.scrutin.create({
              data: { ...scrutinData, slug },
            });
            stats.scrutinsCreated++;
          }

          // Process votes
          const votesToCreate: { politicianId: string; position: VotePosition }[] = [];

          for (const vote of individualVotes) {
            const politicianId = acteurToId.get(vote.acteurRef);
            if (politicianId) {
              votesToCreate.push({
                politicianId,
                position: vote.position,
              });
            } else {
              stats.politiciansNotFound.add(vote.acteurRef);
            }
          }

          // Delete existing votes and create new ones
          if (votesToCreate.length > 0) {
            await db.vote.deleteMany({
              where: { scrutinId: scrutin.id },
            });

            await db.vote.createMany({
              data: votesToCreate.map(v => ({
                scrutinId: scrutin.id,
                politicianId: v.politicianId,
                position: v.position,
              })),
              skipDuplicates: true,
            });

            stats.votesCreated += votesToCreate.length;
          }
        } else {
          // Dry run: just count
          if (individualVotes.length > 0) {
            for (const vote of individualVotes) {
              if (!acteurToId.has(vote.acteurRef)) {
                stats.politiciansNotFound.add(vote.acteurRef);
              }
            }
          }
          stats.scrutinsCreated++;
          stats.votesCreated += individualVotes.filter(v => acteurToId.has(v.acteurRef)).length;
        }

        stats.scrutinsProcessed++;
      } catch (err) {
        stats.errors.push(`${file}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // Cleanup
    rmSync(TEMP_DIR, { recursive: true });

  } catch (err) {
    stats.errors.push(`Fatal error: ${err instanceof Error ? err.message : String(err)}`);
  }

  return stats;
}

const handler: SyncHandler = {
  name: "Politic Tracker - AN Votes Sync",
  description: "Import scrutins and votes from Assemblée nationale",

  options: [
    {
      name: "--leg",
      type: "string",
      description: `Legislature number (default: ${LEGISLATURE})`,
    },
  ],

  showHelp() {
    console.log(`
Politic Tracker - Votes Sync (Assemblée Nationale)

Data source: data.assemblee-nationale.fr (official Open Data)

Features:
  - Downloads official ZIP file with all scrutins
  - Matches deputies by their AN acteur ID (ExternalId)
  - Creates/updates Scrutin and Vote records
    `);
  },

  async showStats() {
    const scrutinsCount = await db.scrutin.count({
      where: { externalId: { startsWith: "VTANR" } },
    });
    const votesCount = await db.vote.count({
      where: { scrutin: { externalId: { startsWith: "VTANR" } } },
    });
    const legislatures = await db.scrutin.groupBy({
      by: ["legislature"],
      _count: true,
      orderBy: { legislature: "desc" },
      where: { externalId: { startsWith: "VTANR" } },
    });

    console.log("\n" + "=".repeat(50));
    console.log("AN Votes Stats");
    console.log("=".repeat(50));
    console.log(`Scrutins (AN): ${scrutinsCount}`);
    console.log(`Total votes: ${votesCount}`);

    if (legislatures.length > 0) {
      console.log("\nBy legislature:");
      for (const leg of legislatures) {
        console.log(`  ${leg.legislature}e: ${leg._count} scrutins`);
      }
    }
  },

  async sync(options): Promise<SyncResult> {
    const { dryRun = false, leg } = options as {
      dryRun?: boolean;
      leg?: string;
    };

    const legislature = leg ? parseInt(leg, 10) : LEGISLATURE;
    if (isNaN(legislature) || legislature < 1) {
      return {
        success: false,
        duration: 0,
        stats: {},
        errors: ["Invalid legislature number"],
      };
    }

    console.log(`Legislature: ${legislature}e`);

    const result = await syncVotesAN(legislature, dryRun);

    return {
      success: result.errors.length === 0,
      duration: 0,
      stats: {
        processed: result.scrutinsProcessed,
        created: result.scrutinsCreated,
        updated: result.scrutinsUpdated,
        votesCreated: result.votesCreated,
        politiciansNotFound: result.politiciansNotFound.size,
      },
      errors: result.errors,
    };
  },
};

createCLI(handler);
