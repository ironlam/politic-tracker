#!/usr/bin/env tsx
/**
 * Fix old MEP mandates that are incorrectly marked as current
 */

import "dotenv/config";
import { db } from "../src/lib/db";

async function main() {
  console.log("🔧 Fixing old MEP mandates...\n");

  const fiveYearsAgo = new Date();
  fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);

  // Find old MEP mandates still marked as current
  const oldMandates = await db.mandate.findMany({
    where: {
      type: "DEPUTE_EUROPEEN",
      isCurrent: true,
      startDate: { lt: fiveYearsAgo },
    },
    include: { politician: { select: { fullName: true } } },
  });

  console.log(`Found ${oldMandates.length} old MEP mandates to fix:`);
  for (const m of oldMandates.slice(0, 10)) {
    const startYear = m.startDate ? m.startDate.getFullYear() : "unknown";
    console.log(`  - ${m.politician.fullName}: started ${startYear}`);
  }

  if (oldMandates.length === 0) {
    console.log("\n✅ No mandates to fix");
    return;
  }

  // Fix them - set end date to end of 9th legislature
  const result = await db.mandate.updateMany({
    where: {
      type: "DEPUTE_EUROPEEN",
      isCurrent: true,
      startDate: { lt: fiveYearsAgo },
    },
    data: {
      isCurrent: false,
      endDate: new Date("2024-07-16"), // End of 9th legislature
    },
  });

  console.log(`\n✅ Fixed ${result.count} mandates`);

  // Verify
  const currentMEPs = await db.mandate.count({
    where: { type: "DEPUTE_EUROPEEN", isCurrent: true },
  });
  console.log(`Current MEPs now: ${currentMEPs}`);
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
