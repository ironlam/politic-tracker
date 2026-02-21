/**
 * Service to discover historical judicial affairs from Wikidata and Wikipedia.
 * Extracted from scripts/discover-affairs.ts for Inngest compatibility.
 *
 * Phase 1: Wikidata — P1399 (convicted of) and P1595 (charge)
 * Phase 2: Wikipedia — Judicial sections + AI extraction
 * Phase 3: Reconciliation — Dedup + persist
 */

import { db } from "@/lib/db";
import { generateSlug } from "@/lib/utils";
import { WikidataService } from "@/lib/api/wikidata";
import { WD_PROPS } from "@/config/wikidata";
import { mapWikidataOffense, getOffenseLabel } from "@/config/wikidata-affairs";
import { wikipediaService } from "@/lib/api/wikipedia";
import { extractAffairsFromWikipedia } from "@/services/wikipedia-affair-extraction";
import { findMatchingAffairs } from "@/services/affairs/matching";
import type { AffairCategory, AffairStatus, Involvement } from "@/generated/prisma";

interface DiscoveredAffair {
  politicianId: string;
  politicianName: string;
  title: string;
  description: string;
  category: AffairCategory;
  status: AffairStatus;
  involvement: Involvement;
  factsDate: Date | null;
  court: string | null;
  charges: string[];
  confidenceScore: number;
  publicationStatus: "PUBLISHED" | "DRAFT";
  sources: Array<{
    url: string;
    title: string;
    publisher: string;
    sourceType: "WIKIDATA" | "WIKIPEDIA" | "PRESSE";
  }>;
  phase: "wikidata" | "wikipedia";
}

export interface DiscoverAffairsResult {
  politiciansProcessed: number;
  wikidataAffairsFound: number;
  wikipediaAffairsFound: number;
  duplicatesSkipped: number;
  affairsCreated: number;
  errors: string[];
}

function extractPublisherFromUrl(url: string): string {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    const PUBLISHER_MAP: Record<string, string> = {
      "lemonde.fr": "Le Monde",
      "liberation.fr": "Lib\u00e9ration",
      "mediapart.fr": "Mediapart",
      "lefigaro.fr": "Le Figaro",
      "francetvinfo.fr": "France Info",
      "bfmtv.com": "BFM TV",
      "leparisien.fr": "Le Parisien",
      "20minutes.fr": "20 Minutes",
      "lexpress.fr": "L'Express",
      "lepoint.fr": "Le Point",
      "nouvelobs.com": "L'Obs",
      "europe1.fr": "Europe 1",
      "rtl.fr": "RTL",
      "rfi.fr": "RFI",
    };
    return PUBLISHER_MAP[hostname] || hostname;
  } catch {
    return "Source inconnue";
  }
}

async function generateUniqueAffairSlug(title: string): Promise<string> {
  const baseSlug = generateSlug(title);
  let slug = baseSlug;
  let counter = 2;

  while (await db.affair.findUnique({ where: { slug } })) {
    const suffix = `-${counter}`;
    const maxBaseLength = 120 - suffix.length;
    const truncatedBase = baseSlug.slice(0, maxBaseLength).replace(/-$/, "");
    slug = `${truncatedBase}${suffix}`;
    counter++;
  }

  return slug;
}

