/**
 * Service to sync legislative dossiers from data.assemblee-nationale.fr.
 * Extracted from scripts/sync-legislation.ts for Inngest compatibility.
 *
 * NOTE: This service uses execSync("unzip ...") for ZIP extraction.
 * This is a system tool invocation (not a Node.js script spawn) and is
 * acceptable on Vercel serverless.
 */

import { db } from "@/lib/db";
import { generateDateSlug } from "@/lib/utils";
import { DossierStatus } from "@/generated/prisma";
import * as fs from "fs";
import * as path from "path";
import * as https from "https";
import { createWriteStream, mkdirSync, rmSync, readdirSync, readFileSync } from "fs";
import { execSync } from "child_process";

const DEFAULT_LEGISLATURE = 17;
const TEMP_DIR = "/tmp/dossiers-legislatifs-an";
const ZIP_URL_TEMPLATE =
  "https://data.assemblee-nationale.fr/static/openData/repository/{leg}/loi/dossiers_legislatifs/Dossiers_Legislatifs.json.zip";

const CATEGORY_MAPPING: Record<string, string> = {
  "Projet de loi de finances": "Budget",
  "Projet de loi de financement de la s\u00e9curit\u00e9 sociale": "Sant\u00e9",
  "Proposition de loi ordinaire": "L\u00e9gislation",
  "Projet de loi ordinaire": "L\u00e9gislation",
  "Projet ou proposition de loi organique": "Institutionnel",
  "Projet ou proposition de loi constitutionnelle": "Constitution",
  "Projet de ratification des trait\u00e9s et conventions": "International",
  "Commission d'enqu\u00eate": "Contr\u00f4le",
  "Mission d'information": "Information",
  "Rapport d'information": "Information",
  "Rapport d'information sans mission": "Information",
};

export interface LegislationSyncResult {
  dossiersProcessed: number;
  dossiersCreated: number;
  dossiersUpdated: number;
  dossiersSkipped: number;
  errors: string[];
}

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

function findFirstDocumentRef(actes: ANActe | ANActe[] | undefined | null): string | null {
  if (!actes) return null;
  const acteArray = Array.isArray(actes) ? actes : [actes];
  for (const acte of acteArray) {
    if (acte.texteAssocie) return acte.texteAssocie;
    if (acte.actesLegislatifs?.acteLegislatif) {
      const found = findFirstDocumentRef(acte.actesLegislatifs.acteLegislatif);
      if (found) return found;
    }
  }
  return null;
}

