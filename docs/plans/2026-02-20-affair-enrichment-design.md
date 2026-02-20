# Enrichissement automatique des affaires REJECT — Design

> **Issue liée** : Extension de #156 (auto-modération)

## Problème

~200 affaires importées de Wikidata ont des données squelettiques (titre générique, 1 phrase de description, source Wikidata uniquement). L'auto-modérateur les rejette à raison (MISSING_SOURCE, POOR_DESCRIPTION) mais beaucoup sont des affaires réelles vérifiables sur le web.

Exemple : "Détournement de fonds publics" pour Bernard Perrut → REJECT 95%. Or Le Monde a un article complet sur sa condamnation.

## Solution : Enrichissement assisté (Approche A)

Recherche web automatique pour trouver des sources presse, enrichir les données, puis upgrader de REJECT à NEEDS_REVIEW pour validation humaine 1-clic. **Jamais d'auto-publication.**

```
REJECT (données thin)
   ↓ Brave Search → trouve des sources presse
   ↓ Scraping + Sonnet extraction → enrichit l'affaire
NEEDS_REVIEW (données enrichies, sources ajoutées)
   ↓ Admin valide en 1 clic
PUBLISHED
```

Si aucune source trouvée → reste REJECT.

## Architecture

### Service d'enrichissement (`src/services/affair-enrichment.ts`)

Fonction principale `enrichAffair(affairId)` :

1. **Construire la requête** : `"{politicien} {titre nettoyé} condamnation affaire judiciaire"`
2. **Brave Search API** → top 5 résultats, filtrés par whitelist publishers
3. **Scraper** les 1-2 meilleurs articles (HTTPClient + @mozilla/readability existants)
4. **Sonnet 4.5 tool_use** → extraire : titre corrigé, description enrichie, statut judiciaire, peine, dates, catégorie
5. **Mettre à jour l'affaire** en DB : ajouter sources presse, enrichir description
6. **Mettre à jour ModerationReview** → NEEDS_REVIEW avec confiance augmentée et reasoning enrichi

### Brave Search Client (`src/lib/api/brave-search.ts`)

- Endpoint : `https://api.search.brave.com/res/v1/web/search`
- Auth : `BRAVE_API_KEY` env var
- Rate limit : 1 req/seconde (free tier = 1 req/s, 2000 req/mois)
- Params : `q={query}&country=fr&search_lang=fr&count=5`
- Retourne : `{ title, url, description, age }[]`

### Whitelist publishers

Basée sur les sources RSS existantes + grandes agences FR :

```
lemonde.fr, lefigaro.fr, liberation.fr, francetvinfo.fr,
mediapart.fr, publicsenat.fr, lcp.fr, ouest-france.fr,
20minutes.fr, bfmtv.com, tf1info.fr, ladepeche.fr,
sudouest.fr, lexpress.fr, lobs.fr, lepoint.fr,
huffingtonpost.fr, europe1.fr, rtl.fr, reuters.com, afp.com
```

### Trois points d'entrée

| Trigger | Usage | Détail |
|---------|-------|--------|
| Phase 3 dans `sync:moderate` | Pipeline automatique | Après Phase 2, enrichit les REJECT avec MISSING_SOURCE/POOR_DESCRIPTION. Flag `--skip-enrich` pour désactiver. |
| Script `sync:enrich` | Rattrapage backlog | Traite les ModerationReview REJECT existantes. Flags `--dry-run`, `--limit=N`, `--verbose`. |
| API `POST /api/admin/affaires/enrich` | Action admin ponctuelle | Reçoit `{ affairId }`, enrichit, retourne le résultat. Bouton dans l'admin UI. |

### Garde-fous

- Sources ajoutées : uniquement des publishers dans la whitelist
- Résultat : **toujours NEEDS_REVIEW**, jamais PUBLISH direct
- Catégories sensibles : restent flaggées SENSITIVE_CATEGORY
- Audit log : chaque enrichissement est tracé
- Anti-homonymie : le titre de l'affaire + nom du politicien dans la requête de recherche

### Tool use — Schema d'extraction

```typescript
{
  name: "enrich_affair",
  input_schema: {
    type: "object",
    properties: {
      enriched_title: { type: "string" },
      enriched_description: { type: "string" },
      corrected_status: { enum: [...AFFAIR_STATUSES] },
      corrected_category: { enum: [...AFFAIR_CATEGORIES] },
      sentence_details: {
        type: "object",
        properties: {
          prison_months: { type: "integer" },
          prison_suspended: { type: "boolean" },
          fine_amount: { type: "number" },
          ineligibility_months: { type: "integer" },
          other: { type: "string" }
        }
      },
      facts_date: { type: "string", description: "YYYY-MM-DD" },
      verdict_date: { type: "string", description: "YYYY-MM-DD" },
      court: { type: "string" },
      confidence: { type: "integer", minimum: 0, maximum: 100 },
      reasoning: { type: "string" },
      sources_used: {
        type: "array",
        items: {
          type: "object",
          properties: {
            url: { type: "string" },
            title: { type: "string" },
            publisher: { type: "string" },
            published_date: { type: "string" }
          }
        }
      }
    },
    required: ["enriched_title", "enriched_description", "confidence", "reasoning", "sources_used"]
  }
}
```

## Coûts estimés (one-shot 200 affaires)

| Ressource | Volume | Coût |
|-----------|--------|------|
| Brave Search | 200 requêtes | Gratuit (free tier 2000/mois) |
| Scraping | 200-400 pages | Gratuit (HTTPClient existant) |
| Sonnet 4.5 | 200 appels | ~$2-4 |

## Admin UI

Pour chaque affaire REJECT dans la page admin :
- Bouton "Enrichir" (icône Search) → appelle `POST /api/admin/affaires/enrich`
- Si enrichissement réussi : badge REJECT → NEEDS_REVIEW, sources ajoutées visibles, description enrichie
- Si rien trouvé : toast "Aucune source trouvée"
