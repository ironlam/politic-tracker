/**
 * Seed staging database with realistic fixture data
 *
 * Usage:
 *   DATABASE_URL=... npx tsx scripts/seed-fixtures.ts
 *   npm run seed:fixtures  (with .env loaded)
 *
 * Options:
 *   --clean    Wipe all data before seeding (asks confirmation)
 *   --force    Skip confirmation prompt for --clean
 */

import { PrismaClient } from "@/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("❌ DATABASE_URL is required");
  process.exit(1);
}

// ============================================================================
// PRODUCTION SAFETY GUARD
// ============================================================================

if (process.env.NODE_ENV === "production") {
  console.error("❌ Refus d'exécuter les fixtures en NODE_ENV=production");
  process.exit(1);
}

function getDatabaseHost(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch {
    return url.slice(0, 50);
  }
}

const dbHost = getDatabaseHost(connectionString);

// Block known production hosts (configurable via env var, comma-separated)
const DEFAULT_BLOCKED_HOSTS = ["pooler.supabase.com"];
const BLOCKED_HOSTS = process.env.SEED_BLOCKED_HOSTS
  ? process.env.SEED_BLOCKED_HOSTS.split(",").map((h) => h.trim())
  : DEFAULT_BLOCKED_HOSTS;

if (BLOCKED_HOSTS.some((p) => dbHost.includes(p) && !dbHost.includes("staging"))) {
  console.error(`❌ Le host "${dbHost}" ressemble à la production. Abandon.`);
  console.error("   Configurez SEED_BLOCKED_HOSTS pour ajuster les hosts bloqués.");
  process.exit(1);
}

const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

const args = process.argv.slice(2);
const shouldClean = args.includes("--clean");
const force = args.includes("--force");

// ============================================================================
// FIXTURE DATA
// ============================================================================

const PARTIES = [
  {
    name: "Renaissance",
    shortName: "RE",
    slug: "renaissance",
    color: "#FFD600",
    politicalPosition: "CENTER" as const,
    ideology: "Libéralisme, Social-libéralisme, Progressisme",
    foundedDate: new Date("2016-04-06"),
    website: "https://parti-renaissance.fr",
  },
  {
    name: "Rassemblement National",
    shortName: "RN",
    slug: "rassemblement-national",
    color: "#0D378A",
    politicalPosition: "FAR_RIGHT" as const,
    ideology: "National-populisme, Souverainisme, Euroscepticisme",
    foundedDate: new Date("1972-10-05"),
    website: "https://rassemblementnational.fr",
  },
  {
    name: "La France Insoumise",
    shortName: "LFI",
    slug: "la-france-insoumise",
    color: "#CC2443",
    politicalPosition: "FAR_LEFT" as const,
    ideology: "Populisme de gauche, Écosocialisme, Altermondialisme",
    foundedDate: new Date("2016-02-10"),
    website: "https://lafranceinsoumise.fr",
  },
  {
    name: "Les Républicains",
    shortName: "LR",
    slug: "les-republicains",
    color: "#0066CC",
    politicalPosition: "RIGHT" as const,
    ideology: "Gaullisme, Conservatisme libéral",
    foundedDate: new Date("2015-05-30"),
    website: "https://republicains.fr",
  },
  {
    name: "Parti Socialiste",
    shortName: "PS",
    slug: "parti-socialiste",
    color: "#FF8080",
    politicalPosition: "LEFT" as const,
    ideology: "Social-démocratie, Socialisme démocratique",
    foundedDate: new Date("1969-07-04"),
    website: "https://parti-socialiste.fr",
  },
  {
    name: "Europe Écologie Les Verts",
    shortName: "EELV",
    slug: "europe-ecologie-les-verts",
    color: "#00C000",
    politicalPosition: "LEFT" as const,
    ideology: "Écologie politique, Social-écologie",
    foundedDate: new Date("2010-11-13"),
    website: "https://lesecologistes.fr",
  },
];

