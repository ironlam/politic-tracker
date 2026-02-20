# Inngest Async Jobs — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the Fly.io worker with Inngest durable functions so sync jobs run on Vercel without timeout, with retry, scheduling, and CLI triggering.

**Architecture:** Inngest SDK wraps existing sync scripts. Admin UI POST creates a SyncJob then sends an Inngest event. Inngest calls `/api/inngest` (signed webhook) which executes the function on Vercel. Each function uses `step.run()` for persistence/retry. A CLI script `trigger.ts` allows launching jobs from the terminal.

**Tech Stack:** inngest (SDK), Next.js App Router, Prisma (SyncJob model), existing sync scripts

**Design doc:** `docs/plans/2026-02-21-inngest-async-jobs-design.md`

---

### Task 1: Install Inngest SDK

**Files:**
- Modify: `package.json`

**Step 1: Install inngest**

```bash
npm install inngest
```

**Step 2: Verify installation**

```bash
node -e "require('inngest')" && echo "OK"
```

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install inngest SDK (#155)"
```

---

### Task 2: Create Inngest client

**Files:**
- Create: `src/inngest/client.ts`

**Step 1: Create the client**

```typescript
import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "poligraph",
});
```

**Step 2: Commit**

```bash
git add src/inngest/client.ts
git commit -m "feat(inngest): create Inngest client (#155)"
```

---

### Task 3: Create the serve route

**Files:**
- Create: `src/app/api/inngest/route.ts`
- Create: `src/inngest/index.ts`

**Step 1: Create barrel export (empty for now)**

```typescript
// src/inngest/index.ts
import type { Inngest } from "inngest";

// All Inngest functions will be exported here
// Functions will be added in subsequent tasks
export const functions: Parameters<typeof import("inngest/next")["serve"]>[0]["functions"] = [];
```

Actually, let's keep it simple — just re-export from functions as we add them.

```typescript
// src/inngest/index.ts
// Functions will be added as they are created
export const functions = [] as const;
```

**Step 2: Create the route handler**

```typescript
// src/app/api/inngest/route.ts
import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { functions } from "@/inngest";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [...functions],
});
```

**Step 3: Verify build**

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add src/inngest/index.ts src/app/api/inngest/route.ts
git commit -m "feat(inngest): add serve route /api/inngest (#155)"
```

---

### Task 4: Create shared job helper

Each Inngest function needs to update the SyncJob record. Extract a shared helper to avoid duplication.

**Files:**
- Create: `src/inngest/job-helper.ts`

**Step 1: Create the helper**

```typescript
// src/inngest/job-helper.ts
import { db } from "@/lib/db";

export async function markJobRunning(jobId: string) {
  await db.syncJob.update({
    where: { id: jobId },
    data: { status: "RUNNING", startedAt: new Date() },
  });
}

export async function markJobCompleted(jobId: string, result?: Record<string, unknown>) {
  await db.syncJob.update({
    where: { id: jobId },
    data: {
      status: "COMPLETED",
      progress: 100,
      completedAt: new Date(),
      result: result ?? null,
    },
  });
}

export async function markJobFailed(jobId: string, error: string) {
  await db.syncJob.update({
    where: { id: jobId },
    data: {
      status: "FAILED",
      completedAt: new Date(),
      error: error.slice(0, 2000),
    },
  });
}

export async function updateJobProgress(jobId: string, progress: number, processed?: number) {
  await db.syncJob.update({
    where: { id: jobId },
    data: {
      progress,
      ...(processed != null ? { processed } : {}),
    },
  });
}
```

**Step 2: Commit**

```bash
git add src/inngest/job-helper.ts
git commit -m "feat(inngest): add shared SyncJob helper (#155)"
```

---

### Task 5: Create the first function — sync-press

Start with one function to validate the entire pipeline end-to-end. `sync-press` is a good candidate: moderate duration (~5-15 min), two natural steps (RSS parse + AI analysis).

**Files:**
- Create: `src/inngest/functions/sync-press.ts`
- Modify: `src/inngest/index.ts`

**Step 1: Create the function**

The function wraps the existing scripts by importing their handler logic. Since our scripts use `createCLI()` which calls `process.exit()`, we can't import them directly. Instead, we use `execSync` (same pattern as `sync-daily.ts`).

