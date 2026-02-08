import { PrismaClient, AffairCategory, AffairStatus, DataSource } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { config } from "dotenv";

config();

// Initialize Prisma
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

// Wikidata SPARQL endpoint
const WIKIDATA_ENDPOINT = "https://query.wikidata.org/sparql";

// Map Wikidata crime labels to our categories
// IMPORTANT: Order matters! More specific terms must come before generic ones
// The mapCrimeToCategory function uses includes(), so "violence" would match before "violences conjugales"
const CRIME_CATEGORY_MAP: Record<string, AffairCategory> = {
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

interface WikidataResult {
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
 * Query Wikidata for French politicians with convictions
 */
async function fetchWikidataConvictions(): Promise<WikidataResult[]> {
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
    LIMIT 200
  `;

  const url = new URL(WIKIDATA_ENDPOINT);
  url.searchParams.set("query", query);

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      "User-Agent":
        "TransparencePolitique/1.0 (https://politic-tracker.vercel.app; contact@example.com)",
    },
  });

  if (!response.ok) {
    throw new Error(`Wikidata query failed: ${response.status}`);
  }

  const data = await response.json();
  return data.results.bindings;
}

/**
 * Parse name into first/last name
 */
function parseName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) {
    return { firstName: "", lastName: parts[0] };
  }
  const lastName = parts.pop()!;
  const firstName = parts.join(" ");
  return { firstName, lastName };
}

/**
 * Generate slug from text
 */
function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * Map crime to category
 * Priority: longer/more specific matches first to avoid false positives
 * e.g., "violences conjugales" should not match "agression sexuelle" just because both are crimes
 */
function mapCrimeToCategory(crime: string): AffairCategory {
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

  // Log unmatched crimes for future improvement
  console.warn(`  ⚠ Unmatched crime category: "${crime}" -> defaulting to AUTRE`);
  return "AUTRE";
}

// Map of known party name variations to standard shortNames
const PARTY_SHORTNAME_MAP: Record<string, string> = {
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
 * Find or create party by name
 */
async function findOrCreateParty(partyName: string): Promise<string | null> {
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
    // Generate initials from party name
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
    // Shortname conflict but different name - just link to existing party conceptually
    console.log(
      `  Party shortName conflict: ${partyName} -> using existing ${existingWithShortName.name}`
    );
    return null; // Don't link, as it's a different party
  }

  console.log(`  Creating new party: ${partyName} (${shortName})`);
  try {
    party = await db.party.create({
      data: {
        name: partyName,
        shortName,
      },
    });
    return party.id;
  } catch (error) {
    console.error(`  Failed to create party ${partyName}:`, error);
    return null;
  }
}

/**
 * Find or create politician with Wikidata ID tracking
 */
async function findOrCreatePolitician(
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
    // Update birthDate if we have it and politician doesn't
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
    // Update birthDate if we have it and politician doesn't
    if (birthDate && !politician.birthDate) {
      await db.politician.update({
        where: { id: politician.id },
        data: { birthDate },
      });
    }
    // Add Wikidata external ID
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
    // Add Wikidata external ID
    await upsertWikidataId(politician.id, wikidataId);
    return politician.id;
  } catch (error) {
    console.error(`  Failed to create ${fullName}:`, error);
    return null;
  }
}

/**
 * Upsert Wikidata external ID
 */
async function upsertWikidataId(politicianId: string, wikidataId: string): Promise<void> {
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
 * Import a single conviction
 */
async function importConviction(
  result: WikidataResult,
  existingSlugs: Set<string>
): Promise<boolean> {
  const { firstName, lastName } = parseName(result.personLabel.value);
  const crime = result.crimeLabel.value;
  const convictionDate = result.convictionDate?.value
    ? new Date(result.convictionDate.value)
    : null;

  // Ve République started in 1958
  const VE_REPUBLIQUE_START = 1958;

  // Parse dates
  const birthDate = result.birthDate?.value ? new Date(result.birthDate.value) : null;
  const deathDate = result.deathDate?.value ? new Date(result.deathDate.value) : null;

  // Skip if died before Ve République - can't be a contemporary politician
  if (deathDate && deathDate.getFullYear() < VE_REPUBLIQUE_START) {
    console.log(`  Skipping (died ${deathDate.getFullYear()}): ${result.personLabel.value}`);
    return false;
  }

  // Skip convictions before Ve République
  if (convictionDate && convictionDate.getFullYear() < VE_REPUBLIQUE_START) {
    console.log(
      `  Skipping (conviction ${convictionDate.getFullYear()}): ${result.personLabel.value}`
    );
    return false;
  }

  // Skip unresolved Wikidata IDs (Q followed by numbers)
  if (/^Q\d+$/.test(result.personLabel.value)) {
    console.log(`  Skipping unresolved: ${result.personLabel.value}`);
    return false;
  }

  const title = `${crime.charAt(0).toUpperCase() + crime.slice(1)}`;
  const baseSlug = generateSlug(`${firstName}-${lastName}-${crime}`);

  // Skip if already exists
  if (existingSlugs.has(baseSlug)) {
    return false;
  }

  // Extract Wikidata ID from URL (e.g., "http://www.wikidata.org/entity/Q123456" -> "Q123456")
  const wikidataId = result.person.value.split("/").pop() || "";

  // Find or create politician
  const politicianId = await findOrCreatePolitician(firstName, lastName, birthDate, wikidataId);

  if (!politicianId) {
    return false;
  }

  // Check if affair already exists for this politician + crime
  const existingAffair = await db.affair.findFirst({
    where: {
      politicianId,
      title: { contains: crime, mode: "insensitive" },
    },
  });

  if (existingAffair) {
    console.log(`  Skipping duplicate: ${result.personLabel.value} - ${crime}`);
    return false;
  }

  // Find or create party at time of conviction
  const partyAtTimeId = result.partyLabel?.value
    ? await findOrCreateParty(result.partyLabel.value)
    : null;

  // Create affair
  const category = mapCrimeToCategory(crime);
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
            url:
              result.article?.value ||
              `https://www.wikidata.org/wiki/${result.person.value.split("/").pop()}`,
            title: `Wikidata - ${result.personLabel.value}`,
            publisher: "Wikidata",
            // Use conviction date as source date (not import date)
            publishedAt: convictionDate || new Date(),
          },
        },
      },
    });

    console.log(`  ✓ Imported: ${result.personLabel.value} - ${crime}`);
    return true;
  } catch (error) {
    console.error(`  ✗ Failed: ${result.personLabel.value} - ${crime}`, error);
    return false;
  }
}

/**
 * Main import function
 */
async function main() {
  console.log("Fetching convictions from Wikidata...");
  const results = await fetchWikidataConvictions();
  console.log(`Found ${results.length} conviction records`);

  // Get existing affair slugs
  const existingAffairs = await db.affair.findMany({ select: { slug: true } });
  const existingSlugs = new Set(existingAffairs.map((a) => a.slug));

  let imported = 0;
  let skipped = 0;

  console.log("\nImporting convictions...");
  for (const result of results) {
    const success = await importConviction(result, existingSlugs);
    if (success) imported++;
    else skipped++;
  }

  console.log(`\n========================================`);
  console.log(`Import complete!`);
  console.log(`  Imported: ${imported}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`========================================`);

  await pool.end();
}

main().catch(console.error);
