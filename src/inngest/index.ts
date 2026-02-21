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

// Phase 1: Migrated — lazy dynamic imports to avoid loading heavy deps at route init
const migratedFunctions = [
  createSyncFunction("sync-votes-an", async (data) => {
    const { syncVotesAN } = await import("@/services/sync/votes-an");
    const todayOnly = !data.flags || !(data.flags as string).includes("--all");
    return syncVotesAN(undefined, false, todayOnly);
  }),
  createSyncFunction("sync-votes-senat", async (data) => {
    const { syncVotesSenat } = await import("@/services/sync/votes-senat");
    const todayOnly = !data.flags || !(data.flags as string).includes("--all");
    return syncVotesSenat(null, false, todayOnly);
  }),
  createSyncFunction("sync-press-analysis", async (data) => {
    const { syncPressAnalysis } = await import("@/services/sync/press-analysis");
    const limit = (data.limit as number) || 100;
    return syncPressAnalysis({ limit });
  }),
  createSyncFunction("sync-judilibre", async (data) => {
    const { syncJudilibre } = await import("@/services/sync/judilibre");
    const limit = (data.limit as number) || 20;
    return syncJudilibre({ limit });
  }),
  createSyncFunction("sync-factchecks", async (data) => {
    const { syncFactchecks } = await import("@/services/sync/factchecks");
    const limit = (data.limit as number) || 50;
    return syncFactchecks({ limit });
  }),
  createSyncFunction("sync-press", async () => {
    const { syncPress: syncPressService } = await import("@/services/sync/press");
    return syncPressService();
  }),
  createSyncFunction("recalculate-prominence", async () => {
    const { recalculateProminence } = await import("@/services/sync/prominence");
    return recalculateProminence();
  }),
  createSyncFunction("assign-publication-status", async () => {
    const { assignPublicationStatus } = await import("@/services/sync/publication-status");
    return assignPublicationStatus();
  }),
  createSyncFunction("reconcile-affairs", async (data) => {
    const { reconcileAffairs } = await import("@/services/sync/reconcile-affairs");
    const autoMerge = Boolean(data.flags && (data.flags as string).includes("--auto-merge"));
    return reconcileAffairs({ autoMerge });
  }),
  createSyncFunction("classify-themes", async (data) => {
    const { classifyThemes } = await import("@/services/sync/classify-themes");
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
