/**
 * CLI script to sync legislative dossiers from data.assemblee-nationale.fr
 *
 * Usage:
 *   npm run sync:legislation              # Full sync (17th legislature)
 *   npm run sync:legislation -- --leg=17  # Sync specific legislature
 *   npm run sync:legislation -- --stats   # Show current stats
 *   npm run sync:legislation -- --active  # Only sync active dossiers
 *   npm run sync:legislation -- --today   # Only process dossiers modified today
 *
 * Data source: data.assemblee-nationale.fr (official Open Data)
 */

import "dotenv/config";
import { createCLI, type SyncHandler, type SyncResult } from "../src/lib/sync";
import { db } from "../src/lib/db";
import { generateDateSlug } from "../src/lib/utils";
import { DossierStatus } from "../src/generated/prisma";
import * as fs from "fs";
import * as path from "path";
import * as https from "https";
import { createWriteStream, mkdirSync, rmSync, readdirSync, readFileSync } from "fs";
import { execSync } from "child_process";

// Configuration
const DEFAULT_LEGISLATURE = 17;
const TEMP_DIR = "/tmp/dossiers-legislatifs-an";
const ZIP_URL_TEMPLATE =
  "https://data.assemblee-nationale.fr/static/openData/repository/{leg}/loi/dossiers_legislatifs/Dossiers_Legislatifs.json.zip";

// Category mapping based on procedureParlementaire.libelle
const CATEGORY_MAPPING: Record<string, string> = {
  "Projet de loi de finances": "Budget",
  "Projet de loi de financement de la sécurité sociale": "Santé",
  "Proposition de loi ordinaire": "Législation",
  "Projet de loi ordinaire": "Législation",
  "Projet ou proposition de loi organique": "Institutionnel",
  "Projet ou proposition de loi constitutionnelle": "Constitution",
  "Projet de ratification des traités et conventions": "International",
  "Commission d'enquête": "Contrôle",
  "Mission d'information": "Information",
  "Rapport d'information": "Information",
  "Rapport d'information sans mission": "Information",
};

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
    https
      .get(url, (response) => {
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
      })
      .on("error", (err) => {
        fs.unlinkSync(dest);
        reject(err);
      });
  });
}

/**
 * AN dossier JSON structure
 */
interface ANDossier {
  dossierParlementaire: {
    "@xsi:type": string;
    uid: string;
    legislature: string;
    titreDossier: {
      titre: string;
      titreChemin: string;
      senatChemin?: string | null;
    };
    procedureParlementaire: {
      code: string;
      libelle: string;
    };
    initiateur?: {
      acteurs?: {
        acteur: ANActeur | ANActeur[];
      };
    } | null;
    actesLegislatifs?: {
      acteLegislatif: ANActe | ANActe[];
    } | null;
    fusionDossier?: string | null;
  };
}

interface ANActeur {
  acteurRef: string;
  mandatRef: string;
}

interface ANActe {
  "@xsi:type": string;
  uid: string;
  codeActe: string;
  libelleActe: {
    nomCanonique: string;
    libelleCourt?: string;
  };
  organeRef: string;
  dateActe: string | null;
  actesLegislatifs?: {
    acteLegislatif: ANActe | ANActe[];
  } | null;
  texteAssocie?: string;
  texteAdopte?: string;
}

/**
 * Recursively find all codeActe in a dossier
 */
function findAllCodes(actes: ANActe | ANActe[] | undefined | null): string[] {
  if (!actes) return [];

  const acteArray = Array.isArray(actes) ? actes : [actes];
  const codes: string[] = [];

  for (const acte of acteArray) {
    codes.push(acte.codeActe);
    if (acte.actesLegislatifs?.acteLegislatif) {
      codes.push(...findAllCodes(acte.actesLegislatifs.acteLegislatif));
    }
  }

  return codes;
}

/**
 * Recursively find the first texteAssocie reference in a dossier's actes
 */
function findFirstDocumentRef(actes: ANActe | ANActe[] | undefined | null): string | null {
  if (!actes) return null;

  const acteArray = Array.isArray(actes) ? actes : [actes];

  for (const acte of acteArray) {
    if (acte.texteAssocie) {
      return acte.texteAssocie;
    }
    if (acte.actesLegislatifs?.acteLegislatif) {
      const found = findFirstDocumentRef(acte.actesLegislatifs.acteLegislatif);
      if (found) return found;
    }
  }

  return null;
}

/**
 * Recursively find all dates in a dossier
 */
