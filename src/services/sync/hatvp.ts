import { db } from "@/lib/db";
import { DataSource, DeclarationType } from "@/generated/prisma";
import { parse } from "csv-parse/sync";
import { HATVPCSV, HATVPSyncResult, HATVP_DOCUMENT_TYPE_MAPPING } from "./types";

const HATVP_CSV_URL = "https://www.hatvp.fr/livraison/opendata/liste.csv";

/**
 * Fetch and parse HATVP declarations CSV
 */
async function fetchHATVPCSV(): Promise<HATVPCSV[]> {
  console.log(`Fetching HATVP data from: ${HATVP_CSV_URL}`);

  const response = await fetch(HATVP_CSV_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch CSV: ${response.status}`);
  }

  const csvText = await response.text();
  const records = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    delimiter: ";",
    bom: true,
  }) as HATVPCSV[];

  console.log(`Parsed ${records.length} declaration records`);
  return records;
}

/**
 * Filter declarations for our target mandate types
 */
function filterRelevantDeclarations(records: HATVPCSV[]): HATVPCSV[] {
  const relevantTypes = ["depute", "senateur", "gouvernement", "europe"];
  return records.filter((r) => relevantTypes.includes(r.type_mandat));
}

/**
 * Find politician by external ID (AN or Sénat)
 */
async function findPoliticianByExternalId(
  idOrigine: string,
  typeMandt: string
): Promise<string | null> {
  if (!idOrigine || idOrigine.trim() === "") return null;

  // Determine source based on mandate type
  let source: DataSource;
  let externalId = idOrigine;

  if (typeMandt === "depute") {
    source = DataSource.ASSEMBLEE_NATIONALE;
    // AN IDs are like "PA841729" but HATVP has just "841729"
    externalId = `PA${idOrigine}`;
  } else if (typeMandt === "senateur") {
    source = DataSource.SENAT;
    // Sénat IDs have various formats, try as-is first
    externalId = idOrigine.replace(/[A-Za-z]$/, ""); // Remove suffix letter if present
  } else {
    return null;
  }

  // Try to find by external ID
  const found = await db.externalId.findFirst({
    where: {
      source,
      OR: [{ externalId }, { externalId: idOrigine }, { externalId: `PA${idOrigine}` }],
    },
    select: { politicianId: true },
  });

  return found?.politicianId || null;
}

/**
 * Find politician by name (fallback)
 */
async function findPoliticianByName(prenom: string, nom: string): Promise<string | null> {
  // Normalize name (HATVP has uppercase names)
  const normalizedNom = nom.charAt(0).toUpperCase() + nom.slice(1).toLowerCase();

  const found = await db.politician.findFirst({
    where: {
      OR: [
        {
          firstName: { equals: prenom, mode: "insensitive" },
          lastName: { equals: nom, mode: "insensitive" },
        },
        {
          firstName: { equals: prenom, mode: "insensitive" },
          lastName: { equals: normalizedNom, mode: "insensitive" },
        },
      ],
    },
    select: { id: true },
  });

  return found?.id || null;
}

/**
 * Map HATVP document type to DeclarationType
 */
function getDeclarationType(typeDoc: string): DeclarationType {
  const mapping = HATVP_DOCUMENT_TYPE_MAPPING[typeDoc];
  switch (mapping) {
    case "INTERETS":
      return DeclarationType.INTERETS;
    case "PATRIMOINE_DEBUT_MANDAT":
      return DeclarationType.PATRIMOINE_DEBUT_MANDAT;
    case "PATRIMOINE_FIN_MANDAT":
      return DeclarationType.PATRIMOINE_FIN_MANDAT;
    case "PATRIMOINE_MODIFICATION":
      return DeclarationType.PATRIMOINE_MODIFICATION;
    default:
      return DeclarationType.INTERETS;
  }
}

/**
 * Extract year from declaration
 */
function extractYear(datePublication: string, dateDepot: string): number {
  const dateStr = datePublication || dateDepot;
  if (dateStr && dateStr.length >= 4) {
    const year = parseInt(dateStr.substring(0, 4), 10);
    if (!isNaN(year)) return year;
  }
  return new Date().getFullYear();
}

/**
 * Sync a single declaration
 */
async function syncDeclaration(
  decl: HATVPCSV,
  politicianId: string
): Promise<"created" | "updated" | "error"> {
  try {
    const declType = getDeclarationType(decl.type_document);
    const year = extractYear(decl.date_publication, decl.date_depot);
    const hatvpUrl = decl.url_dossier
      ? `https://www.hatvp.fr${decl.url_dossier}`
      : `https://www.hatvp.fr/consulter-les-declarations/`;

    // Check if declaration already exists
    const existing = await db.declaration.findUnique({
      where: {
        politicianId_type_year: {
          politicianId,
          type: declType,
          year,
        },
      },
    });

    const declarationData = {
      type: declType,
      year,
      hatvpUrl,
      pdfUrl: decl.nom_fichier
        ? `https://www.hatvp.fr/livraison/dossiers/${decl.nom_fichier}`
        : null,
    };

    if (existing) {
      await db.declaration.update({
        where: { id: existing.id },
        data: declarationData,
      });
      return "updated";
    } else {
      await db.declaration.create({
        data: {
          ...declarationData,
          politicianId,
        },
      });
      return "created";
    }
  } catch (error) {
    console.error(`Error syncing declaration for politician ${politicianId}:`, error);
    return "error";
  }
}