export async function discoverAffairs(options?: {
  limit?: number;
  politicianFilter?: string;
  wikidataOnly?: boolean;
  wikipediaOnly?: boolean;
}): Promise<DiscoverAffairsResult> {
  const { limit, politicianFilter, wikidataOnly = false, wikipediaOnly = false } = options ?? {};

  const stats: DiscoverAffairsResult = {
    politiciansProcessed: 0,
    wikidataAffairsFound: 0,
    wikipediaAffairsFound: 0,
    duplicatesSkipped: 0,
    affairsCreated: 0,
    errors: [],
  };

  // Fetch politicians
  const politicians = await db.politician.findMany({
    where: {
      publicationStatus: "PUBLISHED",
      ...(politicianFilter
        ? {
            fullName: {
              contains: politicianFilter,
              mode: "insensitive" as const,
            },
          }
        : {}),
    },
    select: {
      id: true,
      fullName: true,
      externalIds: {
        where: { source: "WIKIDATA" },
        select: { externalId: true },
      },
    },
    orderBy: { lastName: "asc" },
    ...(limit ? { take: limit } : {}),
  });

  stats.politiciansProcessed = politicians.length;
  console.log(`${politicians.length} politician(s) found`);

  if (politicians.length === 0) {
    return stats;
  }

  // Phase 1: Wikidata
  let phase1Affairs: DiscoveredAffair[] = [];
  if (!wikipediaOnly) {
    phase1Affairs = await runPhase1Wikidata(politicians, stats);
  }

  // Phase 2: Wikipedia
  let phase2Affairs: DiscoveredAffair[] = [];
  if (!wikidataOnly) {
    phase2Affairs = await runPhase2Wikipedia(politicians, phase1Affairs, stats);
  }

  // Phase 3: Reconciliation
  const allAffairs = [...phase1Affairs, ...phase2Affairs];

  if (allAffairs.length > 0) {
    await runPhase3Reconciliation(allAffairs, stats);
  }

  return stats;
}

async function runPhase1Wikidata(
  politicians: Array<{
    id: string;
    fullName: string;
    externalIds: Array<{ externalId: string }>;
  }>,
  stats: DiscoverAffairsResult
): Promise<DiscoveredAffair[]> {
  const discovered: DiscoveredAffair[] = [];
  const wikidataService = new WikidataService();

  const withQid = politicians.filter((p) => p.externalIds.length > 0);
  if (withQid.length === 0) return discovered;

  console.log(`Phase 1: Wikidata - ${withQid.length} politicians with Q-ID`);

  for (const politician of withQid) {
    const qid = politician.externalIds[0].externalId;

    try {
      const entities = await wikidataService.getEntities([qid]);
      const entity = entities.get(qid);
      if (!entity) continue;

      const properties: Array<{
        prop: "P1399" | "P1595";
        claims: (typeof entity.claims)[string];
      }> = [
        { prop: "P1399", claims: entity.claims[WD_PROPS.CONVICTED_OF] },
        { prop: "P1595", claims: entity.claims[WD_PROPS.CHARGE] },
      ];

      for (const { prop, claims } of properties) {
        if (!claims) continue;

        for (const claim of claims) {
          const value = claim.mainsnak?.datavalue?.value;
          if (!value || typeof value !== "object" || !("id" in value)) continue;

          const offenseQid = value.id;
          const { category, status } = mapWikidataOffense(offenseQid, prop);
          const label = getOffenseLabel(offenseQid);

          const isConviction = prop === "P1399";
          const publicationStatus = isConviction ? "PUBLISHED" : "DRAFT";
          const confidence = isConviction ? 95 : 75;
          const titlePrefix = isConviction ? "" : "[\u00c0 V\u00c9RIFIER] ";
          const title = `${titlePrefix}${label} \u2014 ${politician.fullName}`;

          discovered.push({
            politicianId: politician.id,
            politicianName: politician.fullName,
            title,
            description: `${label} (${isConviction ? "condamnation" : "mise en cause"}) \u2014 source Wikidata (${qid}, propri\u00e9t\u00e9 ${prop}).`,
            category,
            status,
            involvement: isConviction ? "DIRECT" : "MENTIONED_ONLY",
            factsDate: null,
            court: null,
            charges: [label],
            confidenceScore: confidence,
            publicationStatus: publicationStatus as "PUBLISHED" | "DRAFT",
            sources: [
              {
                url: `https://www.wikidata.org/wiki/${qid}`,
                title: `Wikidata \u2014 ${politician.fullName}`,
                publisher: "Wikidata",
                sourceType: "WIKIDATA",
              },
            ],
            phase: "wikidata",
          });

          stats.wikidataAffairsFound++;
        }
      }
    } catch (error) {
      stats.errors.push(
        `Wikidata ${politician.fullName}: ${error instanceof Error ? error.message : error}`
      );
    }
  }

  return discovered;
}

