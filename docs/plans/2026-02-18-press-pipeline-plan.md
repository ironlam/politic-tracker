# Amélioration Pipeline Presse — Plan d'implémentation

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Passer de 20 à ~100 articles analysés/jour, avec un système de tiers (Sonnet/Haiku), un pré-filtre mots-clés judiciaires, 6 nouvelles sources RSS, et une protection homonymes renforcée.

**Architecture:** Pré-filtre mots-clés sur `title + description` → articles Tier 1 (judiciaires) analysés avec Sonnet 4.5 pour haute précision, articles Tier 2 avec Haiku 4.5 pour couverture large. Liste de politiciens injectée dans le contexte Tier 1 pour la protection anti-homonymes.

**Tech Stack:** Next.js (TypeScript), Anthropic Claude API (Sonnet 4.5 + Haiku 4.5), Prisma/PostgreSQL, fast-xml-parser (RSS)

**Design doc:** `docs/plans/2026-02-18-press-pipeline-design.md`

---

## Task 1 : Pré-filtre mots-clés judiciaires

**Files:**
- Create: `src/config/press-keywords.ts`
- Create: `src/config/press-keywords.test.ts`

Ce module exporte la liste de mots-clés judiciaires et une fonction de classification Tier 1/Tier 2.

**Step 1: Write the failing test**

Create `src/config/press-keywords.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { classifyArticleTier, JUDICIAL_KEYWORDS } from "./press-keywords";

describe("JUDICIAL_KEYWORDS", () => {
  it("should export a non-empty array of keywords", () => {
    expect(JUDICIAL_KEYWORDS.length).toBeGreaterThan(30);
  });
});

describe("classifyArticleTier", () => {
  it("should return TIER_1 for article with 'mis en examen' in title", () => {
    expect(classifyArticleTier("Politicien X mis en examen", null)).toBe("TIER_1");
  });

  it("should return TIER_1 for article with 'condamné' in description", () => {
    expect(classifyArticleTier("Tribunal de Paris", "L'ancien maire condamné à 2 ans")).toBe("TIER_1");
  });

  it("should return TIER_1 for 'corruption' keyword", () => {
    expect(classifyArticleTier("Affaire de corruption au conseil régional", null)).toBe("TIER_1");
  });

  it("should return TIER_1 for 'tribunal correctionnel'", () => {
    expect(classifyArticleTier("Renvoi devant le tribunal correctionnel", null)).toBe("TIER_1");
  });

  it("should return TIER_2 for article without judicial keywords", () => {
    expect(classifyArticleTier("Macron en visite à Berlin", "Discussions sur le budget européen")).toBe("TIER_2");
  });

  it("should be case-insensitive", () => {
    expect(classifyArticleTier("MISE EN EXAMEN de l'ancien ministre", null)).toBe("TIER_1");
  });

  it("should be accent-insensitive", () => {
    expect(classifyArticleTier("Le depute condamne pour fraude", null)).toBe("TIER_1");
  });

  it("should match 'détournement' with or without accent", () => {
    expect(classifyArticleTier("Détournement de fonds publics", null)).toBe("TIER_1");
    expect(classifyArticleTier("Detournement de fonds publics", null)).toBe("TIER_1");
  });

  it("should return TIER_1 for 'garde à vue'", () => {
    expect(classifyArticleTier("Garde à vue pour le sénateur", null)).toBe("TIER_1");
  });

  it("should return TIER_1 for 'perquisition'", () => {
    expect(classifyArticleTier("Perquisition au siège du parti", null)).toBe("TIER_1");
  });

  it("should handle null description", () => {
    expect(classifyArticleTier("Visite diplomatique", null)).toBe("TIER_2");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/config/press-keywords.test.ts`
Expected: FAIL — module `./press-keywords` does not exist

**Step 3: Write the implementation**

Create `src/config/press-keywords.ts`:

```typescript
/**
 * Judicial keywords for press article pre-filtering.
 *
 * Articles matching these keywords in title or description are classified as
 * TIER_1 and analyzed with Sonnet 4.5 (higher precision, higher cost).
 * Remaining articles are TIER_2, analyzed with Haiku 4.5.
 */

export type ArticleTier = "TIER_1" | "TIER_2";

/**
 * Judicial keywords organized by category.
 * Matching is case-insensitive and accent-insensitive.
 */

// Procédure pénale
const PROCEDURE_KEYWORDS = [
  "mis en examen",
  "mise en examen",
  "condamne",
  "condamnee",
  "condamnation",
  "renvoye devant",
  "poursuivi",
  "poursuivie",
  "garde a vue",
  "perquisition",
  "tribunal correctionnel",
  "proces",
  "relaxe",
  "relaxee",
  "acquitte",
  "acquittee",
  "juge",
  "jugee",
  "inculpe",
  "inculpee",
  "ecroue",
  "ecrouee",
  "detention",
  "mandat d'arret",
  "controle judiciaire",
];

// Infractions
const INFRACTION_KEYWORDS = [
  "detournement",
  "corruption",
  "fraude",
  "abus de bien",
  "prise illegale",
  "favoritisme",
  "harcelement",
  "agression sexuelle",
  "viol",
  "blanchiment",
  "emploi fictif",
  "conflit d'interets",
  "trafic d'influence",
];

// Juridictions
const JURISDICTION_KEYWORDS = [
  "cour d'appel",
  "cour de cassation",
  "tribunal",
  "parquet",
  "pnf",
  "procureur",
];

/** All judicial keywords (already normalized — no accents, lowercase) */
export const JUDICIAL_KEYWORDS: string[] = [
  ...PROCEDURE_KEYWORDS,
  ...INFRACTION_KEYWORDS,
  ...JURISDICTION_KEYWORDS,
];

/**
 * Normalize text for keyword matching:
 * lowercase, strip accents, normalize whitespace
 */
function normalizeForMatching(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .replace(/[\u2018\u2019']/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Classify an article as TIER_1 (judicial keywords found) or TIER_2 (no match).
 * Matching is case-insensitive and accent-insensitive on title + description.
 */
export function classifyArticleTier(
  title: string,
  description: string | null
): ArticleTier {
  const text = normalizeForMatching(`${title} ${description || ""}`);

  for (const keyword of JUDICIAL_KEYWORDS) {
    if (text.includes(keyword)) {
      return "TIER_1";
    }
  }

  return "TIER_2";
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/config/press-keywords.test.ts`
Expected: PASS (all 12 tests)

**Step 5: Commit**

```bash
git add src/config/press-keywords.ts src/config/press-keywords.test.ts
git commit -m "feat(press): add judicial keyword pre-filter for tier classification"
```

---

## Task 2 : Système deux tiers dans le service d'analyse

**Files:**
- Modify: `src/services/press-analysis.ts`

Transformer `analyzeArticle()` pour accepter un paramètre `tier` qui sélectionne le modèle Claude (Sonnet pour Tier 1, Haiku pour Tier 2) et injecter optionnellement le contexte politiciens.

**Step 1: Add tier support to the analysis function**

In `src/services/press-analysis.ts`, make these changes:

1. Replace the single `MODEL` constant (line 17) with a tier-based model map:

```typescript
// Replace line 17:
// const MODEL = "claude-haiku-4-5-20251001";

// With:
const TIER_MODELS = {
  TIER_1: "claude-sonnet-4-5-20250929",
  TIER_2: "claude-haiku-4-5-20251001",
} as const;

type AnalysisTier = keyof typeof TIER_MODELS;
```

2. Add `tier` and `politicianContext` fields to `ArticleAnalysisInput` (line 24-30):

```typescript
export interface ArticleAnalysisInput {
  title: string;
  content: string;
  feedSource: string;
  publishedAt: Date;
  mentionedPoliticians?: string[];
  tier?: "TIER_1" | "TIER_2";
  politicianContext?: string;
}
```

3. In the `analyzeArticle()` function body (line 250-324):

- Select model based on tier:
```typescript
const tier: AnalysisTier = input.tier || "TIER_2";
const model = TIER_MODELS[tier];
```

