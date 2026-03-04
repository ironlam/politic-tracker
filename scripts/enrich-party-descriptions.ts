/**
 * Enrich party descriptions using Wikipedia + Claude.
 *
 * For each party:
 * 1. Look up its Wikipedia article via Wikidata Q-ID → frwiki sitelink
 * 2. Fetch the Wikipedia extract (plain text summary)
 * 3. Send the extract + DB metadata to Claude to generate a 500-800 char description
 * 4. Update the party in the database
 *
 * Usage:
 *   npx dotenv -e .env -- npx tsx scripts/enrich-party-descriptions.ts
 *   npx dotenv -e .env -- npx tsx scripts/enrich-party-descriptions.ts --dry-run
 *   npx dotenv -e .env -- npx tsx scripts/enrich-party-descriptions.ts --limit 5
 *   npx dotenv -e .env -- npx tsx scripts/enrich-party-descriptions.ts --party "Parti socialiste"
 */

import { db } from "../src/lib/db";
import { callAnthropic, extractText } from "../src/lib/api/anthropic";
import { sleep } from "../src/lib/utils";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const WIKIPEDIA_API = "https://fr.wikipedia.org/w/api.php";
const WIKIDATA_API = "https://www.wikidata.org/w/api.php";
const RATE_LIMIT_MS = 1000; // Be polite to Wikipedia
const ANTHROPIC_DELAY_MS = 500;

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const LIMIT = args.includes("--limit") ? parseInt(args[args.indexOf("--limit") + 1] || "0", 10) : 0;
const PARTY_FILTER = args.includes("--party") ? args[args.indexOf("--party") + 1] : null;
const ONLY_MISSING = args.includes("--only-missing");

// ---------------------------------------------------------------------------
// Wikipedia helpers
// ---------------------------------------------------------------------------

/**
 * Resolve a Wikidata Q-ID to a French Wikipedia article title.
 */
async function getWikipediaTitle(wikidataId: string): Promise<string | null> {
  const url = new URL(WIKIDATA_API);
  url.searchParams.set("action", "wbgetentities");
  url.searchParams.set("ids", wikidataId);
  url.searchParams.set("props", "sitelinks");
  url.searchParams.set("sitefilter", "frwiki");
  url.searchParams.set("format", "json");

  try {
    const res = await fetch(url.toString());
    if (!res.ok) return null;
    const data = (await res.json()) as {
      entities: Record<string, { sitelinks?: { frwiki?: { title: string } } }>;
    };
    return data.entities[wikidataId]?.sitelinks?.frwiki?.title ?? null;
  } catch {
    return null;
  }
}

/**
 * Fetch the plain-text extract from a French Wikipedia article.
 */
