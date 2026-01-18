import { PrismaClient, AffairCategory, AffairStatus } from "../src/generated/prisma";
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
const CRIME_CATEGORY_MAP: Record<string, AffairCategory> = {
  "corruption": "CORRUPTION",
  "corruption passive": "CORRUPTION_PASSIVE",
  "trafic d'influence": "TRAFIC_INFLUENCE",
  "prise illégale d'intérêts": "PRISE_ILLEGALE_INTERETS",
  "favoritisme": "FAVORITISME",
  "détournement de fonds publics": "DETOURNEMENT_FONDS_PUBLICS",
  "détournement de fonds": "DETOURNEMENT_FONDS_PUBLICS",
  "fraude fiscale": "FRAUDE_FISCALE",
  "blanchiment d'argent": "BLANCHIMENT",
  "blanchiment": "BLANCHIMENT",
  "abus de biens sociaux": "ABUS_BIENS_SOCIAUX",
  "abus de confiance": "ABUS_CONFIANCE",
  "emploi fictif": "EMPLOI_FICTIF",
  "harcèlement moral": "HARCELEMENT_MORAL",
  "harcèlement sexuel": "HARCELEMENT_SEXUEL",
  "agression sexuelle": "AGRESSION_SEXUELLE",
  "viol": "AGRESSION_SEXUELLE",
  "violence": "VIOLENCE",
  "diffamation": "DIFFAMATION",
  "injure": "INJURE",
  "faux et usage de faux": "FAUX_ET_USAGE_FAUX",
  "recel": "RECEL",
  "subornation de témoin": "AUTRE",
  "financement illégal de parti politique": "FINANCEMENT_ILLEGAL_PARTI",
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
      "User-Agent": "TransparencePolitique/1.0 (https://politic-tracker.vercel.app; contact@example.com)",
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
 */
function mapCrimeToCategory(crime: string): AffairCategory {
  const normalized = crime.toLowerCase();
  for (const [key, value] of Object.entries(CRIME_CATEGORY_MAP)) {
    if (normalized.includes(key)) {
      return value;
    }
  }
  return "AUTRE";
}

// Map of known party name variations to standard shortNames
const PARTY_SHORTNAME_MAP: Record<string, string> = {
  "Les Républicains": "LR",
  "La France insoumise": "LFI",
  "Parti socialiste": "PS",
  "Reconquête": "REC",
  "Renaissance": "RE",
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
  "Horizons": "HOR",
  "Jeanne": "Jeanne",
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
      .map(word => word[0]?.toUpperCase() || "")
      .join("")
      .substring(0, 10);
  }

  // Check if shortName already exists
  const existingWithShortName = await db.party.findFirst({
    where: { shortName: { equals: shortName, mode: "insensitive" } },
  });
  if (existingWithShortName) {
    // Shortname conflict but different name - just link to existing party conceptually
    console.log(`  Party shortName conflict: ${partyName} -> using existing ${existingWithShortName.name}`);
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
 * Find or create politician
 */
async function findOrCreatePolitician(
  firstName: string,
  lastName: string,
  birthDate?: Date | null
): Promise<string | null> {
  const fullName = `${firstName} ${lastName}`.trim();
  const slug = generateSlug(fullName);

  // Try to find existing politician
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
    // Update birthDate if we have it and politician doesn't
    if (birthDate && !politician.birthDate) {
      await db.politician.update({
        where: { id: politician.id },
        data: { birthDate },
      });
    }
    return politician.id;
  }

  // Create new politician if not found
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
    return politician.id;
  } catch (error) {
    console.error(`  Failed to create ${fullName}:`, error);
    return null;
  }
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
    console.log(`  Skipping (conviction ${convictionDate.getFullYear()}): ${result.personLabel.value}`);
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

  // Find or create politician
  const politicianId = await findOrCreatePolitician(
    firstName,
    lastName,
    birthDate
  );

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
            url: result.article?.value || `https://www.wikidata.org/wiki/${result.person.value.split("/").pop()}`,
            title: `Wikidata - ${result.personLabel.value}`,
            publisher: "Wikidata",
            publishedAt: new Date(),
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
