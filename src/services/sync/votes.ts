import { db } from "@/lib/db";
import { VotePosition, VotingResult, DataSource } from "@/generated/prisma";
import {
  NosDeputesScrutinList,
  NosDeputesScrutinDetail,
  NosDeputesScrutinSummary,
  VotesSyncResult,
} from "./types";
import https from "https";

const NOSDEPUTES_BASE_URL = "https://www.nosdeputes.fr";
const DEFAULT_LEGISLATURE = 16; // NosDéputés n'a pas encore la 17e législature
const REQUEST_TIMEOUT = 30000; // 30 seconds
const BATCH_SIZE = 50; // Process in batches for progress reporting

/**
 * Progress callback type
 */
export type ProgressCallback = (current: number, total: number, message: string) => void;

/**
 * Native HTTPS GET request with redirect and timeout support
 */
function httpsGet<T>(url: string, maxRedirects = 5): Promise<T> {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) {
      reject(new Error(`Too many redirects for ${url}`));
      return;
    }

    const request = https.get(url, (res) => {
      // Handle redirects
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const redirectUrl = res.headers.location.startsWith("http")
          ? res.headers.location
          : new URL(res.headers.location, url).href;

        // Check if redirect goes to a different path (like archives)
        if (redirectUrl.includes("/archives/") || !redirectUrl.includes("/json")) {
          reject(new Error(`Legislature not available (redirected to: ${redirectUrl})`));
          return;
        }

        httpsGet<T>(redirectUrl, maxRedirects - 1).then(resolve).catch(reject);
        return;
      }

      // Check for non-2xx status
      if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }

      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          // Check if we got HTML instead of JSON (sign of redirect to web page)
          if (data.trim().startsWith("<!") || data.trim().startsWith("<html")) {
            reject(new Error(`Received HTML instead of JSON from ${url} - legislature may not be available`));
            return;
          }
          resolve(JSON.parse(data) as T);
        } catch (e) {
          reject(new Error(`Failed to parse JSON from ${url}: ${e}`));
        }
      });
    });

    request.on("error", reject);
    request.setTimeout(REQUEST_TIMEOUT, () => {
      request.destroy();
      reject(new Error(`Request timeout after ${REQUEST_TIMEOUT}ms for ${url}`));
    });
  });
}

/**
 * Check if a legislature is available on NosDéputés
 */