/**
 * Update politician photo from HATVP if available and not already set
 */
async function updatePhotoFromHATVP(politicianId: string, photoUrl: string | null): Promise<void> {
  if (!photoUrl || photoUrl.trim() === "") return;

  const politician = await db.politician.findUnique({
    where: { id: politicianId },
    select: { photoUrl: true, photoSource: true },
  });

  // Only update if no photo or from lower priority source
  const shouldUpdate =
    !politician?.photoUrl ||
    !politician?.photoSource ||
    politician.photoSource === "manual" ||
    politician.photoSource === "wikidata";

  if (shouldUpdate) {
    await db.politician.update({
      where: { id: politicianId },
      data: {
        photoUrl,
        photoSource: "hatvp",
      },
    });
  }
}

/**
 * Create/update HATVP external ID
 */
async function upsertHATVPExternalId(politicianId: string, urlDossier: string): Promise<void> {
  if (!urlDossier) return;

  // Extract HATVP ID from URL (e.g., /consulter-les-declarations/d/prenom-nom)
  const hatvpId = urlDossier.replace(/^\//, "").replace(/\/$/, "");

  await db.externalId.upsert({
    where: {
      source_externalId: {
        source: DataSource.HATVP,
        externalId: hatvpId,
      },
    },
    create: {
      politicianId,
      source: DataSource.HATVP,
      externalId: hatvpId,
      url: `https://www.hatvp.fr${urlDossier}`,
    },
    update: {
      politicianId,
      url: `https://www.hatvp.fr${urlDossier}`,
    },
  });
}

/**
 * Main sync function - imports HATVP declarations
 */
export async function syncHATVP(): Promise<HATVPSyncResult> {
  const result: HATVPSyncResult = {
    success: false,
    declarationsCreated: 0,
    declarationsUpdated: 0,
    politiciansMatched: 0,
    politiciansNotFound: 0,
    errors: [],
  };

  try {
    console.log("Starting HATVP sync...");

    // 1. Fetch data
    const allRecords = await fetchHATVPCSV();

    // 2. Filter relevant declarations
    const records = filterRelevantDeclarations(allRecords);
    console.log(`Filtered to ${records.length} relevant declarations`);

    // 3. Group by politician for efficient processing
    const byPolitician = new Map<string, HATVPCSV[]>();
    for (const decl of records) {
      const key = `${decl.prenom}|${decl.nom}|${decl.id_origine}`;
      if (!byPolitician.has(key)) {
        byPolitician.set(key, []);
      }
      byPolitician.get(key)!.push(decl);
    }

    console.log(`Processing ${byPolitician.size} unique politicians...`);

    // 4. Process each politician
    const notFoundPoliticians: string[] = [];

    for (const [_key, declarations] of byPolitician) {
      const firstDecl = declarations[0];

      // Try to find politician by external ID first
      let politicianId = await findPoliticianByExternalId(
        firstDecl.id_origine,
        firstDecl.type_mandat
      );

      // Fallback to name matching
      if (!politicianId) {
        politicianId = await findPoliticianByName(firstDecl.prenom, firstDecl.nom);
      }

      if (!politicianId) {
        result.politiciansNotFound++;
        notFoundPoliticians.push(`${firstDecl.prenom} ${firstDecl.nom} (${firstDecl.type_mandat})`);
        continue;
      }

      result.politiciansMatched++;

      // Update photo if available
      await updatePhotoFromHATVP(politicianId, firstDecl.url_photo);

      // Create HATVP external ID
      await upsertHATVPExternalId(politicianId, firstDecl.url_dossier);

      // Sync all declarations for this politician
      for (const decl of declarations) {
        const status = await syncDeclaration(decl, politicianId);
        if (status === "created") result.declarationsCreated++;
        else if (status === "updated") result.declarationsUpdated++;
        else result.errors.push(`Declaration for ${firstDecl.prenom} ${firstDecl.nom}`);
      }
    }

    // Log some not found politicians for debugging
    if (notFoundPoliticians.length > 0) {
      console.log(`\nPoliticians not found (first 10):`);
      notFoundPoliticians.slice(0, 10).forEach((p) => console.log(`  - ${p}`));
      if (notFoundPoliticians.length > 10) {
        console.log(`  ... and ${notFoundPoliticians.length - 10} more`);
      }
    }

    result.success = true;
    console.log("\nSync completed:", result);
  } catch (error) {
    result.errors.push(String(error));
    console.error("Sync failed:", error);
  }

  return result;
}

/**
 * Get HATVP stats
 */
export async function getHATVPStats() {
  const [totalDeclarations, politiciansWithDeclarations] = await Promise.all([
    db.declaration.count(),
    db.politician.count({
      where: { declarations: { some: {} } },
    }),
  ]);

  return {
    totalDeclarations,
    politiciansWithDeclarations,
  };
}
