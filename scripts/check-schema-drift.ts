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
 * The guard also runs the push itself under `--push`. Chaining them with `&&`
 * looked simpler but was broken: `npm run db:push -- --allow=DROP_INDEX`
 * appends the flag to the END of the chain, so the guard never saw it and
 * Prisma got an option it does not accept.
 *
 * Usage:
 *   npm run db:drift                                 rapport seul
 *   npm run db:push                                  vérifie puis pousse
 *   npm run db:push -- --allow=DROP_INDEX            assume une suppression
 */
import { execFileSync } from "node:child_process";

const args = process.argv.slice(2);
const shouldPush = args.includes("--push");
const allowed = new Set(
  args
    .filter((a) => a.startsWith("--allow="))
    .flatMap((a) => a.split("=")[1]!.split(","))
    .map((a) => a.trim().toUpperCase())
);

/**
 * Objects that live in the database and that the schema cannot express.
 *
 * `SearchEmbedding_embedding_hnsw_idx` is an HNSW index on a vector column.
 * Prisma's `@@index(type:)` covers Gin, Gist, SpGist, Brin and Hash, not Hnsw,
 * so this one cannot be declared and its diff line is permanent. Listed here
 * rather than left as a blind spot: the guard still reports it, it simply does
 * not count as a reason to refuse.
 */
const UNDECLARABLE = ["SearchEmbedding_embedding_hnsw_idx"];

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

  const lines = sql.split("\n").map((l) => l.trim());
  const destructiveLines = lines.filter((line) =>
    DESTRUCTIVE.some((d) => line.toUpperCase().includes(d.token))
  );

  const blocking = destructiveLines.filter((line) => {
    if (UNDECLARABLE.some((name) => line.includes(name))) return false;
    const label = DESTRUCTIVE.find((d) => line.toUpperCase().includes(d.token))!.label;
    return !allowed.has(label);
  });

  const tolerated = destructiveLines.filter((l) => !blocking.includes(l));
  for (const line of tolerated) {
    console.log(`Toléré (non déclarable ou explicitement autorisé) : ${line}`);
  }

  if (blocking.length === 0) {
    console.log("Aucune opération destructrice bloquante dans le diff.");
    if (shouldPush) runPush();
    return;
  }

  console.error("");
  console.error("db:push REFUSÉ : le diff contient des opérations destructrices.");
  console.error("");
  for (const line of blocking) console.error("   " + line);
  console.error("");
  console.error("Un index de performance perdu ne casse rien : ça dégrade en silence.");
  console.error("");
  console.error("Pour un changement ciblé, écrire l'ALTER TABLE à la main.");
  const labels = [
    ...new Set(
      blocking.map((line) => DESTRUCTIVE.find((d) => line.toUpperCase().includes(d.token))!.label)
    ),
  ];
  console.error(`Pour assumer une suppression : npm run db:push -- --allow=${labels.join(",")}`);
  process.exit(1);
}

function runPush(): void {
  console.log("");
  execFileSync("npx", ["prisma", "db", "push"], { stdio: "inherit" });
}

main();