// Fictional politicians with realistic data
const POLITICIANS = [
  {
    firstName: "Marie",
    lastName: "Dupont",
    civility: "Mme",
    birthDate: new Date("1975-03-15"),
    birthPlace: "Lyon (Rhône)",
    partyShort: "RE",
    mandates: [
      {
        type: "DEPUTE" as const,
        title: "Députée de la 3ème circonscription du Rhône",
        institution: "Assemblée nationale",
        constituency: "Rhône (3ème)",
        departmentCode: "69",
        startDate: new Date("2022-06-19"),
        isCurrent: true,
      },
    ],
  },
  {
    firstName: "Jean",
    lastName: "Martin",
    civility: "M.",
    birthDate: new Date("1968-07-22"),
    birthPlace: "Marseille (Bouches-du-Rhône)",
    partyShort: "RN",
    mandates: [
      {
        type: "DEPUTE" as const,
        title: "Député de la 1ère circonscription des Bouches-du-Rhône",
        institution: "Assemblée nationale",
        constituency: "Bouches-du-Rhône (1ère)",
        departmentCode: "13",
        startDate: new Date("2022-06-19"),
        isCurrent: true,
      },
      {
        type: "CONSEILLER_REGIONAL" as const,
        title: "Conseiller régional de Provence-Alpes-Côte d'Azur",
        institution: "Conseil régional PACA",
        startDate: new Date("2015-12-13"),
        endDate: new Date("2022-06-19"),
        isCurrent: false,
      },
    ],
  },
  {
    firstName: "Sophie",
    lastName: "Bernard",
    civility: "Mme",
    birthDate: new Date("1982-11-08"),
    birthPlace: "Toulouse (Haute-Garonne)",
    partyShort: "LFI",
    mandates: [
      {
        type: "DEPUTE" as const,
        title: "Députée de la 2ème circonscription de Haute-Garonne",
        institution: "Assemblée nationale",
        constituency: "Haute-Garonne (2ème)",
        departmentCode: "31",
        startDate: new Date("2022-06-19"),
        isCurrent: true,
      },
    ],
  },
  {
    firstName: "Philippe",
    lastName: "Leclerc",
    civility: "M.",
    birthDate: new Date("1960-01-30"),
    birthPlace: "Paris",
    partyShort: "LR",
    mandates: [
      {
        type: "SENATEUR" as const,
        title: "Sénateur des Hauts-de-Seine",
        institution: "Sénat",
        constituency: "Hauts-de-Seine",
        departmentCode: "92",
        startDate: new Date("2020-09-27"),
        isCurrent: true,
      },
      {
        type: "MAIRE" as const,
        title: "Maire de Neuilly-sur-Seine",
        institution: "Mairie de Neuilly-sur-Seine",
        startDate: new Date("2014-03-30"),
        endDate: new Date("2020-06-28"),
        isCurrent: false,
      },
    ],
  },
  {
    firstName: "Aminata",
    lastName: "Diallo",
    civility: "Mme",
    birthDate: new Date("1988-05-12"),
    birthPlace: "Strasbourg (Bas-Rhin)",
    partyShort: "PS",
    mandates: [
      {
        type: "DEPUTE" as const,
        title: "Députée de la 1ère circonscription du Bas-Rhin",
        institution: "Assemblée nationale",
        constituency: "Bas-Rhin (1ère)",
        departmentCode: "67",
        startDate: new Date("2024-07-07"),
        isCurrent: true,
      },
    ],
  },
  {
    firstName: "Thomas",
    lastName: "Moreau",
    civility: "M.",
    birthDate: new Date("1979-09-03"),
    birthPlace: "Nantes (Loire-Atlantique)",
    partyShort: "EELV",
    mandates: [
      {
        type: "DEPUTE_EUROPEEN" as const,
        title: "Député européen",
        institution: "Parlement européen",
        startDate: new Date("2024-07-16"),
        isCurrent: true,
      },
    ],
  },
  {
    firstName: "Claire",
    lastName: "Rousseau",
    civility: "Mme",
    birthDate: new Date("1971-12-25"),
    birthPlace: "Bordeaux (Gironde)",
    partyShort: "RE",
    mandates: [
      {
        type: "MINISTRE" as const,
        title: "Ministre de la Transition écologique",
        institution: "Gouvernement",
        startDate: new Date("2024-09-21"),
        isCurrent: true,
      },
      {
        type: "DEPUTE" as const,
        title: "Députée de la 2ème circonscription de la Gironde",
        institution: "Assemblée nationale",
        constituency: "Gironde (2ème)",
        departmentCode: "33",
        startDate: new Date("2017-06-18"),
        endDate: new Date("2024-09-21"),
        isCurrent: false,
      },
    ],
  },
  {
    firstName: "Nicolas",
    lastName: "Petit",
    civility: "M.",
    birthDate: new Date("1985-04-18"),
    birthPlace: "Lille (Nord)",
    partyShort: "RN",
    mandates: [
      {
        type: "SENATEUR" as const,
        title: "Sénateur du Nord",
        institution: "Sénat",
        constituency: "Nord",
        departmentCode: "59",
        startDate: new Date("2023-09-24"),
        isCurrent: true,
      },
    ],
  },
];

