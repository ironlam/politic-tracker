import { createSyncFunction } from "./functions/single-script";
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

// Phase 2a: Migrated — services already exist, just wire them up
const phase2Migrated = [
  createSyncFunction("sync-assemblee", async () => {
    const { syncDeputies } = await import("@/services/sync/deputies");
    return syncDeputies();
  }),
  createSyncFunction("sync-senat", async () => {
    const { syncSenators } = await import("@/services/sync/senators");
    return syncSenators();
  }),
  createSyncFunction("sync-gouvernement", async () => {
    const { syncGovernment } = await import("@/services/sync/government");
    return syncGovernment();
  }),
  createSyncFunction("sync-europarl", async () => {
    const { syncEuroparl } = await import("@/services/sync/europarl");
    return syncEuroparl();
  }),
  createSyncFunction("sync-photos", async () => {
    const { syncPhotos } = await import("@/services/sync/photos");
    return syncPhotos();
  }),
  createSyncFunction("sync-hatvp", async () => {
    const { syncHATVP } = await import("@/services/sync/hatvp");
    return syncHATVP();
  }),
  createSyncFunction("sync-deceased", async () => {
    const { syncDeceasedFromWikidata } = await import("@/services/sync/deceased");
    return syncDeceasedFromWikidata();
  }),
];

// Phase 2b: Migrated — services extracted from CLI scripts
const phase2Extracted = [
  createSyncFunction("sync-president", async () => {
    const { syncPresident } = await import("@/services/sync/president");
    return syncPresident();
  }),
  createSyncFunction("sync-wikidata-ids", async (data) => {
    const { syncWikidataIds } = await import("@/services/sync/wikidata-ids");
    const limit = (data.limit as number) || undefined;
    return syncWikidataIds({ limit });
  }),
  createSyncFunction("sync-birthdates", async (data) => {
    const { syncBirthdates } = await import("@/services/sync/birthdates");
    const limit = (data.limit as number) || undefined;
    return syncBirthdates({ limit });
  }),
  createSyncFunction("sync-careers", async (data) => {
    const { syncCareers } = await import("@/services/sync/careers");
    const limit = (data.limit as number) || undefined;
    const foundersOnly = Boolean(data.flags && (data.flags as string).includes("--founders-only"));
    return syncCareers({ limit, foundersOnly });
  }),
  createSyncFunction("sync-parties", async (data) => {
    const { syncParties } = await import("@/services/sync/parties");
    const configOnly = Boolean(data.flags && (data.flags as string).includes("--config"));
    return syncParties({ configOnly });
  }),
  createSyncFunction("sync-mep-parties", async (data) => {
    const { syncMepParties } = await import("@/services/sync/mep-parties");
    const limit = (data.limit as number) || undefined;
    const force = Boolean(data.flags && (data.flags as string).includes("--force"));
    return syncMepParties({ limit, force });
  }),
];

export const functions = [
  ...groupedFunctions,
  ...migratedFunctions,
  ...phase2Migrated,
  ...phase2Extracted,
];