function findAllDates(actes: ANActe | ANActe[] | undefined | null): Date[] {
  if (!actes) return [];
  const acteArray = Array.isArray(actes) ? actes : [actes];
  const dates: Date[] = [];
  for (const acte of acteArray) {
    if (acte.dateActe) {
      try {
        const d = new Date(acte.dateActe);
        if (!isNaN(d.getTime())) dates.push(d);
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

function determineStatus(codes: string[], legislature?: number): DossierStatus {
  if (codes.some((c) => c === "PROM" || c === "PROM-PUB")) return "ADOPTE";
  if (codes.some((c) => c.includes("REJET"))) return "REJETE";
  if (codes.some((c) => c.includes("RETRAIT") || c.includes("RETIRE"))) return "RETIRE";
  if (codes.some((c) => c.startsWith("CC-SAISIE"))) return "CONSEIL_CONSTITUTIONNEL";
  if (legislature && legislature < DEFAULT_LEGISLATURE) return "CADUQUE";

  const hasDebates = codes.some(
    (c) =>
      c.includes("DEBATS-SEANCE") ||
      c.includes("DEBATS-DEC") ||
      c.startsWith("CMP") ||
      c.startsWith("ANLUNI") ||
      c.startsWith("ANLDEF") ||
      c.startsWith("SNLDEF")
  );
  if (hasDebates) return "EN_COURS";

  const hasCommitteeReport = codes.some(
    (c) => c.includes("COM-FOND-RAPPORT") || c.includes("COM-AVIS-RAPPORT")
  );
  if (hasCommitteeReport) return "EN_COMMISSION";

  return "DEPOSE";
}

function generateShortTitle(title: string): string {
  let short = title
    .replace(/^Projet de loi /i, "")
    .replace(/^Proposition de loi /i, "")
    .replace(/^(relatif|relative) (\u00e0|au|aux|\u00e0 la|\u00e0 l') /i, "")
    .replace(/^(portant|visant \u00e0) /i, "")
    .replace(/^(pour|sur) (le|la|les|l') /i, "");
  short = short.charAt(0).toUpperCase() + short.slice(1);
  if (short.length > 100) short = short.substring(0, 97) + "...";
  return short;
}

function extractNumber(dossier: ANDossier): string | null {
  const uid = dossier.dossierParlementaire.uid;
  const procedure = dossier.dossierParlementaire.procedureParlementaire?.libelle || "";
  const match = uid.match(/N(\d+)$/);
  if (!match) return null;
  const num = match[1]!;
  if (procedure.toLowerCase().includes("projet")) return `PJL ${num}`;
  if (procedure.toLowerCase().includes("proposition")) return `PPL ${num}`;
  return num;
}

function getCategory(procedure: string): string | null {
  return CATEGORY_MAPPING[procedure] || null;
}

async function generateUniqueDossierSlug(date: Date | null, title: string): Promise<string> {
  const baseSlug = generateDateSlug(date, title);
  const existing = await db.legislativeDossier.findUnique({
    where: { slug: baseSlug },
  });
  if (!existing) return baseSlug;
  let counter = 2;
  while (counter < 100) {
    const suffix = `-${counter}`;
    const maxBaseLength = 80 - suffix.length;
    const truncatedBase = baseSlug.slice(0, maxBaseLength).replace(/-$/, "");
    const slugWithSuffix = `${truncatedBase}${suffix}`;
    const existsWithSuffix = await db.legislativeDossier.findUnique({
      where: { slug: slugWithSuffix },
    });
    if (!existsWithSuffix) return slugWithSuffix;
    counter++;
  }
  return `${baseSlug.slice(0, 60)}-${Date.now()}`;
}

async function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(dest);
    https
      .get(url, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
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

export async function syncLegislation(options?: {
  legislature?: number;
  activeOnly?: boolean;
  todayOnly?: boolean;
  limit?: number;
}): Promise<LegislationSyncResult> {
  const {
    legislature = DEFAULT_LEGISLATURE,
    activeOnly = false,
    todayOnly = false,
    limit,
  } = options ?? {};

  const stats: LegislationSyncResult = {
    dossiersProcessed: 0,
    dossiersCreated: 0,
    dossiersUpdated: 0,
    dossiersSkipped: 0,
    errors: [],
  };

  try {
    // Download ZIP
    console.log("Downloading dossiers ZIP...");
    const zipUrl = ZIP_URL_TEMPLATE.replace("{leg}", String(legislature));
    const zipPath = path.join(TEMP_DIR, "dossiers.zip");

    if (fs.existsSync(TEMP_DIR)) {
      rmSync(TEMP_DIR, { recursive: true });
    }
    mkdirSync(TEMP_DIR, { recursive: true });

    await downloadFile(zipUrl, zipPath);
    console.log("Downloaded ZIP file");

    // Extract ZIP (system tool, not Node.js script spawn)
    execSync(`unzip -o "${zipPath}" -d "${TEMP_DIR}"`, { stdio: "pipe" });
    console.log("Extracted ZIP file");

    // List JSON files
    const jsonDir = path.join(TEMP_DIR, "json", "dossierParlementaire");
    if (!fs.existsSync(jsonDir)) {
      throw new Error(`Directory not found: ${jsonDir}`);
    }

    let jsonFiles = readdirSync(jsonDir).filter((f) => f.endsWith(".json"));
    jsonFiles = jsonFiles.filter((f) => f.includes(`L${legislature}`));

    if (limit) {
      jsonFiles = jsonFiles.slice(0, limit);
    }

    console.log(`Found ${jsonFiles.length} dossiers to process`);

    for (const file of jsonFiles) {
      try {
        const filePath = path.join(jsonDir, file);
        const content = readFileSync(filePath, "utf-8");
        if (!content.trim()) {
          stats.dossiersSkipped++;
          continue;
        }

        const data: ANDossier = JSON.parse(content);
        const dp = data.dossierParlementaire;

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
        const documentExternalId = findFirstDocumentRef(dp.actesLegislatifs?.acteLegislatif);

        const allCodes = findAllCodes(dp.actesLegislatifs?.acteLegislatif);
        const dossierLeg = parseInt(dp.legislature, 10) || legislature;
        const status = determineStatus(allCodes, dossierLeg);

        const activeStatuses: DossierStatus[] = [
          "DEPOSE",
          "EN_COMMISSION",
          "EN_COURS",
          "CONSEIL_CONSTITUTIONNEL",
        ];
        if (activeOnly && !activeStatuses.includes(status)) {
          stats.dossiersSkipped++;
          continue;
        }

        const allDates = findAllDates(dp.actesLegislatifs?.acteLegislatif).sort(
          (a, b) => a.getTime() - b.getTime()
        );

        if (todayOnly && allDates.length > 0) {
          const today = new Date().toISOString().split("T")[0];
          const mostRecent = allDates[allDates.length - 1]!.toISOString().split("T")[0];
          if (mostRecent !== today) {
            stats.dossiersSkipped++;
            continue;
          }
        }

        const filingDate = allDates.length > 0 ? allDates[0] : null;
        const adoptionDate =
          status === "ADOPTE" && allDates.length > 0 ? allDates[allDates.length - 1] : null;

        const sourceUrl = `https://www.assemblee-nationale.fr/dyn/${legislature}/dossiers/${dp.titreDossier?.titreChemin || externalId}`;

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
          const updateData: typeof dossierData & { slug?: string } = {
            ...dossierData,
          };
          if (!existing.slug) {
            updateData.slug = await generateUniqueDossierSlug(filingDate!, shortTitle || title);
          }
          await db.legislativeDossier.update({
            where: { id: existing.id },
            data: updateData,
          });
          stats.dossiersUpdated++;
        } else {
          const slug = await generateUniqueDossierSlug(filingDate!, shortTitle || title);
          await db.legislativeDossier.create({
            data: { ...dossierData, slug },
          });
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
    stats.errors.push(`Fatal: ${err instanceof Error ? err.message : String(err)}`);
  }

  return stats;
}
