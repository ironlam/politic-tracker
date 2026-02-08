# Architecture technique

> **Dernière mise à jour**: 2026-01-24

---

## 1. Stack technique

| Composant       | Technologie           | Version |
| --------------- | --------------------- | ------- |
| Framework       | Next.js (App Router)  | 16.x    |
| Langage         | TypeScript            | 5.x     |
| Base de données | PostgreSQL            | 15+     |
| ORM             | Prisma                | 7.x     |
| UI Components   | shadcn/ui             | -       |
| Styling         | Tailwind CSS          | 4.x     |
| Hébergement     | Vercel                | -       |
| Base de données | Supabase (PostgreSQL) | -       |

---

## 2. Structure du projet

```
politic-tracker/
├── docs/                          # Documentation
│   ├── SPECIFICATION.md           # Spécifications fonctionnelles
│   ├── ARCHITECTURE.md            # Ce document
│   ├── DATASOURCES.md             # Sources de données
│   └── LEGAL.md                   # Considérations juridiques
│
├── prisma/
│   ├── schema.prisma              # Schéma de base de données
│   └── prisma.config.ts           # Configuration Prisma 7
│
├── scripts/                       # Scripts de synchronisation
│   ├── sync-assemblee.ts          # Import députés
│   ├── sync-senat.ts              # Import sénateurs
│   ├── sync-gouvernement.ts       # Import gouvernement
│   ├── sync-hatvp.ts              # Import déclarations HATVP
│   ├── sync-photos.ts             # Sync photos multi-sources
│   ├── sync-deceased.ts           # Sync dates de décès
│   └── import-wikidata.ts         # Import condamnations Wikidata
│
├── src/
│   ├── app/                       # Next.js App Router
│   │   ├── (public)/              # Routes publiques
│   │   │   ├── page.tsx           # Accueil
│   │   │   ├── politiques/        # Liste et fiches représentants
│   │   │   ├── partis/            # Pages partis politiques
│   │   │   ├── affaires/          # Liste des affaires
│   │   │   ├── statistiques/      # Dashboard statistiques
│   │   │   └── sources/           # Page sources et manifeste
│   │   │
│   │   ├── admin/                 # Interface administration
│   │   │   ├── login/             # Authentification
│   │   │   ├── politiques/        # CRUD représentants
│   │   │   ├── affaires/          # CRUD affaires
│   │   │   └── partis/            # CRUD partis
│   │   │
│   │   └── api/                   # Routes API
│   │       ├── admin/             # API admin (protégée)
│   │       ├── search/            # API recherche (autocomplétion)
│   │       └── affaires/          # API affaires publique
│   │
│   ├── components/                # Composants React
│   │   ├── layout/                # Header, Footer
│   │   ├── politicians/           # Composants représentants
│   │   ├── theme/                 # ThemeProvider, ThemeToggle
│   │   └── ui/                    # Composants shadcn/ui
│   │
│   ├── config/                    # Configuration
│   │   └── labels.ts              # Labels, couleurs, mappings
│   │
│   ├── generated/                 # Code généré
│   │   └── prisma/                # Client Prisma généré
│   │
│   ├── lib/                       # Utilitaires
│   │   ├── db.ts                  # Client Prisma singleton
│   │   └── utils.ts               # Fonctions utilitaires
│   │
│   ├── services/                  # Logique métier
│   │   └── sync/                  # Services de synchronisation
│   │       ├── assemblee.ts       # Sync Assemblée Nationale
│   │       ├── senators.ts        # Sync Sénat
│   │       ├── government.ts      # Sync Gouvernement
│   │       ├── hatvp.ts           # Sync HATVP
│   │       ├── photos.ts          # Sync photos
│   │       ├── deceased.ts        # Sync décès
│   │       └── types.ts           # Types partagés
│   │
│   └── types/                     # Types TypeScript
│       └── index.ts               # Types partagés de l'application
│
└── public/                        # Fichiers statiques
```

---

## 3. Modèle de données

### 3.1 Entités principales