```typescript
// src/inngest/functions/sync-press.ts
import { execSync } from "child_process";
import { inngest } from "../client";
import { markJobRunning, markJobCompleted, markJobFailed, updateJobProgress } from "../job-helper";

export const syncPress = inngest.createFunction(
  {
    id: "sync-press",
    retries: 2,
    concurrency: { limit: 1, key: "event.data.script" },
  },
  { event: "sync/press" },
  async ({ event, step }) => {
    const jobId = event.data.jobId as string | undefined;

    if (jobId) await markJobRunning(jobId);

    // Step 1: Parse RSS feeds
    await step.run("parse-rss", async () => {
      execSync("npx tsx scripts/sync-press.ts", {
        stdio: "inherit",
        env: { ...process.env },
        timeout: 5 * 60 * 1000,
      });
      if (jobId) await updateJobProgress(jobId, 50);
    });

    // Step 2: AI analysis
    await step.run("ai-analysis", async () => {
      const limit = (event.data.limit as number) || 100;
      execSync(`npx tsx scripts/sync-press-analysis.ts --limit=${limit}`, {
        stdio: "inherit",
        env: { ...process.env },
        timeout: 10 * 60 * 1000,
      });
    });

    if (jobId) await markJobCompleted(jobId, { steps: ["parse-rss", "ai-analysis"] });
  }
);
```

**Step 2: Register in barrel**

```typescript
// src/inngest/index.ts
export { syncPress } from "./functions/sync-press";

export const functions = [
  // Dynamically import to get the array
];
```

Actually, the serve() handler needs an array. Better pattern:

```typescript
// src/inngest/index.ts
import { syncPress } from "./functions/sync-press";

export const functions = [syncPress];
```

**Step 3: Verify build**

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add src/inngest/functions/sync-press.ts src/inngest/index.ts
git commit -m "feat(inngest): add sync-press function (#155)"
```

---

### Task 6: Create remaining sync functions

Same pattern as sync-press. One function per logical group.

**Files:**
- Create: `src/inngest/functions/sync-votes.ts`
- Create: `src/inngest/functions/sync-legislation.ts`
- Create: `src/inngest/functions/discover-affairs.ts`
- Create: `src/inngest/functions/sync-factchecks.ts`
- Create: `src/inngest/functions/generate-ai.ts`
- Create: `src/inngest/functions/index-embeddings.ts`
- Create: `src/inngest/functions/sync-politicians.ts`
- Create: `src/inngest/functions/maintenance.ts`
- Modify: `src/inngest/index.ts`

Each function follows the same template:

```typescript
import { execSync } from "child_process";
import { inngest } from "../client";
import { markJobRunning, markJobCompleted, markJobFailed } from "../job-helper";

export const <name> = inngest.createFunction(
  { id: "<id>", retries: 2, concurrency: { limit: 1, key: "event.data.script" } },
  { event: "sync/<event>" },
  async ({ event, step }) => {
    const jobId = event.data.jobId as string | undefined;
    if (jobId) await markJobRunning(jobId);

    await step.run("<step-name>", async () => {
      execSync("npx tsx scripts/<script>.ts <flags>", {
        stdio: "inherit",
        env: { ...process.env },
        timeout: <N> * 60 * 1000,
      });
    });

    if (jobId) await markJobCompleted(jobId);
  }
);
```

**Functions to create:**

| Function | Event | Scripts wrapped | Timeout/step |
|----------|-------|-----------------|--------------|
| `syncVotes` | `sync/votes` | sync-votes-an --today, sync-votes-senat --today | 5min |
| `syncLegislation` | `sync/legislation` | sync-legislation --active, sync-legislation-content --limit=20 | 5min |
| `discoverAffairs` | `sync/discover-affairs` | discover-affairs, reconcile-affairs --auto-merge | 10min |
| `syncFactchecks` | `sync/factchecks` | sync-factchecks --limit=50, sync-judilibre --limit=20 | 5min |
| `generateAi` | `sync/generate-ai` | generate-biographies, generate-summaries, generate-scrutin-summaries, classify-themes | 10min |
| `indexEmbeddings` | `sync/index-embeddings` | index-embeddings (all types) | 10min |
| `syncPoliticians` | `sync/politicians` | sync-assemblee, sync-senat, sync-gouvernement, sync-europarl, sync-photos | 5min |
| `maintenance` | `sync/maintenance` | recalculate-prominence, assign-publication-status | 5min |

Also create one-to-one wrappers for individual scripts that can be triggered alone from the admin catalog:

| Function | Event | Script |
|----------|-------|--------|
| `syncAssemblee` | `sync/sync-assemblee` | sync-assemblee |
| `syncSenat` | `sync/sync-senat` | sync-senat |
| `syncGouvernement` | `sync/sync-gouvernement` | sync-gouvernement |
| etc. for each script in SCRIPT_CATALOG | | |

**Pattern for individual wrappers — use a factory:**

```typescript
// src/inngest/functions/single-script.ts
import { execSync } from "child_process";
import { inngest } from "../client";
import { markJobRunning, markJobCompleted } from "../job-helper";

