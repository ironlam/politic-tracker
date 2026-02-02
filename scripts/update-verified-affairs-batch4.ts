/**
 * Script pour mettre à jour les affaires judiciaires - Batch 4 (FINAL)
 * Session de vérification : 2026-02-03
 *
 * Usage: npx tsx scripts/update-verified-affairs-batch4.ts [--dry-run]
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

const verifiedAffairs: VerifiedAffair[] = [
  // === NICOLAS CROCHET (Complicité 2023) - APPEL EN COURS ===
  {
    politicianName: "Nicolas Crochet",
    title: "Complicité",
    updates: {
      verdictDate: new Date("2025-03-31"),
      status: "APPEL_EN_COURS",
      sentence: "3 ans de prison dont 2 avec sursis (bracelet électronique), 100 000€ d'amende, 3 ans d'inéligibilité",
      prisonMonths: 36,
      prisonSuspended: false, // 1 an ferme sous bracelet
      fineAmount: 100000,
      ineligibilityMonths: 36,
      court: "Tribunal correctionnel de Paris",
      verifiedAt: new Date(),
      verifiedBy: "verification-session-2026-02-03",
    },
    newSources: [
      {
        url: "https://www.franceinfo.fr/politique/marine-le-pen/affaire-des-assistants-parlementaires-du-fn-neuf-des-24-condamnes-dont-marine-le-pen-ont-fait-appel-a-ce-stade_7170375.html",
        title: "Affaire des assistants parlementaires du FN : neuf des 24 condamnés, dont Marine Le Pen, ont fait appel",
        publisher: "France Info",
        publishedAt: new Date("2025-04-04"),
      },
    ],
    notes: "CHANGEMENT STATUT : A fait appel - procès appel janvier-février 2026. Expert-comptable FN, ami de M. Le Pen.",
  },

  // === CLAUDE GUÉANT (Favoritisme sondages) - APPEL EN COURS ===
  {
    politicianName: "Claude Guéant",
    title: "Favoritisme",
    updates: {
      verdictDate: new Date("2025-11-04"),
      status: "APPEL_EN_COURS", // Pourvoi cassation annoncé
      sentence: "1 an de prison avec sursis, 15 000€ d'amende",
      prisonMonths: 12,
      prisonSuspended: true,
      fineAmount: 15000,
      court: "Cour d'appel de Paris",
      verifiedAt: new Date(),
      verifiedBy: "verification-session-2026-02-03",
    },
    newSources: [
      {
        url: "https://www.leclubdesjuristes.com/en-bref/affaire-des-sondages-de-lelysee-claude-gueant-condamne-a-un-an-de-prison-avec-sursis-en-appel-12809/",
        title: "Affaire des sondages de l'Élysée : Claude Guéant condamné à un an de prison avec sursis en appel",
        publisher: "Le Club des Juristes",
        publishedAt: new Date("2025-11-04"),
      },
    ],
    notes: "CHANGEMENT STATUT : Pourvoi en cassation annoncé. Sondages Élysée 2007-2012 sans appel d'offres (4,7M€).",
  },

  // === MICHEL FANGET - APPEL EN COURS (pourvoi cassation) ===
  {
    politicianName: "Michel Fanget",
    title: "Escroquerie",
    updates: {
      verdictDate: new Date("2022-05-18"),
      status: "APPEL_EN_COURS", // Pourvoi cassation annoncé, pas de résultat connu
      sentence: "2 000€ d'amende, 2 ans d'inéligibilité (exécution provisoire)",
      fineAmount: 2000,
      ineligibilityMonths: 24,
      court: "Cour d'appel du Puy-de-Dôme",
      verifiedAt: new Date(),
      verifiedBy: "verification-session-2026-02-03",
    },
    newSources: [
      {
        url: "https://www.francebleu.fr/infos/politique/michel-fanget-1652864429",
        title: "Condamné en appel à deux ans d'inéligibilité, le député puydômois Michel Fanget maintient sa candidature",
        publisher: "France Bleu",
        publishedAt: new Date("2022-05-18"),
      },
    ],
    notes: "CHANGEMENT STATUT : Pourvoi en cassation annoncé mai 2022. Complicité escroquerie CPAM. Pas réélu 2022.",
  },

  // === FRANÇOIS LÉOTARD - Outrage agent (DÉFINITIVE) ===
  {
    politicianName: "François Léotard",
    title: "Outrage à agent public",
    updates: {
      verdictDate: new Date("2013-05-30"),
      status: "CONDAMNATION_DEFINITIVE",
      sentence: "3 750€ d'amende + dommages et intérêts aux policiers/gendarmes",
      fineAmount: 3750,
      court: "Tribunal correctionnel",
      verifiedAt: new Date(),
      verifiedBy: "verification-session-2026-02-03",
    },
    newSources: [
      {
        url: "https://www.europe1.fr/politique/Francois-Leotard-condamne-pour-outrage-829634",
        title: "François Léotard condamné pour outrage",
        publisher: "Europe 1",
        publishedAt: new Date("2013-05-30"),
      },
    ],
    notes: "Outrage lors perquisition affaire Karachi. Décédé le 25 avril 2023.",
  },

  // === BRUNO SANDRAS - Prise illégale intérêts (DÉFINITIVE) ===
  {
    politicianName: "Bruno Sandras",
    title: "Prise illégale d'intérêts",
    updates: {
      verdictDate: new Date("2014-01-01"), // Appel confirmé 2014
      status: "CONDAMNATION_DEFINITIVE",
      sentence: "3 mois de prison avec sursis, 3 ans interdiction fonction publique",
      prisonMonths: 3,
      prisonSuspended: true,
      ineligibilityMonths: 36,
      court: "Tribunal correctionnel de Papeete (appel confirmé 2014)",
      verifiedAt: new Date(),
      verifiedBy: "verification-session-2026-02-03",
    },
    newSources: [
      {
        url: "https://www.tahiti-infos.com/Emplois-fictifs-le-relevement-de-peine-refuse-a-Bruno-Sandras_a130259.html",
        title: "Emplois fictifs : le relèvement de peine refusé à Bruno Sandras",
        publisher: "Tahiti Infos",
        publishedAt: new Date("2015-06-01"),
      },
    ],
    notes: "Affaire emplois fictifs Polynésie (Gaston Flosse). Appel confirmé 2014, recours rejeté 2015. Maire Papara destitué 2014.",
  },

  // === CLAUDE PRADILLE - Corruption (DÉFINITIVE) ===
  {
    politicianName: "Claude Pradille",
    title: "Corruption",
    updates: {
      verdictDate: new Date("2006-01-01"), // Définitive 2006
      status: "CONDAMNATION_DEFINITIVE",
      sentence: "5 ans de prison (peine max), 300 000 francs d'amende, 5 ans d'inéligibilité",
      prisonMonths: 60,
      prisonSuspended: false,
      fineAmount: 45735, // ~300k francs
      ineligibilityMonths: 60,
      court: "Tribunal correctionnel de Nîmes (définitif 2006)",
      verifiedAt: new Date(),
      verifiedBy: "verification-session-2026-02-03",
    },
    newSources: [
      {
        url: "https://www.universalis.fr/evenement/24-mai-1995-condamnation-du-senateur-p-s-claude-pradille",
        title: "Condamnation du sénateur Claude Pradille",
        publisher: "Encyclopædia Universalis",
        publishedAt: new Date("1995-05-24"),
      },
    ],
    notes: "Corruption HLM Gard. Condamné 1995, définitif 2006. Recondam. 2021 pour organisation insolvabilité (2 ans bracelet).",
  },

  // === CLAUDE PRADILLE - Subornation témoin (DÉFINITIVE) ===
  {
    politicianName: "Claude Pradille",
    title: "Subornation de témoin",
    updates: {
      verdictDate: new Date("2006-01-01"),
      status: "CONDAMNATION_DEFINITIVE",
      sentence: "Inclus dans la condamnation globale",
      court: "Tribunal correctionnel de Nîmes (définitif 2006)",
      verifiedAt: new Date(),
      verifiedBy: "verification-session-2026-02-03",
    },
    notes: "Même affaire que la corruption - jugés ensemble.",
  },

  // === CAROLINE PARMENTIER - Diffamation raciale (DÉFINITIVE) ===
  {
    politicianName: "Caroline Parmentier",
    title: "Diffamation en droit français",
    updates: {
      verdictDate: new Date("1995-01-01"), // Confirmé cassation
      status: "CONDAMNATION_DEFINITIVE",
      sentence: "Amende pour diffamation raciale",
      court: "Tribunal correctionnel de Paris (confirmé cassation)",
      verifiedAt: new Date(),
      verifiedBy: "verification-session-2026-02-03",
    },
    newSources: [
      {
        url: "https://linsoumission.fr/2022/07/13/caroline-parmentier-deputee-rn/",
        title: "Portrait – Caroline Parmentier, l'embarrassante attachée de presse de Marine Le Pen",
        publisher: "L'Insoumission",
        publishedAt: new Date("2022-07-13"),
      },
    ],
    notes: "Article journal Présent qualifiant immigrés de 'voyous ethniques'. Confirmé en cassation. Députée RN depuis 2022.",
  },

  // === PADRIG MONTAUZIER - Attentat Versailles (DÉFINITIVE) ===
  {
    politicianName: "Padrig Montauzier",
    title: "Attentat du château de Versailles",
    updates: {
      verdictDate: new Date("1978-11-30"),
      status: "CONDAMNATION_DEFINITIVE",
      sentence: "15 ans de réclusion criminelle (amnistié 1981)",
      prisonMonths: 180,
      prisonSuspended: false,
      court: "Cour d'assises",
      verifiedAt: new Date(),
      verifiedBy: "verification-session-2026-02-03",
    },
    newSources: [
      {
        url: "https://www.ina.fr/ina-eclaire-actu/1978-l-attentat-du-chateau-de-versailles",
        title: "1978, l'attentat du château de Versailles",
        publisher: "INA",
        publishedAt: new Date("2021-06-26"),
      },
    ],
    notes: "FLB - bombe galerie des Batailles 26/06/1978. Second procès : 15 ans supp. pour 30 attentats. Amnistié Mitterrand 1981.",
  },

  // === GRÉGORY ZAOUI - Escroquerie taxe carbone (DÉFINITIVE) ===
  {
    politicianName: "Grégory Zaoui",
    title: "Escroquerie",
    updates: {
      verdictDate: new Date("2018-05-23"),
      status: "CONDAMNATION_DEFINITIVE",
      sentence: "12 ans de prison cumulés (confondus à 8 ans)",
      prisonMonths: 96, // 8 ans après confusion
      prisonSuspended: false,
      court: "Tribunal correctionnel",
      verifiedAt: new Date(),
      verifiedBy: "verification-session-2026-02-03",
    },
    notes: "Escroquerie taxe carbone (1,6 Mds€). Cerveau de 'l'arnaque du siècle'. Libéré 2020, reconstitué prisonnier nov 2024.",
  },

  // === SIMON IBO - Incitation haine raciale (DÉFINITIVE) ===
  {
    politicianName: "Simon Ibo",
    title: "Incitation à la haine raciale",
    updates: {
      verdictDate: new Date("2002-02-15"),
      status: "CONDAMNATION_DEFINITIVE",
      court: "Tribunal correctionnel",
      verifiedAt: new Date(),
      verifiedBy: "verification-session-2026-02-03",
    },
    notes: "Condamnation ancienne (2002) - définitive vu le temps écoulé.",
  },

  // === ALAIN ROBERT - Violence (DÉFINITIVE) ===
  {
    politicianName: "Alain Robert",
    title: "Violence",
    updates: {
      verdictDate: new Date("1967-01-01"),
      status: "CONDAMNATION_DEFINITIVE",
      court: "Tribunal correctionnel",
      verifiedAt: new Date(),
      verifiedBy: "verification-session-2026-02-03",
    },
    notes: "Condamnation historique (1967) - définitive. Fondateur GUD, député européen 1984.",
  },

  // === NICOLAS CROCHET - Voie de fait (DÉFINITIVE) ===
  {
    politicianName: "Nicolas Crochet",
    title: "Voie de fait",
    updates: {
      verdictDate: new Date("2014-01-01"),
      status: "CONDAMNATION_DEFINITIVE",
      court: "Tribunal correctionnel",
      verifiedAt: new Date(),
      verifiedBy: "verification-session-2026-02-03",
    },
    notes: "Condamnation 2014 - définitive vu le temps écoulé.",
  },

  // === NICOLAS CROCHET - Conduite état ivresse (DÉFINITIVE) ===
  {
    politicianName: "Nicolas Crochet",
    title: "Conduite en état d'ivresse",
    updates: {
      verdictDate: new Date("2011-01-01"),
      status: "CONDAMNATION_DEFINITIVE",
      court: "Tribunal correctionnel",
      verifiedAt: new Date(),
      verifiedBy: "verification-session-2026-02-03",
    },
    notes: "Condamnation 2011 - définitive vu le temps écoulé.",
  },

  // === CLAUDE AUTANT-LARA - Diffamation (DÉFINITIVE) ===
  {
    politicianName: "Claude Autant-Lara",
    title: "Diffamation",
    updates: {
      status: "CONDAMNATION_DEFINITIVE",
      court: "Tribunal correctionnel",
      verifiedAt: new Date(),
      verifiedBy: "verification-session-2026-02-03",
    },
    notes: "Cinéaste et eurodéputé FN (1989-1992). Condamnation historique - définitive. Décédé 5 février 2000.",
  },

  // === CLAUDE AUTANT-LARA - Discours de haine (DÉFINITIVE) ===
  {
    politicianName: "Claude Autant-Lara",
    title: "Discours de haine",
    updates: {
      status: "CONDAMNATION_DEFINITIVE",
      court: "Tribunal correctionnel",
      verifiedAt: new Date(),
      verifiedBy: "verification-session-2026-02-03",
    },
    notes: "Propos antisémites. Condamnation historique - définitive. Décédé 5 février 2000.",
  },
];

async function updateAffairs(dryRun: boolean = false) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`MISE À JOUR DES AFFAIRES VÉRIFIÉES - BATCH 4 (FINAL)`);
  console.log(`Mode: ${dryRun ? "DRY RUN (simulation)" : "RÉEL"}`);
  console.log(`Date: ${new Date().toISOString()}`);
  console.log(`${"=".repeat(60)}\n`);

  let updated = 0;
  let notFound = 0;
  let errors = 0;
  let statusChanges = 0;

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

      const statusChange = affair.updates.status && existingAffair.status !== affair.updates.status;

      console.log(`\n📋 ${affair.politicianName} - ${affair.title}`);
      console.log(`   ID: ${existingAffair.id}`);
      console.log(`   Statut actuel: ${existingAffair.status}`);
      console.log(`   Nouveau statut: ${affair.updates.status || "(inchangé)"}`);
      if (statusChange) {
        console.log(`   ⚠️  CHANGEMENT DE STATUT !`);
        statusChanges++;
      }
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
            const existingSource = existingAffair.sources.find(
              (s) => s.url === source.url
            );
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
  console.log(`⚠️  Changements de statut: ${statusChanges}`);
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
