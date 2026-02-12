# Poligraph

Observatoire citoyen des représentants politiques français. Données publiques, regard indépendant.

**Site** : [https://politic-tracker.vercel.app](https://politic-tracker.vercel.app)

## Objectif

Centraliser les informations publiques sur les représentants politiques français : mandats, patrimoine (HATVP), et affaires judiciaires documentées.

## Principes

- **Transparence** : Toute information est sourcée et vérifiable
- **Neutralité** : Présentation factuelle, sans orientation politique
- **Légalité** : Uniquement des données publiques
- **Présomption d'innocence** : Mentionnée systématiquement pour les affaires en cours

## Fonctionnalités

- Liste des 577 députés et 348 sénateurs
- Recherche par nom avec autocomplétion
- Filtres par parti, type de mandat, statut (actifs/anciens)
- Fiches détaillées avec parcours politique
- Déclarations de patrimoine HATVP
- Affaires judiciaires documentées
- Page "Mon député" (recherche par code postal)
- Pages départements
- Statistiques globales

## Stack technique

| Technologie      | Usage                        |
| ---------------- | ---------------------------- |
| **Next.js 16**   | Framework React (App Router) |
| **TypeScript**   | Typage statique              |
| **Prisma 7**     | ORM                          |
| **PostgreSQL**   | Base de données (Supabase)   |
| **Tailwind CSS** | Styles                       |
| **shadcn/ui**    | Composants UI                |
| **Vercel**       | Hébergement                  |

## Installation

### Prérequis

- Node.js 22+
- Compte Supabase (gratuit)

### Setup local

```bash
# 1. Cloner le repo
git clone https://github.com/ironlam/politic-tracker.git
cd politic-tracker

# 2. Installer les dépendances
npm install

# 3. Configurer la base de données
cp .env.example .env
# Éditer .env avec vos credentials Supabase (Connection Pooler URI)

# 4. Générer le client Prisma
npm run db:generate

# 5. Appliquer le schéma
npm run db:push

# 6. Lancer le serveur de dev
npm run dev
```

## Synchronisation des données

### Commandes

```bash
npm run sync:assemblee      # Députés (577)
npm run sync:senat          # Sénateurs (348)
npm run sync:gouvernement   # Gouvernement actuel
npm run sync:hatvp          # Déclarations patrimoine
npm run sync:photos         # Photos manquantes
npm run sync:deceased       # Dates de décès (Wikidata)
npm run sync:stats          # Statistiques base
npm run import:wikidata     # Condamnations Wikidata
```

### Synchronisation automatique

Un workflow GitHub Actions s'exécute chaque dimanche à 4h00 (Paris) pour synchroniser automatiquement les données.

### Sources de données

| Source              | Données                 | API          |
| ------------------- | ----------------------- | ------------ |
| Assemblée Nationale | Députés                 | data.gouv.fr |
| Sénat               | Sénateurs               | senat.fr     |
| Gouvernement        | Ministres               | data.gouv.fr |
| HATVP               | Déclarations patrimoine | hatvp.fr     |
| Wikidata            | Condamnations, décès    | SPARQL       |

## Structure du projet

```
src/
├── app/                  # Routes Next.js (App Router)
│   ├── politiques/       # Pages politiques
│   ├── partis/           # Pages partis
│   ├── departements/     # Pages départements
│   ├── affaires/         # Liste des affaires
│   ├── statistiques/     # Dashboard stats
│   ├── mon-depute/       # Recherche par code postal
│   ├── admin/            # Interface admin
│   └── api/              # API routes
├── components/
│   ├── ui/               # shadcn/ui
│   ├── politicians/      # Composants politiques
│   ├── layout/           # Header, Footer
│   └── seo/              # JSON-LD
├── lib/                  # Utilitaires
├── services/             # Logique métier
│   └── sync/             # Synchronisation
├── types/                # Types TypeScript
└── config/               # Labels, constantes

scripts/                  # Scripts de sync
docs/                     # Documentation
```

## Documentation

| Document                                  | Description            |
| ----------------------------------------- | ---------------------- |
| [ARCHITECTURE.md](./docs/ARCHITECTURE.md) | Architecture technique |
| [DATASOURCES.md](./docs/DATASOURCES.md)   | Sources de données     |
| [LEGAL.md](./docs/LEGAL.md)               | Aspects juridiques     |

## Contribuer

Les contributions sont les bienvenues. Pour les changements importants, ouvrez d'abord une issue.

```bash
# Créer une branche
git checkout -b feature/ma-fonctionnalite

# Commit
git commit -m "feat: description"

# Push
git push origin feature/ma-fonctionnalite
```

## Licence

MIT

## Avertissement

Ce projet utilise exclusivement des données publiques. Les affaires judiciaires mentionnées sont documentées par des sources de presse vérifiables. La présomption d'innocence s'applique à toute personne non définitivement condamnée.
