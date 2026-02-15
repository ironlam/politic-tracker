/**
 * Wikidata Affairs Sync Service
 *
 * Business logic for importing politician convictions from Wikidata SPARQL.
 * Extracted from scripts/import-wikidata.ts for use with createCLI.
 */

import { db } from "@/lib/db";
import { AffairCategory, AffairStatus, DataSource } from "@/generated/prisma";
import { generateSlug } from "@/lib/utils";
import { WIKIDATA_SPARQL_RATE_LIMIT_MS } from "@/config/rate-limits";
import { isDuplicate } from "@/services/affairs/matching";

// Wikidata SPARQL endpoint
const WIKIDATA_ENDPOINT = "https://query.wikidata.org/sparql";

// Ve République started in 1958
const VE_REPUBLIQUE_START = 1958;

// Max retry attempts for SPARQL queries
const MAX_RETRIES = 3;

/**
 * Wikidata SPARQL query result for a politician conviction
 */
export interface WikidataConvictionResult {
  person: { value: string };
  personLabel: { value: string };
  crimeLabel: { value: string };
  convictionDate?: { value: string };
  birthDate?: { value: string };
  deathDate?: { value: string };
  partyLabel?: { value: string };
  article?: { value: string };
}

/**
 * Result of importing a single conviction
 */
export interface ConvictionImportResult {
  imported: boolean;
  skipped: boolean;
  error?: string;
}

/**
 * Map Wikidata crime labels to our categories
 * IMPORTANT: Order matters! More specific terms must come before generic ones.
 * The mapCrimeToCategory function sorts by length, so this is safe.
 */
export const CRIME_CATEGORY_MAP: Record<string, AffairCategory> = {
  // Sexual crimes - be very careful with these!
  "agression sexuelle": "AGRESSION_SEXUELLE",
  "sexual assault": "AGRESSION_SEXUELLE",
  viol: "AGRESSION_SEXUELLE", // Viol is legally distinct but grouped here
  rape: "AGRESSION_SEXUELLE",
  "harcèlement sexuel": "HARCELEMENT_SEXUEL",
  "sexual harassment": "HARCELEMENT_SEXUEL",

  // Violence - MUST check these BEFORE generic "violence" term
  "violences conjugales": "VIOLENCE",
  "intimate partner violence": "VIOLENCE",
  "domestic violence": "VIOLENCE",
  "violence domestique": "VIOLENCE",
  "violences volontaires": "VIOLENCE",
  "violences en réunion": "VIOLENCE",
  "violences sur mineur": "VIOLENCE",
  "violences sur ascendant": "VIOLENCE",
  "coups et blessures": "VIOLENCE",
  assault: "VIOLENCE",
  battery: "VIOLENCE",
  violence: "VIOLENCE", // Generic - must be LAST in violence category

  // Corruption and financial crimes
  "corruption passive": "CORRUPTION_PASSIVE",
  corruption: "CORRUPTION",
  "trafic d'influence": "TRAFIC_INFLUENCE",
  "prise illégale d'intérêts": "PRISE_ILLEGALE_INTERETS",
  favoritisme: "FAVORITISME",
  "détournement de fonds publics": "DETOURNEMENT_FONDS_PUBLICS",
  "détournement de fonds": "DETOURNEMENT_FONDS_PUBLICS",
  embezzlement: "DETOURNEMENT_FONDS_PUBLICS",
  "fraude fiscale": "FRAUDE_FISCALE",
  "tax evasion": "FRAUDE_FISCALE",
  "tax fraud": "FRAUDE_FISCALE",
  "blanchiment d'argent": "BLANCHIMENT",
  blanchiment: "BLANCHIMENT",
  "money laundering": "BLANCHIMENT",
  "abus de biens sociaux": "ABUS_BIENS_SOCIAUX",
  "abus de confiance": "ABUS_CONFIANCE",
  "emploi fictif": "EMPLOI_FICTIF",
  "financement illégal de parti politique": "FINANCEMENT_ILLEGAL_PARTI",
  "illegal party financing": "FINANCEMENT_ILLEGAL_PARTI",

  // Other crimes
  "harcèlement moral": "HARCELEMENT_MORAL",
  diffamation: "DIFFAMATION",
  defamation: "DIFFAMATION",
  injure: "INJURE",
  "faux et usage de faux": "FAUX_ET_USAGE_FAUX",
  forgery: "FAUX_ET_USAGE_FAUX",
  recel: "RECEL",
  "subornation de témoin": "AUTRE",
  menace: "MENACE",
  threat: "MENACE",
  "incitation à la haine": "INCITATION_HAINE",
};