async function getWikipediaExtract(title: string): Promise<string | null> {
  const url = new URL(WIKIPEDIA_API);
  url.searchParams.set("action", "query");
  url.searchParams.set("titles", title);
  url.searchParams.set("prop", "extracts");
  url.searchParams.set("exintro", "false"); // Full article, not just intro
  url.searchParams.set("explaintext", "true"); // Plain text
  url.searchParams.set("exsectionformat", "plain");
  url.searchParams.set("format", "json");

  try {
    const res = await fetch(url.toString());
    if (!res.ok) return null;
    const data = (await res.json()) as {
      query: { pages: Record<string, { extract?: string }> };
    };
    const pages = data.query.pages;
    const page = Object.values(pages)[0];
    return page?.extract ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Claude description generation
// ---------------------------------------------------------------------------

interface PartyContext {
  name: string;
  shortName: string;
  foundedDate: string | null;
  dissolvedDate: string | null;
  politicalPosition: string | null;
  ideology: string | null;
  predecessorName: string | null;
  successorNames: string[];
  wikipediaExtract: string | null;
}

async function generateDescription(ctx: PartyContext): Promise<string | null> {
  const systemPrompt = `Tu es un rédacteur encyclopédique spécialisé dans la vie politique française.
Tu rédiges des descriptions factuelles, neutres et informatives pour des fiches de partis politiques sur un site civique.

Règles strictes :
- Entre 500 et 800 caractères (espaces compris)
- Ton encyclopédique neutre, pas de jugement de valeur
- Mentionner : positionnement politique, idéologie, date de fondation
- Si dissous : mentionner la dissolution et le contexte (fusion, succession, etc.)
- Si prédécesseur ou successeur connus : mentionner la filiation
- Pas de formule introductive type "Le parti X est..."  — commencer directement par le contenu
- Écrire en français
- Ne pas inventer de faits — se baser uniquement sur les informations fournies
- Pas de markdown, pas de listes à puces — texte continu uniquement`;

  const userPrompt = `Génère une description pour ce parti politique :

Nom : ${ctx.name}
Sigle : ${ctx.shortName}
Fondé le : ${ctx.foundedDate || "date inconnue"}
${ctx.dissolvedDate ? `Dissous le : ${ctx.dissolvedDate}` : "Parti toujours actif"}
Position politique : ${ctx.politicalPosition || "non renseignée"}
Idéologie : ${ctx.ideology || "non renseignée"}
${ctx.predecessorName ? `Prédécesseur : ${ctx.predecessorName}` : ""}
${ctx.successorNames.length > 0 ? `Successeur(s) : ${ctx.successorNames.join(", ")}` : ""}

${ctx.wikipediaExtract ? `Article Wikipedia (extrait) :\n${ctx.wikipediaExtract.slice(0, 4000)}` : "Pas d'article Wikipedia disponible."}

Rappel : entre 500 et 800 caractères, texte continu, ton neutre et factuel.`;

  try {
    const response = await callAnthropic([{ role: "user", content: userPrompt }], {
      model: "claude-sonnet-4-5-20250929",
      maxTokens: 500,
      system: systemPrompt,
    });

    const text = extractText(response);
    if (!text) return null;

    const cleaned = text.trim();
    if (cleaned.length < 200) {
      console.warn(`  ⚠ Description trop courte (${cleaned.length} chars), ignorée`);
      return null;
    }

    return cleaned;
  } catch (error) {
    console.error(`  ✗ Erreur Claude: ${error}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("=== Enrichissement des descriptions de partis ===");
  console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "PRODUCTION"}`);
  if (PARTY_FILTER) console.log(`Filtre: "${PARTY_FILTER}"`);
  if (ONLY_MISSING) console.log("Seulement les partis sans description");
  if (LIMIT) console.log(`Limite: ${LIMIT}`);
  console.log();

  // Fetch all parties with context
  const whereClause: Record<string, unknown> = {};
  if (PARTY_FILTER) {
    whereClause.name = { contains: PARTY_FILTER, mode: "insensitive" };
  }
  if (ONLY_MISSING) {
    whereClause.description = null;
  }

  let parties = await db.party.findMany({
    where: whereClause,
    select: {
      id: true,
      name: true,
      shortName: true,
      description: true,
      foundedDate: true,
      dissolvedDate: true,
      politicalPosition: true,
      ideology: true,
      predecessor: { select: { name: true } },
      successors: { select: { name: true } },
      externalIds: {
        where: { source: "WIKIDATA" },
        select: { externalId: true },
      },
    },
    orderBy: { name: "asc" },
  });

  if (LIMIT) parties = parties.slice(0, LIMIT);

  console.log(`${parties.length} partis à traiter\n`);

  let updated = 0;
  let skipped = 0;
  let errors = 0;
  let noWikipedia = 0;

  for (const party of parties) {
    const wikidataId = party.externalIds[0]?.externalId;
    console.log(
      `[${updated + skipped + errors + 1}/${parties.length}] ${party.name} (${party.shortName})`
    );

    // 1. Get Wikipedia article
    let wikipediaExtract: string | null = null;

    if (wikidataId) {
      const wpTitle = await getWikipediaTitle(wikidataId);
      if (wpTitle) {
        wikipediaExtract = await getWikipediaExtract(wpTitle);
        if (wikipediaExtract) {
          console.log(`  ✓ Wikipedia: "${wpTitle}" (${wikipediaExtract.length} chars)`);
        } else {
          console.log(`  ○ Wikipedia: page "${wpTitle}" sans extrait`);
        }
      } else {
        console.log(`  ○ Pas d'article Wikipedia FR pour ${wikidataId}`);
        noWikipedia++;
      }
      await sleep(RATE_LIMIT_MS);
    } else {
      console.log("  ○ Pas de Wikidata ID");
      noWikipedia++;
    }

    // 2. Generate description with Claude
    const ctx: PartyContext = {
      name: party.name,
      shortName: party.shortName,
      foundedDate: party.foundedDate?.toISOString().split("T")[0] ?? null,
      dissolvedDate: party.dissolvedDate?.toISOString().split("T")[0] ?? null,
      politicalPosition: party.politicalPosition,
      ideology: party.ideology,
      predecessorName: party.predecessor?.name ?? null,
      successorNames: party.successors.map((s) => s.name),
      wikipediaExtract,
    };

    const description = await generateDescription(ctx);

    if (!description) {
      errors++;
      continue;
    }

    console.log(`  ✓ Description: ${description.length} chars`);
    if (party.description) {
      console.log(`  ↻ Remplace: "${party.description.slice(0, 60)}..."`);
    }

    // 3. Update DB
    if (!DRY_RUN) {
      await db.party.update({
        where: { id: party.id },
        data: { description },
      });
    }

    updated++;
    await sleep(ANTHROPIC_DELAY_MS);
  }

  console.log("\n=== Résultats ===");
  console.log(`Mis à jour: ${updated}`);
  console.log(`Erreurs: ${errors}`);
  console.log(`Sans Wikipedia: ${noWikipedia}`);
  console.log(`Total: ${parties.length}`);

  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
