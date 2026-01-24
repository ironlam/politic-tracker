import { db } from "@/lib/db";
import { VotePosition, VotingResult, DataSource } from "@/generated/prisma";
import {
  NosDeputesScrutinList,
  NosDeputesScrutinDetail,
  NosDeputesVotant,
  VotesSyncResult,
} from "./types";
import https from "https";

const NOSDEPUTES_BASE_URL = "https://www.nosdeputes.fr";
const DEFAULT_LEGISLATURE = 16; // NosDéputés n'a pas encore la 17e législature
const REQUEST_TIMEOUT = 30000; // 30 seconds

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
  scrutinId: number,
  legislature: number = DEFAULT_LEGISLATURE
): Promise<NosDeputesScrutinDetail> {
  const url = `${NOSDEPUTES_BASE_URL}/${legislature}/scrutin/${scrutinId}/json`;
  return httpsGet<NosDeputesScrutinDetail>(url);
}

/**
 * Convert NosDéputés sort to VotingResult
 */
function parseVotingResult(sort: string): VotingResult {
  return sort.toLowerCase() === "adopté" ? "ADOPTED" : "REJECTED";
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
 * Extract votants from a vote object (handles single or array)
 */
function extractVotants(votants: NosDeputesVotant | NosDeputesVotant[] | undefined): NosDeputesVotant[] {
  if (!votants) return [];
  return Array.isArray(votants) ? votants : [votants];
}

/**
 * Sync a single scrutin with all its votes
 */
export async function syncScrutin(
  detail: NosDeputesScrutinDetail,
  legislature: number,
  slugToId: Map<string, string>
): Promise<{ created: boolean; votesCreated: number; notFound: string[] }> {
  const s = detail.scrutin;
  const externalId = String(s.numero);
  const sourceUrl = `${NOSDEPUTES_BASE_URL}/${legislature}/scrutin/${s.numero}`;

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
    votesFor: s.nombre_pours,
    votesAgainst: s.nombre_contres,
    votesAbstain: s.nombre_abstentions,
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

  // Collect all votes from all groups
  const votesToCreate: { politicianId: string; position: VotePosition }[] = [];
  const notFound: string[] = [];

  for (const groupe of s.synthese.groupe) {
    const vote = groupe.vote;

    // Pour
    for (const votant of extractVotants(vote.pour?.votant)) {
      const polId = slugToId.get(votant.id.toLowerCase());
      if (polId) {
        votesToCreate.push({ politicianId: polId, position: "POUR" });
      } else {
        notFound.push(votant.id);
      }
    }

    // Contre
    for (const votant of extractVotants(vote.contre?.votant)) {
      const polId = slugToId.get(votant.id.toLowerCase());
      if (polId) {
        votesToCreate.push({ politicianId: polId, position: "CONTRE" });
      } else {
        notFound.push(votant.id);
      }
    }

    // Abstention
    for (const votant of extractVotants(vote.abstention?.votant)) {
      const polId = slugToId.get(votant.id.toLowerCase());
      if (polId) {
        votesToCreate.push({ politicianId: polId, position: "ABSTENTION" });
      } else {
        notFound.push(votant.id);
      }
    }

    // Non-votant (absent)
    for (const votant of extractVotants(vote.nonVotant?.votant)) {
      const polId = slugToId.get(votant.id.toLowerCase());
      if (polId) {
        votesToCreate.push({ politicianId: polId, position: "ABSENT" });
      } else {
        notFound.push(votant.id);
      }
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
    notFound: [...new Set(notFound)], // unique
  };
}

/**
 * Main sync function - syncs all scrutins for a legislature
 */
export async function syncVotes(legislature: number = DEFAULT_LEGISLATURE): Promise<VotesSyncResult> {
  const result: VotesSyncResult = {
    success: false,
    scrutinsCreated: 0,
    scrutinsUpdated: 0,
    votesCreated: 0,
    politiciansNotFound: [],
    errors: [],
  };

  try {
    console.log(`\nBuilding slug to politician ID map...`);
    const slugToId = await buildSlugToIdMap();
    console.log(`Found ${slugToId.size} politicians in database`);

    console.log(`\nFetching scrutins for legislature ${legislature}...`);

    let list: NosDeputesScrutinList;
    try {
      list = await fetchScrutins(legislature);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      if (errMsg.includes("not available") || errMsg.includes("redirected")) {
        console.error(`\n❌ Legislature ${legislature} is not available on NosDéputés.`);
        console.error(`   NosDéputés usually lags behind the current legislature.`);
        console.error(`   Try with --leg=16 for the 16th legislature.\n`);
        result.errors.push(`Legislature ${legislature} not available on NosDéputés`);
        return result;
      }
      throw error;
    }

    const scrutins = list.scrutins;
    console.log(`Found ${scrutins.length} scrutins`);

    // Process each scrutin
    let processed = 0;
    for (const item of scrutins) {
      const scrutinId = item.scrutin.numero;

      try {
        // Add delay to avoid rate limiting
        if (processed > 0 && processed % 10 === 0) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }

        const detail = await fetchScrutinDetails(scrutinId, legislature);
        const syncResult = await syncScrutin(detail, legislature, slugToId);

        if (syncResult.created) {
          result.scrutinsCreated++;
        } else {
          result.scrutinsUpdated++;
        }
        result.votesCreated += syncResult.votesCreated;
        result.politiciansNotFound.push(...syncResult.notFound);

        processed++;
        if (processed % 50 === 0) {
          console.log(`  Processed ${processed}/${scrutins.length} scrutins...`);
        }
      } catch (error) {
        result.errors.push(`Scrutin ${scrutinId}: ${error}`);
      }
    }

    // Deduplicate not found list
    result.politiciansNotFound = [...new Set(result.politiciansNotFound)];
    result.success = true;
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
