# Contribuer à Poligraph

Merci de votre intérêt pour Poligraph ! Ce guide explique comment contribuer au projet.

## Démarrage rapide (< 5 minutes)

### Prérequis

- [Node.js 22+](https://nodejs.org/)
- [Docker](https://docs.docker.com/get-docker/) (recommandé) **ou** une instance PostgreSQL

### Installation automatique

```bash
# 1. Forker et cloner le repo
git clone https://github.com/<votre-username>/poligraph.git
cd poligraph

# 2. Tout installer d'un coup (Docker, deps, DB, fixtures)
npm run setup
```

Le script `setup` :
- Installe les dépendances npm
- Crée `.env` avec PostgreSQL local pré-configuré
- Démarre PostgreSQL via Docker Compose
- Génère le client Prisma et pousse le schéma
- Charge des données fictives réalistes (politiciens, votes, affaires...)

```bash
# 3. Lancer le serveur de développement
npm run dev
# → http://localhost:3000
```

### Installation manuelle (sans Docker)

```bash
git clone https://github.com/<votre-username>/poligraph.git
cd poligraph
npm install
cp .env.example .env
# Éditer .env avec votre URL PostgreSQL
npm run db:generate
npm run db:push
npm run seed:fixtures --force
npm run dev
```

### Variables d'environnement

Le fichier `.env.example` est organisé en 3 sections :

| Section | Nécessaire pour... |
|---------|-------------------|
| **REQUIRED** | Faire tourner l'app (DB + URL + admin) |
| **OPTIONAL** | IA, analytics, social posting |
| **ADVANCED** | Scripts de synchronisation spécifiques |

Pour contribuer au frontend ou aux composants, seule la section **REQUIRED** est nécessaire.

## Workflow

1. Créer une branche depuis `main` :
   ```bash
   git checkout -b feat/ma-fonctionnalite
   ```
2. Coder, tester, committer
3. Vérifier que la CI passe :
   ```bash
   npm run lint && npm run typecheck && npm run test:run
   ```
4. Pousser et ouvrir une Pull Request

## Conventions de commits

Utiliser le format [Conventional Commits](https://www.conventionalcommits.org/) :

```
feat: ajouter le filtre par département
fix: corriger le calcul des mandats actifs
docs: mettre à jour DATASOURCES.md
refactor: simplifier le service de sync
```

Types : `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`, `ci`.

## Conventions de code

- **Composants React** : `PascalCase.tsx`
- **Utilitaires** : `camelCase.ts`
- **Routes API** : `kebab-case`
- **Langue du code** : anglais
- **Langue de l'interface** : français
- Toujours `npm run lint` avant de committer (le pre-commit hook le fait automatiquement)
- `npm run build` doit passer sans erreur

## Structure du projet

```
src/
├── app/           # Routes (App Router Next.js)
├── components/    # Composants React (ui/, layout/, politicians/, admin/...)
├── config/        # Configuration, constantes, labels i18n
├── lib/           # Utilitaires, clients API, data layer
│   └── data/      #   Fonctions de requête cachées (getPolitician, getAffairs...)
├── services/      # Logique métier (sync, affairs, votes...)
└── types/         # Types TypeScript
scripts/           # Scripts de synchronisation et outils CLI
prisma/            # Schéma Prisma
```

### Zones idéales pour commencer

| Zone | Risque | Exemples |
|------|--------|----------|
| `src/components/ui/` | Faible | Nouveaux composants UI, améliorations visuelles |
| `src/config/labels.ts` | Faible | Traductions, labels manquants |
| `tests/` | Faible | Nouveaux tests unitaires |
| `src/components/*/` | Moyen | Composants de page (politicians, affairs...) |
| `src/app/*/page.tsx` | Moyen | Pages publiques |
| `src/lib/data/` | Élevé | Couche de données (nécessite connaissance caching) |
| `scripts/` | Élevé | Scripts de synchronisation (nécessite accès API) |

## Commandes utiles

```bash
npm run dev              # Serveur de développement
npm run lint             # Vérifier le code
npm run typecheck        # Vérifier les types TypeScript
npm run test:run         # Lancer les tests
npm run db:studio        # Explorer la base avec Prisma Studio
npm run format           # Formatter le code (Prettier)
```

## Signaler un bug

Ouvrir une [issue](https://github.com/ironlam/poligraph/issues/new?template=bug_report.md) en décrivant :

- Ce qui se passe
- Ce qui devrait se passer
- Les étapes pour reproduire

## Proposer une fonctionnalité

Ouvrir une [issue](https://github.com/ironlam/poligraph/issues/new?template=feature_request.md) en expliquant :

- Le besoin citoyen
- La solution proposée
- Les alternatives envisagées

## Principes importants

- **Neutralité partisane** : mêmes critères pour tous les bords politiques
- **Fiabilité** : sources officielles uniquement, ne jamais inventer de données
- **Présomption d'innocence** : obligatoire pour les affaires en cours
- **Accessibilité** : WCAG AA minimum

## Code de conduite

Ce projet suit un [Code de conduite](./CODE_OF_CONDUCT.md). En participant, vous vous engagez à le respecter.

## Licence

En contribuant, vous acceptez que vos contributions soient publiées sous la licence [AGPL-3.0](./LICENSE).
