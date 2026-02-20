# Enrichissement automatique des affaires — Plan d'implémentation

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enrichir automatiquement les affaires REJECT (données thin) via Brave Search + Sonnet extraction, les upgrader en NEEDS_REVIEW pour validation humaine.

**Architecture:** Service d'enrichissement réutilisable (`affair-enrichment.ts`) appelé par 3 points d'entrée : Phase 3 du sync:moderate, script standalone sync:enrich, et API admin. Brave Search pour la recherche web, Sonnet 4.5 tool_use pour l'extraction structurée.

**Tech Stack:** Brave Search API, Anthropic Claude Sonnet 4.5 (tool_use), HTTPClient + Readability (existants), Prisma

---

### Task 1: Brave Search Client

**Files:**
- Create: `src/lib/api/brave-search.ts`
- Modify: `src/config/rate-limits.ts` (ajouter BRAVE_SEARCH rate limit)

**Step 1: Créer le client Brave Search**

```typescript
// src/lib/api/brave-search.ts
import { HTTPClient } from "./http-client";

const BRAVE_API_KEY = process.env.BRAVE_API_KEY;
const BRAVE_SEARCH_URL = "https://api.search.brave.com/res/v1/web/search";

// Publishers FR de confiance pour les affaires judiciaires
export const TRUSTED_PUBLISHERS: Record<string, string> = {
  "lemonde.fr": "Le Monde",
  "lefigaro.fr": "Le Figaro",
  "liberation.fr": "Libération",
  "francetvinfo.fr": "Franceinfo",
  "mediapart.fr": "Mediapart",
  "publicsenat.fr": "Public Sénat",
  "lcp.fr": "LCP",
  "ouest-france.fr": "Ouest-France",
  "20minutes.fr": "20 Minutes",
  "bfmtv.com": "BFM TV",
  "tf1info.fr": "TF1 Info",
  "ladepeche.fr": "La Dépêche",
  "sudouest.fr": "Sud Ouest",
  "lexpress.fr": "L'Express",
  "lobs.fr": "L'Obs",
  "lepoint.fr": "Le Point",
  "huffingtonpost.fr": "HuffPost",
  "europe1.fr": "Europe 1",
  "rtl.fr": "RTL",
  "reuters.com": "Reuters",
  "afp.com": "AFP",
  "leprogres.fr": "Le Progrès",
  "lavoixdunord.fr": "La Voix du Nord",
  "dna.fr": "DNA",
  "ledauphine.com": "Le Dauphiné",
};

export interface BraveSearchResult {
  title: string;
  url: string;
  description: string;
  age?: string;
  publisher: string | null; // resolved from TRUSTED_PUBLISHERS
}

/**
 * Search Brave and return only results from trusted publishers.
 */
export async function searchBrave(query: string): Promise<BraveSearchResult[]> {
  if (!BRAVE_API_KEY) {
    throw new Error("BRAVE_API_KEY not set");
  }

  const params = new URLSearchParams({
    q: query,
    country: "fr",
    search_lang: "fr",
    count: "10",
  });

  const response = await fetch(`${BRAVE_SEARCH_URL}?${params}`, {
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip",
      "X-Subscription-Token": BRAVE_API_KEY,
    },
  });

  if (!response.ok) {
    throw new Error(`Brave Search error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const webResults = data.web?.results ?? [];

  // Map results and resolve publisher from URL domain
  return webResults
    .map((r: { title: string; url: string; description: string; age?: string }) => {
      const domain = extractDomain(r.url);
      const publisher = domain ? TRUSTED_PUBLISHERS[domain] ?? null : null;
      return {
        title: r.title,
        url: r.url,
        description: r.description,
        age: r.age,
        publisher,
      };
    })
    .filter((r: BraveSearchResult) => r.publisher !== null); // Only trusted publishers
}

function extractDomain(url: string): string | null {
  try {
    const hostname = new URL(url).hostname;
    // Remove www. prefix and match against known domains
    const clean = hostname.replace(/^www\./, "");
    for (const domain of Object.keys(TRUSTED_PUBLISHERS)) {
      if (clean === domain || clean.endsWith(`.${domain}`)) {
        return domain;
      }
    }
    return null;
  } catch {
    return null;
  }
}
```

**Step 2: Ajouter le rate limit**

Dans `src/config/rate-limits.ts`, ajouter :
```typescript
export const BRAVE_SEARCH_RATE_LIMIT_MS = 1100; // 1 req/s free tier
```

**Step 3: Vérifier**

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add src/lib/api/brave-search.ts src/config/rate-limits.ts
git commit -m "feat(search): add Brave Search client with trusted publisher whitelist"
```

---

### Task 2: Service d'enrichissement

**Files:**
- Create: `src/services/affair-enrichment.ts`

**Step 1: Créer le service**

