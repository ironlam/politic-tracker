#!/usr/bin/env tsx
/**
 * Index embeddings for RAG chatbot
 *
 * Usage:
 *   npm run index:embeddings          # Index all types
 *   npm run index:embeddings -- --type=POLITICIAN
 *   npm run index:embeddings -- --type=DOSSIER --limit=100
 *   npm run index:embeddings -- --stats
 */

import "dotenv/config";
import {
  indexAllOfType,
  getEmbeddingStats,
} from "../src/services/embeddings";
import type { EmbeddingType } from "../src/generated/prisma";

async function main() {
  const args = process.argv.slice(2);

  // Check for stats flag
  if (args.includes("--stats")) {
    console.log("\n📊 Embedding Statistics\n");
    const stats = await getEmbeddingStats();
    console.log("Type           | Count");
    console.log("---------------|------");
    for (const [type, count] of Object.entries(stats)) {
      console.log(`${type.padEnd(15)}| ${count}`);
    }
    const total = Object.values(stats).reduce((a, b) => a + b, 0);
    console.log("---------------|------");
    console.log(`${"TOTAL".padEnd(15)}| ${total}`);
    console.log("");
    return;
  }

  // Parse arguments
  let entityType: EmbeddingType | undefined;
  let limit: number | undefined;

  for (const arg of args) {
    if (arg.startsWith("--type=")) {
      entityType = arg.split("=")[1] as EmbeddingType;
    } else if (arg.startsWith("--limit=")) {
      limit = parseInt(arg.split("=")[1], 10);
    }
  }

  // Check for Voyage AI API key
  if (!process.env.VOYAGE_API_KEY) {
    console.error("❌ VOYAGE_API_KEY environment variable is not set");
    process.exit(1);
  }

  const types: EmbeddingType[] = entityType
    ? [entityType]
    : ["POLITICIAN", "PARTY", "AFFAIR", "DOSSIER", "SCRUTIN"];

  console.log("\n🔄 Indexing embeddings for RAG chatbot\n");
  console.log(`Types to index: ${types.join(", ")}`);
  if (limit) console.log(`Limit per type: ${limit}`);
  console.log("");

  let totalIndexed = 0;
  let totalErrors = 0;

  for (const type of types) {
    console.log(`\n📝 Indexing ${type}...`);

    const startTime = Date.now();
    const { indexed, errors } = await indexAllOfType(type, {
      limit,
      onProgress: (current, total) => {
        process.stdout.write(`\r   Progress: ${current}/${total}`);
      },
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n   ✅ Indexed: ${indexed}, Errors: ${errors} (${elapsed}s)`);

    totalIndexed += indexed;
    totalErrors += errors;
  }

  console.log("\n" + "=".repeat(50));
  console.log(`✅ Total indexed: ${totalIndexed}`);
  if (totalErrors > 0) {
    console.log(`❌ Total errors: ${totalErrors}`);
  }
  console.log("");

  // Show final stats
  const finalStats = await getEmbeddingStats();
  console.log("📊 Final embedding counts:");
  for (const [type, count] of Object.entries(finalStats)) {
    if (count > 0) {
      console.log(`   ${type}: ${count}`);
    }
  }
  console.log("");
}

main()
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