/**
 * Map of known party name variations to standard shortNames
 */
export const PARTY_SHORTNAME_MAP: Record<string, string> = {
  "Les Républicains": "LR",
  "La France insoumise": "LFI",
  "Parti socialiste": "PS",
  Reconquête: "REC",
  Renaissance: "RE",
  "Front national": "FN",
  "Rassemblement national": "RN",
  "Union pour un mouvement populaire": "UMP",
  "Mouvement radical": "MR",
  "Nouveau Parti anticapitaliste": "NPA",
  "Union pour la démocratie française": "UDF",
  "Parti socialiste unifié": "PSU",
  "Parti communiste français": "PCF",
  "Rassemblement pour la République": "RPR",
  "Rassemblement du peuple français": "RPF",
  "Union des démocrates pour la République": "UDR",
  "Parti communiste breton": "PCB",
  "Europe Écologie Les Verts": "EELV",
  "Mouvement démocrate": "MoDem",
  Horizons: "HOR",
  Jeanne: "Jeanne",
  "Droit de chasse": "CPNT",
  "Parti républicain": "PR",
};

/**
 * Fetch convictions from Wikidata SPARQL with retry + exponential backoff
 */
export async function fetchWikidataConvictions(
  limit?: number
): Promise<WikidataConvictionResult[]> {
  const sparqlLimit = limit ?? 200;
  const query = `
    SELECT DISTINCT ?person ?personLabel ?crimeLabel ?convictionDate ?birthDate ?deathDate ?partyLabel ?article WHERE {
      ?person wdt:P27 wd:Q142 .
      ?person wdt:P106 wd:Q82955 .
      ?person p:P1399 ?conviction .
      ?conviction ps:P1399 ?crime .
      OPTIONAL { ?conviction pq:P585 ?convictionDate }
      OPTIONAL { ?person wdt:P569 ?birthDate }
      OPTIONAL { ?person wdt:P570 ?deathDate }
      OPTIONAL { ?person wdt:P102 ?party }
      OPTIONAL {
        ?article schema:about ?person ;
                 schema:isPartOf <https://fr.wikipedia.org/> .
      }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "fr,en" }
    }
    ORDER BY DESC(?convictionDate)
    LIMIT ${sparqlLimit}
  `;

  const url = new URL(WIKIDATA_ENDPOINT);
  url.searchParams.set("query", query);

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const backoffMs = Math.pow(2, attempt) * 1000;
      console.log(`  Retry ${attempt}/${MAX_RETRIES - 1} after ${backoffMs}ms...`);
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }

    const response = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "User-Agent":
          "TransparencePolitique/1.0 (https://politic-tracker.vercel.app; contact@example.com)",
      },
    });

    if (response.ok) {
      // Rate limit pause before returning
      await new Promise((resolve) => setTimeout(resolve, WIKIDATA_SPARQL_RATE_LIMIT_MS));
      const data = await response.json();
      return data.results.bindings;
    }

    if (response.status === 429 || response.status === 503) {
      console.warn(`  SPARQL returned ${response.status}, will retry...`);
      continue;
    }

    throw new Error(`Wikidata SPARQL query failed: ${response.status}`);
  }

  throw new Error(`Wikidata SPARQL query failed after ${MAX_RETRIES} retries`);
}

/**
 * Map crime label to AffairCategory
 * Priority: longer/more specific matches first to avoid false positives
 */
export function mapCrimeToCategory(crime: string): AffairCategory {
  const normalized = crime.toLowerCase().trim();

  // Sort keys by length (descending) to match more specific terms first
  const sortedEntries = Object.entries(CRIME_CATEGORY_MAP).sort(
    (a, b) => b[0].length - a[0].length
  );

  for (const [key, value] of sortedEntries) {
    if (normalized.includes(key)) {
      return value;
    }
  }

  console.warn(`  ⚠ Unmatched crime category: "${crime}" -> defaulting to AUTRE`);
  return "AUTRE";
}

/**
 * Parse full name into first/last name
 */
export function parseName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) {
    return { firstName: "", lastName: parts[0] };
  }
  const lastName = parts.pop()!;
  const firstName = parts.join(" ");
  return { firstName, lastName };
}

/**
 * Find or create party by name
 */