```
┌─────────────────┐     ┌─────────────────┐
│   Politician    │────<│    Mandate      │
├─────────────────┤     ├─────────────────┤
│ id              │     │ id              │
│ firstName       │     │ type            │
│ lastName        │     │ title           │
│ fullName        │     │ institution     │
│ slug            │     │ startDate       │
│ civility        │     │ endDate         │
│ birthDate       │     │ isCurrent       │
│ deathDate       │     └─────────────────┘
│ photoUrl        │
│ photoSource     │     ┌─────────────────┐
│ currentPartyId  │────>│     Party       │
└─────────────────┘     ├─────────────────┤
        │               │ id              │
        │               │ name            │
        │               │ shortName       │
        │               │ color           │
        │               └─────────────────┘
        │
        │               ┌─────────────────┐
        ├──────────────<│    Affair       │
        │               ├─────────────────┤
        │               │ id              │
        │               │ title           │
        │               │ status          │
        │               │ category        │
        │               │ verdictDate     │
        │               │ partyAtTimeId   │
        │               └─────────────────┘
        │                       │
        │               ┌───────┴─────────┐
        │               │     Source      │
        │               ├─────────────────┤
        │               │ url             │
        │               │ title           │
        │               │ publisher       │
        │               └─────────────────┘
        │
        │               ┌─────────────────┐
        ├──────────────<│  Declaration    │
        │               ├─────────────────┤
        │               │ type            │
        │               │ year            │
        │               │ hatvpUrl        │
        │               │ pdfUrl          │
        │               └─────────────────┘
        │
        │               ┌─────────────────┐
        └──────────────<│   ExternalId    │
                        ├─────────────────┤
                        │ source          │
                        │ externalId      │
                        │ url             │
                        └─────────────────┘
```

### 3.2 Enums

```typescript
enum MandateType {
  DEPUTE,
  SENATEUR,
  DEPUTE_EUROPEEN,
  PRESIDENT_REPUBLIQUE,
  PREMIER_MINISTRE,
  MINISTRE,
  MINISTRE_DELEGUE,
  SECRETAIRE_ETAT,
  PRESIDENT_REGION,
  PRESIDENT_DEPARTEMENT,
  MAIRE,
  ADJOINT_MAIRE,
  CONSEILLER_REGIONAL,
  CONSEILLER_DEPARTEMENTAL,
  CONSEILLER_MUNICIPAL,
}

enum AffairStatus {
  ENQUETE_PRELIMINAIRE,
  MISE_EN_EXAMEN,
  PROCES_EN_COURS,
  CONDAMNATION_PREMIERE_INSTANCE,
  CONDAMNATION_DEFINITIVE,
  APPEL_EN_COURS,
  RELAXE,
  NON_LIEU,
  PRESCRIPTION,
}

enum DataSource {
  ASSEMBLEE_NATIONALE,
  SENAT,
  GOUVERNEMENT,
  HATVP,
  WIKIDATA,
  NOSDEPUTES,
  NOSSENATEURS,
  WIKIPEDIA,
  MANUAL,
}
```

---

## 4. Flux de données

### 4.1 Synchronisation

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ Source       │────>│ Script sync  │────>│ PostgreSQL   │
│ (API/CSV)    │     │ (TypeScript) │     │ (Supabase)   │
└──────────────┘     └──────────────┘     └──────────────┘
                            │
                            v
                     ┌──────────────┐
                     │ ExternalId   │
                     │ (traçabilité)│
                     └──────────────┘
```

### 4.2 Requêtes utilisateur

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ Navigateur   │────>│ Next.js      │────>│ Prisma       │
│              │<────│ (RSC/API)    │<────│ (PostgreSQL) │
└──────────────┘     └──────────────┘     └──────────────┘
```

---

## 5. Sécurité

### 5.1 Authentification admin

- Cookie de session (HTTP-only)
- Mot de passe hashé comparé côté serveur
- Variable d'environnement `ADMIN_PASSWORD`

### 5.2 Protection des données

- Pas de données personnelles des visiteurs collectées
- Pas de cookies de tracking
- Uniquement données publiques des représentants

### 5.3 Headers de sécurité (à implémenter)

- Content-Security-Policy
- X-Frame-Options
- X-Content-Type-Options
- Strict-Transport-Security

---

## 6. Performance

### 6.1 Stratégies de rendu Next.js

- **Pages statiques** : Accueil, Sources, Mentions légales
- **Pages dynamiques** : Listes avec filtres, fiches individuelles
- **API Routes** : Recherche, Admin

### 6.2 Optimisations

- Images : URL externes (AN, Sénat, HATVP)
- Pagination : 24 items par page
- Débounce recherche : 200ms

---

## 7. Commandes

### 7.1 Développement

```bash
npm run dev          # Serveur développement
npm run build        # Build production
npm run start        # Serveur production
```

### 7.2 Base de données

```bash
npm run db:push      # Appliquer schéma
npm run db:generate  # Régénérer client Prisma
npm run db:studio    # Interface visuelle
```

### 7.3 Synchronisation

```bash
npm run sync:assemblee       # Députés
npm run sync:senat           # Sénateurs
npm run sync:gouvernement    # Gouvernement
npm run sync:hatvp           # Déclarations HATVP
npm run sync:photos          # Photos manquantes
npm run sync:deceased        # Dates de décès
npm run import:wikidata      # Condamnations Wikidata
npm run sync:stats           # Statistiques DB
```

---

## 8. Variables d'environnement

```env
# Base de données (Supabase Pooler)
DATABASE_URL=postgresql://...

# Admin
ADMIN_PASSWORD=...

# Optionnel
NODE_ENV=production
```
