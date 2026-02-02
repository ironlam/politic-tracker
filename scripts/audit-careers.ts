/**
 * Script d'audit des carrières politiques
 *
 * Vérifie :
 * - Politiciens sans mandat
 * - Politiciens sans date de naissance
 * - Mandats incohérents (dates impossibles)
 * - Mandats trop longs (>50 ans)
 * - Mandats dans le futur
 * - Photos manquantes
 *
 * Usage :
 *   npx tsx scripts/audit-careers.ts
 *   npx tsx scripts/audit-careers.ts --export
 */

import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { config } from "dotenv";
import * as fs from "fs";

config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

interface Issue {
  type: string;
  severity: "critical" | "warning" | "info";
  politicianId: string;
  politicianName: string;
  details: string;
}

async function auditCareers(): Promise<Issue[]> {
  const issues: Issue[] = [];
  const now = new Date();
  const currentYear = now.getFullYear();

  console.log("Fetching politicians...");
  const politicians = await db.politician.findMany({
    include: {
      mandates: true,
      currentParty: { select: { name: true } },
    },
  });
  console.log(`Found ${politicians.length} politicians\n`);

  for (const p of politicians) {
    const name = `${p.firstName} ${p.lastName}`;

    // Check: No mandates
    if (p.mandates.length === 0) {
      issues.push({
        type: "NO_MANDATES",
        severity: "warning",
        politicianId: p.id,
        politicianName: name,
        details: "Aucun mandat enregistré",
      });
    }

    // Check: No birth date
    if (!p.birthDate) {
      issues.push({
        type: "NO_BIRTHDATE",
        severity: "info",
        politicianId: p.id,
        politicianName: name,
        details: "Date de naissance manquante",
      });
    }

    // Check: No photo
    if (!p.photoUrl) {
      issues.push({
        type: "NO_PHOTO",
        severity: "info",
        politicianId: p.id,
        politicianName: name,
        details: "Photo manquante",
      });
    }

    // Check: Born after first mandate
    if (p.birthDate && p.mandates.length > 0) {
      const birthYear = new Date(p.birthDate).getFullYear();
      const firstMandateYear = Math.min(
        ...p.mandates.map((m) => new Date(m.startDate).getFullYear())
      );
      if (birthYear > firstMandateYear) {
        issues.push({
          type: "BIRTH_AFTER_MANDATE",
          severity: "critical",
          politicianId: p.id,
          politicianName: name,
          details: `Né en ${birthYear} mais mandat débutant en ${firstMandateYear}`,
        });
      }
    }

    // Check: Too young for mandate (< 18)
    if (p.birthDate && p.mandates.length > 0) {
      const birthYear = new Date(p.birthDate).getFullYear();
      const firstMandateYear = Math.min(
        ...p.mandates.map((m) => new Date(m.startDate).getFullYear())
      );
      const ageAtFirstMandate = firstMandateYear - birthYear;
      if (ageAtFirstMandate < 18) {
        issues.push({
          type: "TOO_YOUNG",
          severity: "warning",
          politicianId: p.id,
          politicianName: name,
          details: `${ageAtFirstMandate} ans au premier mandat (${firstMandateYear})`,
        });
      }
    }

    // Check mandates
    for (const m of p.mandates) {
      const startYear = new Date(m.startDate).getFullYear();
      const endYear = m.endDate ? new Date(m.endDate).getFullYear() : currentYear;

      // Mandate in future
      if (startYear > currentYear) {
        issues.push({
          type: "FUTURE_MANDATE",
          severity: "critical",
          politicianId: p.id,
          politicianName: name,
          details: `Mandat ${m.type} débutant en ${startYear}`,
        });
      }

      // End before start
      if (m.endDate && new Date(m.endDate) < new Date(m.startDate)) {
        issues.push({
          type: "END_BEFORE_START",
          severity: "critical",
          politicianId: p.id,
          politicianName: name,
          details: `Mandat ${m.type}: fin avant début`,
        });
      }

      // Too long mandate (>50 years)
      const duration = endYear - startYear;
      if (duration > 50) {
        issues.push({
          type: "LONG_MANDATE",
          severity: "warning",
          politicianId: p.id,
          politicianName: name,
          details: `Mandat ${m.type} de ${duration} ans (${startYear}-${endYear})`,
        });
      }

      // Very old mandate (before Ve République)
      if (startYear < 1958) {
        issues.push({
          type: "OLD_MANDATE",
          severity: "warning",
          politicianId: p.id,
          politicianName: name,
          details: `Mandat ${m.type} débutant en ${startYear} (avant Ve République)`,
        });
      }
    }

    // Check: Dead but has current mandate
    if (p.deathDate) {
      const currentMandates = p.mandates.filter((m) => m.isCurrent);
      if (currentMandates.length > 0) {
        issues.push({
          type: "DEAD_WITH_CURRENT",
          severity: "critical",
          politicianId: p.id,
          politicianName: name,
          details: `Décédé mais ${currentMandates.length} mandat(s) marqué(s) comme actuel(s)`,
        });
      }
    }
  }

  return issues;
}

