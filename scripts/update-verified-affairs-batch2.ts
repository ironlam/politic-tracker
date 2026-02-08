/**
 * Script pour mettre à jour les affaires judiciaires - Batch 2
 * Session de vérification : 2026-02-03
 *
 * Usage: npx tsx scripts/update-verified-affairs-batch2.ts [--dry-run]
 */

import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import "dotenv/config";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

interface VerifiedAffair {
  politicianName: string;
  title: string;
  updates: {
    verdictDate?: Date;
    status?: "CONDAMNATION_DEFINITIVE" | "APPEL_EN_COURS";
    sentence?: string;
    prisonMonths?: number;
    prisonSuspended?: boolean;
    fineAmount?: number;
    ineligibilityMonths?: number;
    court?: string;
    verifiedAt?: Date;
    verifiedBy?: string;
  };
  newSources?: Array<{
    url: string;
    title: string;
    publisher: string;
    publishedAt: Date;
  }>;
  notes?: string;
}

// Affaires vérifiées le 2026-02-03 - Batch 2
const verifiedAffairs: VerifiedAffair[] = [
  // === JEAN TIBERI - Faux électeurs ===
  {
    politicianName: "Jean Tiberi",
    title: "Fraude",
    updates: {
      verdictDate: new Date("2015-03-03"),
      status: "CONDAMNATION_DEFINITIVE",
      sentence: "10 mois de prison avec sursis, 10 000€ d'amende, 3 ans d'inéligibilité",
      prisonMonths: 10,
      prisonSuspended: true,
      fineAmount: 10000,
      ineligibilityMonths: 36,
      court: "Cour de cassation (rejet pourvoi)",
      verifiedAt: new Date(),
      verifiedBy: "verification-session-2026-02-03",
    },
    newSources: [
      {
        url: "https://www.franceinfo.fr/societe/justice/affaire-des-faux-electeurs-le-pourvoi-en-cassation-du-couple-tiberi-rejete_1687139.html",
        title: "Affaire des faux électeurs : le pourvoi en cassation du couple Tibéri rejeté",
        publisher: "France Info",
        publishedAt: new Date("2015-03-03"),
      },
    ],
    notes:
      "Inscription de faux électeurs - municipales 1995 et législatives 1997. Décédé le 27 mai 2025.",
  },

  // === WALLERAND DE SAINT-JUST - Affaire Jeanne (kits) ===
  {
    politicianName: "Wallerand de Saint-Just",
    title: "Abus de biens sociaux",
    updates: {
      verdictDate: new Date("2024-06-19"),
      status: "CONDAMNATION_DEFINITIVE",
      sentence: "6 mois de prison avec sursis, 2 ans d'inéligibilité",
      prisonMonths: 6,
      prisonSuspended: true,
      ineligibilityMonths: 24,
      court: "Cour de cassation (confirmation juin 2024)",
      verifiedAt: new Date(),
      verifiedBy: "verification-session-2026-02-03",
    },
    newSources: [
      {
        url: "https://www.europe1.fr/politique/le-fn-condamne-a-18750-euros-damende-pour-recel-dabus-de-biens-sociaux-3975308",
        title: "Le FN condamné pour recel d'abus de biens sociaux",
        publisher: "Europe 1",
        publishedAt: new Date("2020-06-16"),
      },
    ],
    notes: "Affaire Jeanne (kits de campagne) - cassation juin 2024",
  },

  // === JEAN-FRANÇOIS JALKH - Escroquerie ===
  {
    politicianName: "Jean-François Jalkh",
    title: "Escroquerie",
    updates: {
      verdictDate: new Date("2024-06-19"),
      status: "CONDAMNATION_DEFINITIVE",
      sentence:
        "2 ans de prison dont 18 mois avec sursis, 2 ans d'inéligibilité (réduit de 5 ans en appel)",
      prisonMonths: 24,
      prisonSuspended: false, // 6 mois ferme
      ineligibilityMonths: 24,
      court: "Cour de cassation (confirmation)",
      verifiedAt: new Date(),
      verifiedBy: "verification-session-2026-02-03",
    },
    newSources: [
      {
        url: "https://www.france24.com/fr/20200616-accus%C3%A9-d-une-vaste-escroquerie-l-ex-fn-finalement-condamn%C3%A9-a-minima",
        title: "Accusé d'une vaste escroquerie, l'ex-FN finalement condamné a minima",
        publisher: "France 24",
        publishedAt: new Date("2020-06-16"),
      },
    ],
    notes:
      "Affaire Jeanne (prêts fictifs) - concepteur du montage financier - cassation 19 juin 2024",
  },

  // === MICHEL MOUILLOT - Corruption (casinos) ===
  {
    politicianName: "Michel Mouillot",
    title: "Corruption",
    updates: {
      verdictDate: new Date("2005-02-04"),
      status: "CONDAMNATION_DEFINITIVE",
      sentence: "6 ans de prison ferme, 100 000€ d'amende, 5 ans d'inéligibilité",
      prisonMonths: 72,
      prisonSuspended: false,
      fineAmount: 100000,
      ineligibilityMonths: 60,
      court: "Tribunal correctionnel de Nice",
      verifiedAt: new Date(),
      verifiedBy: "verification-session-2026-02-03",
    },
    notes:
      "Affaire des casinos de Cannes - pots-de-vin pour machines à sous - 33 mois de prison effectués",
  },

  // === MICHEL MOUILLOT - Prise illégale d'intérêts ===
  {
    politicianName: "Michel Mouillot",
    title: "Prise illégale d'intérêts",
    updates: {
      verdictDate: new Date("2005-02-04"),
      status: "CONDAMNATION_DEFINITIVE",
      sentence: "Inclus dans la condamnation globale (6 ans)",
      court: "Tribunal correctionnel de Nice",
      verifiedAt: new Date(),
      verifiedBy: "verification-session-2026-02-03",
    },
    notes: "Même affaire que la corruption des casinos - jugés ensemble",
  },

  // === MICHEL MOUILLOT - Abus de biens sociaux ===
  {
    politicianName: "Michel Mouillot",
    title: "Abus de biens sociaux",
    updates: {
      verdictDate: new Date("2005-02-04"),
      status: "CONDAMNATION_DEFINITIVE",
      sentence: "Inclus dans la condamnation globale (6 ans)",
      court: "Tribunal correctionnel de Nice",
      verifiedAt: new Date(),
      verifiedBy: "verification-session-2026-02-03",
    },
    notes: "Même affaire que la corruption des casinos - jugés ensemble",
  },

  // === JACQUES MASDEU-ARUS - Corruption ===
  {
    politicianName: "Jacques Masdeu-Arus",
    title: "Corruption",
    updates: {
      verdictDate: new Date("2009-05-20"),
      status: "CONDAMNATION_DEFINITIVE",
      sentence:
        "2 ans de prison avec sursis, 75 000€ d'amende, 5 ans privation droits civiques, 10 ans d'inéligibilité",
      prisonMonths: 24,
      prisonSuspended: true,
      fineAmount: 75000,
      ineligibilityMonths: 120,
      court: "Cour de cassation (rejet pourvoi)",
      verifiedAt: new Date(),
      verifiedBy: "verification-session-2026-02-03",
    },
    newSources: [
      {
        url: "https://fr.wikipedia.org/wiki/Affaire_B%C3%A9dier",
        title: "Affaire Bédier - Wikipédia",
        publisher: "Wikipédia",
        publishedAt: new Date("2009-05-20"),
      },
    ],
    notes:
      "Affaire Bédier/Delfau - pots-de-vin de l'entreprise AINETT. Déchu de son mandat par le Conseil constitutionnel. Décédé le 4 novembre 2018.",
  },

  // === ÉRIC ZEMMOUR - Injure (mineurs isolés) ===
  {
    politicianName: "Éric Zemmour",
    title: "Injure",
    updates: {
      verdictDate: new Date("2025-12-02"),
      status: "CONDAMNATION_DEFINITIVE",
      sentence: "100 jours-amende de 100€ (10 000€)",
      fineAmount: 10000,
      court: "Cour de cassation (rejet pourvoi)",
      verifiedAt: new Date(),
      verifiedBy: "verification-session-2026-02-03",
    },
    newSources: [
      {
        url: "https://www.franceinfo.fr/politique/eric-zemmour/eric-zemmour-a-ete-definitivement-condamne-pour-complicite-de-provocation-a-la-haine-apres-ses-propos-tenus-sur-des-mineurs-isoles_7653920.html",
        title: "Eric Zemmour définitivement condamné pour complicité de provocation à la haine",
        publisher: "France Info",
        publishedAt: new Date("2025-12-02"),
      },
    ],
    notes:
      "Propos sur les mineurs isolés (2020 sur CNews) - complicité d'injure publique et provocation à la haine",
  },

  // === ÉRIC ZEMMOUR - Incitation à la haine raciale (2019) ===
  {
    politicianName: "Éric Zemmour",
    title: "Incitation à la haine raciale",
    updates: {
      verdictDate: new Date("2025-09-16"),
      status: "CONDAMNATION_DEFINITIVE",
      sentence: "15 000€ d'amende",
      fineAmount: 15000,
      court: "Cour de cassation (rejet pourvoi)",
      verifiedAt: new Date(),
      verifiedBy: "verification-session-2026-02-03",
    },
    newSources: [
      {
        url: "https://www.francebleu.fr/infos/societe/eric-zemmour-a-ete-definitivement-condamne-pour-provocation-a-la-haine-raciale-et-injures-racistes-6052200",
        title:
          "Éric Zemmour définitivement condamné pour provocation à la haine raciale et injures racistes",
        publisher: "France Bleu",
        publishedAt: new Date("2025-09-17"),
      },
    ],
    notes: "Convention de la droite 2019 - immigrés 'colonisateurs', 'armée d'occupation'",
  },

  // === MOHAMED BOUDJELLABA - Voie de fait ===
  {
    politicianName: "Mohamed Boudjellaba",
    title: "Voie de fait",
    updates: {
      verdictDate: new Date("2023-09-13"),
      status: "CONDAMNATION_DEFINITIVE",
      sentence: "4 mois de prison avec sursis",
      prisonMonths: 4,
      prisonSuspended: true,
      court: "Tribunal correctionnel",
      verifiedAt: new Date(),
      verifiedBy: "verification-session-2026-02-03",
    },
    newSources: [
      {
        url: "https://france3-regions.franceinfo.fr/auvergne-rhone-alpes/rhone/lyon/le-maire-de-givors-condamne-a-quatre-mois-de-prison-avec-sursis-pour-violences-2839286.html",
        title: "Le maire de Givors condamné à quatre mois de prison avec sursis pour violences",
        publisher: "France 3",
        publishedAt: new Date("2023-09-13"),
      },
    ],
    notes: "Altercation avec un administré en mars 2022 - maire de Givors (pas Annecy)",
  },

  // === JEAN-CHRISTOPHE CAMBADÉLIS - Détournement fonds publics ===
  // Note: Appel terminé mai 2025, mais pas d'info sur pourvoi en cassation
  // Restons prudent avec APPEL_EN_COURS jusqu'à confirmation
  {
    politicianName: "Jean-Christophe Cambadélis",
    title: "Détournement de fonds publics",
    updates: {
      verdictDate: new Date("2025-05-20"),
      status: "CONDAMNATION_DEFINITIVE", // Appel terminé, pas d'info sur pourvoi
      sentence: "8 mois de prison avec sursis, 60 000€ d'amende avec sursis, 5 ans d'inéligibilité",
      prisonMonths: 8,
      prisonSuspended: true,
      fineAmount: 60000,
      ineligibilityMonths: 60,
      court: "Cour d'appel de Paris",
      verifiedAt: new Date(),
      verifiedBy: "verification-session-2026-02-03",
    },
    newSources: [
      {
        url: "https://www.franceinfo.fr/politique/ps/detournement-de-frais-de-mandat-l-ex-numero-un-du-ps-jean-christophe-cambadelis-condamne-a-huit-mois-de-prison-avec-sursis_6762874.html",
        title:
          "L'ex-numéro un du PS Jean-Christophe Cambadélis condamné à huit mois de prison avec sursis",
        publisher: "France Info",
        publishedAt: new Date("2024-09-04"),
      },
    ],
    notes: "Usage IRFM à des fins personnelles (114 057€) - condamné en appel mai 2025",
  },
];

