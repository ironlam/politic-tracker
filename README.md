# Politic Tracker

Observatoire citoyen de la transparence politique française.

## Objectif

Centraliser les informations publiques sur les élus français : patrimoine, mandats, rémunération, et affaires judiciaires documentées par la presse.

## Principes

- **Transparence** : Toute information est sourcée et vérifiable
- **Neutralité** : Présentation factuelle, sans orientation politique
- **Légalité** : Uniquement des données publiques

## Stack technique

- **Framework** : Next.js 14 (App Router)
- **Base de données** : PostgreSQL (Supabase)
- **ORM** : Prisma
- **UI** : Tailwind CSS + shadcn/ui
- **Hébergement** : Vercel

## Installation

### Prérequis

- Node.js 18+
- Compte Supabase (gratuit)

### Setup

```bash
# 1. Cloner le repo
git clone https://github.com/ironlam/politic-tracker.git
cd politic-tracker

# 2. Installer les dépendances
npm install

# 3. Configurer la base de données
cp .env.example .env
# Éditer .env avec vos credentials Supabase

# 4. Générer le client Prisma
npx prisma generate

# 5. Appliquer les migrations
npx prisma db push

# 6. Lancer le serveur de dev
npm run dev
```

### Configuration Supabase

1. Créer un projet sur [supabase.com](https://supabase.com)
2. Aller dans **Project Settings > Database**
3. Copier la **Connection string (URI)**
4. Coller dans `.env` comme `DATABASE_URL`

## Structure du projet

```
src/
├── app/                  # Routes Next.js (App Router)
│   ├── mentions-legales/ # Page mentions légales
│   └── ...
├── components/ui/        # Composants shadcn/ui
├── config/               # Configuration (labels, constantes)
├── lib/                  # Utilitaires (db, utils)
├── services/             # Logique métier
│   ├── politicians/      # Service politiciens
│   ├── affairs/          # Service affaires judiciaires
│   └── sync/             # Synchronisation API externes
└── types/                # Types TypeScript
```

## Documentation

- [Spécification complète](./docs/SPECIFICATION.md)

## Licence

MIT

## Avertissement

Ce projet utilise exclusivement des données publiques. Les affaires judiciaires mentionnées sont documentées par des sources de presse vérifiables. La présomption d'innocence s'applique à toute personne mise en examen.