- Add politician context to the prompt (after line 259, before the API call):
```typescript
if (input.politicianContext) {
  userContent += `\n\n--- CONTEXTE POLITICIENS CONNUS ---\n${input.politicianContext}\n\nSi un nom correspond à un politicien connu mais que l'article ne mentionne pas de fonction politique (député, sénateur, ministre, maire, etc.), retourner confidence_score < 30 et involvement: MENTIONED_ONLY.`;
}
```

- Use `model` variable in API body (replace the hardcoded `model: MODEL` around line 271):
```typescript
body: JSON.stringify({
  model,  // was: MODEL
  max_tokens: MAX_TOKENS,
  // ...rest unchanged
}),
```

**Step 2: Run the test suite to check no regression**

Run: `npx vitest run`
Expected: All 177 tests PASS (no existing tests for `analyzeArticle` — it hits the API)

**Step 3: Commit**

```bash
git add src/services/press-analysis.ts
git commit -m "feat(press): two-tier model selection (Sonnet/Haiku) with politician context"
```

---

## Task 3 : Priorisation et intégration du pré-filtre dans le sync

**Files:**
- Modify: `src/services/sync/press-analysis.ts`

Intégrer le pré-filtre dans le flow de sync : classifier les articles, les trier par priorité, et passer le tier + contexte politiciens à l'analyse.

**Step 1: Import and integrate the pre-filter**

At the top of `src/services/sync/press-analysis.ts`, add import (after line 27):

```typescript
import { classifyArticleTier, type ArticleTier } from "@/config/press-keywords";
```

**Step 2: Add politician context builder function**

Add this new function before the main `syncPressAnalysis` function (around line 62):

```typescript
/**
 * Build politician context string for Tier 1 anti-homonym protection.
 * Format: "Prénom Nom (Parti, Mandat actuel)" per politician.
 * Limited to ~200 politicians to keep token count reasonable (~2000 tokens).
 */
async function buildPoliticianContext(): Promise<string> {
  const politicians = await db.politician.findMany({
    where: {
      mandates: { some: { isCurrent: true } },
    },
    select: {
      fullName: true,
      currentParty: { select: { shortName: true } },
      mandates: {
        where: { isCurrent: true },
        select: { title: true },
        take: 1,
      },
    },
    take: 200,
    orderBy: { lastName: "asc" },
  });

  return politicians
    .map((p) => {
      const party = p.currentParty?.shortName || "?";
      const mandate = p.mandates[0]?.title || "?";
      return `${p.fullName} (${party}, ${mandate})`;
    })
    .join("\n");
}
```

**Step 3: Add article classification and sorting in syncPressAnalysis**

In `syncPressAnalysis()` function, after the articles are fetched (after line 113 `console.log`), add classification and sorting:

```typescript
// Classify articles into tiers and sort by priority
const classifiedArticles = articles.map((article) => ({
  ...article,
  tier: classifyArticleTier(article.title, article.description) as ArticleTier,
}));

// Sort: Tier 1 first, then Tier 2
classifiedArticles.sort((a, b) => {
  if (a.tier === "TIER_1" && b.tier !== "TIER_1") return -1;
  if (a.tier !== "TIER_1" && b.tier === "TIER_1") return 1;
  return b.publishedAt.getTime() - a.publishedAt.getTime(); // Most recent first within tier
});

const tier1Count = classifiedArticles.filter((a) => a.tier === "TIER_1").length;
console.log(`  Tier 1 (Sonnet, mots-clés judiciaires): ${tier1Count}`);
console.log(`  Tier 2 (Haiku, couverture large): ${classifiedArticles.length - tier1Count}`);

// Build politician context for Tier 1 (only if there are Tier 1 articles)
const politicianContext = tier1Count > 0 ? await buildPoliticianContext() : "";
```

**Step 4: Pass tier info to analyzeArticle**

In the article processing loop, replace the `analyzeArticle()` call (around line 162) to pass `tier` and `politicianContext`:

```typescript
// Replace:
// const result = await analyzeArticle({
//   title: article.title,
//   content: analysisContent,
//   feedSource: article.feedSource,
//   publishedAt: article.publishedAt,
//   mentionedPoliticians: mentionedNames,
// });

