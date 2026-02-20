# Design — File d'attente async avec Inngest (#155)

## Contexte

Les scripts de sync (presse, affaires, votes, embeddings) tournent actuellement via :
- **GitHub Actions** (cron 3x/jour) pour les syncs planifiés
- **Worker Fly.io** (`worker/server.js`) pour les syncs déclenchés depuis l'admin

Problème : Fly.io est un service supplémentaire à maintenir (Dockerfile, déploiement, monitoring). L'objectif est de tout consolider sur Vercel + un service serverless-first.

## Décision

**Inngest** — service de "durable functions" intégré nativement à Next.js/Vercel.

### Pourquoi Inngest vs alternatives

| Critère | Inngest | Chunks QStash | Fly.io actuel |
|---------|---------|---------------|---------------|
| Complexité | Wrapper mince | Réécrire chaque script | Déjà en place |
| Timeout | Aucun (steps persistés) | 300s/batch | Aucun |
| Retry | Natif (configurable) | Manuel | Manuel |
| Scheduling | Cron intégré | Via Vercel Cron | Via GitHub Actions |
| Monitoring | Dashboard + API + CLI | Logs Vercel éparpillés | Logs Fly.io |
| Coût | Free tier 5K runs/mois | Free tier 500 msg/jour | ~5$/mois |
| Infra à gérer | Aucune | Upstash Redis | Dockerfile + deploy |

### Sécurité

- Inngest signe chaque webhook avec HMAC-SHA256 (vérifié par le SDK)
- La route `/api/inngest` rejette les requêtes non signées (401)
- Inngest ne voit que les noms d'events + data envoyée, pas la DB ni les env vars
- Au pire (event key leaked) : quelqu'un peut déclencher des syncs, pas accéder aux données

## Architecture

```
┌─────────────┐     inngest.send()     ┌──────────────┐
│  Admin UI   │ ──────────────────────► │   Inngest    │
│ /admin/syncs│                         │   Cloud      │
└─────────────┘                         └──────┬───────┘
                                               │ webhook (signé)
┌─────────────┐     inngest.send()             │
│  CLI local  │ ───────────────────────────────►│
│ npm trigger │                                │
└─────────────┘                                ▼
                                    ┌──────────────────┐
                                    │ POST /api/inngest │
                                    │ (Vercel Function)  │
                                    │                    │
                                    │ syncPress()        │
                                    │ syncVotes()        │
                                    │ discoverAffairs()  │
                                    │ syncDaily()        │
                                    └────────┬───────────┘
                                             │
                                    ┌────────▼───────────┐
                                    │  SyncJob (Prisma)  │
                                    │  status, progress  │
                                    └────────────────────┘
```

Le flux :
1. Admin (ou CLI) envoie un event Inngest (ex: `sync/press`)
2. Inngest appelle `/api/inngest` via webhook signé
3. La fonction Vercel s'exécute, met à jour le SyncJob en base
4. L'admin UI poll `/api/admin/syncs` pour afficher la progression (inchangé)

## Structure fichiers

```
src/inngest/
├── client.ts                    # new Inngest({ id: "poligraph" })
├── functions/
│   ├── sync-press.ts            # RSS + analyse IA presse
│   ├── sync-votes.ts            # Votes AN + Sénat
│   ├── sync-legislation.ts      # Dossiers + contenu
│   ├── discover-affairs.ts      # Wikidata + Wikipedia + réconciliation
│   ├── sync-factchecks.ts       # Factchecks + Judilibre
│   ├── generate-ai.ts           # Biographies + résumés + thèmes
│   ├── index-embeddings.ts      # Embeddings RAG
│   └── sync-daily.ts            # Orchestrateur (cron 3x/jour)
└── index.ts                     # Export barrel
src/app/api/inngest/route.ts     # Route handler serve()
scripts/trigger.ts               # CLI pour déclencher depuis le terminal
```

## Anatomie d'une fonction

Chaque fonction Inngest est un wrapper mince autour de la logique existante.
Les `step.run()` découpent le travail en étapes persistées — si le step 2 échoue,
le retry reprend au step 2 (pas depuis le début). Pas de timeout global.

```typescript
export const syncPress = inngest.createFunction(
  { id: "sync-press", retries: 3, concurrency: { limit: 1 } },
  { event: "sync/press" },
  async ({ event, step }) => {
    const { jobId, limit } = event.data;

    await step.run("parse-rss", async () => {
      // Appelle la logique existante de sync-press.ts
    });

    await step.run("ai-analysis", async () => {
      // Appelle la logique existante de sync-press-analysis.ts
    });

    await db.syncJob.update({
      where: { id: jobId },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
  }
);
```

## 3 modes de déclenchement

### Admin UI (existant, front inchangé)
POST `/api/admin/syncs` crée un SyncJob puis fait `inngest.send()` au lieu d'appeler Fly.io.

### CLI local
```bash
npm run trigger sync:press              # Lance sync presse
npm run trigger sync:press -- --limit=50
npm run trigger discover:affairs
npm run trigger sync:daily
```
Le script envoie l'event via l'API REST Inngest (besoin de INNGEST_EVENT_KEY en .env).

### Cron Inngest (remplace GitHub Actions)
```typescript
export const syncDaily = inngest.createFunction(
  { id: "sync-daily" },
  { cron: "0 5,11,19 * * *" },
  async ({ step }) => { /* orchestrateur */ }
);
```

## Migration Fly.io

### Phase 1 — Inngest en parallèle
- Installer Inngest, créer les fonctions, adapter le POST `/api/admin/syncs`
- Fly.io reste en fallback le temps de valider

### Phase 2 — Suppression Fly.io
- Migrer cron GitHub Actions → cron Inngest
- Supprimer `SYNC_WORKER_URL` / `SYNC_WORKER_SECRET` des env vars Vercel
- Supprimer `worker/` (server.js, Dockerfile, fly.toml)
- Supprimer `.github/workflows/deploy-worker.yml`
- `flyctl apps destroy poligraph-sync-worker`

## Env vars

```bash
# Nouveau
INNGEST_EVENT_KEY=...      # Envoyer des events
INNGEST_SIGNING_KEY=...    # Vérifier les webhooks

# À supprimer (Phase 2)
SYNC_WORKER_URL
SYNC_WORKER_SECRET
```

## Hors scope (pour plus tard)

- Migration de TOUS les scripts (on commence par les 5 principaux)
- Dashboard custom de monitoring (le dashboard Inngest suffit)
- Notifications Slack/email sur échec (possible via Inngest mais pas en v1)