function printReport(issues: Issue[]) {
  console.log("=".repeat(60));
  console.log("AUDIT REPORT - CARRIÈRES POLITIQUES");
  console.log("=".repeat(60));
  console.log();

  const critical = issues.filter((i) => i.severity === "critical");
  const warnings = issues.filter((i) => i.severity === "warning");
  const info = issues.filter((i) => i.severity === "info");

  console.log("SUMMARY");
  console.log("-".repeat(40));
  console.log(`Critical issues:  ${critical.length} ${critical.length > 0 ? "⚠️" : "✓"}`);
  console.log(`Warnings:         ${warnings.length}`);
  console.log(`Info:             ${info.length}`);
  console.log();

  if (critical.length > 0) {
    console.log("CRITICAL ISSUES");
    console.log("-".repeat(40));
    for (const issue of critical) {
      console.log(`  [${issue.type}] ${issue.politicianName}`);
      console.log(`    ${issue.details}`);
    }
    console.log();
  }

  if (warnings.length > 0) {
    console.log("WARNINGS (first 30)");
    console.log("-".repeat(40));
    for (const issue of warnings.slice(0, 30)) {
      console.log(`  [${issue.type}] ${issue.politicianName}`);
      console.log(`    ${issue.details}`);
    }
    if (warnings.length > 30) {
      console.log(`  ... et ${warnings.length - 30} autres`);
    }
    console.log();
  }

  // Group info by type
  const infoByType = new Map<string, number>();
  for (const issue of info) {
    infoByType.set(issue.type, (infoByType.get(issue.type) || 0) + 1);
  }

  console.log("INFO (summary)");
  console.log("-".repeat(40));
  for (const [type, count] of infoByType) {
    console.log(`  ${type}: ${count} politiciens`);
  }
  console.log();
}

function exportToCsv(issues: Issue[]) {
  const timestamp = new Date().toISOString().split("T")[0];
  const filename = `audit-careers-${timestamp}.csv`;

  const rows = [
    "Severity,Type,PoliticianName,PoliticianId,Details",
    ...issues.map(
      (i) =>
        `${i.severity},"${i.politicianName}","${i.type}","${i.politicianId}","${i.details}"`
    ),
  ];

  fs.writeFileSync(filename, rows.join("\n"), "utf-8");
  console.log(`Exported to ${filename}`);
}

async function main() {
  const exportCsv = process.argv.includes("--export");

  console.log("AUDIT DES CARRIÈRES POLITIQUES");
  console.log("==============================\n");

  try {
    const issues = await auditCareers();
    printReport(issues);

    if (exportCsv) {
      exportToCsv(issues);
    }

    // Exit with error if critical issues
    if (issues.filter((i) => i.severity === "critical").length > 0) {
      console.log("\n⚠️  Critical issues found!");
      process.exit(1);
    }

    console.log("✓ Audit completed");
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  } finally {
    await db.$disconnect();
    await pool.end();
  }
}

main();