/**
 * Factory to create a simple Inngest function wrapping a single sync script.
 */
export function createSyncFunction(scriptId: string, timeoutMinutes = 10) {
  return inngest.createFunction(
    {
      id: scriptId,
      retries: 2,
      concurrency: { limit: 1, key: `"${scriptId}"` },
    },
    { event: `sync/${scriptId}` },
    async ({ event, step }) => {
      const jobId = event.data.jobId as string | undefined;
      if (jobId) await markJobRunning(jobId);

      await step.run(scriptId, async () => {
        const flags = (event.data.flags as string) || "";
        execSync(`npx tsx scripts/${scriptId}.ts ${flags}`.trim(), {
          stdio: "inherit",
          env: { ...process.env },
          timeout: timeoutMinutes * 60 * 1000,
        });
      });

      if (jobId) await markJobCompleted(jobId);
    }
  );
}
```

Then register them all:

```typescript
// src/inngest/index.ts
import { syncPress } from "./functions/sync-press";
import { syncDaily } from "./functions/sync-daily";
import { createSyncFunction } from "./functions/single-script";

// Individual script wrappers (matching SCRIPT_CATALOG in admin)
const syncAssemblee = createSyncFunction("sync-assemblee");
const syncSenat = createSyncFunction("sync-senat");
const syncGouvernement = createSyncFunction("sync-gouvernement");
// ... etc for all scripts in SCRIPT_CATALOG

export const functions = [
  syncPress,
  syncDaily,
  syncAssemblee,
  syncSenat,
  syncGouvernement,
  // ... all others
];
```

**Step: Verify build**

```bash
npx tsc --noEmit
```

**Step: Commit**

```bash
git add src/inngest/
git commit -m "feat(inngest): add all sync functions (#155)"
```

---

### Task 7: Create sync-daily orchestrator

Replace the current `sync-daily.ts` (which uses `execSync` sequentially) with an Inngest function that runs the same steps as durable steps.

**Files:**
- Create: `src/inngest/functions/sync-daily.ts`
- Modify: `src/inngest/index.ts`

**Step 1: Create the daily orchestrator**

```typescript
// src/inngest/functions/sync-daily.ts
import { execSync } from "child_process";
import { inngest } from "../client";

const DAILY_STEPS = [
  { name: "votes-an", cmd: "npx tsx scripts/sync-votes-an.ts --today" },
  { name: "votes-senat", cmd: "npx tsx scripts/sync-votes-senat.ts --today" },
  { name: "legislation", cmd: "npx tsx scripts/sync-legislation.ts --active" },
  { name: "legislation-content", cmd: "npx tsx scripts/sync-legislation-content.ts --limit=20" },
  { name: "summaries-dossiers", cmd: "npx tsx scripts/generate-summaries.ts --limit=10" },
  { name: "summaries-scrutins", cmd: "npx tsx scripts/generate-scrutin-summaries.ts --limit=20" },
  { name: "press-rss", cmd: "npx tsx scripts/sync-press.ts" },
  { name: "press-analysis", cmd: "npx tsx scripts/sync-press-analysis.ts --limit=100" },
  { name: "judilibre", cmd: "npx tsx scripts/sync-judilibre.ts --limit=20" },
  { name: "reconcile-affairs", cmd: "npx tsx scripts/reconcile-affairs.ts --auto-merge" },
  { name: "factchecks", cmd: "npx tsx scripts/sync-factchecks.ts --limit=50" },
  { name: "classify-themes", cmd: "npx tsx scripts/classify-themes.ts --limit=30" },
  { name: "embeddings-factchecks", cmd: "npx tsx scripts/index-embeddings.ts --type=FACTCHECK" },
  { name: "embeddings-press", cmd: "npx tsx scripts/index-embeddings.ts --type=PRESS_ARTICLE" },
  { name: "prominence", cmd: "npx tsx scripts/recalculate-prominence.ts" },
  { name: "publication-status", cmd: "npx tsx scripts/assign-publication-status.ts" },
];

