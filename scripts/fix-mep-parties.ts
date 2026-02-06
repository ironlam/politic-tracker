/**
 * Fix MEP parties - Add missing party affiliations for European deputies
 */
import { PrismaClient, PoliticalPosition } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { config } from "dotenv";

config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🔧 Fixing MEP party affiliations...\n");

  // Check if Place Publique exists
  let placePublique = await prisma.party.findFirst({
    where: { name: { contains: "Place Publique", mode: "insensitive" } },
  });

  if (!placePublique) {
    console.log("Creating Place Publique party...");
    placePublique = await prisma.party.create({
      data: {
        id: "place-publique",
        name: "Place Publique",
        shortName: "PP",
        slug: "place-publique",
        color: "#FF7F00", // Orange
        politicalPosition: PoliticalPosition.LEFT,
      },
    });
    console.log("  ✅ Created Place Publique");
  } else {
    console.log("  ℹ️ Place Publique already exists:", placePublique.id);
  }

  // Check if Rassemblement National exists
  const rn = await prisma.party.findFirst({
    where: { shortName: "RN" },
  });
  console.log("  ℹ️ RN party:", rn ? rn.id : "NOT FOUND");

  // Find Raphaël Glucksmann
  const glucksmann = await prisma.politician.findFirst({
    where: { fullName: { contains: "Glucksmann" } },
  });

  if (glucksmann) {
    console.log(`\nUpdating Raphaël Glucksmann (${glucksmann.id})...`);

    // Update currentPartyId
    await prisma.politician.update({
      where: { id: glucksmann.id },
      data: { currentPartyId: placePublique.id },
    });

    // Check if party membership exists
    const existingMembership = await prisma.partyMembership.findFirst({
      where: {
        politicianId: glucksmann.id,
        partyId: placePublique.id,
      },
    });

    if (!existingMembership) {
      await prisma.partyMembership.create({
        data: {
          politicianId: glucksmann.id,
          partyId: placePublique.id,
          startDate: new Date("2018-11-01"), // PP created in 2018
        },
      });
      console.log("  ✅ Added party membership");
    } else {
      console.log("  ℹ️ Party membership already exists");
    }
  } else {
    console.log("  ⚠️ Raphaël Glucksmann not found");
  }

  // Find Julien Sanchez
  const sanchez = await prisma.politician.findFirst({
    where: { fullName: { contains: "Julien Sanchez", mode: "insensitive" } },
  });

  if (sanchez && rn) {
    console.log(`\nUpdating Julien Sanchez (${sanchez.id})...`);

    // Julien Sanchez is RN mayor/MEP
    await prisma.politician.update({
      where: { id: sanchez.id },
      data: { currentPartyId: rn.id },
    });

    const existingMembership = await prisma.partyMembership.findFirst({
      where: {
        politicianId: sanchez.id,
        partyId: rn.id,
      },
    });

    if (!existingMembership) {
      await prisma.partyMembership.create({
        data: {
          politicianId: sanchez.id,
          partyId: rn.id,
          startDate: new Date("2012-01-01"),
        },
      });
      console.log("  ✅ Added RN party membership");
    } else {
      console.log("  ℹ️ Party membership already exists");
    }
  } else if (sanchez) {
    console.log("  ⚠️ Julien Sanchez found but RN party not found");
  } else {
    console.log("  ⚠️ Julien Sanchez not found");
  }

  // Verify changes
  console.log("\n📊 Verification:");

  const glucksmannUpdated = await prisma.politician.findFirst({
    where: { fullName: { contains: "Glucksmann" } },
    include: { currentParty: true },
  });
  console.log(`  Glucksmann party: ${glucksmannUpdated?.currentParty?.shortName || "NONE"}`);

  const sanchezUpdated = await prisma.politician.findFirst({
    where: { fullName: { contains: "Julien Sanchez", mode: "insensitive" } },
    include: { currentParty: true },
  });
  console.log(`  Sanchez party: ${sanchezUpdated?.currentParty?.shortName || "NONE"}`);

  console.log("\n✅ Done!");
}

main()
  .catch(console.error)
  .finally(() => {
    prisma.$disconnect();
    pool.end();
  });
