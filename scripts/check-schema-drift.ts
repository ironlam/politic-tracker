/**
 * Refuse a `db:push` that would destroy something.
 *
 * `db:push` makes the database match `schema.prisma`. Anything living in the
 * database that the schema does not declare is, from its point of view, junk to
 * remove. Two performance indexes are in exactly that position: both were
 * created by real migrations, in raw SQL inside the migration file, so the
 * schema never learned about them.
 *
 *   idx_commune_name_trgm              GIN trigram, backs ILIKE over 34 969 communes
 *   SearchEmbedding_embedding_hnsw_idx HNSW, backs vector search
 *
 * Dropping them breaks nothing and raises no error: queries just fall back to
 * sequential scans until somebody notices the site got slow. The guard sits on
 * the command that would do it rather than in a test suite, because a test that
 * skips without a database would report success on the one machine that matters.
 *
 * Usage: run automatically by `npm run db:push`.
 *   --allow=DROP_INDEX  acknowledge a deliberate index removal
 */
import { execFileSync } from "node:child_process";

const args = process.argv.slice(2);
const allowed = new Set(
  args
    .filter((a) => a.startsWith("--allow="))
    .flatMap((a) => a.split("=")[1]!.split(","))
    .map((a) => a.trim().toUpperCase())
);

/** Statements that remove something a user or a query depends on. */
const DESTRUCTIVE = [
  { token: "DROP INDEX", label: "DROP_INDEX" },
  { token: "DROP COLUMN", label: "DROP_COLUMN" },
  { token: "DROP TABLE", label: "DROP_TABLE" },
  { token: "DROP CONSTRAINT", label: "DROP_CONSTRAINT" },
];

function main() {
  let sql: string;
  try {
    sql = execFileSync(
      "npx",
      [
        "prisma",
        "migrate diff",
        "--from-config-datasource",
        "--to-schema",
        "prisma/schema.prisma",
        "--script",
      ].flatMap((a) => a.split(" ")),
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
    );
  } catch (err) {
    console.error("Impossible de calculer le diff de schéma :");
    console.error(err instanceof Error ? err.message : err);
    // Ne pas laisser passer un push parce que la vérification a échoué.
    process.exit(1);
  }

  const found = DESTRUCTIVE.filter((d) => sql.toUpperCase().includes(d.token)).filter(
    (d) => !allowed.has(d.label)
  );

  if (found.length === 0) {
    console.log("Aucune opération destructrice dans le diff. db:push peut continuer.");
    return;
  }

  console.error("");
  console.error("db:push REFUSÉ : le diff contient des opérations destructrices.");
  console.error("");
  for (const d of found) {
    for (const line of sql.split("\n")) {
      if (line.toUpperCase().includes(d.token)) console.error("   " + line.trim());
    }
  }
  console.error("");
  console.error("Deux index de performance vivent en base sans être déclarés au schéma :");
  console.error("  idx_commune_name_trgm              (GIN trigram, recherche ILIKE des communes)");
  console.error("  SearchEmbedding_embedding_hnsw_idx (HNSW, recherche vectorielle)");
  console.error("Les perdre ne casse rien : ça dégrade en silence.");
  console.error("");
  console.error("Pour un changement ciblé, écrire l'ALTER TABLE à la main.");
  console.error(
    `Pour assumer une suppression : npm run db:push -- --allow=${found.map((f) => f.label).join(",")}`
  );
  process.exit(1);
}

main();