export const syncDaily = inngest.createFunction(
  {
    id: "sync-daily",
    retries: 0, // orchestrator doesn't retry (individual steps do)
    concurrency: { limit: 1 },
  },
  [
    { cron: "0 5,11,19 * * *" },  // 3x/day (same as current GitHub Action)
    { event: "sync/daily" },       // also triggerable manually
  ],
  async ({ step }) => {
    const results: Array<{ name: string; success: boolean; error?: string }> = [];

    for (const s of DAILY_STEPS) {
      const result = await step.run(s.name, async () => {
        try {
          execSync(s.cmd, {
            stdio: "inherit",
            env: { ...process.env },
            timeout: 10 * 60 * 1000,
          });
          return { success: true };
        } catch (err) {
          // Don't throw — continue to next step (same as current sync-daily.ts)
          return {
            success: false,
            error: err instanceof Error ? err.message : String(err),
          };
        }
      });

      results.push({ name: s.name, ...result });
    }

    const failed = results.filter((r) => !r.success);
    return {
      total: results.length,
      succeeded: results.length - failed.length,
      failed: failed.length,
      failures: failed.map((f) => f.name),
    };
  }
);
```

**Step 2: Register + verify build**

**Step 3: Commit**

```bash
git add src/inngest/functions/sync-daily.ts src/inngest/index.ts
git commit -m "feat(inngest): add daily sync orchestrator with cron (#155)"
```

---

### Task 8: Modify admin API to use Inngest

Replace the Fly.io worker call with `inngest.send()`.

**Files:**
- Modify: `src/app/api/admin/syncs/route.ts:70-98`

**Step 1: Update the POST handler**

Replace the Fly.io fetch block (lines 74-98) with:

```typescript
// After creating the SyncJob...
try {
  const { inngest } = await import("@/inngest/client");
  await inngest.send({
    name: `sync/${script}`,
    data: { jobId: job.id },
  });
} catch (err) {
  console.error("Failed to send Inngest event:", err);
  await db.syncJob.update({
    where: { id: job.id },
    data: {
      status: "FAILED",
      error: "Impossible d'envoyer l'événement Inngest",
      completedAt: new Date(),
    },
  });
  return NextResponse.json({ error: "Erreur Inngest" }, { status: 503 });
}
```

**Step 2: Verify build**

```bash
npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add src/app/api/admin/syncs/route.ts
git commit -m "feat(inngest): replace Fly.io worker call with inngest.send (#155)"
```

---

### Task 9: Create CLI trigger script

Allow launching jobs from the terminal without the admin UI.

**Files:**
- Create: `scripts/trigger.ts`
- Modify: `package.json` (add npm script)

**Step 1: Create the trigger script**

```typescript
// scripts/trigger.ts
/**
 * CLI trigger for Inngest sync jobs
 *
 * Usage:
 *   npm run trigger sync:press
 *   npm run trigger sync:press -- --limit=50
 *   npm run trigger sync:daily
 *   npm run trigger discover:affairs
 */
import "dotenv/config";
import { Inngest } from "inngest";

const EVENT_KEY = process.env.INNGEST_EVENT_KEY;
if (!EVENT_KEY) {
  console.error("INNGEST_EVENT_KEY is required in .env");
  process.exit(1);
}

const inngest = new Inngest({ id: "poligraph", eventKey: EVENT_KEY });

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args[0] === "--help") {
    console.log(`
Usage: npm run trigger <event-name> [-- --flag=value]

Events:
  sync:press           Presse RSS + analyse IA
  sync:daily           Sync quotidien complet
  sync:votes           Votes AN + Sénat
  sync:legislation     Dossiers législatifs
  discover:affairs     Découverte affaires
  sync:factchecks      Fact-checks + Judilibre
  generate:ai          Biographies + résumés + thèmes
  index:embeddings     Embeddings RAG

  Or any script from the admin catalog:
  sync-assemblee, sync-senat, sync-gouvernement, etc.

Flags are passed as event data (e.g., --limit=50 → { limit: 50 })
    `);
    process.exit(0);
  }

  // Parse event name (normalize : to /)
  const rawName = args[0];
  const eventName = rawName.startsWith("sync/") || rawName.startsWith("sync:")
    ? "sync/" + rawName.replace(/^sync[:\/]/, "")
    : "sync/" + rawName;

  // Parse flags into data
  const data: Record<string, unknown> = {};
  for (const arg of args.slice(1)) {
    if (arg.startsWith("--")) {
      const [key, value] = arg.slice(2).split("=");
      data[key] = value !== undefined ? (isNaN(Number(value)) ? value : Number(value)) : true;
    }
  }

  console.log(`Sending event: ${eventName}`);
  if (Object.keys(data).length > 0) {
    console.log("Data:", JSON.stringify(data, null, 2));
  }

  const result = await inngest.send({ name: eventName, data });
  console.log("Event sent successfully:", result);
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
```

**Step 2: Add npm script**

In `package.json`, add:
```json
"trigger": "tsx scripts/trigger.ts"
```

**Step 3: Verify**

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add scripts/trigger.ts package.json
git commit -m "feat(inngest): add CLI trigger script (#155)"
```

