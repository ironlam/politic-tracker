/**
 * Reconciliation service: links Scrutin → LegislativeDossier via shared session references.
 *
 * The AN open data has no direct scrutin→dossier FK. However:
 * - Dossier JSON contains nested `actesLegislatifs` with `reunionRef` (debate sessions)
 * - Scrutin JSON contains `seanceRef` (the session where the vote occurred)
 *
 * This service downloads both ZIPs, builds a reunionRef→dossierExternalId map,
 * then matches scrutins to dossiers and updates the FK in bulk.
 */

import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma";
import * as fs from "fs";
import * as https from "https";
import { createWriteStream, mkdirSync, rmSync, readdirSync, readFileSync } from "fs";
import { execSync } from "child_process";

const LEGISLATURE = 17;
const TEMP_DIR = "/tmp/reconcile-scrutin-dossier";

const DOSSIER_ZIP_URL = `https://data.assemblee-nationale.fr/static/openData/repository/${LEGISLATURE}/loi/dossiers_legislatifs/Dossiers_Legislatifs.json.zip`;
const SCRUTIN_ZIP_URL = `https://data.assemblee-nationale.fr/static/openData/repository/${LEGISLATURE}/loi/scrutins/Scrutins.json.zip`;

export interface ReconciliationResult {
  scrutinsLinked: number;
  scrutinsAlreadyLinked: number;
  scrutinsUnmatched: number;
  dossiersWithScrutins: number;
  errors: string[];
}

// ---------------------------------------------------------------------------
// AN JSON types (minimal, just what we need)
// ---------------------------------------------------------------------------

interface ANActe {
  uid: string;
  codeActe: string;
  reunionRef?: string | null;
  actesLegislatifs?: {
    acteLegislatif: ANActe | ANActe[];
  } | null;
}

interface ANDossierMinimal {
  dossierParlementaire: {
    uid: string;
    actesLegislatifs?: {
      acteLegislatif: ANActe | ANActe[];
    } | null;
  };
}

interface ANScrutinMinimal {
  scrutin: {
    uid: string;
    seanceRef?: string | null;
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    https
      .get({ hostname: urlObj.hostname, path: urlObj.pathname + urlObj.search }, (response) => {
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
        const file = createWriteStream(dest);
        response.pipe(file);
        file.on("finish", () => {
          file.close();
          resolve();
        });
      })
      .on("error", (err) => {
        if (fs.existsSync(dest)) fs.unlinkSync(dest);
        reject(err);
      });
  });
}

/**
 * Recursively extract all reunionRef values from nested actesLegislatifs.
 */
