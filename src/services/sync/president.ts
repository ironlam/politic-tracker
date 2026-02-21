/**
 * Service to sync the current President of the Republic.
 * Extracted from scripts/sync-president.ts for Inngest compatibility.
 */

import { db } from "@/lib/db";
import { generateSlug } from "@/lib/utils";
import { MandateType, DataSource } from "@/generated/prisma";

// Emmanuel Macron's data (from official sources and Wikidata Q3052772)
const PRESIDENT_DATA = {
  firstName: "Emmanuel",
  lastName: "Macron",
  fullName: "Emmanuel Macron",
  civility: "M",
  birthDate: new Date("1977-12-21"),
  birthPlace: "Amiens (Somme)",
  wikidataId: "Q3052772",
  photoUrl:
    "https://www.elysee.fr/images/default/0001/14/66e6e3b6bbd98-emmanuel-macron-portrait-officiel-2024.jpg?v=2",
  partyShortName: "RE",
};

const MANDATE_DATA = {
  type: MandateType.PRESIDENT_REPUBLIQUE,
  title: "Président de la République française",
  institution: "Présidence de la République",
  startDate: new Date("2017-05-14"),
  endDate: null,
  isCurrent: true,
  source: DataSource.GOUVERNEMENT,
  sourceUrl: "https://www.elysee.fr/emmanuel-macron",
};

export interface PresidentSyncResult {
  created: number;
  updated: number;
  errors: string[];
}

async function findOrCreateParty(): Promise<string | null> {
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
    console.log("Creating Renaissance party...");
    party = await db.party.create({
      data: {
        name: "Renaissance",
        shortName: "RE",
        slug: "renaissance",
        color: "#FFCC00",
        description:
          "Parti politique français fondé en 2016 par Emmanuel Macron, initialement sous le nom de La République en marche (LREM).",
        foundedDate: new Date("2016-04-06"),
        ideology: "Libéralisme social, Progressisme, Pro-européanisme",
        website: "https://parti-renaissance.fr/",
      },
    });
    console.log(`Created party: ${party.name} (${party.shortName})`);
  }

  return party.id;
}

export async function syncPresident(): Promise<PresidentSyncResult> {
  const stats: PresidentSyncResult = { created: 0, updated: 0, errors: [] };

  try {
    const slug = generateSlug(`${PRESIDENT_DATA.firstName}-${PRESIDENT_DATA.lastName}`);
    const partyId = await findOrCreateParty();

    let politician = await db.politician.findUnique({
      where: { slug },
      include: { mandates: true },
    });

    if (!politician) {
      politician = await db.politician.findFirst({
        where: {
          firstName: {
            equals: PRESIDENT_DATA.firstName,
            mode: "insensitive",
          },
          lastName: {
            equals: PRESIDENT_DATA.lastName,
            mode: "insensitive",
          },
        },
        include: { mandates: true },
      });
    }

    if (politician) {
      console.log(`Found existing politician: ${politician.fullName}`);

      const existingMandate = politician.mandates.find(
        (m) => m.type === MandateType.PRESIDENT_REPUBLIQUE
      );

      if (existingMandate) {
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
        await db.mandate.create({
          data: {
            ...MANDATE_DATA,
            politicianId: politician.id,
          },
        });
      }

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

      stats.updated = 1;
      console.log(`Updated ${politician.fullName}`);
    } else {
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

      stats.created = 1;
      console.log(`Created ${politician.fullName}`);
    }

    // Upsert external IDs
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
  } catch (error) {
    stats.errors.push(String(error));
  }

  return stats;
}