export async function isLegislatureAvailable(legislature: number): Promise<boolean> {
  const url = `${NOSDEPUTES_BASE_URL}/${legislature}/scrutins/json`;
  try {
    await httpsGet<NosDeputesScrutinList>(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Fetch list of all scrutins for a legislature
 */
export async function fetchScrutins(legislature: number = DEFAULT_LEGISLATURE): Promise<NosDeputesScrutinList> {
  const url = `${NOSDEPUTES_BASE_URL}/${legislature}/scrutins/json`;
  console.log(`Fetching scrutins list from: ${url}`);
  return httpsGet<NosDeputesScrutinList>(url);
}

/**
 * Fetch detailed scrutin with individual votes
 */
export async function fetchScrutinDetails(
  scrutinId: string,
  legislature: number = DEFAULT_LEGISLATURE
): Promise<NosDeputesScrutinDetail> {
  const url = `${NOSDEPUTES_BASE_URL}/${legislature}/scrutin/${scrutinId}/json`;
  return httpsGet<NosDeputesScrutinDetail>(url);
}

/**
 * Convert NosDéputés sort to VotingResult
 */
function parseVotingResult(sort: string | null | undefined): VotingResult {
  if (!sort) return "REJECTED";
  return sort.toLowerCase() === "adopté" ? "ADOPTED" : "REJECTED";
}

/**
 * Convert NosDéputés position to VotePosition
 */
function parseVotePosition(position: string | null | undefined): VotePosition {
  if (!position) return "ABSENT";
  switch (position.toLowerCase()) {
    case "pour":
      return "POUR";
    case "contre":
      return "CONTRE";
    case "abstention":
      return "ABSTENTION";
    case "nonvotant":
    default:
      return "ABSENT";
  }
}

/**
 * Build a map of NosDéputés slug -> politician ID
 */
async function buildSlugToIdMap(): Promise<Map<string, string>> {
  // Get all politicians with NOSDEPUTES external ID
  const externalIds = await db.externalId.findMany({
    where: { source: DataSource.NOSDEPUTES, politicianId: { not: null } },
    select: { externalId: true, politicianId: true },
  });

  const map = new Map<string, string>();
  for (const ext of externalIds) {
    if (ext.politicianId) {
      map.set(ext.externalId.toLowerCase(), ext.politicianId);
    }
  }

  // Also try matching by slug for deputies without NOSDEPUTES external ID
  const politicians = await db.politician.findMany({
    select: { id: true, slug: true },
  });

  for (const pol of politicians) {
    // NosDéputés slug format: prenom-nom
    const ndSlug = pol.slug.toLowerCase();
    if (!map.has(ndSlug)) {
      map.set(ndSlug, pol.id);
    }
  }

  return map;
}

/**
 * Sync a single scrutin with all its votes
 */
async function syncScrutin(
  summary: NosDeputesScrutinSummary,
  legislature: number,
  slugToId: Map<string, string>
): Promise<{ created: boolean; votesCreated: number; notFound: string[]; error?: string }> {
  const s = summary.scrutin;
  const externalId = s.numero;
  const sourceUrl = s.url_nosdeputes || `${NOSDEPUTES_BASE_URL}/${legislature}/scrutin/${s.numero}`;

  try {
    // Fetch detailed votes
    const detail = await fetchScrutinDetails(s.numero, legislature);

    if (!detail.votes || detail.votes.length === 0) {
      return { created: false, votesCreated: 0, notFound: [], error: "No votes in detail" };
    }

    // Upsert scrutin
    const existing = await db.scrutin.findUnique({
      where: { externalId },
    });

    const scrutinData = {
      externalId,
      title: s.titre,
      description: null,
      votingDate: new Date(s.date),
      legislature,
      votesFor: parseInt(s.nombre_pours, 10) || 0,
      votesAgainst: parseInt(s.nombre_contres, 10) || 0,
      votesAbstain: parseInt(s.nombre_abstentions, 10) || 0,
      result: parseVotingResult(s.sort),
      sourceUrl,
    };

    let scrutin;
    let created = false;

    if (existing) {
      scrutin = await db.scrutin.update({
        where: { id: existing.id },
        data: scrutinData,
      });
    } else {
      scrutin = await db.scrutin.create({
        data: scrutinData,
      });
      created = true;
    }

    // Process votes
    const votesToCreate: { politicianId: string; position: VotePosition }[] = [];
    const notFound: string[] = [];

    for (const entry of detail.votes) {
      const vote = entry.vote;
      const slug = vote.parlementaire_slug?.toLowerCase();

      if (!slug) continue;

      const polId = slugToId.get(slug);
      if (polId) {
        votesToCreate.push({
          politicianId: polId,
          position: parseVotePosition(vote.position),
        });
      } else {
        notFound.push(slug);
      }
    }

    // Delete existing votes for this scrutin (to handle updates)
    await db.vote.deleteMany({
      where: { scrutinId: scrutin.id },
    });

    // Create all votes
    if (votesToCreate.length > 0) {
      await db.vote.createMany({
        data: votesToCreate.map((v) => ({
          scrutinId: scrutin.id,
          politicianId: v.politicianId,
          position: v.position,
        })),
        skipDuplicates: true,
      });
    }

    return {
      created,
      votesCreated: votesToCreate.length,
      notFound: [...new Set(notFound)],
    };
  } catch (error) {
    return {
      created: false,
      votesCreated: 0,
      notFound: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Main sync function - syncs all scrutins for a legislature
 */
export async function syncVotes(
  legislature: number = DEFAULT_LEGISLATURE,
  onProgress?: ProgressCallback
): Promise<VotesSyncResult> {
  const result: VotesSyncResult = {
    success: false,
    scrutinsCreated: 0,
    scrutinsUpdated: 0,
    votesCreated: 0,
    politiciansNotFound: [],
    errors: [],
  };

  // Use silent mode when progress callback is provided (CLI handles output)
  const log = onProgress ? () => {} : console.log.bind(console);
  const logError = console.error.bind(console); // Always log errors

  try {
    onProgress?.(0, 100, "Building slug to politician ID map...");
    log(`\nBuilding slug to politician ID map...`);
    const slugToId = await buildSlugToIdMap();
    log(`Found ${slugToId.size} politicians in database`);

    onProgress?.(5, 100, `Fetching scrutins for legislature ${legislature}...`);
    log(`\nFetching scrutins for legislature ${legislature}...`);

    let list: NosDeputesScrutinList;
    try {
      list = await fetchScrutins(legislature);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      if (errMsg.includes("not available") || errMsg.includes("redirected")) {
        logError(`\n❌ Legislature ${legislature} is not available on NosDéputés.`);
        logError(`   NosDéputés usually lags behind the current legislature.`);
        logError(`   Try with --leg=16 for the 16th legislature.\n`);
        result.errors.push(`Legislature ${legislature} not available on NosDéputés`);
        return result;
      }
      throw error;
    }

    const scrutins = list.scrutins;
    const total = scrutins.length;
    log(`Found ${total} scrutins\n`);

    // Process each scrutin
    for (let i = 0; i < scrutins.length; i++) {
      const item = scrutins[i];

      // Progress update
      const percent = Math.round(5 + ((i + 1) / total) * 90);
      const progressMsg = `Processing scrutin ${i + 1}/${total} (${item.scrutin.numero})`;

      if ((i + 1) % BATCH_SIZE === 0 || i === 0) {
        onProgress?.(percent, 100, progressMsg);
        log(`  ${progressMsg}...`);
      }

      // Add delay to avoid rate limiting
      if (i > 0 && i % 10 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      const syncResult = await syncScrutin(item, legislature, slugToId);

      if (syncResult.error) {
        result.errors.push(`Scrutin ${item.scrutin.numero}: ${syncResult.error}`);
      } else {
        if (syncResult.created) {
          result.scrutinsCreated++;
        } else {
          result.scrutinsUpdated++;
        }
        result.votesCreated += syncResult.votesCreated;
        result.politiciansNotFound.push(...syncResult.notFound);
      }
    }

    // Deduplicate not found list
    result.politiciansNotFound = [...new Set(result.politiciansNotFound)];
    result.success = true;
    onProgress?.(100, 100, "Sync completed!");
  } catch (error) {
    result.errors.push(`Fatal error: ${error}`);
  }

  return result;
}

/**
 * Get current votes stats
 */
export async function getVotesStats() {
  const scrutinsCount = await db.scrutin.count();
  const votesCount = await db.vote.count();
  const legislatures = await db.scrutin.groupBy({
    by: ["legislature"],
    _count: true,
    orderBy: { legislature: "desc" },
  });

  const votesByPosition = await db.vote.groupBy({
    by: ["position"],
    _count: true,
  });

  return {
    scrutins: scrutinsCount,
    votes: votesCount,
    legislatures: legislatures.map((l) => ({
      legislature: l.legislature,
      count: l._count,
    })),
    byPosition: votesByPosition.reduce(
      (acc, v) => {
        acc[v.position] = v._count;
        return acc;
      },
      {} as Record<string, number>
    ),
  };
}
