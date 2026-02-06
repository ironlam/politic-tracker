/**
 * Audit and fix party consistency
 *
 * Checks for inconsistencies between currentPartyId and PartyMembership,
 * and optionally fixes them.
 *
 * Usage:
 *   npx tsx scripts/audit-party-consistency.ts          # Audit only
 *   npx tsx scripts/audit-party-consistency.ts --fix    # Audit and fix
 */
import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { config } from "dotenv";

config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

async function audit() {
  console.log("🔍 Auditing party consistency...\n");

  const politicians = await db.politician.findMany({
    select: {
      id: true,
      fullName: true,
      currentPartyId: true,
      currentParty: { select: { shortName: true } },
      partyHistory: {
        where: { endDate: null },
        orderBy: { startDate: "desc" },
        take: 1,
        select: {
          partyId: true,
          party: { select: { shortName: true } },
        },
      },
    },
  });

  const inconsistencies: Array<{
    id: string;
    name: string;
    current: string | null;
    expected: string | null;
  }> = [];

  const noMembership: Array<{
    id: string;
    name: string;
    currentParty: string | null;
  }> = [];

  for (const p of politicians) {
    const expectedPartyId = p.partyHistory[0]?.partyId ?? null;

    // Check for inconsistency
    if (p.currentPartyId !== expectedPartyId) {
      inconsistencies.push({
        id: p.id,
        name: p.fullName,
        current: p.currentParty?.shortName ?? "(none)",
        expected: p.partyHistory[0]?.party.shortName ?? "(none)",
      });
    }

    // Check for currentParty without membership
    if (p.currentPartyId && p.partyHistory.length === 0) {
      noMembership.push({
        id: p.id,
        name: p.fullName,
        currentParty: p.currentParty?.shortName ?? null,
      });
    }
  }

  console.log(`Total politicians: ${politicians.length}`);
  console.log(`Inconsistencies: ${inconsistencies.length}`);
  console.log(`Has party but no membership: ${noMembership.length}\n`);

  if (inconsistencies.length > 0) {
    console.log("=== INCONSISTENCIES ===");
    console.log("(currentPartyId ≠ active PartyMembership)\n");
    inconsistencies.slice(0, 20).forEach((i) => {
      console.log(`  ${i.name}: ${i.current} → should be ${i.expected}`);
    });
    if (inconsistencies.length > 20) {
      console.log(`  ... and ${inconsistencies.length - 20} more`);
    }
    console.log();
  }

  if (noMembership.length > 0) {
    console.log("=== HAS PARTY BUT NO MEMBERSHIP ===");
    console.log("(currentPartyId set but no PartyMembership record)\n");
    noMembership.slice(0, 20).forEach((i) => {
      console.log(`  ${i.name}: ${i.currentParty}`);
    });
    if (noMembership.length > 20) {
      console.log(`  ... and ${noMembership.length - 20} more`);
    }
    console.log();
  }

  return { inconsistencies, noMembership };
}

async function fix(
  inconsistencies: Array<{ id: string; name: string }>,
  noMembership: Array<{ id: string; name: string; currentParty: string | null }>
) {
  console.log("🔧 Fixing inconsistencies...\n");

  // FIRST: Create missing memberships (before syncing currentPartyId!)
  let created = 0;
  for (const i of noMembership) {
    const politician = await db.politician.findUnique({
      where: { id: i.id },
      select: { currentPartyId: true },
    });

    if (politician?.currentPartyId) {
      await db.partyMembership.create({
        data: {
          politicianId: i.id,
          partyId: politician.currentPartyId,
          startDate: new Date("2020-01-01"), // Default date for existing records
        },
      });
      created++;
    }
  }
  console.log(`  Created ${created} missing memberships`);

  // THEN: Fix remaining inconsistencies by syncing currentPartyId from PartyMembership
  // Only fix those NOT in noMembership (we just created their memberships)
  const noMembershipIds = new Set(noMembership.map((i) => i.id));
  const toFix = inconsistencies.filter((i) => !noMembershipIds.has(i.id));

  let fixed = 0;
  for (const i of toFix) {
    const membership = await db.partyMembership.findFirst({
      where: { politicianId: i.id, endDate: null },
      orderBy: { startDate: "desc" },
    });

    await db.politician.update({
      where: { id: i.id },
      data: { currentPartyId: membership?.partyId ?? null },
    });
    fixed++;
  }
  console.log(`  Fixed ${fixed} true inconsistencies`);
}

async function main() {
  const shouldFix = process.argv.includes("--fix");

  const { inconsistencies, noMembership } = await audit();

  if (shouldFix && (inconsistencies.length > 0 || noMembership.length > 0)) {
    await fix(inconsistencies, noMembership);
    console.log("\n✅ Done!");
  } else if (inconsistencies.length > 0 || noMembership.length > 0) {
    console.log("Run with --fix to correct these issues.");
  } else {
    console.log("✅ All party data is consistent!");
  }
}

main()
  .catch(console.error)
  .finally(() => {
    db.$disconnect();
    pool.end();
  });