const SCRUTINS = [
  {
    externalId: "VTANR5L17FIXTURE001",
    slug: "2025-01-15-projet-loi-finances-2025",
    title: "Scrutin sur l'ensemble du projet de loi de finances pour 2025",
    description:
      "Vote solennel sur le projet de loi de finances pour l'année 2025, incluant les mesures de réduction du déficit public.",
    votingDate: new Date("2025-01-15"),
    legislature: 17,
    chamber: "AN" as const,
    votesFor: 289,
    votesAgainst: 251,
    votesAbstain: 12,
    result: "ADOPTED" as const,
    theme: "ECONOMIE_BUDGET" as const,
    summary:
      "Le projet de loi de finances pour 2025 a été adopté avec une majorité relative. Il prévoit une réduction du déficit public à 4,5% du PIB et des mesures d'économies sur les dépenses de fonctionnement de l'État.",
  },
  {
    externalId: "VTANR5L17FIXTURE002",
    slug: "2025-02-03-motion-censure",
    title: "Scrutin sur la motion de censure déposée par le groupe LFI-NUPES",
    description:
      "Motion de censure déposée en réaction à l'utilisation de l'article 49.3 sur le projet de loi immigration.",
    votingDate: new Date("2025-02-03"),
    legislature: 17,
    chamber: "AN" as const,
    votesFor: 210,
    votesAgainst: 342,
    votesAbstain: 0,
    result: "REJECTED" as const,
    theme: "INSTITUTIONS" as const,
    summary:
      "La motion de censure n'a pas atteint la majorité absolue de 289 voix nécessaire. Les groupes RN et LR n'ont pas joint leurs voix à celles de la gauche.",
  },
  {
    externalId: "VTANR5L17FIXTURE003",
    slug: "2025-03-10-proposition-loi-climat",
    title:
      "Scrutin sur la proposition de loi relative à l'accélération de la transition énergétique",
    description:
      "Proposition de loi visant à interdire les nouvelles concessions d'énergies fossiles et accélérer le déploiement des énergies renouvelables.",
    votingDate: new Date("2025-03-10"),
    legislature: 17,
    chamber: "AN" as const,
    votesFor: 185,
    votesAgainst: 310,
    votesAbstain: 45,
    result: "REJECTED" as const,
    theme: "ENVIRONNEMENT_ENERGIE" as const,
    summary:
      "La proposition de loi écologiste a été rejetée malgré le soutien de la gauche. Les groupes RE, LR et RN ont voté contre, jugeant les mesures trop contraignantes pour l'économie.",
  },
];

const AFFAIRS = [
  {
    politicianLastName: "Leclerc",
    title: "Affaire des frais de représentation du Sénat",
    slug: "affaire-frais-representation-leclerc",
    description:
      "Philippe Leclerc est soupçonné d'avoir utilisé son indemnité représentative de frais de mandat (IRFM) pour des dépenses personnelles entre 2020 et 2023, pour un montant estimé à 45 000 euros.",
    status: "ENQUETE_PRELIMINAIRE" as const,
    category: "DETOURNEMENT_FONDS_PUBLICS" as const,
    startDate: new Date("2024-06-15"),
    sources: [
      {
        url: "https://example.com/fixture-article-1",
        title: "Un sénateur LR visé par une enquête sur ses frais de mandat",
        publisher: "Mediapart",
        publishedAt: new Date("2024-06-15"),
      },
    ],
  },
  {
    politicianLastName: "Martin",
    title: "Affaire du financement de la campagne législative 2022",
    slug: "affaire-financement-campagne-martin",
    description:
      "Jean Martin fait l'objet d'une information judiciaire pour des soupçons de financement irrégulier de sa campagne législative de 2022. Des versements en espèces non déclarés auraient été effectués.",
    status: "INSTRUCTION" as const,
    category: "FINANCEMENT_ILLEGAL_CAMPAGNE" as const,
    startDate: new Date("2023-11-20"),
    sources: [
      {
        url: "https://example.com/fixture-article-2",
        title: "Législatives 2022 : un député RN visé pour financement irrégulier",
        publisher: "Le Monde",
        publishedAt: new Date("2023-11-20"),
      },
    ],
  },
];

