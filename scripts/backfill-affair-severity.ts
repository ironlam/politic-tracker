/**
 * Backfill severity and isRelatedToMandate for all existing affairs.
 * Run: npx dotenv -e .env -- npx tsx scripts/backfill-affair-severity.ts
 */
import { Pool } from "pg";

// Inline the mapping to avoid ESM/TS import issues in scripts
const INHERENT_CATEGORIES = [
  "CORRUPTION",
  "CORRUPTION_PASSIVE",
  "TRAFIC_INFLUENCE",
  "PRISE_ILLEGALE_INTERETS",
  "FAVORITISME",
  "DETOURNEMENT_FONDS_PUBLICS",
  "EMPLOI_FICTIF",
  "FINANCEMENT_ILLEGAL_CAMPAGNE",
  "FINANCEMENT_ILLEGAL_PARTI",
  "INCITATION_HAINE",
];

const CATEGORY_DEFAULT_SEVERITY: Record<string, string> = {
  CORRUPTION: "CRITIQUE",
  CORRUPTION_PASSIVE: "CRITIQUE",
  TRAFIC_INFLUENCE: "CRITIQUE",
  PRISE_ILLEGALE_INTERETS: "CRITIQUE",
  FAVORITISME: "CRITIQUE",
  DETOURNEMENT_FONDS_PUBLICS: "CRITIQUE",
  EMPLOI_FICTIF: "CRITIQUE",
  FINANCEMENT_ILLEGAL_CAMPAGNE: "CRITIQUE",
  FINANCEMENT_ILLEGAL_PARTI: "CRITIQUE",
  INCITATION_HAINE: "CRITIQUE",
  AGRESSION_SEXUELLE: "GRAVE",
  HARCELEMENT_SEXUEL: "GRAVE",
  HARCELEMENT_MORAL: "GRAVE",
  FRAUDE_FISCALE: "GRAVE",
  BLANCHIMENT: "GRAVE",
  ABUS_BIENS_SOCIAUX: "GRAVE",
  ABUS_CONFIANCE: "GRAVE",
  FAUX_ET_USAGE_FAUX: "GRAVE",
  RECEL: "GRAVE",
  CONFLIT_INTERETS: "GRAVE",
  MENACE: "GRAVE",
  VIOLENCE: "SIGNIFICATIF",
  DIFFAMATION: "SIGNIFICATIF",
  INJURE: "SIGNIFICATIF",
  AUTRE: "SIGNIFICATIF",
};

const SEVERITY_ORDER = ["CRITIQUE", "GRAVE", "SIGNIFICATIF"];

function computeSeverity(category: string, isRelatedToMandate: boolean): string {
  const base = CATEGORY_DEFAULT_SEVERITY[category] || "SIGNIFICATIF";
  if (!isRelatedToMandate) return base;
  const idx = SEVERITY_ORDER.indexOf(base);
  return idx > 0 ? SEVERITY_ORDER[idx - 1] : base;
}

async function main() {
  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
  // Append sslmode if not present (Supabase requires SSL)
  const url = new URL(connectionString!);
  if (!url.searchParams.has("sslmode")) {
    url.searchParams.set("sslmode", "require");
  }
  const pool = new Pool({ connectionString: url.toString() });

  try {
    // 1. Set isRelatedToMandate for inherent probity categories
    const inherentResult = await pool.query(
      `UPDATE "Affair" SET "isRelatedToMandate" = true WHERE category::text = ANY($1::text[])`,
      [INHERENT_CATEGORIES],
    );
    console.log(
      `Set isRelatedToMandate=true for ${inherentResult.rowCount} probity affairs`,
    );

    // 2. Compute severity for all affairs
    const affairs = await pool.query(
      `SELECT id, category, "isRelatedToMandate" FROM "Affair"`,
    );

    let updated = 0;
    for (const affair of affairs.rows) {
      const severity = computeSeverity(affair.category, affair.isRelatedToMandate);
      await pool.query(
        `UPDATE "Affair" SET severity = $1::"AffairSeverity" WHERE id = $2`,
        [severity, affair.id],
      );
      updated++;
    }

    console.log(`Updated severity for ${updated} affairs`);

    // 3. Verify
    const stats = await pool.query(
      `SELECT severity, COUNT(*) as count FROM "Affair" GROUP BY severity ORDER BY severity`,
    );
    console.log("\nSeverity distribution:");
    for (const row of stats.rows) {
      console.log(`  ${row.severity}: ${row.count}`);
    }
  } finally {
    await pool.end();
  }
}

main().catch(console.error);
