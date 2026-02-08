/**
 * Fix Sénat scrutin dates - Parse voting date from title
 *
 * Some scrutins have the import date instead of the actual voting date.
 * This script extracts the date from the title and updates the votingDate field.
 */
import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { config } from "dotenv";

config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

const MONTHS: Record<string, number> = {
  janvier: 0,
  février: 1,
  fevrier: 1,
  mars: 2,
  avril: 3,
  mai: 4,
  juin: 5,
  juillet: 6,
  août: 7,
  aout: 7,
  septembre: 8,
  octobre: 9,
  novembre: 10,
  décembre: 11,
  decembre: 11,
};

function parseDateFromTitle(title: string): Date | null {
  // Match "séance du 1 décembre 2024" or similar
  // Use [\wÀ-ÿ]+ to match French month names with accents (décembre, février, etc.)
  const match = title.match(/séance\s+du\s+(\d{1,2})\s+([\wÀ-ÿ]+)\s+(\d{4})/i);
  if (!match) return null;

  const day = parseInt(match[1]);
  const monthName = match[2].toLowerCase();
  const year = parseInt(match[3]);

  const month = MONTHS[monthName];
  if (month === undefined) {
    console.log(`  Unknown month: ${monthName}`);
    return null;
  }

  return new Date(year, month, day);
}

async function main() {
  console.log("🔧 Fixing Sénat scrutin dates...\n");

  // Find all Sénat scrutins
  const scrutins = await db.scrutin.findMany({
    where: { chamber: "SENAT" },
    select: { id: true, title: true, votingDate: true },
  });

  console.log(`Found ${scrutins.length} Sénat scrutins`);

  let fixed = 0;
  let alreadyCorrect = 0;
  let failed = 0;

  for (const scrutin of scrutins) {
    if (!scrutin.title) {
      failed++;
      continue;
    }

    const parsedDate = parseDateFromTitle(scrutin.title);
    if (!parsedDate) {
      console.log(`  ⚠️ Could not parse date from: ${scrutin.title}`);
      failed++;
      continue;
    }

    // Check if date needs fixing (compare dates ignoring time)
    const storedDateStr = scrutin.votingDate?.toISOString().split("T")[0];
    const parsedDateStr = parsedDate.toISOString().split("T")[0];

    if (storedDateStr === parsedDateStr) {
      alreadyCorrect++;
      continue;
    }

    // Update the date
    await db.scrutin.update({
      where: { id: scrutin.id },
      data: { votingDate: parsedDate },
    });

    console.log(
      `  ✅ Fixed: ${scrutin.title.substring(0, 50)}... (${storedDateStr} → ${parsedDateStr})`
    );
    fixed++;
  }

  console.log("\n📊 Summary:");
  console.log(`  Already correct: ${alreadyCorrect}`);
  console.log(`  Fixed: ${fixed}`);
  console.log(`  Failed to parse: ${failed}`);

  console.log("\n✅ Done!");
}

main()
  .catch(console.error)
  .finally(() => {
    db.$disconnect();
    pool.end();
  });