export async function findOrCreateParty(partyName: string): Promise<string | null> {
  if (!partyName || partyName.startsWith("Q")) return null; // Skip unresolved Wikidata IDs

  // Try to find existing party by name or shortName
  let party = await db.party.findFirst({
    where: {
      OR: [
        { name: { equals: partyName, mode: "insensitive" } },
        { shortName: { equals: partyName, mode: "insensitive" } },
      ],
    },
  });

  if (party) {
    return party.id;
  }

  // Determine shortName from map or generate one
  let shortName = PARTY_SHORTNAME_MAP[partyName];
  if (!shortName) {
    shortName = partyName
      .split(/\s+/)
      .map((word) => word[0]?.toUpperCase() || "")
      .join("")
      .substring(0, 10);
  }

  // Check if shortName already exists
  const existingWithShortName = await db.party.findFirst({
    where: { shortName: { equals: shortName, mode: "insensitive" } },
  });
  if (existingWithShortName) {
    console.log(
      `  Party shortName conflict: ${partyName} -> using existing ${existingWithShortName.name}`
    );
    return null;
  }

  console.log(`  Creating new party: ${partyName} (${shortName})`);
  try {
    party = await db.party.create({
      data: {
        name: partyName,
        shortName,
        slug: generateSlug(partyName),
      },
    });
    return party.id;
  } catch (error) {
    console.error(`  Failed to create party ${partyName}:`, error);
    return null;
  }
}

/**
 * Upsert Wikidata external ID for a politician
 */
export async function upsertWikidataId(politicianId: string, wikidataId: string): Promise<void> {
  await db.externalId.upsert({
    where: {
      source_externalId: {
        source: DataSource.WIKIDATA,
        externalId: wikidataId,
      },
    },
    create: {
      politicianId,
      source: DataSource.WIKIDATA,
      externalId: wikidataId,
      url: `https://www.wikidata.org/wiki/${wikidataId}`,
    },
    update: {
      politicianId,
      url: `https://www.wikidata.org/wiki/${wikidataId}`,
    },
  });
}

/**
 * Find or create politician with Wikidata ID tracking
 */
export async function findOrCreatePolitician(
  firstName: string,
  lastName: string,
  birthDate: Date | null,
  wikidataId: string
): Promise<string | null> {
  const fullName = `${firstName} ${lastName}`.trim();
  const slug = generateSlug(fullName);

  // 1. Try to find by Wikidata ID first (most reliable)
  const existingByWikidata = await db.externalId.findUnique({
    where: {
      source_externalId: {
        source: DataSource.WIKIDATA,
        externalId: wikidataId,
      },
    },
    include: { politician: true },
  });

  if (existingByWikidata?.politician) {
    const politician = existingByWikidata.politician;
    if (birthDate && !politician.birthDate) {
      await db.politician.update({
        where: { id: politician.id },
        data: { birthDate },
      });
    }
    return politician.id;
  }

  // 2. Try to find existing politician by name (fuzzy match)
  let politician = await db.politician.findFirst({
    where: {
      OR: [
        { slug },
        { fullName: { equals: fullName, mode: "insensitive" } },
        {
          AND: [
            { firstName: { equals: firstName, mode: "insensitive" } },
            { lastName: { equals: lastName, mode: "insensitive" } },
          ],
        },
      ],
    },
  });

  if (politician) {
    console.log(`  Matched existing politician: ${fullName}`);
    if (birthDate && !politician.birthDate) {
      await db.politician.update({
        where: { id: politician.id },
        data: { birthDate },
      });
    }
    await upsertWikidataId(politician.id, wikidataId);
    return politician.id;
  }

  // 3. Create new politician if not found
  console.log(`  Creating new politician: ${fullName}`);
  try {
    politician = await db.politician.create({
      data: {
        slug,
        firstName,
        lastName,
        fullName,
        birthDate,
        photoSource: "wikidata",
      },
    });
    await upsertWikidataId(politician.id, wikidataId);
    return politician.id;
  } catch (error) {
    console.error(`  Failed to create ${fullName}:`, error);
    return null;
  }
}

/**
 * Import a single conviction from Wikidata
 */
