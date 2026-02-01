#!/usr/bin/env tsx
/**
 * Truth Validators - Check if our data matches official sources
 *
 * Compares our database against:
 * - data.gouv.fr (government data)
 * - assemblee-nationale.fr (deputies)
 * - senat.fr (senators)
 *
 * Usage:
 *   npm run validate:truth           # Run all validators
 *   npm run validate:truth -- --fix  # Attempt to fix discrepancies
 */

import "dotenv/config";
import { db } from "../src/lib/db";
import { MandateType } from "../src/generated/prisma";

interface ValidationResult {
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
  source: string;
  fixable: boolean;
  details?: string;
}

const VALIDATORS: Array<{
  name: string;
  source: string;
  validate: () => Promise<ValidationResult>;
}> = [
  // === GOVERNMENT ===
  {
    name: "Premier ministre actuel",
    source: "data.gouv.fr + info.gouv.fr",
    validate: async () => {
      // Expected value (manually updated or fetched from API)
      // As of 2026-01-03, Sébastien Lecornu is PM
      const expected = "Sébastien Lecornu";

      const pm = await db.mandate.findFirst({
        where: { type: MandateType.PREMIER_MINISTRE, isCurrent: true },
        include: { politician: true },
      });

      const actual = pm?.politician.fullName || "Non trouvé";

      return {
        name: "Premier ministre actuel",
        passed: actual.toLowerCase().includes(expected.toLowerCase()),
        expected,
        actual,
        source: "https://www.info.gouv.fr/composition-du-gouvernement",
        fixable: true,
        details: pm ? `Mandat depuis ${pm.startDate?.toISOString().split("T")[0]}` : undefined,
      };
    },
  },
  {
    name: "Président de la République",
    source: "elysee.fr",
    validate: async () => {
      const expected = "Emmanuel Macron";

      const president = await db.mandate.findFirst({
        where: { type: MandateType.PRESIDENT_REPUBLIQUE, isCurrent: true },
        include: { politician: true },
      });

      const actual = president?.politician.fullName || "Non trouvé";

      return {
        name: "Président de la République",
        passed: actual.toLowerCase().includes(expected.toLowerCase()),
        expected,
        actual,
        source: "https://www.elysee.fr/",
        fixable: true,
      };
    },
  },

  // === PARLIAMENT COUNTS ===
  {
    name: "Nombre de députés",
    source: "assemblee-nationale.fr",
    validate: async () => {
      const expected = 577; // Legal number of seats
      const tolerance = 5; // Some seats may be vacant

      const count = await db.mandate.count({
        where: { type: MandateType.DEPUTE, isCurrent: true },
      });

      return {
        name: "Nombre de députés",
        passed: count >= expected - tolerance && count <= expected,
        expected: `${expected} (tolérance: ${tolerance})`,
        actual: String(count),
        source: "https://www.assemblee-nationale.fr/",
        fixable: false,
        details: count < expected - tolerance ? "Sièges vacants ou données manquantes" : undefined,
      };
    },
  },
  {
    name: "Nombre de sénateurs",
    source: "senat.fr",
    validate: async () => {
      const expected = 348;
      const tolerance = 5;

      const count = await db.mandate.count({
        where: { type: MandateType.SENATEUR, isCurrent: true },
      });

      return {
        name: "Nombre de sénateurs",
        passed: count >= expected - tolerance && count <= expected,
        expected: `${expected} (tolérance: ${tolerance})`,
        actual: String(count),
        source: "https://www.senat.fr/",
        fixable: false,
      };
    },
  },
  {
    name: "Nombre d'eurodéputés français",
    source: "europarl.europa.eu",
    validate: async () => {
      const expected = 81; // France's seats in EP
      const tolerance = 5;

      const count = await db.mandate.count({
        where: { type: MandateType.DEPUTE_EUROPEEN, isCurrent: true },
      });

      return {
        name: "Nombre d'eurodéputés français",
        passed: count >= expected - tolerance && count <= expected + tolerance,
        expected: `${expected} (tolérance: ${tolerance})`,
        actual: String(count),
        source: "https://www.europarl.europa.eu/",
        fixable: false,
      };
    },
  },

  // === ASSEMBLY LEADERSHIP ===
  {
    name: "Présidente de l'Assemblée nationale",
    source: "assemblee-nationale.fr",
    validate: async () => {
      const expected = "Yaël Braun-Pivet";

      // Search by title (no specific mandate type for AN president)
      const president = await db.mandate.findFirst({
        where: {
          OR: [
            { title: { contains: "Présidente de l'Assemblée", mode: "insensitive" } },
            { title: { contains: "Président de l'Assemblée", mode: "insensitive" } },
          ],
          isCurrent: true,
        },
        include: { politician: true },
      });

      const actual = president?.politician.fullName || "Non trouvé (pas de mandat de ce type)";

      return {
        name: "Présidente de l'Assemblée nationale",
        passed: actual.toLowerCase().includes(expected.toLowerCase()),
        expected,
        actual,
        source: "https://www.assemblee-nationale.fr/dyn/la-presidente",
        fixable: true,
        details: !president ? "Aucun mandat 'Président(e) de l'Assemblée' trouvé - peut nécessiter ajout manuel" : undefined,
      };
    },
  },

  // === DATA FRESHNESS ===
  {
    name: "Fraîcheur des données députés",
    source: "data.assemblee-nationale.fr",
    validate: async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const recentUpdate = await db.mandate.findFirst({
        where: {
          type: MandateType.DEPUTE,
          updatedAt: { gte: thirtyDaysAgo },
        },
      });

      return {
        name: "Fraîcheur des données députés",
        passed: !!recentUpdate,
        expected: "Mise à jour < 30 jours",
        actual: recentUpdate
          ? `Dernière MAJ: ${recentUpdate.updatedAt.toISOString().split("T")[0]}`
          : "Aucune MAJ récente",
        source: "Sync interne",
        fixable: true,
        details: recentUpdate ? undefined : "Exécuter npm run sync:assemblee",
      };
    },
  },
  {
    name: "Fraîcheur des données sénateurs",
    source: "data.senat.fr",
    validate: async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const recentUpdate = await db.mandate.findFirst({
        where: {
          type: MandateType.SENATEUR,
          updatedAt: { gte: thirtyDaysAgo },
        },
      });

      return {
        name: "Fraîcheur des données sénateurs",
        passed: !!recentUpdate,
        expected: "Mise à jour < 30 jours",
        actual: recentUpdate
          ? `Dernière MAJ: ${recentUpdate.updatedAt.toISOString().split("T")[0]}`
          : "Aucune MAJ récente",
        source: "Sync interne",
        fixable: true,
        details: recentUpdate ? undefined : "Exécuter npm run sync:senat",
      };
    },
  },

  // === AFFAIRS INTEGRITY ===
  {
    name: "Affaires avec sources",
    source: "Intégrité données",
    validate: async () => {
      const total = await db.affair.count();
      const withSources = await db.affair.count({
        where: { sources: { some: {} } },
      });

      return {
        name: "Affaires avec sources",
        passed: total === withSources,
        expected: "100% des affaires avec source",
        actual: `${withSources}/${total} (${Math.round((withSources / total) * 100)}%)`,
        source: "Intégrité données",
        fixable: false,
        details: total !== withSources ? "CRITIQUE: Affaires sans source = risque juridique" : undefined,
      };
    },
  },
];

