/**
 * Script d'audit des affaires judiciaires
 *
 * Vérifie :
 * - Affaires sans source
 * - Sources avec URLs inaccessibles (404, etc.)
 * - Catégories sensibles (AGRESSION_SEXUELLE, HARCELEMENT_SEXUEL)
 * - Statuts CONDAMNATION_DEFINITIVE à vérifier
 *
 * Usage :
 *   npx tsx scripts/audit-affairs.ts
 *   npx tsx scripts/audit-affairs.ts --check-urls  # Vérifie les URLs (lent)
 *   npx tsx scripts/audit-affairs.ts --export      # Exporte en CSV
 */

import { PrismaClient, AffairCategory, AffairStatus } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { config } from "dotenv";
import * as fs from "fs";

config();

// Initialize Prisma
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

// Sensitive categories that require manual verification
const SENSITIVE_CATEGORIES: AffairCategory[] = ["AGRESSION_SEXUELLE", "HARCELEMENT_SEXUEL"];

// Statuses that require verification (ensure no appeal in progress)
const DEFINITIVE_STATUSES: AffairStatus[] = ["CONDAMNATION_DEFINITIVE"];

interface AuditResult {
  affairsWithoutSources: AffairInfo[];
  brokenUrls: BrokenUrl[];
  sensitiveCategories: AffairInfo[];
  definitiveToVerify: AffairInfo[];
  summary: {
    totalAffairs: number;
    withoutSources: number;
    brokenUrls: number;
    sensitiveCount: number;
    definitiveCount: number;
  };
}

interface AffairInfo {
  id: string;
  title: string;
  politicianName: string;
  category: AffairCategory;
  status: AffairStatus;
  sourceCount: number;
  sourceUrls: string[];
}

interface BrokenUrl {
  affairId: string;
  affairTitle: string;
  politicianName: string;
  url: string;
  error: string;
}

/**
 * Check if a URL is accessible
 */
async function checkUrl(url: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; TransparencePolitique/1.0)",
      },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return { ok: false, error: `HTTP ${response.status}` };
    }

    return { ok: true };
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === "AbortError") {
        return { ok: false, error: "Timeout (10s)" };
      }
      return { ok: false, error: error.message };
    }
    return { ok: false, error: "Unknown error" };
  }
}

/**
 * Fetch all affairs with sources and politician info
 */
