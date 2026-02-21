import { createSyncFunction } from "./functions/single-script";
import { discoverAffairs } from "./functions/discover-affairs";
import { generateAi } from "./functions/generate-ai";
import { indexEmbeddings } from "./functions/index-embeddings";
import { maintenance } from "./functions/maintenance";
import { syncFactchecks } from "./functions/sync-factchecks";
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
  syncFactchecks,
  generateAi,
  indexEmbeddings,
  syncPoliticians,
  maintenance,
  syncDaily,
];

// --- Individual script wrappers (admin SCRIPT_CATALOG) ---
const scriptCatalog: { id: string; timeout?: number }[] = [
  // Politicians
  { id: "sync-assemblee" },
  { id: "sync-senat" },
  { id: "sync-gouvernement" },
  { id: "sync-president" },
  { id: "sync-europarl" },
  // Metadata
  { id: "sync-wikidata-ids" },
  { id: "sync-photos" },
  { id: "sync-birthdates" },
  { id: "sync-careers" },
  { id: "sync-parties" },
  { id: "sync-mep-parties" },
  { id: "sync-hatvp" },
  { id: "sync-deceased" },
  // Votes & legislation
  { id: "sync-votes-an" },
  { id: "sync-votes-senat" },
  { id: "sync-legislation" },
  { id: "sync-legislation-content" },
  // Press & factchecks
  { id: "sync-press" },
  { id: "sync-press-analysis", timeout: 10 },
  { id: "sync-factchecks" },
  { id: "sync-judilibre" },
  // AI generation
  { id: "generate-biographies", timeout: 10 },
  { id: "generate-summaries", timeout: 10 },
  { id: "generate-scrutin-summaries", timeout: 10 },
  { id: "classify-themes", timeout: 10 },
  { id: "index-embeddings", timeout: 10 },
  // Maintenance
  { id: "recalculate-prominence" },
  { id: "assign-publication-status" },
  { id: "reconcile-affairs" },
];

const individualFunctions = scriptCatalog.map(({ id, timeout }) => createSyncFunction(id, timeout));

export const functions = [...groupedFunctions, ...individualFunctions];