async function main() {
  const args = process.argv.slice(2);
  const verbose = args.includes("--verbose") || args.includes("-v");

  console.log("\n🔍 Validateurs de Vérité\n");
  console.log("Compare nos données avec les sources officielles.\n");

  const results: ValidationResult[] = [];
  let passed = 0;
  let failed = 0;

  for (const validator of VALIDATORS) {
    process.stdout.write(`[${validator.name}]... `);

    try {
      const result = await validator.validate();
      results.push(result);

      if (result.passed) {
        passed++;
        console.log(`✅ ${result.actual}`);
      } else {
        failed++;
        console.log(`❌ Attendu: ${result.expected}, Trouvé: ${result.actual}`);
        if (verbose && result.details) {
          console.log(`   └─ ${result.details}`);
        }
        if (verbose) {
          console.log(`   └─ Source: ${result.source}`);
        }
      }
    } catch (error) {
      failed++;
      console.log(`❌ Erreur: ${error}`);
      results.push({
        name: validator.name,
        passed: false,
        expected: "N/A",
        actual: `Erreur: ${error}`,
        source: validator.source,
        fixable: false,
      });
    }
  }

  // Summary
  console.log("\n" + "=".repeat(50));
  console.log("📊 Résumé\n");
  console.log(`Total: ${VALIDATORS.length}`);
  console.log(`Valides: ${passed} ✅`);
  console.log(`Invalides: ${failed} ❌`);

  if (failed > 0) {
    console.log("\n⚠️ Données potentiellement obsolètes détectées.");
    console.log("Actions recommandées :");

    for (const result of results.filter((r) => !r.passed)) {
      console.log(`\n• ${result.name}`);
      console.log(`  Attendu: ${result.expected}`);
      console.log(`  Trouvé: ${result.actual}`);
      if (result.fixable) {
        console.log(`  → Peut être corrigé via sync ou corrections manuelles`);
      }
      if (result.details) {
        console.log(`  → ${result.details}`);
      }
    }
  }

  console.log("");
  process.exit(failed > 0 ? 1 : 0);
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