function findAllDates(actes: ANActe | ANActe[] | undefined | null): Date[] {
  if (!actes) return [];

  const acteArray = Array.isArray(actes) ? actes : [actes];
  const dates: Date[] = [];

  for (const acte of acteArray) {
    if (acte.dateActe) {
      try {
        const d = new Date(acte.dateActe);
        if (!isNaN(d.getTime())) {
          dates.push(d);
        }
      } catch {
        // Ignore invalid dates
      }
    }
    if (acte.actesLegislatifs?.acteLegislatif) {
      dates.push(...findAllDates(acte.actesLegislatifs.acteLegislatif));
    }
  }

  return dates;
}

/**
 * Determine dossier status from actes
 */
function determineStatus(codes: string[]): DossierStatus {
  // Check for promulgation (adopted)
  if (codes.some((c) => c === "PROM" || c === "PROM-PUB")) {
    return "ADOPTE";
  }

  // Check for rejection indicators
  if (codes.some((c) => c.includes("REJET"))) {
    return "REJETE";
  }

  // Check for withdrawal
  if (codes.some((c) => c.includes("RETRAIT") || c.includes("RETIRE"))) {
    return "RETIRE";
  }

  // Default: in progress
  return "EN_COURS";
}

/**
 * Generate short title from full title
 */
