/**
 * Seed script for upcoming French elections
 *
 * Idempotent: uses upsert on slug, safe to run multiple times.
 *
 * Usage:
 *   npx tsx scripts/seed-elections.ts
 */

import "dotenv/config";
import { db } from "../src/lib/db";
import type { ElectionType, ElectionScope, SuffrageType } from "../src/generated/prisma";

interface ElectionSeed {
  slug: string;
  type: ElectionType;
  title: string;
  shortTitle: string;
  scope: ElectionScope;
  round1Date: Date | null;
  round2Date: Date | null;
  dateConfirmed: boolean;
  totalSeats: number | null;
  suffrage: SuffrageType;
}

const ELECTIONS: ElectionSeed[] = [
  {
    slug: "municipales-2026",
    type: "MUNICIPALES",
    title: "Élections municipales de 2026",
    shortTitle: "Municipales 2026",
    scope: "MUNICIPAL",
    round1Date: new Date("2026-03-15"),
    round2Date: new Date("2026-03-22"),
    dateConfirmed: true,
    totalSeats: 460000,
    suffrage: "DIRECT",
  },
  {
    slug: "senatoriales-2026",
    type: "SENATORIALES",
    title: "Élections sénatoriales de 2026",
    shortTitle: "Sénatoriales 2026",
    scope: "NATIONAL",
    round1Date: new Date("2026-09-28"),
    round2Date: null,
    dateConfirmed: false,
    totalSeats: 178,
    suffrage: "INDIRECT",
  },
  {
    slug: "presidentielle-2027",
    type: "PRESIDENTIELLE",
    title: "Élection présidentielle de 2027",
    shortTitle: "Présidentielle 2027",
    scope: "NATIONAL",
    round1Date: new Date("2027-04-11"),
    round2Date: new Date("2027-04-25"),
    dateConfirmed: false,
    totalSeats: 1,
    suffrage: "DIRECT",
  },
  {
    slug: "legislatives-2029",
    type: "LEGISLATIVES",
    title: "Élections législatives de 2029",
    shortTitle: "Législatives 2029",
    scope: "NATIONAL",
    round1Date: null,
    round2Date: null,
    dateConfirmed: false,
    totalSeats: 577,
    suffrage: "DIRECT",
  },
  {
    slug: "departementales-2028",
    type: "DEPARTEMENTALES",
    title: "Élections départementales de 2028",
    shortTitle: "Départementales 2028",
    scope: "DEPARTMENTAL",
    round1Date: null,
    round2Date: null,
    dateConfirmed: false,
    totalSeats: 4056,
    suffrage: "DIRECT",
  },
  {
    slug: "regionales-2028",
    type: "REGIONALES",
    title: "Élections régionales de 2028",
    shortTitle: "Régionales 2028",
    scope: "REGIONAL",
    round1Date: null,
    round2Date: null,
    dateConfirmed: false,
    totalSeats: 1757,
    suffrage: "DIRECT",
  },
  {
    slug: "europeennes-2029",
    type: "EUROPEENNES",
    title: "Élections européennes de 2029",
    shortTitle: "Européennes 2029",
    scope: "EUROPEAN",
    round1Date: null,
    round2Date: null,
    dateConfirmed: false,
    totalSeats: 81,
    suffrage: "DIRECT",
  },
];

async function main() {
  console.log("=== Seed élections ===\n");

  let created = 0;
  let updated = 0;

  for (const election of ELECTIONS) {
    const result = await db.election.upsert({
      where: { slug: election.slug },
      create: {
        slug: election.slug,
        type: election.type,
        title: election.title,
        shortTitle: election.shortTitle,
        scope: election.scope,
        round1Date: election.round1Date,
        round2Date: election.round2Date,
        dateConfirmed: election.dateConfirmed,
        totalSeats: election.totalSeats,
        suffrage: election.suffrage,
      },
      update: {
        type: election.type,
        title: election.title,
        shortTitle: election.shortTitle,
        scope: election.scope,
        round1Date: election.round1Date,
        round2Date: election.round2Date,
        dateConfirmed: election.dateConfirmed,
        totalSeats: election.totalSeats,
        suffrage: election.suffrage,
      },
    });

    // Check if it was newly created (createdAt === updatedAt means just created)
    const isNew = result.createdAt.getTime() === result.updatedAt.getTime();
    if (isNew) {
      created++;
      console.log(`  + ${election.shortTitle} (créée)`);
    } else {
      updated++;
      console.log(`  ~ ${election.shortTitle} (mise à jour)`);
    }
  }

  console.log(`\nTerminé : ${created} créées, ${updated} mises à jour`);
}

main()
  .catch((error) => {
    console.error("Erreur:", error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
