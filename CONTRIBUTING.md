# Contribuer à Poligraph

Merci de votre intérêt pour Poligraph ! Ce guide explique comment contribuer au projet.

## Prérequis

- Node.js 22+
- npm
- PostgreSQL

## Mise en place

```bash
# Forker le repo sur GitHub, puis :
git clone https://github.com/<votre-username>/poligraph.git
cd poligraph
npm install
cp .env.example .env
# Configurer .env avec votre URL PostgreSQL
npm run db:generate
npm run db:push
npm run dev
```

## Workflow

1. Créer une branche depuis `main` :
   ```bash
   git checkout -b feat/ma-fonctionnalite
   ```
2. Coder, tester, committer
3. Pousser et ouvrir une Pull Request

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
- Toujours `npm run lint` avant de committer
- `npm run build` doit passer sans erreur

## Structure

```
src/
├── app/           # Routes (App Router)
├── components/    # Composants React
├── config/        # Configuration
├── lib/           # Utilitaires
├── services/      # Logique métier
└── types/         # Types TypeScript
scripts/           # Scripts de synchronisation
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
