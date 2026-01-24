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
const DEFAULT_LEGISLATURE = 17;

/**
 * Native HTTPS GET request (more reliable than fetch in WSL2)
 */
function httpsGet<T>(url: string): Promise<T> {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve(JSON.parse(data) as T);
        } catch (e) {
          reject(new Error(`Failed to parse JSON from ${url}: ${e}`));
        }
      });
    }).on("error", reject);
  });
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
    const list = await fetchScrutins(legislature);
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
