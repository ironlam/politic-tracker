/**
 * Web discovery pass: find judicial affairs the other sources never see.
 *
 * `discover-affairs` reads Wikidata and Wikipedia. Press analysis reads the
 * ingested feeds. A mayor of a sub-prefecture convicted locally appears in
 * none of the three, which is why a search engine finds cases Poligraph does
 * not. Measured on the live base, the scheduled pass covers 2.92% of published
 * politicians and skips Wikipedia entirely.
 *
 * The chain is deliberately cheap before it is smart:
 *   1. one Brave query per politician, best-value first
 *   2. `searchBrave` already drops anything outside TRUSTED_PUBLISHERS
 *   3. a deterministic screen drops results with no judicial term, no surname,
 *      or a title naming somebody else's case
 *   4. only the survivors cost an AI call, which answers the one question a
 *      keyword cannot: is this person the SUBJECT of the procedure?
 *
 * Output is always a DRAFT affair. Nothing here publishes, and the moderation
 * queue is where a human decides.
 */
import { db } from "@/lib/db";
import { searchBrave, isBraveQuotaError, type BraveSearchResult } from "@/lib/api/brave-search";
import { callAnthropic, extractToolUse } from "@/lib/api/anthropic";
import { BRAVE_SEARCH_RATE_LIMIT_MS } from "@/config/rate-limits";
import { selectSearchTargets, type SearchTarget } from "@/lib/affair-discovery/search-priority";
import { screenWebResult } from "@/lib/affair-discovery/web-lead-filter";
import { createDraftAffairFromDiscovery } from "@/services/affairs/create-draft";

const MODEL = "claude-sonnet-5";

export interface WebDiscoveryStats {
  politiciansSearched: number;
  resultsReturned: number;
  resultsScreenedOut: number;
  resultsJudged: number;
  affairsCreated: number;
  /** Politiciens distincts pour lesquels au moins un brouillon est né. */
  politiciansWithFinding: number;
  /** Pistes écartées parce que la source est déjà attachée à une affaire. */
  duplicatesSkipped: number;
  quotaExhausted: boolean;
  errors: string[];
}

const JUDGE_TOOL = {
  name: "juger_piste",
  description:
    "Décide si un résultat de presse décrit une procédure judiciaire visant le politicien nommé.",
  input_schema: {
    type: "object" as const,
    properties: {
      is_subject: {
        type: "boolean",
        description:
          "true UNIQUEMENT si le politicien est la personne visée par la procédure. false s'il est cité, s'il commente, s'il est un homonyme, ou si l'affaire vise quelqu'un d'autre.",
      },
      confidence: { type: "integer", minimum: 0, maximum: 100 },
      reasoning: { type: "string", description: "Justification courte, en français." },
      suggested_title: {
        type: ["string", "null"],
        description:
          "Titre factuel de l'affaire si is_subject est true, sinon null. Format : « Mise en examen de X pour Y ».",
      },
    },
    required: ["is_subject", "confidence", "reasoning", "suggested_title"],
  },
};

const JUDGE_SYSTEM = `Tu qualifies des résultats de recherche pour Poligraph, un observatoire citoyen de la transparence politique.

UNE SEULE QUESTION : le politicien nommé est-il la personne VISÉE par une procédure judiciaire dans ce résultat ?

Réponds is_subject = false si :
- le politicien commente, réagit ou est interrogé sur l'affaire d'un tiers
- l'affaire porte le nom d'une autre personne
- il s'agit d'un homonyme (vérifie la cohérence avec la fonction indiquée)
- le résultat décrit une proposition de loi, un débat ou une position politique sur la justice
- le politicien est victime ou plaignant sans être mis en cause

Réponds is_subject = true uniquement si une procédure vise nommément cette personne.

PRÉSOMPTION D'INNOCENCE : ne qualifie jamais une mise en examen de condamnation. En cas de doute, réponds false : un faux positif coûte plus cher qu'un oubli.`;

interface Judgment {
  isSubject: boolean;
  confidence: number;
  reasoning: string;
  suggestedTitle: string | null;
}

