# Politic Tracker - Document de Spécification

> **Version**: 0.3.0
> **Dernière mise à jour**: 2026-01-18
> **Statut**: Draft - En cours de définition

---

## 1. Vision du projet

### 1.1 Objectif principal

Créer un **observatoire citoyen de la transparence politique française** permettant aux citoyens d'accéder facilement aux informations publiques concernant les élus : patrimoine, votes, présence, rémunération, et affaires judiciaires documentées.

### 1.2 Principes fondamentaux

1. **Transparence** : Toute information affichée doit être sourcée et vérifiable
2. **Neutralité** : Présentation factuelle, sans orientation politique
3. **Légalité** : Uniquement des données publiques, respect du RGPD et du droit à l'image
4. **Accessibilité** : Interface simple, compréhensible par tous les citoyens

### 1.3 Ce que le projet N'EST PAS

- Un site de dénonciation ou de "name and shame"
- Un média d'opinion
- Une base de données de casiers judiciaires (illégal)

---

## 2. Périmètre fonctionnel

### 2.1 Phase 1 - MVP+ (Scope initial)

#### Élus couverts
- [ ] Députés (577)
- [ ] Sénateurs (348)
- [ ] Membres du gouvernement (~40)

#### Données par élu
- [ ] **Identité** : Nom, photo, date de naissance, parti politique
- [ ] **Mandat actuel** : Fonction, circonscription, date début
- [ ] **Historique des mandats** : Fonctions précédentes
- [ ] **Rémunération** : Indemnités parlementaires (données officielles)
- [ ] **Patrimoine** : Déclarations HATVP (si disponibles)
- [ ] **Affaires judiciaires** : Condamnations et mises en examen publiques (avec sources presse)

#### Fonctionnalités utilisateur
- [ ] Recherche par nom, parti, circonscription
- [ ] Fiche détaillée par politicien
- [ ] Filtres : par parti, par type d'affaire, par statut
- [ ] Liste des dernières affaires ajoutées

#### Fonctionnalités admin
- [ ] Authentification sécurisée
- [ ] CRUD politiciens
- [ ] CRUD affaires judiciaires (avec obligation de source)
- [ ] Import de données depuis API officielles

### 2.2 Phase 2 - Enrichissement (Future)

- [ ] Votes à l'Assemblée/Sénat avec positions
- [ ] Taux de présence
- [ ] Déclarations d'intérêts détaillées
- [ ] Élus locaux (maires grandes villes, présidents régions)
- [ ] Comparateur entre élus
- [ ] Timeline des événements par élu
- [ ] API publique pour réutilisation

### 2.3 Phase 3 - Communautaire (Future)

- [ ] Contributions externes modérées
- [ ] Système de signalement d'erreurs
- [ ] Notifications sur nouvelles affaires
- [ ] Export des données (Open Data)

---

## 3. Sources de données

### 3.1 Sources officielles (automatisables)

| Source | URL | Données | Priorité |
|--------|-----|---------|----------|
| API Assemblée Nationale | data.assemblee-nationale.fr | Députés, mandats, organes | P0 |
| API Sénat | data.senat.fr | Sénateurs, mandats | P0 |
| HATVP | hatvp.fr | Déclarations patrimoine/intérêts | P1 |
| data.gouv.fr | data.gouv.fr | Répertoire national des élus | P0 |
| Journal Officiel | legifrance.gouv.fr | Nominations gouvernement | P1 |

### 3.2 Sources presse (manuelles)

| Source | Usage | Accès |
|--------|-------|-------|
| Mediapart | Affaires judiciaires, enquêtes | Abonnement personnel disponible |
| Le Monde | Affaires judiciaires, fact-checking | À souscrire |
| AFP | Dépêches factuelles (optionnel) | Coûteux - Phase 2 |
| Légifrance | Décisions de justice publiques | Gratuit |

### 3.3 Politique de sourçage

**Règle absolue** : Toute affaire judiciaire DOIT avoir :
1. Au minimum 1 source presse nationale vérifiable
2. La date de publication de la source
3. Le statut précis (mise en examen / condamnation / relaxe / appel)
4. La date de dernière vérification

---

## 4. Architecture technique

### 4.1 Stack retenue

```
Frontend + Backend : Next.js 14 (App Router)
Base de données   : PostgreSQL (Neon ou Supabase)
ORM               : Prisma
Auth              : NextAuth.js
UI                : Tailwind CSS + shadcn/ui
Validation        : Zod
Hébergement       : Vercel (frontend) + DB hébergée
```

### 4.2 Structure du projet

```
politic-tracker/
├── docs/
│   ├── SPECIFICATION.md      # Ce document
│   ├── ARCHITECTURE.md       # Détails techniques
│   ├── DATA_SOURCES.md       # Documentation des sources
│   └── LEGAL.md              # Considérations juridiques
├── prisma/
│   └── schema.prisma         # Schéma base de données
├── src/
│   ├── app/                  # Next.js App Router
│   │   ├── (public)/         # Pages publiques
│   │   │   ├── page.tsx      # Accueil
│   │   │   ├── politicians/  # Liste et fiches
│   │   │   └── search/       # Recherche
│   │   ├── admin/            # Interface admin
│   │   └── api/              # Routes API
│   ├── components/           # Composants React
│   ├── lib/                  # Utilitaires, DB client
│   ├── services/             # Logique métier
│   │   ├── politicians/      # Service politiciens
│   │   ├── affairs/          # Service affaires
│   │   └── sync/             # Synchronisation données
│   └── types/                # Types TypeScript
├── scripts/
│   └── seed/                 # Scripts d'import initial
└── tests/
```

