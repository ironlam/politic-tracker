/**
 * Script pour mettre à jour les affaires judiciaires - Batch 3
 * Session de vérification : 2026-02-03
 *
 * Usage: npx tsx scripts/update-verified-affairs-batch3.ts [--dry-run]
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
  // === PHILIPPE NACHBAR - CRPC définitive ===
  {
    politicianName: "Philippe Nachbar",
    title: "Détournement de fonds",
    updates: {
      verdictDate: new Date("2023-01-10"),
      status: "CONDAMNATION_DEFINITIVE",
      sentence: "100 000€ d'amende, 3 ans d'inéligibilité",
      fineAmount: 100000,
      ineligibilityMonths: 36,
      court: "Tribunal judiciaire de Paris (CRPC homologuée)",
      verifiedAt: new Date(),
      verifiedBy: "verification-session-2026-02-03",
    },
    newSources: [
      {
        url: "https://www.francebleu.fr/infos/faits-divers-justice/100-000-euros-d-amende-pour-l-ancien-senateur-lr-philippe-nachbar-pour-detournement-de-frais-de-mandat-4757666",
        title: "L'ancien sénateur LR Philippe Nachbar condamné à 100 000 euros d'amende pour détournement de frais de mandat",
        publisher: "France Bleu",
        publishedAt: new Date("2023-01-10"),
      },
    ],
    notes: "CRPC (plaider-coupable) - usage non conforme IRFM (98k€) 2015-2017. Première condamnation dans dossier IRFM.",
  },

  // === AGNÈS CERIGHELLI - Homophobie ===
  {
    politicianName: "Agnès Cerighelli",
    title: "Homophobie",
    updates: {
      verdictDate: new Date("2022-03-16"),
      status: "CONDAMNATION_DEFINITIVE",
      sentence: "4 000€ d'amende dont 2 000€ sursis, 3 600€ de dommages aux associations",
      fineAmount: 4000,
      court: "Cour d'appel de Versailles",
      verifiedAt: new Date(),
      verifiedBy: "verification-session-2026-02-03",
    },
    newSources: [
      {
        url: "https://www.assomousse.org/agnes-cerighelli-condamnee-pour-ses-propos-homophobes/",
        title: "Agnès Cerighelli condamnée pour ses propos homophobes",
        publisher: "Association Mousse",
        publishedAt: new Date("2022-03-16"),
      },
    ],
    notes: "Tweets comparant rainbow flag à l'étoile jaune (mars 2019). Ex-LREM exclue en 2018.",
  },

  // === JOËLLE GARRIAUD-MAYLAM - Harcèlement moral ===
  {
    politicianName: "Joëlle Garriaud-Maylam",
    title: "Harcèlement moral",
    updates: {
      verdictDate: new Date("2025-07-11"),
      status: "CONDAMNATION_DEFINITIVE",
      sentence: "Condamnation confirmée en appel",
      court: "Cour d'appel de Paris",
      verifiedAt: new Date(),
      verifiedBy: "verification-session-2026-02-03",
    },
    newSources: [
      {
        url: "https://france.news-pravda.com/france/2025/07/11/95135.html",
        title: "La sénatrice LR Garriaud-Maylam est définitivement condamnée pour harcèlement moral",
        publisher: "Pravda France",
        publishedAt: new Date("2025-07-11"),
      },
    ],
    notes: "Plus de 40 collaborateurs employés 2004-2023. Présidente AP-OTAN 2022-2023.",
  },

  // === BENOÎT SIMIAN - Harcèlement moral ===
  {
    politicianName: "Benoît Simian",
    title: "Harcèlement moral",
    updates: {
      verdictDate: new Date("2022-06-23"),
      status: "CONDAMNATION_DEFINITIVE",
      sentence: "8 mois de prison avec sursis, 5 000€ de dommages et intérêts, interdiction d'approcher son ex-compagne",
      prisonMonths: 8,
      prisonSuspended: true,
      fineAmount: 5000,
      ineligibilityMonths: 0, // Pas d'inéligibilité
      court: "Tribunal correctionnel de Bordeaux",
      verifiedAt: new Date(),
      verifiedBy: "verification-session-2026-02-03",
    },
    newSources: [
      {
        url: "https://www.francebleu.fr/infos/faits-divers-justice/gironde-benoit-simian-condamne-a-huit-mois-de-prison-avec-sursis-pour-harcelement-1655990415",
        title: "Benoît Simian condamné à huit mois de prison avec sursis pour harcèlement",
        publisher: "France Bleu",
        publishedAt: new Date("2022-06-23"),
      },
    ],
    notes: "41 faits de harcèlement juillet-novembre 2020. N'a pas fait appel.",
  },

  // === ALEXANDRE VINCENDET - Violences mineur ===
  {
    politicianName: "Alexandre Vincendet",
    title: "Violences sur mineur par ascendant",
    updates: {
      verdictDate: new Date("2020-11-18"),
      status: "CONDAMNATION_DEFINITIVE",
      sentence: "Stage de responsabilité parentale (non inscrit au casier)",
      prisonMonths: 0,
      court: "Tribunal correctionnel de Lyon (CRPC)",
      verifiedAt: new Date(),
      verifiedBy: "verification-session-2026-02-03",
    },
    newSources: [
      {
        url: "https://www.mediacites.fr/enquete/lyon/2021/12/06/rillieux-la-pape-ce-qui-se-cache-derriere-les-rumeurs-sur-alexandre-vincendet/",
        title: "Rillieux-la-Pape : ce qui se cache derrière les rumeurs sur Alexandre Vincendet",
        publisher: "Mediacités",
        publishedAt: new Date("2021-12-06"),
      },
    ],
    notes: "CRPC - violences sur fils de 5 ans le 6 mars 2020. Stage réalisé le 23/03/2021.",
  },

  // === JÉRÔME PEYRAT - Violence ===
  {
    politicianName: "Jérôme Peyrat",
    title: "Violence",
    updates: {
      verdictDate: new Date("2020-09-18"),
      status: "CONDAMNATION_DEFINITIVE",
      sentence: "3 000€ d'amende avec sursis",
      fineAmount: 3000,
      court: "Tribunal correctionnel d'Angoulême",
      verifiedAt: new Date(),
      verifiedBy: "verification-session-2026-02-03",
    },
    newSources: [
      {
        url: "https://www.francebleu.fr/infos/politique/legislatives-en-dordogne-jerome-peyrat-s-explique-sur-sa-condamnation-violence-1652693648",
        title: "Législatives en Dordogne : Jérôme Peyrat s'explique sur sa condamnation pour violence",
        publisher: "France Bleu",
        publishedAt: new Date("2022-05-16"),
      },
    ],
    notes: "Violences conjugales sur ex-compagne (décembre 2019). 14 jours ITT.",
  },

  // === CATHERINE BLEIN - Apologie terrorisme ===
  {
    politicianName: "Catherine Blein",
    title: "Apologie du terrorisme en droit français",
    updates: {
      verdictDate: new Date("2021-04-13"),
      status: "CONDAMNATION_DEFINITIVE",
      sentence: "1 500€ d'amende, 3 ans d'inéligibilité",
      fineAmount: 1500,
      ineligibilityMonths: 36,
      court: "Cour d'appel de Rennes",
      verifiedAt: new Date(),
      verifiedBy: "verification-session-2026-02-03",
    },
    newSources: [
      {
        url: "https://www.francebleu.fr/infos/faits-divers-justice/bretagne-la-conseillere-regionale-catherine-blein-condamnee-en-appel-pour-apologie-du-terrorisme-1618334758",
        title: "La conseillère régionale Catherine Blein condamnée en appel pour apologie du terrorisme",
        publisher: "France Bleu",
        publishedAt: new Date("2021-04-13"),
      },
    ],
    notes: "Tweet 'Œil pour Œil' après attentat Christchurch (mars 2019). Ex-FN exclue pour propos homophobes/islamophobes.",
  },

  // === JULIEN SANCHEZ - Incitation haine raciale ===
  {
    politicianName: "Julien Sanchez",
    title: "Incitation à la haine raciale",
    updates: {
      verdictDate: new Date("2013-10-18"), // Appel confirmé
      status: "CONDAMNATION_DEFINITIVE",
      sentence: "4 000€ d'amende dont 3 000€ pour provocation à la haine",
      fineAmount: 4000,
      court: "Cour d'appel de Nîmes (+ CEDH rejet mai 2023)",
      verifiedAt: new Date(),
      verifiedBy: "verification-session-2026-02-03",
    },
    newSources: [
      {
        url: "https://www.francebleu.fr/infos/politique/la-cour-europeenne-des-droits-de-l-homme-deboute-a-nouveau-le-maire-de-beaucaire-julien-sanchez-1361529",
        title: "La CEDH déboute à nouveau le maire RN de Beaucaire Julien Sanchez",
        publisher: "France Bleu",
        publishedAt: new Date("2023-05-15"),
      },
    ],
    notes: "Commentaires haineux Facebook non supprimés (campagne 2012). CEDH rejette recours mai 2023.",
  },

  // === HUBERT FAYARD - Proxénétisme ===
  {
    politicianName: "Hubert Fayard",
    title: "Proxénétisme",
    updates: {
      verdictDate: new Date("2021-03-10"),
      status: "CONDAMNATION_DEFINITIVE",
      sentence: "2 ans de prison avec sursis",
      prisonMonths: 24,
      prisonSuspended: true,
      court: "Tribunal correctionnel",
      verifiedAt: new Date(),
      verifiedBy: "verification-session-2026-02-03",
    },
    notes: "Proxénétisme aggravé - filles de l'Est. Ex-adjoint au maire de Vitrolles (FN), conseiller régional. Représentation Donetsk.",
  },

  // === PHILIPPE MARTIN (Gers) - Détournement fonds ===
  {
    politicianName: "Philippe Martin",
    title: "Détournement de fonds publics",
    updates: {
      verdictDate: new Date("2022-01-04"),
      status: "CONDAMNATION_DEFINITIVE",
      sentence: "2 ans de prison avec sursis, 70 000€ d'amende, 3 ans d'inéligibilité, remboursement 238 000€",
      prisonMonths: 24,
      prisonSuspended: true,
      fineAmount: 70000,
      ineligibilityMonths: 36,
      court: "Tribunal judiciaire de Paris (CRPC)",
      verifiedAt: new Date(),
      verifiedBy: "verification-session-2026-02-03",
    },
    newSources: [
      {
        url: "https://www.francebleu.fr/infos/faits-divers-justice/le-president-du-conseil-departemental-du-gers-condamne-a-2-ans-de-prison-pour-emploi-fictif-1641316415",
        title: "Le président du Conseil départemental du Gers condamné à deux ans de prison avec sursis pour emploi fictif",
        publisher: "France Bleu",
        publishedAt: new Date("2022-01-04"),
      },
    ],
    notes: "CRPC - emploi fictif ex-épouse comme assistante parlementaire 2002-2013. Démission 06/01/2022.",
  },

  // === JEAN-MICHEL BOUCHERON - Fraude fiscale ===
  {
    politicianName: "Jean-Michel Boucheron",
    title: "Fraude fiscale",
    updates: {
      verdictDate: new Date("2018-03-27"),
      status: "CONDAMNATION_DEFINITIVE",
      sentence: "18 mois de prison avec sursis, 20 000€ d'amende, 3 ans privation droits civiques",
      prisonMonths: 18,
      prisonSuspended: true,
      fineAmount: 20000,
      ineligibilityMonths: 36,
      court: "Tribunal correctionnel d'Angoulême",
      verifiedAt: new Date(),
      verifiedBy: "verification-session-2026-02-03",
    },
    newSources: [
      {
        url: "https://www.francebleu.fr/infos/faits-divers-justice/l-ancien-maire-d-angouleme-jean-michel-boucheron-condamne-pour-fraude-fiscale-1522153541",
        title: "L'ancien maire d'Angoulême Jean-Michel Boucheron condamné pour fraude fiscale",
        publisher: "France Bleu",
        publishedAt: new Date("2018-03-27"),
      },
    ],
    notes: "Organisation insolvabilité - retraite parlementaire sur compte de sa compagne. Déjà condamné 1994 et 1997.",
  },

  // === MARTIN SOTTON - CHANGEMENT EN APPEL_EN_COURS ===
  {
    politicianName: "Martin Sotton",
    title: "Incitation de mineurs à la consommation d'alcool",
    updates: {
      verdictDate: new Date("2023-04-01"),
      status: "APPEL_EN_COURS", // Il a fait appel
      sentence: "6 mois de prison avec sursis, 1 an d'inéligibilité",
      prisonMonths: 6,
      prisonSuspended: true,
      ineligibilityMonths: 12,
      court: "Tribunal correctionnel de Villefranche-sur-Saône",
      verifiedAt: new Date(),
      verifiedBy: "verification-session-2026-02-03",
    },
    newSources: [
      {
        url: "https://france3-regions.franceinfo.fr/auvergne-rhone-alpes/rhone/soirees-alcoolisees-avec-des-mineurs-un-maire-du-rhone-condamne-a-6-mois-de-prison-avec-sursis-2760158.html",
        title: "Soirées alcoolisées avec des mineurs : un maire du Rhône condamné à 6 mois de prison avec sursis",
        publisher: "France 3",
        publishedAt: new Date("2023-04-01"),
      },
    ],
    notes: "CHANGEMENT STATUT : Appel interjeté - réélu en septembre 2023 après nouvelles élections.",
  },

  // === MARTIN SOTTON - 2ème affaire ===
  {
    politicianName: "Martin Sotton",
    title: "Complicité de conduite d'un véhicule sans permis",
    updates: {
      verdictDate: new Date("2023-04-01"),
      status: "APPEL_EN_COURS",
      court: "Tribunal correctionnel de Villefranche-sur-Saône",
      verifiedAt: new Date(),
      verifiedBy: "verification-session-2026-02-03",
    },
    notes: "CHANGEMENT STATUT : Même affaire que l'alcool - appel en cours",
  },

  // === MARC GIRAUD - CHANGEMENT EN APPEL_EN_COURS ===
  {
    politicianName: "Marc Giraud",
    title: "Détournement de fonds publics",
    updates: {
      verdictDate: new Date("2022-10-14"),
      status: "APPEL_EN_COURS", // Appel annoncé
      sentence: "2 ans de prison avec sursis, 20 000€ d'amende, 5 ans d'inéligibilité (exécution provisoire)",
      prisonMonths: 24,
      prisonSuspended: true,
      fineAmount: 20000,
      ineligibilityMonths: 60,
      court: "Tribunal correctionnel de Toulon",
      verifiedAt: new Date(),
      verifiedBy: "verification-session-2026-02-03",
    },
    newSources: [
      {
        url: "https://www.francebleu.fr/infos/faits-divers-justice/marc-giraud-le-president-du-conseil-derpartemental-du-var-condamne-et-ineligible-1665126595",
        title: "Marc Giraud, le président du conseil départemental du Var condamné et inéligible",
        publisher: "France Bleu",
        publishedAt: new Date("2022-10-07"),
      },
    ],
    notes: "CHANGEMENT STATUT : Appel annoncé - emploi fictif Patricia Arnould (25k€/an) 2011-2015. Démission forcée (exécution provisoire).",
  },
];

async function updateAffairs(dryRun: boolean = false) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`MISE À JOUR DES AFFAIRES VÉRIFIÉES - BATCH 3`);
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