// With:
const result = await analyzeArticle({
  title: article.title,
  content: analysisContent,
  feedSource: article.feedSource,
  publishedAt: article.publishedAt,
  mentionedPoliticians: mentionedNames,
  tier: article.tier,
  politicianContext: article.tier === "TIER_1" ? politicianContext : undefined,
});
```

Also update the loop to iterate over `classifiedArticles` instead of `articles`:

```typescript
// Replace: for (const article of articles) {
// With:    for (const article of classifiedArticles) {
```

And update the progress log:

```typescript
// Update the verbose log to show tier:
if (verbose) {
  console.log(
    `\n[${stats.articlesProcessed}/${classifiedArticles.length}] [${article.tier}] ${article.feedSource}: ${article.title.slice(0, 80)}...`
  );
}
```

**Step 5: Run tests to verify no regression**

Run: `npx vitest run`
Expected: All tests PASS

**Step 6: Commit**

```bash
git add src/services/sync/press-analysis.ts
git commit -m "feat(press): integrate tier classification, priority sorting, politician context"
```

---

## Task 4 : Ajout des 6 nouvelles sources RSS

**Files:**
- Modify: `src/lib/api/rss.ts` (add 6 feeds to `RSS_FEEDS` array)
- Modify: `src/lib/api/article-scraper.ts` (add new scrapable sources)
- Modify: `src/services/sync/press-analysis.ts` (add publishers to `feedSourceToPublisher`)

**Step 1: Add new RSS feeds**

In `src/lib/api/rss.ts`, add these 6 entries to the `RSS_FEEDS` array (after the existing `lcp` entry, line 93):

```typescript
  // ── Priority 2: Presse régionale ──
  {
    id: "ouestfrance",
    name: "Ouest-France",
    url: "https://www.ouest-france.fr/rss/france",
    priority: 2,
  },
  {
    id: "sudouest",
    name: "Sud Ouest",
    url: "https://www.sudouest.fr/politique/rss.xml",
    priority: 2,
  },
  {
    id: "ladepeche",
    name: "La Dépêche du Midi",
    url: "https://www.ladepeche.fr/rss/politique.xml",
    priority: 2,
  },
  {
    id: "lavoixdunord",
    name: "La Voix du Nord",
    url: "https://www.lavoixdunord.fr/rss",
    priority: 2,
  },
  {
    id: "dna",
    name: "Dernières Nouvelles d'Alsace",
    url: "https://www.dna.fr/rss",
    priority: 2,
  },

  // ── Priority 2: Agrégateur ──
  {
    id: "googlenews",
    name: "Google News FR (Politique/Justice)",
    url: "https://news.google.com/rss/search?q=politique+france+justice&hl=fr&gl=FR&ceid=FR:fr",
    priority: 2,
  },