async function runPhase2Wikipedia(
  politicians: Array<{
    id: string;
    fullName: string;
    externalIds: Array<{ externalId: string }>;
  }>,
  phase1Affairs: DiscoveredAffair[],
  stats: DiscoverAffairsResult
): Promise<DiscoveredAffair[]> {
  const discovered: DiscoveredAffair[] = [];
  const phase1Keys = new Set(phase1Affairs.map((a) => `${a.politicianId}:${a.category}`));

  console.log(`Phase 2: Wikipedia - ${politicians.length} politicians`);

  for (const politician of politicians) {
    try {
      const sections = await wikipediaService.findJudicialSections(politician.fullName);
      if (sections.length === 0) continue;

      for (const section of sections) {
        const pageUrl = `https://fr.wikipedia.org/wiki/${encodeURIComponent(politician.fullName.replace(/ /g, "_"))}`;

        const result = await extractAffairsFromWikipedia({
          politicianName: politician.fullName,
          sectionTitle: section.title,
          wikitext: section.wikitext,
          pageUrl,
        });

        for (const extracted of result.affairs) {
          if (
            extracted.involvement !== "DIRECT" &&
            extracted.involvement !== "VICTIM" &&
            extracted.involvement !== "PLAINTIFF"
          )
            continue;

          if (extracted.confidenceScore < 40) continue;

          const dedupKey = `${politician.id}:${extracted.category}`;
          if (phase1Keys.has(dedupKey)) continue;

          const sources: DiscoveredAffair["sources"] = [
            {
              url: pageUrl,
              title: `Wikipedia \u2014 ${politician.fullName}`,
              publisher: "Wikipedia",
              sourceType: "WIKIPEDIA",
            },
          ];

          for (const sourceUrl of extracted.sourceUrls) {
            sources.push({
              url: sourceUrl,
              title: extracted.title,
              publisher: extractPublisherFromUrl(sourceUrl),
              sourceType: "PRESSE",
            });
          }

          discovered.push({
            politicianId: politician.id,
            politicianName: politician.fullName,
            title: `[\u00c0 V\u00c9RIFIER] ${extracted.title}`,
            description: extracted.description,
            category: extracted.category as AffairCategory,
            status: extracted.status as AffairStatus,
            involvement: extracted.involvement,
            factsDate: extracted.factsDate ? new Date(extracted.factsDate) : null,
            court: extracted.court,
            charges: extracted.charges,
            confidenceScore: extracted.confidenceScore,
            publicationStatus: "DRAFT",
            sources,
            phase: "wikipedia",
          });

          stats.wikipediaAffairsFound++;
        }
      }
    } catch (error) {
      stats.errors.push(
        `Wikipedia ${politician.fullName}: ${error instanceof Error ? error.message : error}`
      );
    }
  }

  return discovered;
}

async function runPhase3Reconciliation(
  allAffairs: DiscoveredAffair[],
  stats: DiscoverAffairsResult
): Promise<void> {
  console.log(`Phase 3: Reconciliation - ${allAffairs.length} affairs`);

  for (const affair of allAffairs) {
    try {
      const matches = await findMatchingAffairs({
        politicianId: affair.politicianId,
        title: affair.title,
        category: affair.category,
      });

      const highMatch = matches.find((m) => m.confidence === "HIGH" || m.confidence === "CERTAIN");

      if (highMatch) {
        stats.duplicatesSkipped++;
        continue;
      }

      const slug = await generateUniqueAffairSlug(affair.title);

      await db.affair.create({
        data: {
          politicianId: affair.politicianId,
          title: affair.title,
          slug,
          description: affair.description,
          status: affair.status,
          category: affair.category,
          involvement: affair.involvement,
          factsDate: affair.factsDate,
          court: affair.court,
          confidenceScore: affair.confidenceScore,
          publicationStatus: affair.publicationStatus,
          verifiedAt: affair.publicationStatus === "PUBLISHED" ? new Date() : null,
          sources: {
            create: affair.sources.map((s) => ({
              url: s.url,
              title: s.title,
              publisher: s.publisher,
              publishedAt: new Date(),
              sourceType: s.sourceType,
            })),
          },
        },
      });

      stats.affairsCreated++;
    } catch (error) {
      stats.errors.push(
        `Create "${affair.title}": ${error instanceof Error ? error.message : error}`
      );
    }
  }
}
