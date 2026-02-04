/**
 * CLI script to sync parliamentary votes from senat.fr
 *
 * Usage:
 *   npm run sync:votes-senat              # Sync current session
 *   npm run sync:votes-senat -- --all     # Sync all sessions
 *   npm run sync:votes-senat -- --session=2024  # Specific session
 *   npm run sync:votes-senat -- --stats   # Show current stats
 *
 * Data source: senat.fr (official Senate website)
 */

import "dotenv/config";
import { createCLI, type SyncHandler, type SyncResult } from "../src/lib/sync";
import { db } from "../src/lib/db";
import { generateDateSlug } from "../src/lib/utils";
import { VotePosition, VotingResult, DataSource, Chamber } from "../src/generated/prisma";
import * as https from "https";

// Configuration
const BASE_URL = "https://www.senat.fr";
const DEFAULT_SESSION = 2024; // Current session
const AVAILABLE_SESSIONS = [2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015, 2014, 2013, 2012, 2011, 2010, 2009, 2008, 2007, 2006];
const RATE_LIMIT_MS = 200; // Delay between requests

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
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Decode HTML entities
 */
function decodeHtmlEntities(html: string): string {
  return html
    // Named entities
    .replace(/&eacute;/g, "é")
    .replace(/&egrave;/g, "è")
    .replace(/&agrave;/g, "à")
    .replace(/&acirc;/g, "â")
    .replace(/&ecirc;/g, "ê")
    .replace(/&icirc;/g, "î")
    .replace(/&ocirc;/g, "ô")
    .replace(/&ucirc;/g, "û")
    .replace(/&ccedil;/g, "ç")
    .replace(/&ugrave;/g, "ù")
    .replace(/&iuml;/g, "ï")
    .replace(/&euml;/g, "ë")
    .replace(/&ouml;/g, "ö")
    .replace(/&uuml;/g, "ü")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&deg;/g, "°")
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&rdquo;/g, '"')
    .replace(/&ldquo;/g, '"')
    .replace(/&ndash;/g, "–")
    .replace(/&mdash;/g, "—")
    .replace(/&hellip;/g, "…")
    // Numeric entities
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

/**
 * Fetch content from URL
 */