```

**Step 2: Add new scrapable sources**

In `src/lib/api/article-scraper.ts`, add regional sources to `SCRAPABLE_SOURCES` (line 31):

```typescript
const SCRAPABLE_SOURCES = new Set([
  "franceinfo",
  "liberation",
  "publicsenat",
  "lcp",
  "politico",
  "mediapart",
  // Regional press (free access)
  "ouestfrance",
  "sudouest",
  "ladepeche",
  "lavoixdunord",
  "dna",
  // Google News links to external articles — don't scrape
]);
```

Note: `googlenews` is NOT scrapable — it links to external sources, and the RSS title+description from Google News already contains useful content.

**Step 3: Add publishers mapping**

In `src/services/sync/press-analysis.ts`, update `feedSourceToPublisher()` (around line 623):

```typescript
function feedSourceToPublisher(feedSource: string): string {
  const publishers: Record<string, string> = {
    lemonde: "Le Monde",
    lefigaro: "Le Figaro",
    franceinfo: "Franceinfo",
    liberation: "Libération",
    politico: "Politico",
    mediapart: "Mediapart",
    publicsenat: "Public Sénat",
    lcp: "LCP",
    ouestfrance: "Ouest-France",
    sudouest: "Sud Ouest",
    ladepeche: "La Dépêche du Midi",
    lavoixdunord: "La Voix du Nord",
    dna: "DNA",
    googlenews: "Google News",
  };
  return publishers[feedSource] || feedSource;
}
```

**Step 4: Run tests**

Run: `npx vitest run`
Expected: All tests PASS

**Step 5: Verify RSS feeds work**

Run: `npx tsx scripts/sync-press.ts --dry-run --limit=3`
Expected: Should list articles from new feeds. Some feeds may fail (URLs to validate) — that's OK, we'll fix in Step 6.

**Step 6: Fix any broken RSS URLs**

If a feed returns 404 or invalid XML, try alternative URLs. Common patterns for French regional press:
- `/rss` or `/rss.xml` (generic feed)
- `/politique/rss.xml` (politics-specific)
- `/flux-rss` (alternative)
- Check the homepage source for `<link rel="alternate" type="application/rss+xml">`

Update `RSS_FEEDS` with correct URLs as needed.

**Step 7: Commit**

```bash
git add src/lib/api/rss.ts src/lib/api/article-scraper.ts src/services/sync/press-analysis.ts
git commit -m "feat(press): add 6 new RSS sources (5 regional + Google News)"
```

---

## Task 5 : Augmenter le volume (limit 20 → 100)

**Files:**
- Modify: `scripts/sync-daily.ts` (line 62)

**Step 1: Update the press analysis limit**

In `scripts/sync-daily.ts`, change line 62:

```typescript
// Replace:
  {
    name: "Analyse presse IA (limit 20)",
    command: `npx tsx scripts/sync-press-analysis.ts --limit=20${dryRunFlag}`,
  },

// With:
  {
    name: "Analyse presse IA (limit 100)",
    command: `npx tsx scripts/sync-press-analysis.ts --limit=100${dryRunFlag}`,
  },
```

**Step 2: Run tests**

Run: `npx vitest run`
Expected: All tests PASS

**Step 3: Commit**

```bash
git add scripts/sync-daily.ts
git commit -m "feat(press): increase daily analysis limit from 20 to 100 articles"
```

---

## Task 6 : Tests d'intégration et vérification TypeScript

**Files:**
- All modified files

**Step 1: Run full TypeScript check**

Run: `npx tsc --noEmit`
Expected: 0 errors

**Step 2: Run full test suite**

Run: `npx vitest run`
Expected: All tests PASS (existing + new press-keywords tests)

**Step 3: Run lint**

Run: `npm run lint`
Expected: No errors (warnings OK)

**Step 4: Verify dry-run flow**

Run: `npx tsx scripts/sync-press-analysis.ts --dry-run --limit=5 --force --verbose`
Expected: Should show tier classification in output. Actual API calls won't be made in dry-run... Actually dry-run does make API calls (it just doesn't write to DB). So this will verify the two-tier flow works end-to-end.

**Step 5: Commit if any fixes were needed**

```bash
git add -A
git commit -m "fix(press): address review issues from integration testing"
```

---

## Résumé des changements par fichier

| Fichier | Task | Changement |
|---------|------|------------|
| `src/config/press-keywords.ts` | 1 | **NEW** — Mots-clés judiciaires + `classifyArticleTier()` |
| `src/config/press-keywords.test.ts` | 1 | **NEW** — 12 tests pour le pré-filtre |
| `src/services/press-analysis.ts` | 2 | Tier-based model selection, politician context injection |
| `src/services/sync/press-analysis.ts` | 3, 4 | Pre-filter integration, priority sorting, new publishers |
| `src/lib/api/rss.ts` | 4 | 6 new RSS feeds |
| `src/lib/api/article-scraper.ts` | 4 | 5 new scrapable sources |
| `scripts/sync-daily.ts` | 5 | Limit 20 → 100 |

## Budget estimé post-implémentation

| Tier | Modèle | Articles/jour | Coût/jour |
|------|--------|--------------|-----------|
| Tier 1 | Sonnet 4.5 | ~20 | ~$0.40 |
| Tier 2 | Haiku 4.5 | ~80 | ~$0.16 |
| **Total** | | **~100** | **~$0.56** |