function generateShortTitle(title: string): string {
  // Remove common prefixes
  let short = title
    .replace(/^Projet de loi /i, "")
    .replace(/^Proposition de loi /i, "")
    .replace(/^(relatif|relative) (à|au|aux|à la|à l') /i, "")
    .replace(/^(portant|visant à) /i, "")
    .replace(/^(pour|sur) (le|la|les|l') /i, "");

  // Capitalize first letter
  short = short.charAt(0).toUpperCase() + short.slice(1);

  // Truncate if too long
  if (short.length > 100) {
    short = short.substring(0, 97) + "...";
  }

  return short;
}

/**
 * Extract dossier number (PJL/PPL number)
 */
function extractNumber(dossier: ANDossier): string | null {
  const type = dossier.dossierParlementaire["@xsi:type"];
  const uid = dossier.dossierParlementaire.uid;
  const procedure = dossier.dossierParlementaire.procedureParlementaire?.libelle || "";

  // Extract number from UID: DLR5L17N50426 -> 50426
  const match = uid.match(/N(\d+)$/);
  if (!match) return null;

  const num = match[1];

  // Determine prefix based on procedure
  if (procedure.toLowerCase().includes("projet")) {
    return `PJL ${num}`;
  } else if (procedure.toLowerCase().includes("proposition")) {
    return `PPL ${num}`;
  }

  return num;
}

/**
 * Get category from procedure
 */
function getCategory(procedure: string): string | null {
  return CATEGORY_MAPPING[procedure] || null;
}

/**
 * Generate a unique slug for a dossier
 */
async function generateUniqueDossierSlug(date: Date | null, title: string): Promise<string> {
  const baseSlug = generateDateSlug(date, title);

  // Check if slug already exists
  const existing = await db.legislativeDossier.findUnique({ where: { slug: baseSlug } });
  if (!existing) return baseSlug;

  // Try with suffix
  let counter = 2;
  while (counter < 100) {
    const suffix = `-${counter}`;
    const maxBaseLength = 80 - suffix.length;
    const truncatedBase = baseSlug.slice(0, maxBaseLength).replace(/-$/, "");
    const slugWithSuffix = `${truncatedBase}${suffix}`;

    const existsWithSuffix = await db.legislativeDossier.findUnique({ where: { slug: slugWithSuffix } });
    if (!existsWithSuffix) return slugWithSuffix;

    counter++;
  }

  // Fallback: use timestamp
  return `${baseSlug.slice(0, 60)}-${Date.now()}`;
}

/**
 * Main sync function
 */
async function syncLegislation(
  legislature: number = DEFAULT_LEGISLATURE,
  options: {
    dryRun?: boolean;
    limit?: number;
    activeOnly?: boolean;
    todayOnly?: boolean;
  } = {}
) {
  const { dryRun = false, limit, activeOnly = false, todayOnly = false } = options;
  const stats = {
    dossiersProcessed: 0,
    dossiersCreated: 0,
    dossiersUpdated: 0,
    dossiersSkipped: 0,
    byStatus: {
      EN_COURS: 0,
      ADOPTE: 0,
      REJETE: 0,
      RETIRE: 0,
    } as Record<string, number>,
    byCategory: {} as Record<string, number>,
    errors: [] as string[],
  };

  try {
    // Step 1: Download ZIP
    updateLine("Downloading dossiers ZIP from data.assemblee-nationale.fr...");
    const zipUrl = ZIP_URL_TEMPLATE.replace("{leg}", String(legislature));
    const zipPath = path.join(TEMP_DIR, "dossiers.zip");

    // Clean and create temp dir
    if (fs.existsSync(TEMP_DIR)) {
      rmSync(TEMP_DIR, { recursive: true });
    }
    mkdirSync(TEMP_DIR, { recursive: true });

    await downloadFile(zipUrl, zipPath);
    console.log("\n✓ Downloaded ZIP file");

    // Step 2: Extract ZIP
    updateLine("Extracting ZIP...");
    execSync(`unzip -o "${zipPath}" -d "${TEMP_DIR}"`, { stdio: "pipe" });
    console.log("✓ Extracted ZIP file");

    // Step 3: List JSON files
    const jsonDir = path.join(TEMP_DIR, "json", "dossierParlementaire");
    if (!fs.existsSync(jsonDir)) {
      throw new Error(`Directory not found: ${jsonDir}`);
    }

    let jsonFiles = readdirSync(jsonDir).filter((f) => f.endsWith(".json"));

    // Filter by legislature if needed (some ZIPs contain multiple legislatures)
    jsonFiles = jsonFiles.filter((f) => f.includes(`L${legislature}`));

    if (limit) {
      jsonFiles = jsonFiles.slice(0, limit);
    }

    const total = jsonFiles.length;
    console.log(`Found ${total} dossiers to process\n`);

    // Step 4: Process each dossier
    for (let i = 0; i < jsonFiles.length; i++) {
      const file = jsonFiles[i];
      const progressMsg = `${renderProgressBar(i + 1, total)} Processing ${i + 1}/${total}`;

      if ((i + 1) % 50 === 0 || i === 0 || i === jsonFiles.length - 1) {
        updateLine(progressMsg);
      }

      try {
        const filePath = path.join(jsonDir, file);
        const content = readFileSync(filePath, "utf-8");

        // Skip empty files
        if (!content.trim()) {
          stats.dossiersSkipped++;
          continue;
        }

        const data: ANDossier = JSON.parse(content);
        const dp = data.dossierParlementaire;

        // Skip non-legislative dossiers (missions, rapports, etc.)
        const type = dp["@xsi:type"];
        if (
          !type.includes("Legislatif") &&
          !type.includes("Loi") &&
          type !== "DossierLegislatif_Type"
        ) {
          stats.dossiersSkipped++;
          continue;
        }

        const externalId = dp.uid;
        const title = dp.titreDossier?.titre || "Sans titre";
        const shortTitle = generateShortTitle(title);
        const number = extractNumber(data);
        const procedure = dp.procedureParlementaire?.libelle || "";
        const category = getCategory(procedure);

        // Find document reference for expose des motifs
        const documentExternalId = findFirstDocumentRef(dp.actesLegislatifs?.acteLegislatif);

        // Find all codes to determine status
        const allCodes = findAllCodes(dp.actesLegislatifs?.acteLegislatif);
        const status = determineStatus(allCodes);

        // Skip non-active if activeOnly
        if (activeOnly && status !== "EN_COURS") {
          stats.dossiersSkipped++;
          continue;
        }

        // Find dates (needed for todayOnly filter and filingDate/adoptionDate)
        const allDates = findAllDates(dp.actesLegislatifs?.acteLegislatif).sort(
          (a, b) => a.getTime() - b.getTime()
        );
        // Filter by today: only process dossiers whose most recent date is today
        if (todayOnly && allDates.length > 0) {
          const today = new Date().toISOString().split("T")[0];
          const mostRecent = allDates[allDates.length - 1].toISOString().split("T")[0];
          if (mostRecent !== today) {
            stats.dossiersSkipped++;
            continue;
          }
        }

        const filingDate = allDates.length > 0 ? allDates[0] : null;
        const adoptionDate =
          status === "ADOPTE" && allDates.length > 0 ? allDates[allDates.length - 1] : null;

        // Source URL
        const sourceUrl = `https://www.assemblee-nationale.fr/dyn/${legislature}/dossiers/${dp.titreDossier?.titreChemin || externalId}`;

        // Update stats
        stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;
        if (category) {
          stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;
        }

        if (!dryRun) {
          // Upsert dossier
          const existing = await db.legislativeDossier.findUnique({
            where: { externalId },
          });

          const dossierData = {
            externalId,
            title,
            shortTitle,
            number,
            status,
            category,
            filingDate,
            adoptionDate,
            sourceUrl,
            documentExternalId,
          };

          if (existing) {
            // Update existing dossier, generate slug if missing
            const updateData: typeof dossierData & { slug?: string } = { ...dossierData };
            if (!existing.slug) {
              updateData.slug = await generateUniqueDossierSlug(filingDate, shortTitle || title);
            }
            await db.legislativeDossier.update({
              where: { id: existing.id },
              data: updateData,
            });
            stats.dossiersUpdated++;
          } else {
            // Create new dossier with slug
            const slug = await generateUniqueDossierSlug(filingDate, shortTitle || title);
            await db.legislativeDossier.create({
              data: { ...dossierData, slug },
            });
            stats.dossiersCreated++;
          }
        } else {
          // Dry run: just count
          stats.dossiersCreated++;
        }

        stats.dossiersProcessed++;
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
  name: "Politic Tracker - Legislative Dossiers Sync",
  description: "Import dossiers législatifs from Assemblée nationale",

  options: [
    {
      name: "--leg",
      type: "string",
      description: `Legislature number (default: ${DEFAULT_LEGISLATURE})`,
    },
    {
      name: "--active",
      type: "boolean",
      description: "Only sync active (EN_COURS) dossiers",
    },
    {
      name: "--today",
      type: "boolean",
      description: "Only process dossiers modified today",
    },
  ],

  showHelp() {
    console.log(`
Politic Tracker - Dossiers Législatifs Sync

Data source: data.assemblee-nationale.fr (official Open Data)

Features:
  - Downloads official ZIP file with all legislative dossiers
  - Parses dossier status from parliamentary acts (PROM = adopted)
  - Categorizes dossiers by procedure type
  - Creates/updates LegislativeDossier records
    `);
  },

  async showStats() {
    const dossiersCount = await db.legislativeDossier.count();

    const byStatus = await db.legislativeDossier.groupBy({
      by: ["status"],
      _count: true,
      orderBy: { _count: { status: "desc" } },
    });

    const byCategory = await db.legislativeDossier.groupBy({
      by: ["category"],
      _count: true,
      orderBy: { _count: { category: "desc" } },
    });

    const recentDossiers = await db.legislativeDossier.findMany({
      where: { status: "EN_COURS" },
      orderBy: { filingDate: "desc" },
      take: 5,
      select: { title: true, number: true, category: true, filingDate: true },
    });

    console.log("\n" + "=".repeat(50));
    console.log("Legislative Dossiers Stats");
    console.log("=".repeat(50));
    console.log(`Total dossiers: ${dossiersCount}`);

    if (byStatus.length > 0) {
      console.log("\nBy status:");
      for (const s of byStatus) {
        console.log(`  ${s.status}: ${s._count}`);
      }
    }

    if (byCategory.length > 0) {
      console.log("\nBy category:");
      for (const c of byCategory) {
        console.log(`  ${c.category || "(none)"}: ${c._count}`);
      }
    }

    if (recentDossiers.length > 0) {
      console.log("\nRecent active dossiers:");
      for (const d of recentDossiers) {
        const date = d.filingDate ? d.filingDate.toISOString().split("T")[0] : "N/A";
        console.log(`  - ${d.number || "?"}: ${d.title.substring(0, 50)}... (${date})`);
      }
    }
  },

  async sync(options): Promise<SyncResult> {
    const { dryRun = false, limit, leg, active = false, today = false } = options as {
      dryRun?: boolean;
      limit?: number;
      leg?: string;
      active?: boolean;
      today?: boolean;
    };

    const legislature = leg ? parseInt(leg, 10) : DEFAULT_LEGISLATURE;
    if (isNaN(legislature) || legislature < 1) {
      return {
        success: false,
        duration: 0,
        stats: {},
        errors: ["Invalid legislature number"],
      };
    }

    console.log(`Legislature: ${legislature}e`);
    if (active) console.log("Filter: Active dossiers only");
    if (today) console.log("Filter: Dossiers modified today only");

    const result = await syncLegislation(legislature, {
      dryRun,
      limit,
      activeOnly: active,
      todayOnly: today,
    });

    return {
      success: result.errors.length === 0,
      duration: 0,
      stats: {
        processed: result.dossiersProcessed,
        created: result.dossiersCreated,
        updated: result.dossiersUpdated,
        skipped: result.dossiersSkipped,
      },
      errors: result.errors,
    };
  },
};

createCLI(handler);
