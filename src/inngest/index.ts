import { createSyncFunction, createStubFunction } from "./functions/single-script";
import { discoverAffairs } from "./functions/discover-affairs";
import { generateAi } from "./functions/generate-ai";
import { indexEmbeddings } from "./functions/index-embeddings";
import { maintenance } from "./functions/maintenance";
import { syncFactchecksGrouped } from "./functions/sync-factchecks";
import { syncLegislation } from "./functions/sync-legislation";
import { syncPoliticians } from "./functions/sync-politicians";
import { syncDaily } from "./functions/sync-daily";
import { syncPress } from "./functions/sync-press";
import { syncVotes } from "./functions/sync-votes";

// Services for individual script wrappers (Phase 1 — migrated)
import { syncVotesAN } from "@/services/sync/votes-an";
import { syncVotesSenat } from "@/services/sync/votes-senat";
import { syncPressAnalysis } from "@/services/sync/press-analysis";
import { syncJudilibre } from "@/services/sync/judilibre";
import { syncFactchecks } from "@/services/sync/factchecks";
import { syncPress as syncPressService } from "@/services/sync/press";
import { recalculateProminence } from "@/services/sync/prominence";
import { assignPublicationStatus } from "@/services/sync/publication-status";
import { reconcileAffairs } from "@/services/sync/reconcile-affairs";
import { classifyThemes } from "@/services/sync/classify-themes";

// --- Grouped multi-step functions ---
const groupedFunctions = [
  syncPress,
  syncVotes,
  syncLegislation,
  discoverAffairs,
  syncFactchecksGrouped,
  generateAi,
  indexEmbeddings,
  syncPoliticians,
  maintenance,
  syncDaily,
];

// --- Individual script wrappers (admin SCRIPT_CATALOG) ---

// Phase 1: Migrated — direct service imports
const migratedFunctions = [
  createSyncFunction("sync-votes-an", async (data) => {
    const todayOnly = !data.flags || !(data.flags as string).includes("--all");
    return syncVotesAN(undefined, false, todayOnly);
  }),
  createSyncFunction("sync-votes-senat", async (data) => {
    const todayOnly = !data.flags || !(data.flags as string).includes("--all");
    return syncVotesSenat(null, false, todayOnly);
  }),
  createSyncFunction("sync-press-analysis", async (data) => {
    const limit = (data.limit as number) || 100;
    return syncPressAnalysis({ limit });
  }),
  createSyncFunction("sync-judilibre", async (data) => {
    const limit = (data.limit as number) || 20;
    return syncJudilibre({ limit });
  }),
  createSyncFunction("sync-factchecks", async (data) => {
    const limit = (data.limit as number) || 50;
    return syncFactchecks({ limit });
  }),
  createSyncFunction("sync-press", async () => {
    return syncPressService();
  }),
  createSyncFunction("recalculate-prominence", async () => {
    return recalculateProminence();
  }),
  createSyncFunction("assign-publication-status", async () => {
    return assignPublicationStatus();
  }),
  createSyncFunction("reconcile-affairs", async (data) => {
    const autoMerge = Boolean(data.flags && (data.flags as string).includes("--auto-merge"));
    return reconcileAffairs({ autoMerge });
  }),
  createSyncFunction("classify-themes", async (data) => {
    const limit = (data.limit as number) || 30;
    return classifyThemes({ limit });
  }),
];

// Phase 2: Not yet migrated — stubs that fail with a helpful message
// NOTE: Only scripts with NO grouped-function coverage go here.
// Scripts handled by grouped functions (sync-legislation, index-embeddings,
// generate-biographies/summaries/scrutin-summaries) are excluded — their
// grouped function already handles the execSync call.
const stubFunctions = [
  // Politicians
  "sync-assemblee",
  "sync-senat",
  "sync-gouvernement",
  "sync-president",
  "sync-europarl",
  // Metadata
  "sync-wikidata-ids",
  "sync-photos",
  "sync-birthdates",
  "sync-careers",
  "sync-parties",
  "sync-mep-parties",
  "sync-hatvp",
  "sync-deceased",
].map((id) => createStubFunction(id));

export const functions = [...groupedFunctions, ...migratedFunctions, ...stubFunctions];