export async function importConviction(
  result: WikidataConvictionResult,
  existingSlugs: Set<string>,
  dryRun: boolean
): Promise<ConvictionImportResult> {
  const { firstName, lastName } = parseName(result.personLabel.value);
  const crime = result.crimeLabel.value;
  const convictionDate = result.convictionDate?.value
    ? new Date(result.convictionDate.value)
    : null;

  // Parse dates
  const birthDate = result.birthDate?.value ? new Date(result.birthDate.value) : null;
  const deathDate = result.deathDate?.value ? new Date(result.deathDate.value) : null;

  // Skip if died before Ve République
  if (deathDate && deathDate.getFullYear() < VE_REPUBLIQUE_START) {
    return { imported: false, skipped: true };
  }

  // Skip convictions before Ve République
  if (convictionDate && convictionDate.getFullYear() < VE_REPUBLIQUE_START) {
    return { imported: false, skipped: true };
  }

  // Skip unresolved Wikidata IDs (Q followed by numbers)
  if (/^Q\d+$/.test(result.personLabel.value)) {
    return { imported: false, skipped: true };
  }

  const title = `${crime.charAt(0).toUpperCase() + crime.slice(1)}`;
  const baseSlug = generateSlug(`${firstName}-${lastName}-${crime}`);

  // Skip if already exists
  if (existingSlugs.has(baseSlug)) {
    return { imported: false, skipped: true };
  }

  const wikidataId = result.person.value.split("/").pop() || "";

  if (dryRun) {
    console.log(`  [DRY-RUN] Would import: ${result.personLabel.value} - ${crime}`);
    existingSlugs.add(baseSlug);
    return { imported: true, skipped: false };
  }

  // Find or create politician
  const politicianId = await findOrCreatePolitician(firstName, lastName, birthDate, wikidataId);

  if (!politicianId) {
    return {
      imported: false,
      skipped: true,
      error: `Could not find/create politician: ${result.personLabel.value}`,
    };
  }

  // Check if affair already exists using multi-criteria matching
  const category = mapCrimeToCategory(crime);
  const duplicate = await isDuplicate({
    politicianId,
    title: crime,
    category,
    verdictDate: convictionDate,
  });

  if (duplicate) {
    return { imported: false, skipped: true };
  }

  // Find or create party at time of conviction
  const partyAtTimeId = result.partyLabel?.value
    ? await findOrCreateParty(result.partyLabel.value)
    : null;

  // Create affair with unique slug
  let slug = baseSlug;
  let counter = 1;
  while (existingSlugs.has(slug)) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }
  existingSlugs.add(slug);

  try {
    await db.affair.create({
      data: {
        politicianId,
        title,
        slug,
        description: `Condamnation pour ${crime}.`,
        status: "CONDAMNATION_DEFINITIVE" as AffairStatus,
        category,
        verdictDate: convictionDate,
        partyAtTimeId,
        sources: {
          create: {
            url: result.article?.value || `https://www.wikidata.org/wiki/${wikidataId}`,
            title: `Wikidata - ${result.personLabel.value}`,
            publisher: "Wikidata",
            publishedAt: convictionDate || new Date(),
            sourceType: "WIKIDATA",
          },
        },
      },
    });

    console.log(`  ✓ Imported: ${result.personLabel.value} - ${crime}`);
    return { imported: true, skipped: false };
  } catch (error) {
    const message = `Failed: ${result.personLabel.value} - ${crime}: ${error}`;
    console.error(`  ✗ ${message}`);
    return { imported: false, skipped: false, error: message };
  }
}

/**
 * Get statistics about Wikidata affairs in the database
 */
export async function getWikidataAffairsStats(): Promise<{
  totalAffairs: number;
  topCategories: { category: string; count: number }[];
  recentAffairs: { title: string; politicianName: string; createdAt: Date }[];
}> {
  const [totalAffairs, categoryGroups, recentAffairs] = await Promise.all([
    db.affair.count({
      where: {
        sources: { some: { publisher: "Wikidata" } },
      },
    }),
    db.affair.groupBy({
      by: ["category"],
      where: {
        sources: { some: { publisher: "Wikidata" } },
      },
      _count: true,
      orderBy: { _count: { category: "desc" } },
      take: 5,
    }),
    db.affair.findMany({
      where: {
        sources: { some: { publisher: "Wikidata" } },
      },
      select: {
        title: true,
        createdAt: true,
        politician: { select: { fullName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  return {
    totalAffairs,
    topCategories: categoryGroups.map((g) => ({
      category: g.category,
      count: g._count,
    })),
    recentAffairs: recentAffairs.map((a) => ({
      title: a.title,
      politicianName: a.politician.fullName,
      createdAt: a.createdAt,
    })),
  };
}
