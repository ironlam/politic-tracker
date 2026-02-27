<p align="center">
  <a href="https://poligraph.fr">
    <img alt="Poligraph" src="https://poligraph.fr/logo.svg" width="200">
  </a>
</p>

<p align="center">
  <strong>Observatoire citoyen des responsables politiques français</strong><br>
  Données publiques, regard indépendant
</p>

<p align="center">
  <a href="https://poligraph.fr">poligraph.fr</a> ·
  <a href="https://github.com/ironlam/poligraph/issues">Issues</a> ·
  <a href="./CONTRIBUTING.md">Contribuer</a>
</p>

<p align="center">
  <a href="https://github.com/ironlam/poligraph/actions/workflows/ci.yml"><img src="https://github.com/ironlam/poligraph/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://github.com/ironlam/poligraph/actions/workflows/sync-daily.yml"><img src="https://github.com/ironlam/poligraph/actions/workflows/sync-daily.yml/badge.svg" alt="Sync Daily"></a>
  <a href="https://github.com/ironlam/poligraph/actions/workflows/test-quality.yml"><img src="https://github.com/ironlam/poligraph/actions/workflows/test-quality.yml/badge.svg" alt="Quality"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/License-AGPL--3.0-blue.svg" alt="License: AGPL-3.0"></a>
</p>

---

## Qu'est-ce que Poligraph ?

Poligraph centralise les informations publiques sur les responsables politiques français : mandats, votes parlementaires, déclarations de patrimoine, affaires judiciaires, et activité législative — le tout sourcé, vérifiable et présenté de manière factuelle.

### Principes fondateurs

|                             |                                                        |
| --------------------------- | ------------------------------------------------------ |
| **Transparence**            | Toute information est sourcée et vérifiable            |
| **Neutralité**              | Présentation factuelle, sans orientation politique     |
| **Légalité**                | Uniquement des données publiques                       |
| **Présomption d'innocence** | Mentionnée systématiquement pour les affaires en cours |

## Fonctionnalités

### Fiches politiques

- 577 députés, 348 sénateurs, membres du gouvernement
- Parcours politique complet : mandats, partis, fonctions
- Photos officielles, biographies générées par IA
- Score de notoriété calculé automatiquement

### Votes & législation

- Scrutins de l'Assemblée nationale avec résumés IA
- Vote individuel de chaque député (pour / contre / abstention)
- Taux de participation et classement par parlementaire
- Suivi des dossiers législatifs et amendements

### Transparence financière

- Déclarations de patrimoine HATVP (intérêts & activités)
- Portefeuille immobilier, valeurs mobilières, revenus

### Affaires judiciaires

- Découverte automatique via Wikidata, Judilibre et presse
- Timeline des procédures (mise en examen → condamnation)
- Modération éditoriale avec triage IA
- Fact-checks agrégés (AFP, Les Décodeurs)

### Exploration

- Recherche par nom, code postal, département
- Filtres par parti, mandat, statut, chambre
- Comparateur de politiques (votes, patrimoine)
- Pages par département et par institution

### IA & recherche sémantique

- Chatbot avec RAG (pgvector + embeddings)
- Résumés automatiques des scrutins
- Biographies générées et vérifiées
- Classification thématique des textes de loi

## Stack technique

| Technologie       | Usage                                           |
| ----------------- | ----------------------------------------------- |
| **Next.js 16**    | Framework React (App Router, Server Components) |
| **TypeScript**    | Typage statique                                 |
| **Prisma 7**      | ORM avec 37 modèles                             |
| **PostgreSQL**    | Base de données (Supabase) + pgvector           |
| **Tailwind CSS**  | Styles                                          |
| **shadcn/ui**     | Composants UI                                   |
| **Inngest**       | Orchestration de jobs asynchrones               |
| **Vercel**        | Hébergement & CDN                               |
| **Upstash Redis** | Cache                                           |

## Installation

### Prérequis

- Node.js 22+
- Compte Supabase (gratuit)

### Setup local

```bash
git clone https://github.com/ironlam/poligraph.git
cd poligraph

npm install

cp .env.example .env
# Éditer .env avec vos credentials Supabase

npm run db:generate
npm run db:push
npm run dev
```

## Sources de données