async function fetchUrl(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const request = https.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirectUrl = response.headers.location;
        if (redirectUrl) {
          fetchUrl(redirectUrl.startsWith("http") ? redirectUrl : `${BASE_URL}${redirectUrl}`)
            .then(resolve)
            .catch(reject);
          return;
        }
      }

      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode} for ${url}`));
        return;
      }

      let data = "";
      response.on("data", (chunk) => (data += chunk));
      response.on("end", () => resolve(data));
    });

    request.on("error", reject);
    request.setTimeout(30000, () => {
      request.destroy();
      reject(new Error(`Timeout fetching ${url}`));
    });
  });
}

/**
 * Get list of scrutin numbers from a session page
 */
async function getScrutinListForSession(session: number): Promise<string[]> {
  const url = `${BASE_URL}/scrutin-public/scr${session}.html`;
  const html = await fetchUrl(url);

  // Extract scrutin numbers from links - can be relative (2024/scr2024-367.html) or absolute
  // Pattern matches both "/scrutin-public/2024/scr2024-367.html" and "2024/scr2024-367.html"
  const regex = new RegExp(`(?:/scrutin-public/)?${session}/scr${session}-(\\d+)\\.html`, "g");
  const numbers: string[] = [];
  let match;

  while ((match = regex.exec(html)) !== null) {
    if (!numbers.includes(match[1])) {
      numbers.push(match[1]);
    }
  }

  return numbers.sort((a, b) => parseInt(b) - parseInt(a)); // Descending order
}

/**
 * Parse scrutin metadata from HTML page
 */
interface ScrutinMetadata {
  number: number;
  date: Date;
  title: string;
  votesFor: number;
  votesAgainst: number;
  votesAbstain: number;
  result: VotingResult;
  sourceUrl: string;
}

function parseScrutinMetadata(html: string, session: number, number: string): ScrutinMetadata | null {
  try {
    // Decode HTML entities first
    const decodedHtml = decodeHtmlEntities(html);

    // Strip HTML tags for easier parsing
    const textContent = decodedHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

    // Extract title from h1 + h2 structure
    // h1: "Scrutin n°367 - séance du 11 juillet 2025"
    // h2: "sur l'ensemble du texte..."
    const h1Match = decodedHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    const h2Match = decodedHtml.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);

    let title = `Scrutin n°${number}`;
    if (h1Match) {
      let h1Text = h1Match[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      // Remove "En savoir plus" links
      h1Text = h1Text.replace(/\s*En savoir plus\s*/gi, " ").replace(/\s+/g, " ").trim();
      title = h1Text;
      if (h2Match) {
        let h2Text = h2Match[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        h2Text = h2Text.replace(/\s*En savoir plus\s*/gi, " ").replace(/\s+/g, " ").trim();
        // Append h2 content (the subject of the vote)
        if (h2Text.length < 200 && h2Text.length > 0) {
          title = `${h1Text} ${h2Text}`;
        }
      }
    }

    // Extract date - format: "séance du 11 juillet 2025"
    const dateMatch = textContent.match(/séance\s+du\s+(\d{1,2})\s+(\w+)\s+(\d{4})/i);
    let date = new Date();

    if (dateMatch) {
      const day = parseInt(dateMatch[1]);
      const monthName = dateMatch[2].toLowerCase();
      const year = parseInt(dateMatch[3]);

      const months: Record<string, number> = {
        janvier: 0, février: 1, fevrier: 1, mars: 2, avril: 3, mai: 4, juin: 5,
        juillet: 6, août: 7, aout: 7, septembre: 8, octobre: 9, novembre: 10, décembre: 11, decembre: 11
      };

      const month = months[monthName] ?? 0;
      date = new Date(year, month, day);
    }

    // Extract vote counts from HTML structure like:
    // <strong>194</strong> pour
    // <strong>113</strong> contre
    // Abstention : 33

    // Pattern 1: <strong>N</strong> pour/contre
    const forMatch = html.match(/<strong>\s*(\d+)\s*<\/strong>\s*pour/i) ||
                     textContent.match(/(\d+)\s+pour(?!\s+part)/i);
    const againstMatch = html.match(/<strong>\s*(\d+)\s*<\/strong>\s*contre/i) ||
                         textContent.match(/(\d+)\s+contre/i);

    // Pattern 2: Abstention : N (plain text)
    const abstainMatch = textContent.match(/abstention[s]?\s*:?\s*(\d+)/i) ||
                         html.match(/<strong>\s*(\d+)\s*<\/strong>\s*abstention/i);

    const votesFor = forMatch ? parseInt(forMatch[1]) : 0;
    const votesAgainst = againstMatch ? parseInt(againstMatch[1]) : 0;
    const votesAbstain = abstainMatch ? parseInt(abstainMatch[1]) : 0;

    // Determine result - "Le Sénat a adopté" vs "Le Sénat n'a pas adopté"
    const hasAdoption = /Le\s+Sénat\s+a\s+adopté|a\s+été\s+adopté/i.test(textContent);
    const hasRejection = /n['']a\s+pas\s+adopté|a\s+été\s+rejeté|rejet/i.test(textContent);
    const result: VotingResult = hasAdoption && !hasRejection ? "ADOPTED" : "REJECTED";

    return {
      number: parseInt(number),
      date,
      title,
      votesFor,
      votesAgainst,
      votesAbstain,
      result,
      sourceUrl: `${BASE_URL}/scrutin-public/${session}/scr${session}-${number}.html`,
    };
  } catch (error) {
    console.error(`Error parsing scrutin metadata: ${error}`);
    return null;
  }
}

/**
 * Fetch individual votes from JSON endpoint
 */
interface SenatVote {
  matricule: string;
  vote: string; // "p" = pour, "c" = contre, "a" = abstention, "n" = non-votant
  siege: number;
}

async function fetchVotesJson(session: number, number: string): Promise<SenatVote[]> {
  const url = `${BASE_URL}/scrutin-public/${session}/scr${session}-${number}.json`;

  try {
    const json = await fetchUrl(url);
    const data = JSON.parse(json);
    return data.votes || [];
  } catch (error) {
    console.error(`Error fetching votes JSON: ${error}`);
    return [];
  }
}

/**
 * Map Senate vote code to VotePosition
 */
function mapVotePosition(code: string): VotePosition {
  switch (code.toLowerCase()) {
    case "p":
      return "POUR";
    case "c":
      return "CONTRE";
    case "a":
      return "ABSTENTION";
    case "n":
    default:
      return "ABSENT";
  }
}

/**
 * Build map of Senate matricule -> politician ID
 */
async function buildMatriculeToIdMap(): Promise<Map<string, string>> {
  const externalIds = await db.externalId.findMany({
    where: {
      source: DataSource.SENAT,
      politicianId: { not: null },
    },
    select: { externalId: true, politicianId: true },
  });

  const map = new Map<string, string>();
  for (const ext of externalIds) {
    if (ext.politicianId) {
      // Store with and without "F" suffix for flexibility
      map.set(ext.externalId, ext.politicianId);
      // Some matricules might have different formats
      if (ext.externalId.endsWith("F")) {
        map.set(ext.externalId.slice(0, -1), ext.politicianId);
      }
    }
  }

  return map;
}

/**
 * Generate a unique slug for a scrutin
 */
async function generateUniqueScrutinSlug(date: Date, title: string): Promise<string> {
  const baseSlug = generateDateSlug(date, title);

  // Add "senat" prefix to distinguish from AN votes
  const senatSlug = `senat-${baseSlug}`.slice(0, 80);

  // Check if slug already exists
  const existing = await db.scrutin.findUnique({ where: { slug: senatSlug } });
  if (!existing) return senatSlug;

  // Try with suffix
  let counter = 2;
  while (counter < 100) {
    const suffix = `-${counter}`;
    const maxBaseLength = 80 - suffix.length;
    const truncatedBase = senatSlug.slice(0, maxBaseLength).replace(/-$/, "");
    const slugWithSuffix = `${truncatedBase}${suffix}`;

    const existsWithSuffix = await db.scrutin.findUnique({ where: { slug: slugWithSuffix } });
    if (!existsWithSuffix) return slugWithSuffix;

    counter++;
  }

  // Fallback: use timestamp
  return `${senatSlug.slice(0, 60)}-${Date.now()}`;
}

/**
 * Determine legislature from session year
 * Senate doesn't have legislatures like AN, but we use session year for grouping
 */
function sessionToLegislature(session: number): number {
  // Map to pseudo-legislature based on election cycles
  // Senators are elected for 6-year terms, half renewed every 3 years
  if (session >= 2023) return 2023; // Current cycle
  if (session >= 2020) return 2020;
  if (session >= 2017) return 2017;
  if (session >= 2014) return 2014;
  if (session >= 2011) return 2011;
  if (session >= 2008) return 2008;
  return session;
}

/**
 * Main sync function
 */
async function syncVotesSenat(session: number | null = null, dryRun: boolean = false) {
  const stats = {
    scrutinsProcessed: 0,
    scrutinsCreated: 0,
    scrutinsUpdated: 0,
    scrutinsSkipped: 0,
    votesCreated: 0,
    errors: [] as string[],
    senatorsNotFound: new Set<string>(),
  };

  try {
    // Build matricule map
    updateLine("Building matricule to politician ID map...");
    const matriculeToId = await buildMatriculeToIdMap();
    console.log(`\n✓ Found ${matriculeToId.size} senators with Sénat IDs in database\n`);

    // Determine which sessions to process
    const sessionsToProcess = session ? [session] : AVAILABLE_SESSIONS;
    console.log(`Processing sessions: ${sessionsToProcess.join(", ")}\n`);

    for (const currentSession of sessionsToProcess) {
      console.log(`\n--- Session ${currentSession}-${currentSession + 1} ---`);

      // Get list of scrutins for this session
      updateLine(`Fetching scrutin list for session ${currentSession}...`);
      let scrutinNumbers: string[];

      try {
        scrutinNumbers = await getScrutinListForSession(currentSession);
      } catch (error) {
        console.log(`\n⚠️ Could not fetch session ${currentSession}: ${error}`);
        continue;
      }

      console.log(`\n✓ Found ${scrutinNumbers.length} scrutins for session ${currentSession}\n`);

      if (scrutinNumbers.length === 0) continue;

      // Process each scrutin
      for (let i = 0; i < scrutinNumbers.length; i++) {
        const number = scrutinNumbers[i];
        const progressMsg = `${renderProgressBar(i + 1, scrutinNumbers.length)} Processing ${i + 1}/${scrutinNumbers.length} (n°${number})`;

        if ((i + 1) % 20 === 0 || i === 0 || i === scrutinNumbers.length - 1) {
          updateLine(progressMsg);
        }

        try {
          // Fetch HTML page for metadata
          const htmlUrl = `${BASE_URL}/scrutin-public/${currentSession}/scr${currentSession}-${number}.html`;
          const html = await fetchUrl(htmlUrl);

          // Parse metadata
          const metadata = parseScrutinMetadata(html, currentSession, number);
          if (!metadata) {
            stats.scrutinsSkipped++;
            continue;
          }

          // Fetch votes JSON
          const votes = await fetchVotesJson(currentSession, number);

          // Create external ID for this scrutin
          const externalId = `SENAT-${currentSession}-${number}`;

          if (!dryRun) {
            // Check if scrutin already exists
            const existing = await db.scrutin.findUnique({
              where: { externalId },
            });

            const scrutinData = {
              externalId,
              title: metadata.title,
              description: null,
              votingDate: metadata.date,
              legislature: sessionToLegislature(currentSession),
              chamber: Chamber.SENAT,
              votesFor: metadata.votesFor,
              votesAgainst: metadata.votesAgainst,
              votesAbstain: metadata.votesAbstain,
              result: metadata.result,
              sourceUrl: metadata.sourceUrl,
            };

            let scrutin;
            if (existing) {
              // Update existing
              const updateData: typeof scrutinData & { slug?: string } = { ...scrutinData };
              if (!existing.slug) {
                updateData.slug = await generateUniqueScrutinSlug(metadata.date, metadata.title);
              }
              scrutin = await db.scrutin.update({
                where: { id: existing.id },
                data: updateData,
              });
              stats.scrutinsUpdated++;
            } else {
              // Create new
              const slug = await generateUniqueScrutinSlug(metadata.date, metadata.title);
              scrutin = await db.scrutin.create({
                data: { ...scrutinData, slug },
              });
              stats.scrutinsCreated++;
            }

            // Process votes
            const votesToCreate: { politicianId: string; position: VotePosition }[] = [];

            for (const vote of votes) {
              const politicianId = matriculeToId.get(vote.matricule);
              if (politicianId) {
                votesToCreate.push({
                  politicianId,
                  position: mapVotePosition(vote.vote),
                });
              } else {
                stats.senatorsNotFound.add(vote.matricule);
              }
            }

            // Delete existing votes and create new ones
            if (votesToCreate.length > 0) {
              await db.vote.deleteMany({
                where: { scrutinId: scrutin.id },
              });

              await db.vote.createMany({
                data: votesToCreate.map((v) => ({
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
            stats.scrutinsCreated++;
            for (const vote of votes) {
              if (!matriculeToId.has(vote.matricule)) {
                stats.senatorsNotFound.add(vote.matricule);
              } else {
                stats.votesCreated++;
              }
            }
          }

          stats.scrutinsProcessed++;

          // Rate limiting
          await sleep(RATE_LIMIT_MS);
        } catch (err) {
          stats.errors.push(`Session ${currentSession} n°${number}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      console.log(""); // New line after progress bar
    }
  } catch (err) {
    stats.errors.push(`Fatal error: ${err instanceof Error ? err.message : String(err)}`);
  }

  return stats;
}