Le service fait :
1. Charge l'affaire + politician + sources + moderation review
2. Construit la query Brave Search
3. Filtre les résultats par publisher de confiance
4. Scrape le contenu des 1-2 meilleurs articles
5. Appelle Sonnet 4.5 tool_use pour extraire les données structurées
6. Met à jour l'affaire en DB (sources, description, statut, peine)
7. Met à jour la ModerationReview → NEEDS_REVIEW

Points clés :
- Le tool schema `enrich_affair` extrait : titre, description, statut, catégorie, peine détaillée, dates, tribunal, sources utilisées
- Le prompt système doit préciser : "Tu enrichis une affaire judiciaire existante à partir d'articles de presse. Extrais les faits vérifiables uniquement."
- Garde-fou : catégories sensibles → NEEDS_REVIEW avec flag SENSITIVE_CATEGORY
- Si Brave ne trouve rien → retourner `{ enriched: false }`
- Si l'extraction AI n'est pas concluante (confiance < 40) → ne pas enrichir

Le scraping réutilise le pattern existant de `sync-press.ts` : fetch HTML → JSDOM → @mozilla/readability → Readability.parse().

**Step 2: Vérifier**

```bash
npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add src/services/affair-enrichment.ts
git commit -m "feat(enrichment): add affair enrichment service with Brave Search + Sonnet extraction"
```

---

### Task 3: Phase 3 dans sync:moderate + script sync:enrich

**Files:**
- Modify: `scripts/sync-moderate-affairs.ts` (ajouter Phase 3)
- Create: `scripts/sync-enrich-affairs.ts` (script standalone)
- Modify: `package.json` (ajouter scripts)

**Step 1: Ajouter Phase 3 au sync:moderate**

Après `phaseAIModeration()`, ajouter `phaseEnrichment()` :
- Charge les ModerationReview REJECT avec issues MISSING_SOURCE ou POOR_DESCRIPTION
- Pour chaque, appelle `enrichAffair()`
- Respecte le rate limit Brave (1 req/s)
- Flag `--skip-enrich` pour désactiver cette phase
- Applique `--limit` si spécifié
- Stats : enriched, notFound, errors

**Step 2: Créer le script standalone sync:enrich**

Script indépendant qui :
- Charge les reviews REJECT non encore enrichies
- Flags : `--dry-run`, `--limit=N`, `--verbose`, `--stats`
- Même logique que Phase 3 mais standalone

**Step 3: Ajouter les npm scripts**

```json
"sync:enrich": "tsx scripts/sync-enrich-affairs.ts",
"sync:enrich:stats": "tsx scripts/sync-enrich-affairs.ts --stats"
```

**Step 4: Vérifier**

```bash
npx tsc --noEmit
```

**Step 5: Commit**

```bash
git add scripts/sync-moderate-affairs.ts scripts/sync-enrich-affairs.ts package.json
git commit -m "feat(enrichment): add Phase 3 to sync:moderate + standalone sync:enrich script"
```

---

### Task 4: API admin enrichissement

**Files:**
- Create: `src/app/api/admin/affaires/enrich/route.ts`
- Modify: `src/lib/validations/affairs.ts` (ajouter schema)

**Step 1: Créer la route API**

`POST /api/admin/affaires/enrich` :
- Body : `{ affairId: string }`
- Auth : `isAuthenticated()`
- Appelle `enrichAffair(affairId)`
- Retourne le résultat (enriched: true/false, données trouvées, sources ajoutées)
- Audit log

**Step 2: Ajouter le schema de validation**

```typescript
export const enrichAffairSchema = z.object({
  affairId: z.string().min(1),
});
```

**Step 3: Vérifier**

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add src/app/api/admin/affaires/enrich/route.ts src/lib/validations/affairs.ts
git commit -m "feat(api): add affair enrichment endpoint for admin UI"
```

---

### Task 5: Bouton enrichir dans l'admin UI

**Files:**
- Modify: `src/app/admin/affaires/page.tsx`

**Step 1: Ajouter le bouton "Enrichir"**

Pour chaque affaire avec une ModerationReview REJECT :
- Bouton avec icône Search (lucide-react)
- Loading state pendant l'appel API
- Si enrichissement réussi : badge passe de REJECT à NEEDS_REVIEW, toast de succès, données rafraîchies
- Si rien trouvé : toast "Aucune source trouvée"
- Bouton bulk "Enrichir les REJECT" pour traiter toutes les affaires REJECT en une fois

**Step 2: Vérifier**

```bash
npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add src/app/admin/affaires/page.tsx
git commit -m "feat(admin): add enrich button for REJECT affairs with web search"
```

---

### Task 6: Vérification complète

**Step 1: Build complet**
```bash
npx tsc --noEmit
npm run lint
```

**Step 2: Test dry-run sur 5 affaires**
```bash
npx tsx scripts/sync-enrich-affairs.ts --limit=5 --verbose
```

**Step 3: Vérifier les résultats en DB**
```bash
npx tsx -e 'import "dotenv/config"; import {db} from "./src/lib/db"; ...'
```
