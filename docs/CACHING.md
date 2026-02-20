# Stratégie de Caching — Poligraph

> **Stack** : Next.js 16 (App Router) + Vercel CDN + Prisma + PostgreSQL
>
> **Dernière mise à jour** : 2026-02-20 (issue #132)

## Vue d'ensemble

Le caching opère sur **3 couches** :

```
Navigateur → CDN Vercel → Serveur Next.js → PostgreSQL
               (edge)       ("use cache")      (DB)
```

| Couche             | Mécanisme                                 | TTL               | Invalidation                         |
| ------------------ | ----------------------------------------- | ----------------- | ------------------------------------ |
| **CDN** (edge)     | ISR (`revalidate`) ou `Cache-Control`     | 5min–1h           | Automatique (stale-while-revalidate) |
| **Serveur** (data) | `"use cache"` + `cacheLife`               | ~5min ("minutes") | `revalidateTag()`                    |
| **API routes**     | `Cache-Control` headers via `withCache()` | 5min–1h           | TTL-based                            |

---

## Règles fondamentales

### 1. Ne JAMAIS utiliser `"use cache"` avec un paramètre de recherche libre

```typescript
// ❌ INTERDIT — clé unbounded → explosion du cache
async function getResults(search: string) {
  "use cache";
  return db.politician.findMany({ where: { name: { contains: search } } });
}

// ✅ CORRECT — séparer en 3 fonctions
async function queryPoliticians(search?: string, filters?) {
  // Core query, pas de cache ici
}

async function getPoliticiansFiltered(filters) {
  "use cache";
  cacheTag("politicians");
  cacheLife("minutes");
  return queryPoliticians(undefined, filters); // Params bornés uniquement
}

async function searchPoliticians(search: string, filters) {
  return queryPoliticians(search, filters); // Pas de cache
}
```

**Pourquoi** : `"use cache"` utilise tous les arguments comme clé composite. Un champ texte libre crée une entrée par requête unique → mémoire serveur qui explose.

### 2. Pages avec `searchParams` → ISR, pas `"use cache"` sur le composant

```typescript
// ✅ Page listing avec searchParams
export const revalidate = 300; // ISR 5 min

export default async function Page({ searchParams }) {
  const params = await searchParams;
  // ...
}
```

**Pourquoi** : `await searchParams` force Next.js en mode `dynamic` (`Cache-Control: private, no-cache`). Le `revalidate` assure quand même un cache serveur ISR de 5 min côté Vercel.

### 3. Pages dynamiques `[slug]` → `generateStaticParams` obligatoire pour le CDN

```typescript
// ✅ Page détail avec CDN cache
export const revalidate = 3600; // ISR 1h

export async function generateStaticParams() {
  const items = await db.politician.findMany({
    where: { publicationStatus: "PUBLISHED" },
    select: { slug: true },
    take: 100,
    orderBy: { prominenceScore: "desc" },
  });
  return items.map((p) => ({ slug: p.slug }));
}

export default async function Page({ params }) {
  const { slug } = await params;
  const data = await getData(slug); // "use cache" sur getData, pas sur la page
  // ...
}
```

**Pourquoi** : Sans `generateStaticParams`, Next.js traite la route `[slug]` comme dynamique pure → jamais de CDN HIT. Avec, les pages pré-rendues sont SSG, les autres sont ISR (rendu à la demande puis cachées).

### 4. `"use cache"` uniquement sur les fonctions data, pas sur les composants page

```typescript
// ❌ ÉVITER — "use cache" sur un composant page
export default async function Page({ params }) {
  "use cache";
  cacheLife("hours");
  // Ne génère PAS de Cache-Control CDN
}

// ✅ CORRECT — "use cache" sur la fonction data
async function getData(slug: string) {
  "use cache";
  cacheTag(`entity:${slug}`);
  cacheLife("minutes");
  return db.entity.findUnique({ where: { slug } });
}
```

**Pourquoi** : `"use cache"` sur un composant cache côté serveur (in-memory) mais ne définit pas les headers `Cache-Control` pour le CDN. Pour le CDN, il faut `revalidate` + `generateStaticParams`.

---

## Patterns par type de page

### Pages statiques (pas de params dynamiques)

```
/departements, /institutions, /partis, /mentions-legales, /sources, /soutenir
```

- Rendues au build (`○ Static`)
- CDN cache illimité jusqu'au prochain déploiement
- Données cachées via `"use cache"` sur les fonctions data

### Pages listing avec recherche

```
/politiques, /affaires, /votes, /presse, /factchecks
```

- `export const revalidate = 300` (ISR 5 min)
- Pattern 3 fonctions : `query()` + `getFiltered()` (cached) + `search()` (uncached)
- Rendues dynamiquement (`ƒ Dynamic`) à cause de `await searchParams`
- Le CDN ne cache pas (mode dynamic), mais le data cache serveur évite des requêtes DB

### Pages détail avec `[slug]`

```
/politiques/[slug]
```

- `export const revalidate = 3600` (ISR 1h)
- `generateStaticParams()` pré-rend les top 100
- Build produit `● SSG` → CDN HIT (~100ms)
- Slugs non pré-rendus : rendu à la demande puis caché CDN

### Pages détail sans generateStaticParams

```
/politiques/[slug]/votes, /politiques/[slug]/relations
/departements/[slug], /partis/[slug], /votes/[slug]
```

- Rendues dynamiquement (`ƒ Dynamic`)
- Données cachées via `"use cache"` sur les fonctions data
- **Candidats futurs** pour `generateStaticParams` si le trafic le justifie

### Page statistiques

```
/statistiques
```

- Rendue statique (`○ Static`) avec `revalidate = 300`
- Toutes les données chargées côté serveur en une passe
- Onglets gérés côté client (`useState` + `useSearchParams`)
- Pas de `await searchParams` dans le Server Component → CDN cache OK

---

## Fonctions data — Convention `"use cache"`

Toutes les fonctions data suivent le même pattern :

```typescript
async function getEntityData(id: string) {
  "use cache";
  cacheTag("entity-type", `entity:${id}`);  // Tags pour invalidation ciblée
  cacheLife("minutes");                       // Profil ~5 min
  return db.entity.findUnique({ ... });
}
```

### Tags principaux

| Tag                  | Utilisé par                | Invalidé quand                  |
| -------------------- | -------------------------- | ------------------------------- |
| `politicians`        | Listing, stats, search     | Sync politiciens, admin edit    |
| `politician:${slug}` | Fiche politicien           | Edit d'un politicien spécifique |
| `parties`            | Listing partis, filtres    | Sync partis                     |
| `votes`              | Listing votes, stats       | Sync votes AN/Sénat             |
| `affairs`            | Listing affaires, stats    | Import presse, admin edit       |
| `stats`              | Page statistiques          | Post-sync global                |
| `dossiers`           | Pages dossiers législatifs | Sync dossiers                   |
| `statistics`         | Page /statistiques         | Post-sync global                |
| `feature-flags`      | Feature flags admin        | Admin toggle                    |

### Profil `cacheLife`

Un seul profil est utilisé : `"minutes"` (~5 min de TTL serveur). Défini dans la config Next.js via `experimental.useCache`.

---

## API Routes — Cache-Control headers

Les routes API utilisent `withCache(response, tier)` de `src/lib/cache.ts` :

```typescript
import { withCache } from "@/lib/cache";

export async function GET() {
  const data = await fetchData();
  return withCache(NextResponse.json(data), "daily");
}
```

### Tiers disponibles

| Tier     | `Cache-Control`                             | Usage                                             |
| -------- | ------------------------------------------- | ------------------------------------------------- |
| `static` | `s-maxage=3600, stale-while-revalidate=600` | Données rarement modifiées (partis, institutions) |
| `daily`  | `s-maxage=300, stale-while-revalidate=120`  | Données mises à jour quotidiennement              |
| `stats`  | `s-maxage=900, stale-while-revalidate=300`  | Agrégations statistiques                          |
| `none`   | `no-store`                                  | Données temps réel ou sensibles                   |

**Règle** : `withCache()` uniquement sur les réponses 2xx. Les erreurs ne sont jamais cachées.

---

## Invalidation

### Automatique (post-sync)

Le script `npm run sync:daily` déclenche après chaque sync :

```typescript
import { invalidateEntity, revalidateAll } from "@/lib/cache";

// Après sync d'un politicien
invalidateEntity("politician", "emmanuel-macron");

// Après sync complète
revalidateAll(); // Purge les 5 tags principaux
```

### Manuelle (endpoint cron)

```bash
# Invalider des tags spécifiques
curl -X POST https://poligraph.fr/api/cron/revalidate \
  -H "Authorization: Bearer $CRON_SECRET" \
  -d '{"tags": ["politicians", "votes"]}'

# Tout invalider
curl -X POST https://poligraph.fr/api/cron/revalidate \
  -H "Authorization: Bearer $CRON_SECRET" \
  -d '{"all": true}'
```

### Par entité

`invalidateEntity(type, slug?)` dans `src/lib/cache.ts` invalide :

- Les chemins API (`revalidatePath`)
- Les tags data cache (`revalidateTag`)
- Cascading : un changement de `mandate` invalide aussi `politicians`

---

## Fichiers clés

| Fichier                                | Rôle                                                  |
| -------------------------------------- | ----------------------------------------------------- |
| `src/lib/cache.ts`                     | Tiers API, invalidation par entité, `revalidateAll()` |
| `next.config.ts`                       | `experimental.useCache: true`                         |
| `src/app/api/cron/revalidate/route.ts` | Endpoint d'invalidation manuelle                      |
| `src/app/politiques/[slug]/page.tsx`   | Exemple de référence ISR + `generateStaticParams`     |
| `src/app/statistiques/page.tsx`        | Exemple de page statique avec tabs client             |
| `src/app/politiques/page.tsx`          | Exemple de listing avec pattern 3 fonctions           |

---

## Checklist nouveau développeur

Avant de créer/modifier une page :

- [ ] **La page utilise `searchParams`** ? → `export const revalidate = 300`, pas de `"use cache"` sur le composant
- [ ] **La page est `[slug]` sans searchParams** ? → `generateStaticParams` + `revalidate = 3600`
- [ ] **Nouvelle fonction data** ? → `"use cache"` + `cacheTag` + `cacheLife("minutes")`
- [ ] **Paramètre de recherche libre (texte)** ? → Pattern 3 fonctions, jamais dans `"use cache"`
- [ ] **Nouvelle API route** ? → `withCache(response, tier)` sur les 2xx
- [ ] **Modification de données (admin/sync)** ? → `invalidateEntity(type, slug)` après mutation
- [ ] **Après changement Prisma** ? → `rm -rf .next && npm run db:generate` (cache Next.js invalide)

---

## Résultats mesurés (février 2026)

| Page                 | Avant             | Après            | Mécanisme                               |
| -------------------- | ----------------- | ---------------- | --------------------------------------- |
| `/politiques/[slug]` | 600ms (MISS)      | ~100ms (CDN HIT) | ISR 1h + `generateStaticParams`         |
| `/statistiques`      | 500ms (MISS)      | ~236ms (CDN HIT) | Static + client tabs                    |
| `/departements`      | 320ms (PRERENDER) | 320ms            | Déjà statique                           |
| `/`                  | 110ms (PRERENDER) | 110ms            | Déjà statique                           |
| Listing pages        | 400-900ms         | 400-900ms        | Data cache serveur (CDN non applicable) |
