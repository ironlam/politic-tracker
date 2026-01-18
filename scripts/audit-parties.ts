import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { config } from "dotenv";

config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

async function audit() {
  // Get all parties with stats
  const parties = await db.party.findMany({
    include: {
      _count: {
        select: {
          politicians: true,
          partyMemberships: true,
          affairsAtTime: true,
        },
      },
      externalIds: true,
    },
    orderBy: { name: "asc" },
  });

  console.log("=== AUDIT DES PARTIS ===\n");
  console.log(`Total: ${parties.length} partis\n`);

  // Group by similar names (lowercase, no accents)
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "");

  const groups = new Map<string, typeof parties>();

  for (const p of parties) {
    const key = normalize(p.name);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(p);
  }

  // Find exact duplicates
  const duplicates = [...groups.entries()].filter(([_, v]) => v.length > 1);
  if (duplicates.length > 0) {
    console.log("=== DOUBLONS EXACTS ===");
    for (const [key, ps] of duplicates) {
      console.log(`\n"${ps[0].name}":`);
      for (const p of ps) {
        console.log(
          `  - ID: ${p.id}, shortName: ${p.shortName}, membres: ${p._count.politicians}, adhésions: ${p._count.partyMemberships}`
        );
      }
    }
    console.log("");
  }

  // Find similar names (potential duplicates)
  console.log("=== PARTIS SIMILAIRES (à vérifier) ===\n");

  // Known party evolutions
  const evolutions = [
    ["RN", "FN", "Front national", "Rassemblement national"],
    [
      "LR",
      "UMP",
      "RPR",
      "Les Républicains",
      "Union pour un mouvement populaire",
      "Rassemblement pour la République",
    ],
    ["PS", "SOC", "Parti socialiste", "Socialistes"],
    ["PCF", "Parti communiste", "Communiste"],
    ["EELV", "Verts", "Écologiste", "Europe Écologie"],
    ["MoDem", "Mouvement démocrate", "UDF"],
    ["Renaissance", "LREM", "En Marche", "République en Marche"],
    ["LFI", "France insoumise", "Insoumise"],
    ["Horizons", "HOR"],
    ["Radical", "PRG", "Parti radical"],
  ];

  for (const group of evolutions) {
    const matches = parties.filter((p) =>
      group.some(
        (term) =>
          p.name.toLowerCase().includes(term.toLowerCase()) ||
          (p.shortName && p.shortName.toLowerCase().includes(term.toLowerCase()))
      )
    );
    if (matches.length > 1) {
      console.log(`Famille "${group[0]}":`);
      for (const p of matches) {
        const wikidataId =
          p.externalIds.find((e) => e.source === "WIKIDATA")?.externalId || "-";
        console.log(
          `  - "${p.name}" (${p.shortName || "?"}) | membres: ${p._count.politicians} | adhésions: ${p._count.partyMemberships} | wikidata: ${wikidataId}`
        );
      }
      console.log("");
    }
  }

  // Parties with 0 members and 0 memberships (orphans)
  const orphans = parties.filter(
    (p) =>
      p._count.politicians === 0 &&
      p._count.partyMemberships === 0 &&
      p._count.affairsAtTime === 0
  );

  if (orphans.length > 0) {
    console.log(`=== PARTIS ORPHELINS (${orphans.length}) ===`);
    console.log("(aucun membre actuel, aucune adhésion, aucune affaire)\n");
    for (const p of orphans.slice(0, 30)) {
      console.log(`  - "${p.name}" (${p.shortName || "?"})`);
    }
    if (orphans.length > 30) console.log(`  ... et ${orphans.length - 30} autres`);
    console.log("");
  }

  // Stats summary
  const withMembers = parties.filter((p) => p._count.politicians > 0);
  const withHistory = parties.filter((p) => p._count.partyMemberships > 0);
  const withAffairs = parties.filter((p) => p._count.affairsAtTime > 0);

  console.log("=== RÉSUMÉ ===");
  console.log(`Partis avec membres actuels: ${withMembers.length}`);
  console.log(`Partis avec historique d'adhésion: ${withHistory.length}`);
  console.log(`Partis liés à des affaires: ${withAffairs.length}`);
  console.log(`Partis orphelins: ${orphans.length}`);

  await pool.end();
}

audit().catch(console.error);