const DECLARATIONS = [
  {
    politicianLastName: "Leclerc",
    type: "PATRIMOINE_DEBUT_MANDAT" as const,
    year: 2020,
    realEstate: 850000,
    securities: 120000,
    bankAccounts: 45000,
    liabilities: 200000,
    totalNet: 815000,
    hatvpUrl: "https://example.com/fixture-hatvp-1",
  },
  {
    politicianLastName: "Dupont",
    type: "PATRIMOINE_DEBUT_MANDAT" as const,
    year: 2022,
    realEstate: 320000,
    securities: 15000,
    bankAccounts: 22000,
    liabilities: 180000,
    totalNet: 177000,
    hatvpUrl: "https://example.com/fixture-hatvp-2",
  },
  {
    politicianLastName: "Rousseau",
    type: "INTERETS" as const,
    year: 2024,
    hatvpUrl: "https://example.com/fixture-hatvp-3",
  },
];

// ============================================================================
// SEED LOGIC
// ============================================================================

async function confirmClean(): Promise<boolean> {
  if (force) return true;

  const readline = await import("readline");
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question("⚠️  --clean va SUPPRIMER toutes les données. Continuer ? (y/N) ", (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "y");
    });
  });
}

async function clean() {
  console.log("🗑️  Nettoyage de la base...");
  // Delete in dependency order
  await db.vote.deleteMany();
  await db.scrutin.deleteMany();
  await db.source.deleteMany();
  await db.affairEvent.deleteMany();
  await db.affair.deleteMany();
  await db.declaration.deleteMany();
  await db.pressArticleMention.deleteMany();
  await db.pressArticlePartyMention.deleteMany();
  await db.pressArticle.deleteMany();
  await db.factCheckMention.deleteMany();
  await db.factCheck.deleteMany();
  await db.candidacy.deleteMany();
  await db.electionRound.deleteMany();
  await db.election.deleteMany();
  await db.chatMessage.deleteMany();
  await db.chatConversation.deleteMany();
  await db.chatEmbedding.deleteMany();
  await db.amendment.deleteMany();
  await db.legislativeDossier.deleteMany();
  await db.mandate.deleteMany();
  await db.partyMembership.deleteMany();
  await db.externalId.deleteMany();
  await db.politician.deleteMany();
  await db.parliamentaryGroup.deleteMany();
  await db.europeanGroup.deleteMany();
  await db.party.deleteMany();
  await db.syncMetadata.deleteMany();
  await db.auditLog.deleteMany();
  await db.adminUser.deleteMany();
  console.log("✅ Base nettoyée");
}