async function judgeLead(target: SearchTarget, result: BraveSearchResult): Promise<Judgment> {
  const content = `Politicien : ${target.fullName}
Résultat de recherche :
  Titre : ${result.title}
  Éditeur : ${result.publisher}
  Extrait : ${result.description}
  URL : ${result.url}`;

  const data = await callAnthropic([{ role: "user", content }], {
    label: "affair-discovery-web",
    // Pas de cachePrefix : le prompt système fait 349 tokens, mesurés, contre
    // 1024 requis sur Sonnet. Le marqueur serait un no-op silencieux, et le
    // laisser ferait croire à une économie inexistante.
    thinking: { type: "disabled" },
    model: MODEL,
    maxTokens: 700,
    system: JUDGE_SYSTEM,
    tools: [JUDGE_TOOL],
    toolChoice: { type: "tool", name: "juger_piste" },
  });

  const raw = extractToolUse(data) as Record<string, unknown> | null;
  if (!raw) throw new Error("No tool_use content in judge response");

  return {
    isSubject: raw.is_subject === true,
    confidence: typeof raw.confidence === "number" ? raw.confidence : 0,
    reasoning: String(raw.reasoning ?? ""),
    suggestedTitle: raw.suggested_title ? String(raw.suggested_title) : null,
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function discoverAffairsWeb(options: {
  limit: number;
  dryRun?: boolean;
}): Promise<WebDiscoveryStats> {
  const { limit, dryRun = false } = options;

  const stats: WebDiscoveryStats = {
    politiciansSearched: 0,
    resultsReturned: 0,
    resultsScreenedOut: 0,
    resultsJudged: 0,
    affairsCreated: 0,
    politiciansWithFinding: 0,
    duplicatesSkipped: 0,
    quotaExhausted: false,
    errors: [],
  };

  const targets = await selectSearchTargets(limit);

  for (const target of targets) {
    const query = `"${target.fullName}" condamné OR "mis en examen" OR procès OR détournement`;

    let results: BraveSearchResult[];
    try {
      results = await searchBrave(query);
      stats.politiciansSearched++;
    } catch (err) {
      if (isBraveQuotaError(err)) {
        // Le solde est épuisé : continuer brûlerait des requêtes vouées à échouer.
        stats.quotaExhausted = true;
        stats.errors.push(`quota Brave épuisé après ${stats.politiciansSearched} recherches`);
        break;
      }
      stats.errors.push(`${target.fullName} : ${err instanceof Error ? err.message : String(err)}`);
      await sleep(BRAVE_SEARCH_RATE_LIMIT_MS);
      continue;
    }

    stats.resultsReturned += results.length;

    // Un élu ne produit qu'un brouillon par passe. La mesure sur 200 élus a
    // montré cinq résultats pour la MÊME mise en examen de Steeve Briois :
    // sans ce garde, une affaire médiatisée inonde la file de modération.
    let alreadyFoundForTarget = false;

    for (const result of results) {
      if (alreadyFoundForTarget) break;

      const screen = screenWebResult(result, {
        firstName: target.firstName,
        lastName: target.lastName,
      });
      if (!screen.keep) {
        stats.resultsScreenedOut++;
        continue;
      }

      let judgment: Judgment;
      try {
        judgment = await judgeLead(target, result);
        stats.resultsJudged++;
      } catch (err) {
        stats.errors.push(
          `jugement ${target.fullName} : ${err instanceof Error ? err.message : String(err)}`
        );
        continue;
      }

      if (!judgment.isSubject) continue;

      // Cette source est-elle déjà attachée à une affaire de cet élu ? Le
      // pipeline redécouvrirait sinon ce qui est déjà documenté, à chaque passe.
      const known = await db.source.findFirst({
        where: { url: result.url, affair: { politicianId: target.id } },
        select: { id: true },
      });
      if (known) {
        stats.duplicatesSkipped++;
        continue;
      }

      alreadyFoundForTarget = true;
      stats.politiciansWithFinding++;

      if (dryRun) {
        stats.affairsCreated++;
        console.log(
          `  [DRY-RUN] ${target.fullName} : ${judgment.suggestedTitle} (${judgment.confidence} %)`
        );
        continue;
      }

      await createDraftFromLead(target, result, judgment);
      stats.affairsCreated++;
    }

    // Estampiller même sans trouvaille : c'est ce qui fait avancer la rotation.
    // Sans ça la passe rechercherait indéfiniment les mêmes premiers élus, le
    // défaut que le curseur de discover-affairs avait déjà corrigé une fois.
    if (!dryRun) {
      await db.politician.update({
        where: { id: target.id },
        data: { webSearchCheckedAt: new Date() },
      });
    }

    await sleep(BRAVE_SEARCH_RATE_LIMIT_MS);
  }

  return stats;
}

/**
 * A discovery always lands as a DRAFT with its source attached.
 *
 * Through `createDraftAffairFromDiscovery`, the only sanctioned door for a sync
 * service to create an affair (Affaires v2, lot 1). It forces DRAFT and a null
 * `verifiedAt` structurally, so no future edit here can publish by accident.
 *
 * Status stays at the least severe value and category at AUTRE: the judge
 * answered "is this person the subject", not "what exactly is the offence".
 * Guessing either would put an unreviewed legal qualification on a named person.
 */
async function createDraftFromLead(
  target: SearchTarget,
  result: BraveSearchResult,
  judgment: Judgment
): Promise<void> {
  const title = judgment.suggestedTitle ?? `Procédure judiciaire visant ${target.fullName}`;

  await createDraftAffairFromDiscovery({
    politicianId: target.id,
    title,
    baseSlug: `${target.lastName}-${title}`,
    description: `Piste détectée par recherche web le ${new Date().toISOString().slice(0, 10)}. ${judgment.reasoning}`,
    status: "ENQUETE_PRELIMINAIRE",
    category: "AUTRE",
    involvement: "MENTIONED_ONLY",
    confidenceScore: judgment.confidence,
    sources: [
      {
        url: result.url,
        title: result.title,
        publisher: result.publisher ?? "",
        publishedAt: new Date(),
        sourceType: "PRESSE",
      },
    ],
  });
}