async function fetchAffairs() {
  return db.affair.findMany({
    include: {
      sources: true,
      politician: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Run the audit
 */
async function runAudit(checkUrls: boolean): Promise<AuditResult> {
  console.log("Fetching affairs from database...");
  const affairs = await fetchAffairs();
  console.log(`Found ${affairs.length} affairs\n`);

  const result: AuditResult = {
    affairsWithoutSources: [],
    brokenUrls: [],
    sensitiveCategories: [],
    definitiveToVerify: [],
    summary: {
      totalAffairs: affairs.length,
      withoutSources: 0,
      brokenUrls: 0,
      sensitiveCount: 0,
      definitiveCount: 0,
    },
  };

  const allUrls: { affair: (typeof affairs)[0]; url: string }[] = [];

  for (const affair of affairs) {
    const politicianName = `${affair.politician.firstName} ${affair.politician.lastName}`;
    const affairInfo: AffairInfo = {
      id: affair.id,
      title: affair.title,
      politicianName,
      category: affair.category,
      status: affair.status,
      sourceCount: affair.sources.length,
      sourceUrls: affair.sources.map((s) => s.url),
    };

    // Check: no sources
    if (affair.sources.length === 0) {
      result.affairsWithoutSources.push(affairInfo);
      result.summary.withoutSources++;
    }

    // Check: sensitive categories
    if (SENSITIVE_CATEGORIES.includes(affair.category)) {
      result.sensitiveCategories.push(affairInfo);
      result.summary.sensitiveCount++;
    }

    // Check: definitive convictions
    if (DEFINITIVE_STATUSES.includes(affair.status)) {
      result.definitiveToVerify.push(affairInfo);
      result.summary.definitiveCount++;
    }

    // Collect URLs for checking
    if (checkUrls) {
      for (const source of affair.sources) {
        allUrls.push({ affair, url: source.url });
      }
    }
  }

  // Check URLs if requested
  if (checkUrls && allUrls.length > 0) {
    console.log(`Checking ${allUrls.length} URLs (this may take a while)...\n`);

    for (let i = 0; i < allUrls.length; i++) {
      const { affair, url } = allUrls[i]!;
      const politicianName = `${affair.politician.firstName} ${affair.politician.lastName}`;

      process.stdout.write(`  [${i + 1}/${allUrls.length}] Checking ${url.substring(0, 50)}...`);

      const { ok, error } = await checkUrl(url);

      if (!ok) {
        console.log(` BROKEN (${error})`);
        result.brokenUrls.push({
          affairId: affair.id,
          affairTitle: affair.title,
          politicianName,
          url,
          error: error || "Unknown",
        });
        result.summary.brokenUrls++;
      } else {
        console.log(" OK");
      }

      // Rate limiting
      await new Promise((r) => setTimeout(r, 200));
    }
    console.log();
  }

  return result;
}

/**
 * Print the audit report
 */
function printReport(result: AuditResult) {
  console.log("=".repeat(60));
  console.log("AUDIT REPORT - AFFAIRES JUDICIAIRES");
  console.log("=".repeat(60));
  console.log();

  console.log("SUMMARY");
  console.log("-".repeat(40));
  console.log(`Total affairs:           ${result.summary.totalAffairs}`);
  console.log(
    `Without sources:         ${result.summary.withoutSources} ${result.summary.withoutSources > 0 ? "⚠️" : "✓"}`
  );
  console.log(
    `Broken URLs:             ${result.summary.brokenUrls} ${result.summary.brokenUrls > 0 ? "⚠️" : "✓"}`
  );
  console.log(`Sensitive categories:    ${result.summary.sensitiveCount} (require manual review)`);
  console.log(`Definitive convictions:  ${result.summary.definitiveCount} (require verification)`);
  console.log();

  if (result.affairsWithoutSources.length > 0) {
    console.log("AFFAIRS WITHOUT SOURCES (CRITICAL)");
    console.log("-".repeat(40));
    for (const affair of result.affairsWithoutSources) {
      console.log(`  - ${affair.politicianName}: "${affair.title}"`);
      console.log(`    Category: ${affair.category}, Status: ${affair.status}`);
    }
    console.log();
  }

  if (result.brokenUrls.length > 0) {
    console.log("BROKEN URLs");
    console.log("-".repeat(40));
    for (const broken of result.brokenUrls) {
      console.log(`  - ${broken.politicianName}: "${broken.affairTitle}"`);
      console.log(`    URL: ${broken.url}`);
      console.log(`    Error: ${broken.error}`);
    }
    console.log();
  }

  if (result.sensitiveCategories.length > 0) {
    console.log("SENSITIVE CATEGORIES (REQUIRE MANUAL VERIFICATION)");
    console.log("-".repeat(40));
    for (const affair of result.sensitiveCategories) {
      console.log(`  - ${affair.politicianName}: "${affair.title}"`);
      console.log(`    Category: ${affair.category}, Status: ${affair.status}`);
      if (affair.sourceUrls.length > 0) {
        console.log(`    Sources: ${affair.sourceUrls.join(", ")}`);
      }
    }
    console.log();
  }

  if (result.definitiveToVerify.length > 0) {
    console.log("DEFINITIVE CONVICTIONS (VERIFY NO APPEAL IN PROGRESS)");
    console.log("-".repeat(40));
    for (const affair of result.definitiveToVerify) {
      console.log(`  - ${affair.politicianName}: "${affair.title}"`);
      console.log(`    Category: ${affair.category}`);
      if (affair.sourceUrls.length > 0) {
        console.log(`    Sources: ${affair.sourceUrls.join(", ")}`);
      }
    }
    console.log();
  }

  console.log("=".repeat(60));
  console.log("RECOMMENDATIONS");
  console.log("=".repeat(60));
  console.log();

  if (result.summary.withoutSources > 0) {
    console.log("1. ADD SOURCES to affairs without documentation");
    console.log("   These affairs are legally risky without sources.");
    console.log();
  }

  if (result.summary.brokenUrls > 0) {
    console.log("2. FIX BROKEN URLS or add archive.org backups");
    console.log("   Use archive.org to create permanent copies.");
    console.log();
  }

  if (result.summary.sensitiveCount > 0) {
    console.log("3. VERIFY SENSITIVE CATEGORIES manually");
    console.log("   - AGRESSION_SEXUELLE: confirm it's not simple VIOLENCE");
    console.log("   - HARCELEMENT_SEXUEL: confirm it's not HARCELEMENT_MORAL");
    console.log();
  }

  if (result.summary.definitiveCount > 0) {
    console.log("4. VERIFY DEFINITIVE CONVICTIONS");
    console.log("   - Check that no appeal or cassation is pending");
    console.log("   - If appeal in progress, change to APPEL_EN_COURS");
    console.log();
  }
}

/**
 * Export results to CSV
 */
function exportToCsv(result: AuditResult) {
  const timestamp = new Date().toISOString().split("T")[0];
  const filename = `audit-affairs-${timestamp}.csv`;

  const rows: string[] = ["Type,Politician,Title,Category,Status,Sources,URLs,Issue"];

  for (const affair of result.affairsWithoutSources) {
    rows.push(
      `NO_SOURCE,"${affair.politicianName}","${affair.title}",${affair.category},${affair.status},0,,Missing sources`
    );
  }

  for (const broken of result.brokenUrls) {
    rows.push(
      `BROKEN_URL,"${broken.politicianName}","${broken.affairTitle}",,,,${broken.url},${broken.error}`
    );
  }

  for (const affair of result.sensitiveCategories) {
    rows.push(
      `SENSITIVE,"${affair.politicianName}","${affair.title}",${affair.category},${affair.status},${affair.sourceCount},"${affair.sourceUrls.join(";")}",Needs manual verification`
    );
  }

  for (const affair of result.definitiveToVerify) {
    rows.push(
      `DEFINITIVE,"${affair.politicianName}","${affair.title}",${affair.category},${affair.status},${affair.sourceCount},"${affair.sourceUrls.join(";")}",Verify no appeal pending`
    );
  }

  fs.writeFileSync(filename, rows.join("\n"), "utf-8");
  console.log(`\nExported to ${filename}`);
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  const checkUrls = args.includes("--check-urls");
  const exportCsv = args.includes("--export");

  console.log("AUDIT DES AFFAIRES JUDICIAIRES");
  console.log("==============================\n");

  if (checkUrls) {
    console.log("Mode: URL checking enabled (slow)\n");
  }

  try {
    const result = await runAudit(checkUrls);
    printReport(result);

    if (exportCsv) {
      exportToCsv(result);
    }

    // Exit with error code if critical issues found
    if (result.summary.withoutSources > 0) {
      console.log("\n⚠️  Critical issues found (affairs without sources)");
      process.exit(1);
    }

    console.log("\n✓ Audit completed successfully");
  } catch (error) {
    console.error("Error during audit:", error);
    process.exit(1);
  } finally {
    await db.$disconnect();
    await pool.end();
  }
}

main();