### 4.3 Schéma de base de données (Draft)

```prisma
// Politicien
model Politician {
  id              String    @id @default(cuid())
  slug            String    @unique
  firstName       String
  lastName        String
  birthDate       DateTime?
  photoUrl        String?
  currentParty    Party?    @relation(fields: [partyId], references: [id])
  partyId         String?

  mandates        Mandate[]
  affairs         Affair[]
  declarations    Declaration[]

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}

// Parti politique
model Party {
  id              String    @id @default(cuid())
  name            String
  shortName       String    // Ex: "RN", "LFI", "PS"
  color           String?   // Couleur officielle
  politicians     Politician[]
}

// Mandat
model Mandate {
  id              String    @id @default(cuid())
  politician      Politician @relation(fields: [politicianId], references: [id])
  politicianId    String
  type            MandateType
  title           String    // Ex: "Député de la 3ème circonscription du Rhône"
  institution     String    // Ex: "Assemblée nationale"
  startDate       DateTime
  endDate         DateTime?
  isCurrent       Boolean   @default(true)
  salary          Decimal?  // Indemnité mensuelle

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}

enum MandateType {
  DEPUTE
  SENATEUR
  MINISTRE
  SECRETAIRE_ETAT
  PREMIER_MINISTRE
  PRESIDENT
  MAIRE
  PRESIDENT_REGION
  DEPUTE_EUROPEEN
  OTHER
}

// Affaire judiciaire
model Affair {
  id              String    @id @default(cuid())
  politician      Politician @relation(fields: [politicianId], references: [id])
  politicianId    String
  title           String    // Ex: "Affaire des emplois fictifs"
  description     String    @db.Text
  status          AffairStatus
  category        AffairCategory
  dateStart       DateTime? // Date des faits ou début affaire
  dateVerdict     DateTime? // Date condamnation/relaxe
  sentence        String?   // Ex: "2 ans avec sursis"

  sources         Source[]

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  verifiedAt      DateTime? // Dernière vérification
  verifiedBy      String?   // Admin qui a vérifié
}

enum AffairStatus {
  ENQUETE_PRELIMINAIRE
  MISE_EN_EXAMEN
  PROCES_EN_COURS
  CONDAMNATION
  RELAXE
  APPEL_EN_COURS
  PRESCRIPTION
  NON_LIEU
}

enum AffairCategory {
  CORRUPTION
  FRAUDE_FISCALE
  ABUS_BIEN_SOCIAUX
  EMPLOI_FICTIF
  FINANCEMENT_ILLEGAL
  HARCELEMENT
  VIOLENCE
  DIFFAMATION
  CONFLIT_INTERETS
  AUTRE
}

// Source (pour traçabilité)
model Source {
  id              String    @id @default(cuid())
  affair          Affair    @relation(fields: [affairId], references: [id])
  affairId        String
  url             String
  title           String
  publisher       String    // Ex: "Mediapart", "Le Monde"
  publishedAt     DateTime
  archivedUrl     String?   // Archive.org backup

  createdAt       DateTime  @default(now())
}

// Déclaration HATVP
model Declaration {
  id              String    @id @default(cuid())
  politician      Politician @relation(fields: [politicianId], references: [id])
  politicianId    String
  type            DeclarationType
  year            Int
  patrimonyTotal  Decimal?
  pdfUrl          String?
  hatvpUrl        String

  createdAt       DateTime  @default(now())
}

enum DeclarationType {
  PATRIMOINE
  INTERETS
}
```

---

## 5. Contraintes légales

### 5.1 Ce qui est autorisé

- Republier des informations déjà publiques (presse, JO, HATVP)
- Mentionner des condamnations définitives
- Mentionner des mises en examen publiques (avec précaution)
- Afficher les déclarations de patrimoine HATVP

### 5.2 Ce qui est INTERDIT

- Accéder ou diffuser le casier judiciaire (confidentiel)
- Présenter une mise en examen comme une condamnation
- Diffuser des informations non sourcées
- Utiliser des photos sans droit (préférer photos officielles AN/Sénat)

### 5.3 Mentions obligatoires

- Rappel de la présomption d'innocence pour mises en examen
- Date de dernière mise à jour de chaque fiche
- Lien vers les sources originales
- Formulaire de droit de réponse / rectification

### 5.4 Recommandations

- Consulter un avocat avant mise en production
- Souscrire une assurance RC Pro
- Prévoir une procédure de retrait rapide si mise en demeure

### 5.5 Mentions légales (à intégrer dès Phase 1)

