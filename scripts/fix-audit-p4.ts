/**
 * Fix script for Priority 4 audit issues (#72)
 *
 * 1. Fix photos for Tondelier & Roussel (Wikidata Commons)
 * 2. Fix wrong Wikidata IDs for Tondelier & Roussel
 * 3. Create missing PartyMembership for Tondelier
 * 4. Close duplicate open memberships (keep most recent per politician)
 * 5. Sync currentPartyId from PartyMembership (fixes Macron, Sarkozy, Le Pen, etc.)
 *
 * Usage:
 *   npx tsx scripts/fix-audit-p4.ts --dry-run
 *   npx tsx scripts/fix-audit-p4.ts
 */

import "dotenv/config";
import { db } from "../src/lib/db";
import { DataSource } from "../src/generated/prisma";

const DRY_RUN = process.argv.includes("--dry-run");

// ── Photo URLs from Wikidata Commons ──────────────────────────
const PHOTO_FIXES: Record<
  string,
  { photoUrl: string; wikidataId: string; wrongWikidataId: string }
> = {
  "Marine Tondelier": {
    photoUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/20210819_tondelier.m-cr3.jpg/400px-20210819_tondelier.m-cr3.jpg",
    wikidataId: "Q29917987",
    wrongWikidataId: "Q21640846",
  },
  "Fabien Roussel": {
    photoUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ae/Roussel_Fabien_1.jpg/400px-Roussel_Fabien_1.jpg",
    wikidataId: "Q30388733",
    wrongWikidataId: "Q3064416",
  },
};

async function main() {
  console.log(`=== Fix Audit P4 — Data Consistency ===`);
  console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}\n`);

  // ── 1. Fix photos + Wikidata IDs ──
  console.log("── 1. Fix photos & Wikidata IDs ──");
  for (const [fullName, fix] of Object.entries(PHOTO_FIXES)) {
    const politician = await db.politician.findFirst({
      where: { fullName },
      select: { id: true, fullName: true, photoUrl: true },
    });
    if (!politician) {
      console.log(`  ⚠ ${fullName} not found in DB`);
      continue;
    }

    if (DRY_RUN) {
      console.log(`  [DRY-RUN] ${fullName}: photo → ${fix.photoUrl.substring(0, 60)}...`);
      console.log(`  [DRY-RUN] ${fullName}: Wikidata ${fix.wrongWikidataId} → ${fix.wikidataId}`);
    } else {
      // Update photo
      await db.politician.update({
        where: { id: politician.id },
        data: { photoUrl: fix.photoUrl, photoSource: "wikidata" },
      });
      console.log(`  ✓ ${fullName}: photo set`);

      // Fix Wikidata ExternalId
      const wrongExt = await db.externalId.findFirst({
        where: {
          politicianId: politician.id,
          source: DataSource.WIKIDATA,
          externalId: fix.wrongWikidataId,
        },
      });

      if (wrongExt) {
        await db.externalId.update({
          where: { id: wrongExt.id },
          data: {
            externalId: fix.wikidataId,
            url: `https://www.wikidata.org/wiki/${fix.wikidataId}`,
          },
        });
        console.log(`  ✓ ${fullName}: Wikidata ID ${fix.wrongWikidataId} → ${fix.wikidataId}`);
      } else {
        console.log(`  ⚠ ${fullName}: old Wikidata ID ${fix.wrongWikidataId} not found, skipping`);
      }
    }
  }
  console.log();

  // ── 2. Fix Tondelier missing PartyMembership ──
  console.log("── 2. Fix missing PartyMembership ──");
  const tondelier = await db.politician.findFirst({
    where: { fullName: "Marine Tondelier" },
    select: {
      id: true,
      currentPartyId: true,
      partyHistory: { where: { endDate: null }, select: { id: true, partyId: true } },
    },
  });

  if (tondelier && tondelier.currentPartyId && tondelier.partyHistory.length === 0) {
    if (DRY_RUN) {
      console.log(
        `  [DRY-RUN] Would create active membership for Tondelier → ${tondelier.currentPartyId}`
      );
    } else {
      await db.partyMembership.create({
        data: {
          politicianId: tondelier.id,
          partyId: tondelier.currentPartyId,
          startDate: new Date("2022-12-10"),
        },
      });
      console.log(`  ✓ Created active membership for Tondelier`);
    }
  } else {
    console.log(`  ⓘ Tondelier membership already OK or not found`);
  }
  console.log();

  // ── 3. Close duplicate open memberships ──
  console.log("── 3. Close duplicate open memberships ──");

  // Find all politicians with multiple open memberships
  const multiMemberships = await db.$queryRaw<
    Array<{ politicianId: string; fullName: string; cnt: bigint }>
  >`
    SELECT pm."politicianId", p."fullName", COUNT(*) as cnt
    FROM "PartyMembership" pm
    JOIN "Politician" p ON p.id = pm."politicianId"
    WHERE pm."endDate" IS NULL
    GROUP BY pm."politicianId", p."fullName"
    HAVING COUNT(*) > 1
  `;

  let membershipsClosed = 0;
  for (const row of multiMemberships) {
    const memberships = await db.partyMembership.findMany({
      where: { politicianId: row.politicianId, endDate: null },
      include: { party: { select: { shortName: true } } },
      orderBy: { startDate: "desc" },
    });

    // Keep the most recent, close the rest
    const keep = memberships[0];
    const toClose = memberships.slice(1);

    for (const m of toClose) {
      if (DRY_RUN) {
        console.log(
          `  [DRY-RUN] ${row.fullName}: close old ${m.party.shortName} (keep ${keep.party.shortName})`
        );
      } else {
        await db.partyMembership.update({
          where: { id: m.id },
          data: { endDate: keep.startDate || new Date() },
        });
      }
      membershipsClosed++;
    }
  }
  console.log(`  Duplicate memberships closed: ${membershipsClosed}\n`);

  // ── 4. Sync currentPartyId from memberships ──
  console.log("── 4. Sync currentPartyId ──");

  const politicians = await db.politician.findMany({
    select: {
      id: true,
      fullName: true,
      currentPartyId: true,
      partyHistory: {
        where: { endDate: null },
        orderBy: { startDate: "desc" },
        take: 1,
        select: { partyId: true, party: { select: { shortName: true } } },
      },
    },
  });

  let synced = 0;
  for (const p of politicians) {
    const expectedPartyId = p.partyHistory[0]?.partyId ?? null;
    if (p.currentPartyId !== expectedPartyId) {
      const expectedName = p.partyHistory[0]?.party.shortName ?? "null";
      if (DRY_RUN) {
        console.log(`  [DRY-RUN] ${p.fullName}: currentPartyId → ${expectedName}`);
      } else {
        await db.politician.update({
          where: { id: p.id },
          data: { currentPartyId: expectedPartyId },
        });
        console.log(`  ✓ ${p.fullName}: currentPartyId → ${expectedName}`);
      }
      synced++;
    }
  }
  console.log(`  currentPartyId synced: ${synced}\n`);

  // ── Summary ──
  console.log("=".repeat(50));
  console.log("Summary:");
  console.log(`  Photos fixed: ${Object.keys(PHOTO_FIXES).length}`);
  console.log(`  Wikidata IDs corrected: ${Object.keys(PHOTO_FIXES).length}`);
  console.log(`  Duplicate memberships closed: ${membershipsClosed}`);
  console.log(`  currentPartyId synced: ${synced}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