function extractReunionRefs(acte: ANActe | ANActe[] | undefined | null): Set<string> {
  if (!acte) return new Set();
  const actes = Array.isArray(acte) ? acte : [acte];
  const refs = new Set<string>();
  for (const a of actes) {
    if (a.reunionRef) {
      refs.add(a.reunionRef);
    }
    if (a.actesLegislatifs?.acteLegislatif) {
      for (const ref of extractReunionRefs(a.actesLegislatifs.acteLegislatif)) {
        refs.add(ref);
      }
    }
  }
  return refs;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export async function reconcileScrutinDossier(): Promise<ReconciliationResult> {
  const result: ReconciliationResult = {
    scrutinsLinked: 0,
    scrutinsAlreadyLinked: 0,
    scrutinsUnmatched: 0,
    dossiersWithScrutins: 0,
    errors: [],
  };

  // 1. Setup temp directory
  if (fs.existsSync(TEMP_DIR)) rmSync(TEMP_DIR, { recursive: true });
  mkdirSync(TEMP_DIR, { recursive: true });

  try {
    // 2. Download and extract dossier ZIP
    console.log("[reconcile] Downloading dossier ZIP...");
    const dossierZip = `${TEMP_DIR}/dossiers.zip`;
    await downloadFile(DOSSIER_ZIP_URL, dossierZip);
    execSync(`unzip -o -q "${dossierZip}" -d "${TEMP_DIR}/dossiers/"`, { stdio: "pipe" });

    // 3. Build reunionRef → dossierExternalId map
    console.log("[reconcile] Building reunionRef → dossier map...");
    const reunionToDossier = new Map<string, string>();

    const dossierDir = `${TEMP_DIR}/dossiers/json/dossierParlementaire`;
    if (!fs.existsSync(dossierDir)) {
      // Try alternative structure
      const altDir = `${TEMP_DIR}/dossiers/json`;
      if (!fs.existsSync(altDir)) {
        throw new Error("Cannot find dossier JSON files after extraction");
      }
    }

    const dossierFiles = readdirSync(dossierDir).filter((f) => f.endsWith(".json"));
    for (const file of dossierFiles) {
      try {
        const raw = readFileSync(`${dossierDir}/${file}`, "utf-8");
        const data = JSON.parse(raw) as ANDossierMinimal;
        const dp = data.dossierParlementaire;
        if (!dp?.uid || !dp.actesLegislatifs?.acteLegislatif) continue;

        const refs = extractReunionRefs(dp.actesLegislatifs.acteLegislatif);
        for (const ref of refs) {
          // A session can belong to multiple dossiers — keep the first match
          // (in practice, debate sessions are specific to one dossier)
          if (!reunionToDossier.has(ref)) {
            reunionToDossier.set(ref, dp.uid);
          }
        }
      } catch {
        // Skip malformed files
      }
    }
    console.log(`[reconcile] Found ${reunionToDossier.size} session→dossier mappings`);

    // 4. Download and extract scrutin ZIP
    console.log("[reconcile] Downloading scrutin ZIP...");
    const scrutinZip = `${TEMP_DIR}/scrutins.zip`;
    await downloadFile(SCRUTIN_ZIP_URL, scrutinZip);
    execSync(`unzip -o -q "${scrutinZip}" -d "${TEMP_DIR}/scrutins/"`, { stdio: "pipe" });

    // 5. Build scrutinExternalId → dossierExternalId map via seanceRef
    console.log("[reconcile] Matching scrutins to dossiers via seanceRef...");
    const scrutinToDossier = new Map<string, string>();

    const scrutinDir = `${TEMP_DIR}/scrutins/json`;
    const scrutinFiles = readdirSync(scrutinDir).filter((f) => f.endsWith(".json"));
    for (const file of scrutinFiles) {
      try {
        const raw = readFileSync(`${scrutinDir}/${file}`, "utf-8");
        const data = JSON.parse(raw) as ANScrutinMinimal;
        const seanceRef = data.scrutin?.seanceRef;
        const uid = data.scrutin?.uid;
        if (!uid || !seanceRef) continue;

        const dossierExtId = reunionToDossier.get(seanceRef);
        if (dossierExtId) {
          scrutinToDossier.set(uid, dossierExtId);
        }
      } catch {
        // Skip malformed files
      }
    }
    console.log(
      `[reconcile] ${scrutinToDossier.size}/${scrutinFiles.length} scrutins matched to a dossier`
    );

    // 6. Load DB mappings
    const dbDossiers = await db.legislativeDossier.findMany({
      select: { id: true, externalId: true },
    });
    const dossierIdByExtId = new Map(dbDossiers.map((d) => [d.externalId, d.id]));

    const dbScrutins = await db.scrutin.findMany({
      select: { id: true, externalId: true, dossierLegislatifId: true },
    });

    // 7. Build update list
    const updates: Array<{ scrutinId: string; dossierId: string }> = [];
    const dossiersUsed = new Set<string>();

    for (const scrutin of dbScrutins) {
      if (scrutin.dossierLegislatifId) {
        result.scrutinsAlreadyLinked++;
        continue;
      }

      const dossierExtId = scrutinToDossier.get(scrutin.externalId);
      if (!dossierExtId) {
        result.scrutinsUnmatched++;
        continue;
      }

      const dossierId = dossierIdByExtId.get(dossierExtId);
      if (!dossierId) {
        result.scrutinsUnmatched++;
        continue;
      }

      updates.push({ scrutinId: scrutin.id, dossierId });
      dossiersUsed.add(dossierId);
    }

    result.dossiersWithScrutins = dossiersUsed.size;

    // 8. Bulk update in chunks
    if (updates.length > 0) {
      const CHUNK_SIZE = 500;
      for (let i = 0; i < updates.length; i += CHUNK_SIZE) {
        const chunk = updates.slice(i, i + CHUNK_SIZE);
        const values = Prisma.join(
          chunk.map((u) => Prisma.sql`(${u.scrutinId}::text, ${u.dossierId}::text)`)
        );

        await db.$executeRaw`
          UPDATE "Scrutin" AS s
          SET "dossierLegislatifId" = v.dossier_id
          FROM (VALUES ${values}) AS v(scrutin_id, dossier_id)
          WHERE s.id = v.scrutin_id
        `;
      }
      result.scrutinsLinked = updates.length;
    }

    console.log(
      `[reconcile] Done: ${result.scrutinsLinked} linked, ${result.scrutinsAlreadyLinked} already linked, ${result.scrutinsUnmatched} unmatched, ${result.dossiersWithScrutins} dossiers`
    );
  } finally {
    // Cleanup
    if (fs.existsSync(TEMP_DIR)) {
      rmSync(TEMP_DIR, { recursive: true });
    }
  }

  return result;
}