Page `/mentions-legales` obligatoire :
- Identité de l'éditeur (nom, adresse ou SIREN si association/société)
- Hébergeur (Vercel Inc.)
- Contact (email dédié)
- Directeur de publication
- Politique de confidentialité (même minimale sans tracking)
- Droit de réponse et procédure de rectification
- Sources des données utilisées
- Rappel : "Les informations publiées proviennent de sources publiques. La présomption d'innocence s'applique à toute personne mentionnée."

---

## 6. Roadmap

### Phase 1 : Fondations (Semaines 1-2)
- [ ] Setup projet Next.js + Prisma + DB
- [ ] Schéma de base de données
- [ ] Import initial des députés (API AN)
- [ ] Import initial des sénateurs (API Sénat)
- [ ] Pages de base (liste, fiche)
- [ ] Page mentions légales

### Phase 2 : Core Features (Semaines 3-4)
- [ ] Recherche et filtres
- [ ] Interface admin authentifiée
- [ ] CRUD affaires judiciaires
- [ ] Système de sources obligatoires
- [ ] Design UI polish

### Phase 3 : Enrichissement (Semaines 5-6)
- [ ] Import données HATVP
- [ ] Membres du gouvernement
- [ ] Page d'accueil avec stats
- [ ] SEO et meta tags
- [ ] Tests et corrections

### Phase 4 : Production (Semaines 7-8)
- [ ] Revue juridique
- [ ] Mentions légales complètes
- [ ] Déploiement Vercel
- [ ] Monitoring et analytics
- [ ] Documentation

---

## 7. Métriques de succès

### Lancement
- 100% des députés et sénateurs importés
- Au moins 50 affaires judiciaires documentées
- Temps de chargement < 2s
- Score Lighthouse > 90

### 6 mois
- X visiteurs uniques / mois (objectif à définir)
- Couverture médiatique
- 0 mise en demeure / procès

---

## 8. Décisions prises

1. ~~**Nom de domaine**~~ → À décider plus tard (repo GitHub : politic-tracker)
2. **Monétisation** → À décider plus tard, mentions légales prévues dès le début
3. **Contributions externes** → Phase 2, avec système de modération robuste
4. **Historique affaires** → Démarrage sur 5 dernières années (2020+), extensible sans limite

---

## 9. Complexité politique - Considérations

### 9.1 Institutions couvertes (par priorité)

| Institution | Effectif | Source données | Priorité | Statut |
|-------------|----------|----------------|----------|--------|
| Assemblée nationale | 577 députés | data.gouv.fr, API AN | P0 | FAIT |
| Sénat | 348 sénateurs | data.senat.fr | P1 | À FAIRE |
| Gouvernement | ~40 membres | Journal Officiel | P1 | À FAIRE |
| Parlement européen (FR) | 81 eurodéputés | europarl.europa.eu | P2 | - |
| Régions | 17 présidents | data.gouv.fr | P3 | - |
| Grandes villes | ~40 maires | data.gouv.fr | P3 | - |

### 9.2 Cycles politiques à gérer

| Cycle | Fréquence | Impact |
|-------|-----------|--------|
| **Législature AN** | 5 ans (sauf dissolution) | Renouvellement complet des députés |
| **Sénat** | 6 ans (1/2 tous les 3 ans) | Renouvellement partiel |
| **Gouvernement** | Variable | Remaniements fréquents |
| **Présidentielle** | 5 ans | Changement potentiel de majorité |
| **Municipales** | 6 ans | - |
| **Européennes** | 5 ans | - |

### 9.3 Cas particuliers à gérer

- **Candidats** : Personnes en campagne (pas encore élues) → Phase future
- **Suppléants** : Députés remplaçants (quand titulaire devient ministre)
- **Cumul des mandats** : Un élu peut avoir plusieurs mandats
- **Changements de groupe** : Députés qui changent de parti en cours de mandat
- **Démissions / Décès** : Mandats interrompus
- **Élections partielles** : Remplacement en cours de législature

### 9.4 Photos des élus

**Options envisagées :**

| Option | Avantages | Inconvénients |
|--------|-----------|---------------|
| **URL directe AN/Sénat** | Gratuit, toujours à jour | Dépendance externe, peut changer |
| **Supabase Storage** | Contrôle total, rapide | Coût stockage, mise à jour manuelle |
| **Wikidata/Wikipedia** | Gratuit, communautaire | Couverture incomplète |

**Décision** : À définir. Commencer par URL directe AN, prévoir migration.

### 9.5 Données à ajouter (Phase 2+)

- [ ] Champ `civility` (M./Mme) pour genre correct
- [ ] Champ `photoUrl` avec URL officielle AN/Sénat
- [ ] Import déclarations HATVP (scraping PDF)
- [ ] Import sénateurs (API Sénat)
- [ ] Import gouvernement (Journal Officiel)
- [ ] Historique des législatures

---

## Historique des modifications

| Date | Version | Changements |
|------|---------|-------------|
| 2025-01-18 | 0.1.0 | Création initiale du document |
| 2025-01-18 | 0.2.0 | Décisions : historique 5 ans, contributions Phase 2, mentions légales Phase 1 |
| 2026-01-18 | 0.3.0 | Section 9 : Complexité politique (institutions, cycles, photos, candidats) |