| Source                                                             | Données                              | Fréquence    |
| ------------------------------------------------------------------ | ------------------------------------ | ------------ |
| [Assemblée nationale](https://data.assemblee-nationale.fr)         | Députés, votes, dossiers législatifs | Quotidienne  |
| [Sénat](https://www.senat.fr/open-data.html)                       | Sénateurs                            | Quotidienne  |
| [data.gouv.fr](https://www.data.gouv.fr)                           | Gouvernement, élections              | Quotidienne  |
| [HATVP](https://www.hatvp.fr/open-data/)                           | Déclarations de patrimoine           | Hebdomadaire |
| [Wikidata](https://www.wikidata.org)                               | Enrichissement, affaires, décès      | Hebdomadaire |
| [Judilibre](https://www.courdecassation.fr/acces-rapide-judilibre) | Jurisprudence                        | Hebdomadaire |
| Flux RSS presse                                                    | Mentions médiatiques                 | Horaire      |
| [Google Fact Check API](https://toolbox.google.com/factcheck/apis) | Fact-checks                          | Quotidienne  |

### Synchronisation

```bash
# Politiques
npm run sync:assemblee         # Députés (CSV data.gouv.fr)
npm run sync:senat             # Sénateurs (API senat.fr)
npm run sync:gouvernement      # Ministres (corrections + data.gouv.fr)

# Votes & législation
npm run sync:votes-an          # Scrutins Assemblée nationale
npm run sync:legislation       # Dossiers législatifs

# Transparence
npm run sync:hatvp             # Déclarations HATVP

# Enrichissement
npm run sync:wikidata-ids      # Réconciliation Wikidata
npm run import:wikidata        # Affaires judiciaires (SPARQL)
npm run sync:press             # Articles de presse (RSS)
npm run sync:factchecks        # Fact-checks

# Pré-calcul
npm run sync:compute-stats     # Stats de participation & classements
```

Un **sync quotidien** tourne automatiquement via GitHub Actions + Inngest. Les données sont mises à jour toutes les heures pour les votes et la presse, quotidiennement pour le reste.

## Structure du projet

```
src/
├── app/                     # 56 pages (Next.js App Router)
│   ├── politiques/          # Fiches politiques
│   ├── votes/               # Scrutins & votes
│   ├── affaires/            # Affaires judiciaires
│   ├── declarations-*/      # Patrimoine HATVP
│   ├── assemblee/           # Députés
│   ├── statistiques/        # Dashboard stats
│   ├── comparer/            # Comparateur
│   ├── chat/                # Chatbot IA
│   ├── elections/           # Élections
│   ├── presse/              # Revue de presse
│   ├── mon-depute/          # Recherche par code postal
│   ├── admin/               # Interface d'administration
│   └── api/                 # Endpoints REST
├── components/              # Composants React
├── services/
│   └── sync/                # 18 services de synchronisation
├── inngest/                 # Jobs Inngest (sync, IA, maintenance)
├── lib/                     # Utilitaires (DB, API clients, cache)
├── config/                  # Labels, constantes, Wikidata Q-IDs
└── types/                   # Types TypeScript partagés

scripts/                     # 50+ scripts CLI
data/                        # Corrections manuelles (gouvernement, etc.)
docs/                        # Documentation technique
```

## Documentation

| Document                                  | Description                    |
| ----------------------------------------- | ------------------------------ |
| [ARCHITECTURE.md](./docs/ARCHITECTURE.md) | Architecture technique         |
| [DATASOURCES.md](./docs/DATASOURCES.md)   | Sources de données et pipeline |
| [LEGAL.md](./docs/LEGAL.md)               | Cadre juridique                |
| [CONTRIBUTING.md](./CONTRIBUTING.md)      | Guide de contribution          |
| [SECURITY.md](./SECURITY.md)              | Politique de sécurité          |

## Écosystème

| Projet                                                                              | Description                           |
| ----------------------------------------------------------------------------------- | ------------------------------------- |
| [poligraph](https://github.com/ironlam/poligraph)                                   | Application web principale            |
| [transparence-politique-mcp](https://github.com/ironlam/transparence-politique-mcp) | Serveur MCP pour agents IA            |
| [poligraph-wikibot](https://github.com/ironlam/poligraph-wikibot)                   | Bot Wikidata (contribution open data) |

## Contribuer

Les contributions sont les bienvenues ! Consultez le guide [CONTRIBUTING.md](./CONTRIBUTING.md).

## Licence

Ce projet est sous licence [AGPL-3.0](./LICENSE).

---

<sub>Ce projet utilise exclusivement des données publiques. Les affaires judiciaires mentionnées sont documentées par des sources de presse vérifiables. La présomption d'innocence s'applique à toute personne non définitivement condamnée.</sub>