const handler: SyncHandler = {
  name: "Politic Tracker - Senate Votes Sync",
  description: "Import scrutins and votes from Sénat",

  options: [
    {
      name: "--session",
      type: "string",
      description: `Session year (default: ${DEFAULT_SESSION}). Available: ${AVAILABLE_SESSIONS.join(", ")}`,
    },
    {
      name: "--all",
      type: "boolean",
      description: "Sync all sessions (2006-present)",
    },
  ],

  showHelp() {
    console.log(`
Politic Tracker - Votes Sync (Sénat)

Data source: senat.fr (official Senate website)

Features:
  - Scrapes scrutin list from session pages
  - Downloads JSON vote data for each scrutin
  - Parses metadata from HTML (title, date, results)
  - Matches senators by their matricule (ExternalId)
    `);
  },

  async showStats() {
    const scrutinsCount = await db.scrutin.count({
      where: { chamber: Chamber.SENAT },
    });
    const votesCount = await db.vote.count({
      where: { scrutin: { chamber: Chamber.SENAT } },
    });
    const sessions = await db.scrutin.groupBy({
      by: ["legislature"],
      where: { chamber: Chamber.SENAT },
      _count: true,
      orderBy: { legislature: "desc" },
    });

    console.log("\n" + "=".repeat(50));
    console.log("Senate Votes Stats");
    console.log("=".repeat(50));
    console.log(`Scrutins (Sénat): ${scrutinsCount}`);
    console.log(`Total votes: ${votesCount}`);

    if (sessions.length > 0) {
      console.log("\nBy session:");
      for (const s of sessions) {
        console.log(`  ${s.legislature}: ${s._count} scrutins`);
      }
    }
  },

  async sync(options): Promise<SyncResult> {
    const { dryRun = false, session: sessionStr, all = false } = options as {
      dryRun?: boolean;
      session?: string;
      all?: boolean;
    };

    let session: number | null = DEFAULT_SESSION;

    if (sessionStr) {
      session = parseInt(sessionStr, 10);
      if (isNaN(session) || !AVAILABLE_SESSIONS.includes(session)) {
        return {
          success: false,
          duration: 0,
          stats: {},
          errors: [`Invalid session. Available: ${AVAILABLE_SESSIONS.join(", ")}`],
        };
      }
    }

    // --all overrides session
    if (all) {
      session = null;
      console.log("Syncing all sessions (2006-present)");
    } else {
      console.log(`Session: ${session}`);
    }

    const result = await syncVotesSenat(session, dryRun);

    return {
      success: result.errors.length === 0,
      duration: 0,
      stats: {
        processed: result.scrutinsProcessed,
        created: result.scrutinsCreated,
        updated: result.scrutinsUpdated,
        skipped: result.scrutinsSkipped,
        votesCreated: result.votesCreated,
        senatorsNotFound: result.senatorsNotFound.size,
      },
      errors: result.errors,
    };
  },
};

createCLI(handler);
