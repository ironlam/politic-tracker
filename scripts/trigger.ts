/**
 * CLI trigger for Inngest sync jobs
 *
 * Usage:
 *   npm run trigger sync:press
 *   npm run trigger sync:press -- --limit=50
 *   npm run trigger sync:daily
 *   npm run trigger discover:affairs
 *   npm run trigger sync-assemblee           (individual script from admin catalog)
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

Grouped events (multi-step):
  sync:press           Presse RSS + analyse IA
  sync:votes           Votes AN + Sénat
  sync:legislation     Dossiers législatifs + contenu
  discover:affairs     Découverte affaires + réconciliation
  sync:factchecks      Fact-checks + Judilibre
  generate:ai          Biographies + résumés + thèmes
  index:embeddings     Embeddings RAG
  sync:politicians     Assemblée + Sénat + Gouvernement + PE + photos
  sync:maintenance     Prominence + publication status
  sync:daily           Sync quotidien complet (16 étapes)

Individual scripts (from admin catalog):
  sync-assemblee, sync-senat, sync-gouvernement, sync-press, etc.

Flags are passed as event data (e.g., --limit=50)
    `);
    process.exit(0);
  }

  // Parse event name: normalize ":" to "/" and ensure "sync/" prefix
  const rawName = args[0];
  let eventName: string;
  if (rawName!.includes("/") || rawName!.includes(":")) {
    eventName = rawName!.replace(":", "/");
  } else {
    // Bare script name like "sync-assemblee"
    eventName = `sync/${rawName}`;
  }

  // Parse flags into data
  const data: Record<string, unknown> = {};
  for (const arg of args.slice(1)) {
    if (arg.startsWith("--")) {
      const eqIndex = arg.indexOf("=");
      if (eqIndex !== -1) {
        const key = arg.slice(2, eqIndex);
        const value = arg.slice(eqIndex + 1);
        data[key] = isNaN(Number(value)) ? value : Number(value);
      } else {
        data[arg.slice(2)] = true;
      }
    }
  }

  console.log(`Sending event: ${eventName}`);
  if (Object.keys(data).length > 0) {
    console.log("Data:", JSON.stringify(data, null, 2));
  }

  const result = await inngest.send({ name: eventName, data });
  console.log("Event sent successfully:", JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
