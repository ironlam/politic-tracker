import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { config } from "dotenv";

config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

/**
 * Generate slug from text
 */
function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function main() {
  console.log("=== MIGRATION DES PARTIS ===\n");

  // 1. Generate SEO-friendly slugs for all parties (name-based)
  console.log("1. Migration des slugs (format SEO : nom complet)...");
  const allParties = await db.party.findMany();

  const usedSlugs = new Set<string>();
  let updated = 0;
  for (const party of allParties) {
    const baseSlug = generateSlug(party.name);
    let slug = baseSlug;
    let counter = 1;
    while (usedSlugs.has(slug)) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }
    usedSlugs.add(slug);

    if (party.slug !== slug) {
      await db.party.update({
        where: { id: party.id },
        data: { slug },
      });
      console.log(`   ${party.shortName}: ${party.slug || "(null)"} → ${slug}`);
      updated++;
    }
  }
  console.log(`   ✓ ${updated}/${allParties.length} slugs mis à jour\n`);

  // 2. Delete orphan parties (no politicians, no memberships, no affairs)
  console.log("2. Suppression des partis orphelins...");
  const orphans = await db.party.findMany({
    where: {
      AND: [
        { politicians: { none: {} } },
        { partyMemberships: { none: {} } },
        { affairsAtTime: { none: {} } },
      ],
    },
    select: { id: true, name: true, shortName: true },
  });

  // Delete orphans (external IDs will be cascade deleted)
  for (const orphan of orphans) {
    await db.party.delete({ where: { id: orphan.id } });
  }
  console.log(`   ✓ ${orphans.length} partis orphelins supprimés\n`);

  // 3. Merge FN into RN (transfer memberships, set predecessor)
  console.log("3. Fusion FN → RN...");
  const fn = await db.party.findFirst({
    where: { shortName: "FN" },
    include: { partyMemberships: true },
  });
  const rn = await db.party.findFirst({
    where: { shortName: "RN" },
  });

  if (fn && rn) {
    // Transfer all FN memberships to RN
    const transferred = await db.partyMembership.updateMany({
      where: { partyId: fn.id },
      data: { partyId: rn.id },
    });
    console.log(`   - ${transferred.count} adhésions transférées de FN vers RN`);

    // Set FN as predecessor of RN
    await db.party.update({
      where: { id: rn.id },
      data: { predecessorId: fn.id },
    });
    console.log(`   - FN défini comme prédécesseur de RN`);

    // Mark FN as dissolved (if not already)
    if (!fn.dissolvedDate) {
      await db.party.update({
        where: { id: fn.id },
        data: { dissolvedDate: new Date("2018-06-01") }, // RN renamed from FN
      });
    }
    console.log(`   ✓ Fusion FN → RN terminée\n`);
  } else {
    console.log(`   ⚠ FN ou RN non trouvé\n`);
  }

  // 4. Link LFI-NFP group to LFI party
  console.log("4. Liaison LFI-NFP → LFI...");
  const lfiNfp = await db.party.findFirst({
    where: { shortName: "LFI-NFP" },
  });
  const lfi = await db.party.findFirst({
    where: { shortName: "LFI" },
  });

  if (lfiNfp && lfi) {
    // Transfer current members from LFI group to LFI party (for currentPartyId)
    // Keep memberships separate as they represent different things

    // Set LFI as predecessor of LFI-NFP (parliamentary group derived from party)
    await db.party.update({
      where: { id: lfiNfp.id },
      data: {
        predecessorId: lfi.id,
        description: "Groupe parlementaire à l'Assemblée nationale (2024-)",
      },
    });
    console.log(`   ✓ LFI-NFP lié à LFI comme groupe parlementaire\n`);
  } else {
    console.log(`   ⚠ LFI-NFP ou LFI non trouvé\n`);
  }

  // 5. Link parliamentary groups to their parties where clear
  console.log("5. Liaison groupes parlementaires → partis...");

  const groupToParty = [
    { group: "ECOS", party: "EELV", desc: "Groupe parlementaire Écologiste et Social (2024-)" },
    { group: "SOC", party: "PS", desc: "Groupe parlementaire Socialistes et apparentés" },
    { group: "GDR", party: "PCF", desc: "Groupe parlementaire Gauche Démocrate et Républicaine" },
  ];

  for (const { group, party, desc } of groupToParty) {
    const groupParty = await db.party.findFirst({ where: { shortName: group } });
    const mainParty = await db.party.findFirst({ where: { shortName: party } });

    if (groupParty && mainParty && !groupParty.predecessorId) {
      await db.party.update({
        where: { id: groupParty.id },
        data: {
          predecessorId: mainParty.id,
          description: desc,
        },
      });
      console.log(`   - ${group} lié à ${party}`);
    }
  }
  console.log("");

  // 6. Set up historical party chains
  console.log("6. Chaînes historiques...");

  const chains = [
    { successor: "LR-hist", predecessor: "UMP" },
    { successor: "UMP", predecessor: "RPR" },
  ];

  for (const { successor, predecessor } of chains) {
    const succParty = await db.party.findFirst({ where: { shortName: successor } });
    const predParty = await db.party.findFirst({ where: { shortName: predecessor } });

    if (succParty && predParty && !succParty.predecessorId) {
      await db.party.update({
        where: { id: succParty.id },
        data: { predecessorId: predParty.id },
      });
      console.log(`   - ${predecessor} → ${successor}`);
    }
  }
  console.log("");

  // Final stats
  console.log("=== RÉSUMÉ ===");
  const totalParties = await db.party.count();
  const withPoliticians = await db.party.count({ where: { politicians: { some: {} } } });
  const withMemberships = await db.party.count({ where: { partyMemberships: { some: {} } } });
  const withPredecessor = await db.party.count({ where: { predecessorId: { not: null } } });

  console.log(`Total partis: ${totalParties}`);
  console.log(`Avec membres actuels: ${withPoliticians}`);
  console.log(`Avec historique: ${withMemberships}`);
  console.log(`Avec prédécesseur: ${withPredecessor}`);

  await pool.end();
}

main().catch(console.error);