function slugify(firstName: string, lastName: string): string {
  return `${firstName}-${lastName}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-");
}

async function seed() {
  console.log("🌱 Seeding fixtures...\n");

  // 1. Parties
  console.log("📌 Partis politiques...");
  const partyMap = new Map<string, string>();
  for (const p of PARTIES) {
    const party = await db.party.upsert({
      where: { shortName: p.shortName },
      update: {},
      create: p,
    });
    partyMap.set(p.shortName, party.id);
    console.log(`   ✓ ${p.shortName} — ${p.name}`);
  }

  // 2. Politicians + mandates + party memberships
  console.log("\n👤 Politiciens...");
  const politicianMap = new Map<string, string>();
  for (const pol of POLITICIANS) {
    const slug = slugify(pol.firstName, pol.lastName);
    const fullName = `${pol.firstName} ${pol.lastName}`;
    const partyId = partyMap.get(pol.partyShort)!;

    const politician = await db.politician.upsert({
      where: { slug },
      update: {},
      create: {
        slug,
        civility: pol.civility,
        firstName: pol.firstName,
        lastName: pol.lastName,
        fullName,
        birthDate: pol.birthDate,
        birthPlace: pol.birthPlace,
        currentPartyId: partyId,
      },
    });
    politicianMap.set(pol.lastName, politician.id);
    console.log(`   ✓ ${fullName} (${pol.partyShort})`);

    // Mandates
    for (const m of pol.mandates) {
      await db.mandate.create({
        data: {
          politicianId: politician.id,
          type: m.type,
          title: m.title,
          institution: m.institution,
          constituency: "constituency" in m ? m.constituency : undefined,
          departmentCode: "departmentCode" in m ? m.departmentCode : undefined,
          startDate: m.startDate,
          endDate: "endDate" in m ? m.endDate : undefined,
          isCurrent: m.isCurrent,
        },
      });
    }

    // Party membership
    await db.partyMembership.create({
      data: {
        politicianId: politician.id,
        partyId,
        startDate: pol.mandates[0].startDate,
        role: "MEMBER",
      },
    });
  }

  // 3. Scrutins + votes
  console.log("\n🗳️  Scrutins...");
  for (const s of SCRUTINS) {
    const scrutin = await db.scrutin.upsert({
      where: { externalId: s.externalId },
      update: {},
      create: {
        externalId: s.externalId,
        slug: s.slug,
        title: s.title,
        description: s.description,
        votingDate: s.votingDate,
        legislature: s.legislature,
        chamber: s.chamber,
        votesFor: s.votesFor,
        votesAgainst: s.votesAgainst,
        votesAbstain: s.votesAbstain,
        result: s.result,
        theme: s.theme,
        summary: s.summary,
      },
    });
    console.log(`   ✓ ${s.slug}`);

    // Generate votes for all deputies
    const deputies = POLITICIANS.filter((p) =>
      p.mandates.some((m) => m.type === "DEPUTE" && m.isCurrent && s.chamber === "AN")
    );
    const positions = ["POUR", "CONTRE", "ABSTENTION", "POUR", "CONTRE"] as const;
    for (let i = 0; i < deputies.length; i++) {
      const polId = politicianMap.get(deputies[i].lastName)!;
      await db.vote.create({
        data: {
          scrutinId: scrutin.id,
          politicianId: polId,
          position: positions[i % positions.length],
        },
      });
    }
  }

  // 4. Affairs
  console.log("\n⚖️  Affaires judiciaires...");
  for (const a of AFFAIRS) {
    const politicianId = politicianMap.get(a.politicianLastName)!;
    const affair = await db.affair.create({
      data: {
        politicianId,
        title: a.title,
        slug: a.slug,
        description: a.description,
        status: a.status,
        category: a.category,
        startDate: a.startDate,
        sources: {
          create: a.sources,
        },
      },
    });
    console.log(`   ✓ ${a.title}`);

    // Add timeline event
    await db.affairEvent.create({
      data: {
        affairId: affair.id,
        date: a.startDate,
        type: "REVELATION",
        title: "Révélation médiatique",
        sourceUrl: a.sources[0].url,
        sourceTitle: a.sources[0].title,
      },
    });
  }

  // 5. Declarations
  console.log("\n📋 Déclarations HATVP...");
  for (const d of DECLARATIONS) {
    const politicianId = politicianMap.get(d.politicianLastName)!;
    await db.declaration.upsert({
      where: {
        politicianId_type_year: {
          politicianId,
          type: d.type,
          year: d.year,
        },
      },
      update: {},
      create: {
        politicianId,
        type: d.type,
        year: d.year,
        realEstate: d.realEstate,
        securities: d.securities,
        bankAccounts: d.bankAccounts,
        liabilities: d.liabilities,
        totalNet: d.totalNet,
        hatvpUrl: d.hatvpUrl,
      },
    });
    console.log(`   ✓ ${d.politicianLastName} — ${d.type} ${d.year}`);
  }

  // 6. Admin user
  console.log("\n👑 Admin...");
  await db.adminUser.upsert({
    where: { email: "admin@poligraph.fr" },
    update: {},
    create: {
      email: "admin@poligraph.fr",
      name: "Admin Staging",
      role: "SUPER_ADMIN",
    },
  });
  console.log("   ✓ admin@poligraph.fr (SUPER_ADMIN)");

  // Summary
  const counts = {
    parties: await db.party.count(),
    politicians: await db.politician.count(),
    mandates: await db.mandate.count(),
    scrutins: await db.scrutin.count(),
    votes: await db.vote.count(),
    affairs: await db.affair.count(),
    declarations: await db.declaration.count(),
  };

  console.log("\n" + "=".repeat(50));
  console.log("📊 Résumé :");
  for (const [key, count] of Object.entries(counts)) {
    console.log(`   ${key}: ${count}`);
  }
  console.log("=".repeat(50));
  console.log("\n✅ Fixtures chargées avec succès !");
}

async function confirmTarget(): Promise<boolean> {
  if (force) return true;

  const readline = await import("readline");
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`🎯 Base cible : ${dbHost}\n   Continuer ? (y/N) `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "y");
    });
  });
}

async function main() {
  try {
    const confirmed = await confirmTarget();
    if (!confirmed) {
      console.log("Annulé.");
      process.exit(0);
    }

    if (shouldClean) {
      const cleanConfirmed = await confirmClean();
      if (!cleanConfirmed) {
        console.log("Annulé.");
        process.exit(0);
      }
      await clean();
    }

    await seed();
  } catch (error) {
    console.error("❌ Erreur:", error);
    process.exit(1);
  } finally {
    await db.$disconnect();
    await pool.end();
  }
}

main();