---

### Task 10: Add env vars + test locally with Inngest Dev Server

**Files:**
- Modify: `.env` (add keys)
- Modify: `.env.example` (document keys)

**Step 1: Add Inngest dev config to .env**

```bash
# Inngest (dev mode — no real keys needed locally)
INNGEST_EVENT_KEY=test
INNGEST_SIGNING_KEY=test
```

**Step 2: Update .env.example**

Add:
```
# Inngest — async job queue (https://inngest.com)
INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=
```

**Step 3: Test locally**

```bash
# Terminal 1: Start Next.js dev server
npm run dev

# Terminal 2: Start Inngest dev server
npx inngest-cli@latest dev -u http://localhost:3000/api/inngest
```

Open `http://localhost:8288` to see the Inngest dev dashboard. The functions should appear.

**Step 4: Trigger a test job from admin**

Go to `http://localhost:3000/admin/syncs`, click a sync button. Verify:
- SyncJob created in DB
- Event appears in Inngest dev dashboard
- Script executes (check terminal output)

**Step 5: Commit**

```bash
git add .env.example
git commit -m "feat(inngest): add env config + dev server setup (#155)"
```

---

### Task 11: Deploy to Vercel + configure production

**Step 1: Add env vars on Vercel**

```bash
vercel env add INNGEST_EVENT_KEY production
vercel env add INNGEST_SIGNING_KEY production
```

(Get the actual keys from https://app.inngest.com → Settings → Keys)

**Step 2: Deploy**

```bash
git push
```

**Step 3: Register the Inngest app**

Go to https://app.inngest.com → Apps → Sync New App
URL: `https://poligraph.fr/api/inngest`

**Step 4: Test in production**

Trigger a small sync from the admin or CLI:
```bash
npm run trigger sync-factchecks -- --limit=5
```

Verify in Inngest dashboard that the function executed.

---

### Task 12: Remove Fly.io (Phase 2)

Only after Inngest is validated in production.

**Files:**
- Delete: `worker/` (entire directory)
- Delete: `.github/workflows/deploy-worker.yml`
- Modify: `.github/workflows/sync-daily.yml` → delete or disable (replaced by Inngest cron)
- Modify: `.github/workflows/sync-politicians.yml` → delete or disable

**Step 1: Remove worker directory**

```bash
rm -rf worker/
```

**Step 2: Remove deploy workflow**

```bash
rm .github/workflows/deploy-worker.yml
```

**Step 3: Disable GitHub Actions cron workflows**

Comment out or delete the cron-based workflows (sync-daily, sync-politicians). Keep any workflows that do other things (tests, deploy).

**Step 4: Remove Fly.io env vars from Vercel**

```bash
vercel env rm SYNC_WORKER_URL production
vercel env rm SYNC_WORKER_SECRET production
```

**Step 5: Destroy Fly.io app**

```bash
flyctl apps destroy poligraph-sync-worker --yes
```

**Step 6: Commit**

```bash
git add -A
git commit -m "chore: remove Fly.io worker, replaced by Inngest (#155)"
```

---

## Verification Checklist

After all tasks:

- [ ] `npx tsc --noEmit` — zero errors
- [ ] `npm run build` — success
- [ ] Admin UI `/admin/syncs` launches jobs via Inngest (not Fly.io)
- [ ] `npm run trigger sync:press -- --limit=5` works from CLI
- [ ] Inngest dashboard shows function executions
- [ ] Daily cron fires at scheduled times
- [ ] Failed jobs retry automatically (up to 2 times)
- [ ] SyncJob records are updated with progress/status/errors
- [ ] Fly.io worker is removed (Phase 2)
