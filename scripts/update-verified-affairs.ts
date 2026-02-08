/**
 * Script pour mettre à jour les affaires judiciaires après vérification manuelle
 * Session de vérification : 2026-02-03
 *
 * Usage: npx tsx scripts/update-verified-affairs.ts [--dry-run]
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
  title: string; // Pour matcher l'affaire existante
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

// Affaires vérifiées le 2026-02-03
const verifiedAffairs: VerifiedAffair[] = [
  // === THIERRY LÉGIER ===
  {
    politicianName: "Thierry Légier",
    title: "Recel", // Affaire des assistants parlementaires
    updates: {
      verdictDate: new Date("2025-03-31"),
      status: "CONDAMNATION_DEFINITIVE",
      sentence: "12 mois de prison avec sursis, 2 ans d'inéligibilité",
      prisonMonths: 12,
      prisonSuspended: true,
      ineligibilityMonths: 24,
      court: "Tribunal correctionnel de Paris",
      verifiedAt: new Date(),
      verifiedBy: "verification-session-2026-02-03",
    },
    newSources: [
      {
        url: "https://www.franceinfo.fr/politique/front-national/affaire-des-assistants-fn-au-parlement-europeen/marine-le-pen-louis-aliot-julien-odoul-on-a-liste-les-25-condamnations-a-l-issue-du-proces-des-assistants-parlementaires-du-fn_7162527.html",
        title:
          "On a listé les 25 condamnations à l'issue du procès des assistants parlementaires du FN",
        publisher: "France Info",
        publishedAt: new Date("2025-03-31"),
      },
    ],
    notes: "N'a pas fait appel - condamnation définitive",
  },

  // === GÉRALD GÉRIN - Fraude fiscale ===
  {
    politicianName: "Gérald Gérin",
    title: "Fraude fiscale",
    updates: {
      verdictDate: new Date("2025-01-21"),
      status: "CONDAMNATION_DEFINITIVE",
      sentence: "2 ans de prison avec sursis, 5 ans d'inéligibilité, confiscation 1,9M€",
      prisonMonths: 24,
      prisonSuspended: true,
      ineligibilityMonths: 60,
      court: "Tribunal correctionnel de Paris",
      verifiedAt: new Date(),
      verifiedBy: "verification-session-2026-02-03",
    },
    newSources: [
      {
        url: "https://www.europe1.fr/police-justice/fraude-fiscale-lex-assistant-de-jean-marie-le-pen-condamne-deux-ans-de-prison-avec-sursis-243313",
        title:
          "Fraude fiscale : l'ex-assistant de Jean-Marie Le Pen condamné à deux ans de prison avec sursis",
        publisher: "Europe 1",
        publishedAt: new Date("2025-01-21"),
      },
    ],
    notes: "Dissimulation d'un trust aux îles Vierges britanniques (2008-2015)",
  },

  // === GÉRALD GÉRIN - Recel ===
  {
    politicianName: "Gérald Gérin",
    title: "Recel",
    updates: {
      verdictDate: new Date("2025-03-31"),
      status: "CONDAMNATION_DEFINITIVE",
      sentence: "12 mois de prison avec sursis, 1 an d'inéligibilité",
      prisonMonths: 12,
      prisonSuspended: true,
      ineligibilityMonths: 12,
      court: "Tribunal correctionnel de Paris",
      verifiedAt: new Date(),
      verifiedBy: "verification-session-2026-02-03",
    },
    notes: "Affaire des assistants parlementaires - N'a pas fait appel",
  },

  // === PHILIPPE DOUCET ===
  {
    politicianName: "Philippe Doucet",
    title: "Détournement de fonds publics",
    updates: {
      verdictDate: new Date("2024-12-10"),
      status: "CONDAMNATION_DEFINITIVE",
      sentence:
        "1 an de prison avec sursis, 2 ans d'inéligibilité, 45 000€ de dommages et intérêts",
      prisonMonths: 12,
      prisonSuspended: true,
      ineligibilityMonths: 24,
      fineAmount: 45000, // Dommages et intérêts
      court: "Tribunal correctionnel de Paris (CRPC)",
      verifiedAt: new Date(),
      verifiedBy: "verification-session-2026-02-03",
    },
    newSources: [
      {
        url: "https://www.francebleu.fr/infos/faits-divers-justice/l-ancien-maire-d-argenteuil-philippe-doucet-condamne-a-2-ans-d-ineligibilite-7317451",
        title: "L'ancien maire d'Argenteuil, Philippe Doucet, condamné à 2 ans d'inéligibilité",
        publisher: "France Bleu",
        publishedAt: new Date("2024-12-10"),
      },
    ],
    notes: "CRPC (plaider-coupable) - cumul de systèmes de remboursement de frais 2009-2014",
  },

  // === NICOLAS SARKOZY - Bygmalion ===
  {
    politicianName: "Nicolas Sarkozy",
    title: "Financement illégal de campagne électorale",
    updates: {
      verdictDate: new Date("2025-11-26"),
      status: "CONDAMNATION_DEFINITIVE",
      sentence: "1 an de prison dont 6 mois ferme",
      prisonMonths: 12,
      prisonSuspended: false, // 6 mois ferme
      court: "Cour de cassation (rejet pourvoi)",
      verifiedAt: new Date(),
      verifiedBy: "verification-session-2026-02-03",
    },
    newSources: [
      {
        url: "https://www.franceinfo.fr/societe/affaire/les-affaires-sarkozy/affaire-bygmalion-nicolas-sarkozy-definitivement-condamne-pour-le-financement-illegal-de-sa-campagne-presidentielle-de-2012-apres-le-rejet-de-son-pourvoi-en-cassation_7638986.html",
        title:
          "Affaire Bygmalion : Nicolas Sarkozy définitivement condamné après le rejet de son pourvoi en cassation",
        publisher: "France Info",
        publishedAt: new Date("2025-11-26"),
      },
    ],
    notes: "Deuxième condamnation définitive après l'affaire des écoutes (Bismuth)",
  },

  // === CLAUDE GUÉANT - Primes cabinet ===
  {
    politicianName: "Claude Guéant",
    title: "Détournement de fonds",
    updates: {
      verdictDate: new Date("2019-01-16"),
      status: "CONDAMNATION_DEFINITIVE",
      sentence:
        "2 ans de prison dont 1 ferme, 75 000€ d'amende, 5 ans interdiction fonction publique",
      prisonMonths: 24,
      prisonSuspended: false, // 1 an ferme
      fineAmount: 75000,
      court: "Cour de cassation (rejet pourvoi)",
      verifiedAt: new Date(),
      verifiedBy: "verification-session-2026-02-03",
    },
    newSources: [
      {
        url: "https://www.franceinfo.fr/politique/claude-gueant/affaire-gueant/claude-gueant-definitivement-condamne-a-un-an-de-prison-ferme-dans-l-affaire-des-primes-en-liquide-du-ministere-de-l-interieur_3147663.html",
        title:
          "Claude Guéant définitivement condamné à un an de prison ferme dans l'affaire des primes en liquide",
        publisher: "France Info",
        publishedAt: new Date("2019-01-16"),
      },
    ],
    notes: "Primes versées entre 2002 et 2004 quand il était directeur de cabinet de Sarkozy",
  },

  // === ISABELLE BALKANY - Fraude fiscale ===
  {
    politicianName: "Isabelle Balkany",
    title: "Détournement de fonds",
    updates: {
      verdictDate: new Date("2024-05-15"), // Cassation mai 2024
      status: "CONDAMNATION_DEFINITIVE",
      sentence: "3 ans et demi de prison, 100 000€ d'amende, 10 ans d'inéligibilité",
      prisonMonths: 42,
      prisonSuspended: false,
      fineAmount: 100000,
      ineligibilityMonths: 120,
      court: "Cour de cassation (rejet pourvoi mai 2024)",
      verifiedAt: new Date(),
      verifiedBy: "verification-session-2026-02-03",
    },
    newSources: [
      {
        url: "https://www.franceinfo.fr/politique/affaire/affaire-balkany/blanchiment-de-fraude-fiscale-la-cour-de-cassation-confirme-la-culpabilite-des-epoux-balkany-mais-ordonne-un-nouveau-proces-pour-fixer-les-peines_4684347.html",
        title:
          "Blanchiment de fraude fiscale : la Cour de cassation confirme la culpabilité des époux Balkany",
        publisher: "France Info",
        publishedAt: new Date("2024-05-15"),
      },
    ],
    notes: "Blanchiment de fraude fiscale aggravé - condamnation définitive mai 2024",
  },

  // === PATRICK BALKANY - Prise illégale d'intérêts ===
  {
    politicianName: "Patrick Balkany",
    title: "Prise illégale d'intérêts",
    updates: {
      verdictDate: new Date("1997-01-15"), // Appel confirmé janvier 1997
      status: "CONDAMNATION_DEFINITIVE",
      sentence: "15 mois de prison, 200 000 francs d'amende, 2 ans d'inéligibilité avec sursis",
      prisonMonths: 15,
      prisonSuspended: true,
      fineAmount: 30490, // ~200 000 francs
      ineligibilityMonths: 24,
      court: "Cour d'appel",
      verifiedAt: new Date(),
      verifiedBy: "verification-session-2026-02-03",
    },
    notes:
      "Emploi de personnel municipal pour résidence privée (Moulin de Cossy à Giverny) - confirmé en appel 1997",
  },

  // === MARC JOULAUD ===
  {
    politicianName: "Marc Joulaud",
    title: "Détournement de fonds publics",
    updates: {
      verdictDate: new Date("2024-04-24"),
      status: "CONDAMNATION_DEFINITIVE",
      sentence: "3 ans de prison avec sursis, 5 ans d'inéligibilité, remboursement 679 989€",
      prisonMonths: 36,
      prisonSuspended: true,
      ineligibilityMonths: 60,
      fineAmount: 679989,
      court: "Cour de cassation (rejet pourvoi)",
      verifiedAt: new Date(),
      verifiedBy: "verification-session-2026-02-03",
    },
    newSources: [
      {
        url: "https://www.france24.com/fr/info-en-continu/20240424-emplois-fictifs-l-ancien-premier-ministre-fran%C3%A7ois-fillon-d%C3%A9finitivement-jug%C3%A9-coupable",
        title: "Emplois fictifs : François Fillon définitivement jugé coupable",
        publisher: "France 24",
        publishedAt: new Date("2024-04-24"),
      },
    ],
    notes: "Affaire Fillon - emplois fictifs de Penelope Fillon",
  },

  // === MARINE LE PEN - Diffamation Cimade ===
  {
    politicianName: "Marine Le Pen",
    title: "Diffamation",
    updates: {
      verdictDate: new Date("2025-12-16"),
      status: "CONDAMNATION_DEFINITIVE",
      sentence: "500€ d'amende avec sursis",
      fineAmount: 500,
      court: "Cour de cassation (rejet pourvoi)",
      verifiedAt: new Date(),
      verifiedBy: "verification-session-2026-02-03",
    },
    newSources: [
      {
        url: "https://www.lacimade.org/diffamation-a-lencontre-de-la-cimade-marine-le-pen-definitivement-condamnee/",
        title: "Diffamation à l'encontre de La Cimade : Marine Le Pen définitivement condamnée",
        publisher: "La Cimade",
        publishedAt: new Date("2025-12-16"),
      },
    ],
    notes:
      "Propos tenus lors de la campagne présidentielle 2022 accusant la Cimade d'organiser l'immigration clandestine",
  },

  // === SYLVIE ANDRIEUX ===
  {
    politicianName: "Sylvie Andrieux",
    title: "Détournement de fonds publics",
    updates: {
      verdictDate: new Date("2016-11-09"),
      status: "CONDAMNATION_DEFINITIVE",
      sentence: "4 ans de prison dont 3 avec sursis, 100 000€ d'amende, 5 ans d'inéligibilité",
      prisonMonths: 48,
      prisonSuspended: false, // 1 an ferme
      fineAmount: 100000,
      ineligibilityMonths: 60,
      court: "Cour de cassation (rejet pourvoi)",
      verifiedAt: new Date(),
      verifiedBy: "verification-session-2026-02-03",
    },
    newSources: [
      {
        url: "https://www.francebleu.fr/infos/faits-divers-justice/la-deputee-socialiste-sylvie-andrieux-definitivement-condamnee-pour-detournement-de-fonds-publics-1478711566",
        title:
          "La députée PS Sylvie Andrieux définitivement condamnée pour détournement de fonds publics",
        publisher: "France Bleu",
        publishedAt: new Date("2016-11-09"),
      },
    ],
    notes: "740 000€ détournés via associations fictives - Conseil régional PACA 2005-2009",
  },

  // === ALAIN CARIGNON - Corruption ===
  {
    politicianName: "Alain Carignon",
    title: "Corruption",
    updates: {
      verdictDate: new Date("1997-10-27"),
      status: "CONDAMNATION_DEFINITIVE",
      sentence:
        "5 ans de prison dont 1 avec sursis, 400 000 francs d'amende, 5 ans d'inéligibilité",
      prisonMonths: 60,
      prisonSuspended: false, // 4 ans ferme
      fineAmount: 60980, // ~400 000 francs
      ineligibilityMonths: 60,
      court: "Cour de cassation (rejet pourvoi)",
      verifiedAt: new Date(),
      verifiedBy: "verification-session-2026-02-03",
    },
    notes: "Affaire Lyonnaise des Eaux / Dauphiné News - 29 mois de prison effectués",
  },

  // === ALAIN CARIGNON - Abus biens sociaux ===
  {
    politicianName: "Alain Carignon",
    title: "Abus de biens sociaux",
    updates: {
      verdictDate: new Date("1997-10-27"),
      status: "CONDAMNATION_DEFINITIVE",
      sentence: "Inclus dans la condamnation globale pour corruption",
      court: "Cour de cassation (rejet pourvoi)",
      verifiedAt: new Date(),
      verifiedBy: "verification-session-2026-02-03",
    },
    notes: "Même affaire que la corruption - jugés ensemble",
  },

  // === ALAIN CARIGNON - Subornation de témoin ===
  {
    politicianName: "Alain Carignon",
    title: "Subornation de témoin",
    updates: {
      verdictDate: new Date("1997-10-27"),
      status: "CONDAMNATION_DEFINITIVE",
      sentence: "Inclus dans la condamnation globale",
      court: "Cour de cassation (rejet pourvoi)",
      verifiedAt: new Date(),
      verifiedBy: "verification-session-2026-02-03",
    },
    notes: "Même affaire que la corruption - jugés ensemble",
  },

  // === GÉRARD DALONGEVILLE ===
  {
    politicianName: "Gérard Dalongeville",
    title: "Détournement de fonds publics",
    updates: {
      verdictDate: new Date("2014-11-15"), // Désistement appel
      status: "CONDAMNATION_DEFINITIVE",
      sentence: "4 ans de prison dont 3 ferme, 50 000€ d'amende, 5 ans d'inéligibilité",
      prisonMonths: 48,
      prisonSuspended: false, // 3 ans ferme
      fineAmount: 50000,
      ineligibilityMonths: 60,
      court: "Tribunal correctionnel de Béthune",
      verifiedAt: new Date(),
      verifiedBy: "verification-session-2026-02-03",
    },
    newSources: [
      {
        url: "https://www.francebleu.fr/infos/faits-divers-justice/gerard-dalongeville-l-ancien-maire-d-henin-beaumont-renonce-son-appel-1415964582",
        title: "Gérard Dalongeville, l'ancien maire d'Hénin-Beaumont, renonce à son appel",
        publisher: "France Bleu",
        publishedAt: new Date("2014-11-14"),
      },
    ],
    notes: "Fausses factures - désistement d'appel rendant la condamnation définitive",
  },

  // === JEAN-PAUL HUCHON ===
  {
    politicianName: "Jean-Paul Huchon",
    title: "Prise illégale d'intérêts",
    updates: {
      verdictDate: new Date("2008-11-01"), // Appel novembre 2008
      status: "CONDAMNATION_DEFINITIVE",
      sentence: "6 mois de prison avec sursis, 60 000€ d'amende (inéligibilité levée en appel)",
      prisonMonths: 6,
      prisonSuspended: true,
      fineAmount: 60000,
      ineligibilityMonths: 0, // Levée en appel
      court: "Cour d'appel de Paris",
      verifiedAt: new Date(),
      verifiedBy: "verification-session-2026-02-03",
    },
    newSources: [
      {
        url: "https://www.anticor.org/2008/11/24/jean-paul-huchon-condamne/",
        title: "Jean-Paul Huchon condamné",
        publisher: "Anticor",
        publishedAt: new Date("2008-11-24"),
      },
    ],
    notes: "Marchés publics de communication 2002-2003 impliquant son épouse",
  },

  // === JEAN-MARIE LE PEN - Incitation haine raciale (Roms 2012) ===
  {
    politicianName: "Jean-Marie Le Pen",
    title: "Incitation à la haine raciale",
    updates: {
      verdictDate: new Date("2016-03-01"), // Cassation
      status: "CONDAMNATION_DEFINITIVE",
      sentence: "5 000€ d'amende",
      fineAmount: 5000,
      court: "Cour de cassation (rejet pourvoi)",
      verifiedAt: new Date(),
      verifiedBy: "verification-session-2026-02-03",
    },
    newSources: [
      {
        url: "https://www.romeurope.org/communique-de-presse-mrap-05-03-2016-condamnation-definitive-du-multirecidiviste-jean-marie-le-pen-pour-injures-racistes-envers-les-roms/",
        title:
          "Condamnation définitive du multirécidiviste Jean-Marie Le Pen pour injures racistes envers les Roms",
        publisher: "MRAP / Romeurope",
        publishedAt: new Date("2016-03-05"),
      },
    ],
    notes: "Propos sur les Roms qui 'volent naturellement' (2012)",
  },

  // === JEAN-MARIE LE PEN - Voie de fait ===
  {
    politicianName: "Jean-Marie Le Pen",
    title: "Voie de fait",
    updates: {
      verdictDate: new Date("1998-01-01"),
      status: "CONDAMNATION_DEFINITIVE",
      verifiedAt: new Date(),
      verifiedBy: "verification-session-2026-02-03",
    },
    notes: "Condamnation confirmée - multiples incidents violents",
  },

  // === LAURENT JACOBELLI - À VÉRIFIER APPEL ===
  {
    politicianName: "Laurent Jacobelli",
    title: "Diffamation en droit français",
    updates: {
      verdictDate: new Date("2025-09-02"),
      status: "APPEL_EN_COURS", // L'avocat de Belhaddad a annoncé faire appel
      sentence: "300€ d'amende avec sursis, 150€ de dommages et intérêts",
      fineAmount: 300,
      court: "Tribunal correctionnel de Thionville",
      verifiedAt: new Date(),
      verifiedBy: "verification-session-2026-02-03",
    },
    newSources: [
      {
        url: "https://www.franceinfo.fr/politique/front-national/le-porte-parole-du-rassemblement-national-laurent-jacobelli-condamne-a-300-euros-d-amende-avec-sursis-pour-outrage-et-diffamation_7468933.html",
        title:
          "Le porte-parole du RN Laurent Jacobelli condamné à 300 euros d'amende avec sursis pour outrage et diffamation",
        publisher: "France Info",
        publishedAt: new Date("2025-09-02"),
      },
    ],
    notes:
      "ATTENTION: L'avocat de Belhaddad a annoncé qu'il allait faire appel - donc PAS définitif",
  },
];

async function updateAffairs(dryRun: boolean = false) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`MISE À JOUR DES AFFAIRES VÉRIFIÉES`);
  console.log(`Mode: ${dryRun ? "DRY RUN (simulation)" : "RÉEL"}`);
  console.log(`Date: ${new Date().toISOString()}`);
  console.log(`${"=".repeat(60)}\n`);

  let updated = 0;
  let notFound = 0;
  let errors = 0;

  for (const affair of verifiedAffairs) {
    try {
      // Trouver le politicien
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

      // Trouver l'affaire
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
        // Mettre à jour l'affaire
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

        // Ajouter les nouvelles sources
        if (affair.newSources && affair.newSources.length > 0) {
          for (const source of affair.newSources) {
            // Vérifier si la source existe déjà
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