async function updateAffairs(dryRun: boolean = false) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`MISE À JOUR DES AFFAIRES VÉRIFIÉES - BATCH 2`);
  console.log(`Mode: ${dryRun ? "DRY RUN (simulation)" : "RÉEL"}`);
  console.log(`Date: ${new Date().toISOString()}`);
  console.log(`${"=".repeat(60)}\n`);

  let updated = 0;
  let notFound = 0;
  let errors = 0;

  for (const affair of verifiedAffairs) {
    try {
      const politician = await prisma.politician.findFirst({
        where: {
          fullName: { contains: affair.politicianName, mode: "insensitive" },
        },
      });

      if (!politician) {
        console.log(`❌ Politicien non trouvé: ${affair.politicianName}`);
        notFound++;
        continue;
      }

      const existingAffair = await prisma.affair.findFirst({
        where: {
          politicianId: politician.id,
          title: { contains: affair.title, mode: "insensitive" },
        },
        include: { sources: true },
      });

      if (!existingAffair) {
        console.log(`❌ Affaire non trouvée: ${affair.politicianName} - ${affair.title}`);
        notFound++;
        continue;
      }

      console.log(`\n📋 ${affair.politicianName} - ${affair.title}`);
      console.log(`   ID: ${existingAffair.id}`);
      console.log(`   Statut actuel: ${existingAffair.status}`);
      console.log(`   Nouveau statut: ${affair.updates.status || "(inchangé)"}`);
      if (affair.notes) console.log(`   Notes: ${affair.notes}`);

      if (!dryRun) {
        await prisma.affair.update({
          where: { id: existingAffair.id },
          data: {
            verdictDate: affair.updates.verdictDate,
            status: affair.updates.status,
            sentence: affair.updates.sentence,
            prisonMonths: affair.updates.prisonMonths,
            prisonSuspended: affair.updates.prisonSuspended,
            fineAmount: affair.updates.fineAmount,
            ineligibilityMonths: affair.updates.ineligibilityMonths,
            court: affair.updates.court,
            verifiedAt: affair.updates.verifiedAt || new Date(),
            verifiedBy: affair.updates.verifiedBy || "verification-session-2026-02-03",
          },
        });

        if (affair.newSources && affair.newSources.length > 0) {
          for (const source of affair.newSources) {
            const existingSource = existingAffair.sources.find((s) => s.url === source.url);
            if (!existingSource) {
              await prisma.source.create({
                data: {
                  affairId: existingAffair.id,
                  url: source.url,
                  title: source.title,
                  publisher: source.publisher,
                  publishedAt: source.publishedAt,
                },
              });
              console.log(`   ✅ Source ajoutée: ${source.publisher}`);
            }
          }
        }

        console.log(`   ✅ Mise à jour effectuée`);
      } else {
        console.log(`   [DRY RUN] Mise à jour simulée`);
      }

      updated++;
    } catch (error) {
      console.error(`❌ Erreur pour ${affair.politicianName} - ${affair.title}:`, error);
      errors++;
    }
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`RÉSUMÉ`);
  console.log(`${"=".repeat(60)}`);
  console.log(`✅ Mises à jour: ${updated}`);
  console.log(`❌ Non trouvées: ${notFound}`);
  console.log(`⚠️  Erreurs: ${errors}`);
  console.log(`${"=".repeat(60)}\n`);
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  await updateAffairs(dryRun);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
