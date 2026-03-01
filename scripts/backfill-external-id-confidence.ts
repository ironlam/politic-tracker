/**
 * Backfill confidence and matchedBy on existing ExternalIds.
 * Assigns source-specific default confidence based on how reliable each source typically is.
 * Run: npx dotenv -e .env -- npx tsx scripts/backfill-external-id-confidence.ts
 */
import { db } from "@/lib/db";
import { DataSource, MatchMethod } from "@/generated/prisma";

const SOURCE_DEFAULTS: Record<string, { confidence: number; matchedBy: MatchMethod }> = {
  [DataSource.ASSEMBLEE_NATIONALE]: {
    confidence: 1.0,
    matchedBy: MatchMethod.EXTERNAL_ID,
  },
  [DataSource.SENAT]: {
    confidence: 1.0,
    matchedBy: MatchMethod.EXTERNAL_ID,
  },
  [DataSource.PARLEMENT_EUROPEEN]: {
    confidence: 1.0,
    matchedBy: MatchMethod.EXTERNAL_ID,
  },
  [DataSource.WIKIDATA]: {
    confidence: 0.95,
    matchedBy: MatchMethod.WIKIDATA_PIVOT,
  },
  [DataSource.HATVP]: {
    confidence: 0.9,
    matchedBy: MatchMethod.EXTERNAL_ID,
  },
  [DataSource.GOUVERNEMENT]: {
    confidence: 0.9,
    matchedBy: MatchMethod.EXTERNAL_ID,
  },
  [DataSource.NOSDEPUTES]: {
    confidence: 0.85,
    matchedBy: MatchMethod.EXTERNAL_ID,
  },
  [DataSource.WIKIPEDIA]: {
    confidence: 0.7,
    matchedBy: MatchMethod.NAME_ONLY,
  },
  [DataSource.MANUAL]: { confidence: 0.8, matchedBy: MatchMethod.MANUAL },
  [DataSource.RNE]: { confidence: 0.7, matchedBy: MatchMethod.NAME_ONLY },
};

async function main() {
  const externalIds = await db.externalId.findMany({
    where: { confidence: null },
    select: { id: true, source: true },
  });

  console.log(`Found ${externalIds.length} ExternalIds without confidence`);

  if (externalIds.length === 0) {
    console.log("Nothing to do.");
    await db.$disconnect();
    return;
  }

  // Show distribution before backfill
  const bySource = new Map<string, number>();
  for (const ext of externalIds) {
    bySource.set(ext.source, (bySource.get(ext.source) ?? 0) + 1);
  }
  console.log("Distribution:", Object.fromEntries(bySource));

  for (let i = 0; i < externalIds.length; i += 200) {
    const chunk = externalIds.slice(i, i + 200);
    await Promise.all(
      chunk.map((ext) => {
        const defaults = SOURCE_DEFAULTS[ext.source] ?? {
          confidence: 0.5,
          matchedBy: MatchMethod.NAME_ONLY,
        };
        return db.externalId.update({
          where: { id: ext.id },
          data: { confidence: defaults.confidence, matchedBy: defaults.matchedBy },
        });
      })
    );
    console.log(`Updated ${Math.min(i + 200, externalIds.length)}/${externalIds.length}`);
  }

  console.log("Done.");
  await db.$disconnect();
}

main();
