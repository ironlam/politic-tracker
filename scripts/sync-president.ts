/**
 * Script to sync the current President of the Republic
 *
 * Usage:
 *   npx tsx scripts/sync-president.ts
 */

import "dotenv/config";
import { db } from "../src/lib/db";
import { generateSlug } from "../src/lib/utils";
import { MandateType, DataSource } from "../src/generated/prisma";

// Emmanuel Macron's data (from official sources and Wikidata Q3052772)
const PRESIDENT_DATA = {
  firstName: "Emmanuel",
  lastName: "Macron",
  fullName: "Emmanuel Macron",
  civility: "M",
  birthDate: new Date("1977-12-21"),
  birthPlace: "Amiens (Somme)",
  wikidataId: "Q3052772",
  photoUrl: "https://www.elysee.fr/images/default/0001/14/66e6e3b6bbd98-emmanuel-macron-portrait-officiel-2024.jpg?v=2",
  partyShortName: "RE", // Renaissance
};

const MANDATE_DATA = {
  type: MandateType.PRESIDENT_REPUBLIQUE,
  title: "Président de la République française",
  institution: "Présidence de la République",
  startDate: new Date("2017-05-14"),
  endDate: null, // Still in office
  isCurrent: true,
  sourceUrl: "https://www.elysee.fr/emmanuel-macron",
};

async function findOrCreateParty(): Promise<string | null> {
  // Try to find Renaissance party
  let party = await db.party.findFirst({
    where: {
      OR: [
        { shortName: "RE" },
        { shortName: "REN" },
        { name: { contains: "Renaissance", mode: "insensitive" } },
      ],
    },
  });

  if (!party) {
    // Try La République En Marche
    party = await db.party.findFirst({
      where: {
        OR: [
          { shortName: "LREM" },
          { shortName: "REM" },
          { name: { contains: "Marche", mode: "insensitive" } },
        ],
      },
    });
  }

  if (!party) {
    // Create Renaissance party
    console.log("Creating Renaissance party...");
    party = await db.party.create({
      data: {
        name: "Renaissance",
        shortName: "RE",
        slug: "renaissance",
        color: "#FFCC00", // Yellow (Macron's campaign color)
        description: "Parti politique français fondé en 2016 par Emmanuel Macron, initialement sous le nom de La République en marche (LREM).",
        foundedDate: new Date("2016-04-06"),
        ideology: "Libéralisme social, Progressisme, Pro-européanisme",
        website: "https://parti-renaissance.fr/",
      },
    });
    console.log(`Created party: ${party.name} (${party.shortName})`);
  }

  return party.id;
}

async function syncPresident(): Promise<void> {
  console.log("=".repeat(50));
  console.log("Politic Tracker - President Sync");
  console.log("=".repeat(50));
  console.log(`Started at: ${new Date().toISOString()}\n`);

  const slug = generateSlug(`${PRESIDENT_DATA.firstName}-${PRESIDENT_DATA.lastName}`);

  // Find or create party
  const partyId = await findOrCreateParty();

  // Check if president already exists
  let politician = await db.politician.findUnique({
    where: { slug },
    include: { mandates: true },
  });

  if (!politician) {
    // Also try by name
    politician = await db.politician.findFirst({
      where: {
        firstName: { equals: PRESIDENT_DATA.firstName, mode: "insensitive" as const },
        lastName: { equals: PRESIDENT_DATA.lastName, mode: "insensitive" as const },
      },
      include: { mandates: true },
    });
  }

  if (politician) {
    console.log(`Found existing politician: ${politician.fullName} (${politician.slug})`);

    // Check if president mandate exists
    const existingMandate = politician.mandates.find(
      (m) => m.type === MandateType.PRESIDENT_REPUBLIQUE
    );

    if (existingMandate) {
      console.log("President mandate already exists, updating...");
      await db.mandate.update({
        where: { id: existingMandate.id },
        data: {
          title: MANDATE_DATA.title,
          institution: MANDATE_DATA.institution,
          startDate: MANDATE_DATA.startDate,
          endDate: MANDATE_DATA.endDate,
          isCurrent: MANDATE_DATA.isCurrent,
          sourceUrl: MANDATE_DATA.sourceUrl,
        },
      });
    } else {
      console.log("Creating president mandate...");
      await db.mandate.create({
        data: {
          ...MANDATE_DATA,
          politicianId: politician.id,
        },
      });
    }

    // Update politician data
    await db.politician.update({
      where: { id: politician.id },
      data: {
        civility: PRESIDENT_DATA.civility,
        birthDate: PRESIDENT_DATA.birthDate,
        birthPlace: PRESIDENT_DATA.birthPlace,
        photoUrl: PRESIDENT_DATA.photoUrl,
        photoSource: "elysee",
        currentPartyId: partyId,
      },
    });

    console.log("Politician data updated.");
  } else {
    console.log("Creating new politician: Emmanuel Macron");

    politician = await db.politician.create({
      data: {
        slug,
        firstName: PRESIDENT_DATA.firstName,
        lastName: PRESIDENT_DATA.lastName,
        fullName: PRESIDENT_DATA.fullName,
        civility: PRESIDENT_DATA.civility,
        birthDate: PRESIDENT_DATA.birthDate,
        birthPlace: PRESIDENT_DATA.birthPlace,
        photoUrl: PRESIDENT_DATA.photoUrl,
        photoSource: "elysee",
        currentPartyId: partyId,
        mandates: {
          create: MANDATE_DATA,
        },
      },
      include: { mandates: true },
    });

    console.log(`Created politician with ID: ${politician.id}`);
  }

  // Upsert Wikidata external ID
  await db.externalId.upsert({
    where: {
      source_externalId: {
        source: DataSource.WIKIDATA,
        externalId: PRESIDENT_DATA.wikidataId,
      },
    },
    create: {
      politicianId: politician.id,
      source: DataSource.WIKIDATA,
      externalId: PRESIDENT_DATA.wikidataId,
      url: `https://www.wikidata.org/wiki/${PRESIDENT_DATA.wikidataId}`,
    },
    update: {
      politicianId: politician.id,
    },
  });

  // Upsert Elysee external ID
  await db.externalId.upsert({
    where: {
      source_externalId: {
        source: DataSource.MANUAL,
        externalId: "president-macron",
      },
    },
    create: {
      politicianId: politician.id,
      source: DataSource.MANUAL,
      externalId: "president-macron",
      url: "https://www.elysee.fr/emmanuel-macron",
    },
    update: {
      politicianId: politician.id,
    },
  });

  console.log("\n" + "=".repeat(50));
  console.log("Sync completed successfully!");
  console.log("=".repeat(50));
}

syncPresident()
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
    process.exit(0);
  });
