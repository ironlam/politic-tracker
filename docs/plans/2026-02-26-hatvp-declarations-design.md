# Design : Enrichir l'affichage des déclarations HATVP (#145)

## Contexte

Les déclarations HATVP sont affichées comme de simples liens. Les XML open data (DIA — intérêts et activités) contiennent des données financières riches : participations financières, revenus, mandats, postes de direction. Mise à jour quotidienne par la HATVP.

Les champs `realEstate`, `securities`, `bankAccounts`, etc. existent déjà dans le schema Prisma mais ne sont jamais peuplés. Le CSV a un champ `open_data` avec le nom du fichier XML — jamais utilisé.

**Note** : Seuls les XML DIA (intérêts) sont accessibles individuellement. Les DSP (patrimoine) semblent être PDF-only pour l'instant.

## Architecture

### 1. Sync — Parser les XML DIA

**Source** : `https://www.hatvp.fr/livraison/dossiers/{open_data}` (colonne `open_data` du CSV).

**Parser** : `fast-xml-parser` (déjà en dépendance).

**Sections XML disponibles** :

| Section XML | Données | Champs clés |
|------------|---------|-------------|
| `participationFinanciereDto` | Actions, parts sociales | `nomSociete`, `evaluation`, `nombreParts`, `capitalDetenu`, `remuneration` |
| `activProfCinqDerniereDto` | Activités professionnelles | `description`, `employeur`, `remuneration.montant[]` (par année) |
| `mandatElectifDto` | Mandats + indemnités | `descriptionMandat`, `remuneration.montant[]`, `dateDebut/Fin` |
| `participationDirigeantDto` | Postes de direction | `nomSociete`, `activite`, `remuneration`, `dateDebut/Fin` |
| `activProfConjointDto` | Activité conjoint | `activiteProf`, `employeurConjoint` |
| `activCollaborateursDto` | Collaborateurs | `nom`, `employeur`, `descriptionActivite` |

**Logique** :
- Pendant `syncHATVP()`, si `open_data` non vide et type = DIA/DIM/DIAM, fetch le XML
- Parser avec `fast-xml-parser`
- Stocker le résultat structuré en JSON dans un nouveau champ
- Rate limit : 200ms entre requêtes (déjà en place)

### 2. Stockage — Modèle enrichi

Ajouter un champ `details` de type `Json?` au modèle `Declaration` existant :

```prisma
model Declaration {
  // ... champs existants ...
  details Json? // Structured data parsed from HATVP XML
}
```

Structure JSON typée côté TypeScript :

```typescript
interface DeclarationDetails {
  financialParticipations: Array<{
    company: string;
    evaluation: number | null; // en euros
    shares: number | null;
    capitalPercent: number | null;
    dividends: string | null;
    isBoardMember: boolean;
  }>;
  professionalActivities: Array<{
    description: string;
    employer: string;
    startDate: string | null;
    endDate: string | null;
    annualRevenues: Array<{ year: number; amount: number }>;
  }>;
  electoralMandates: Array<{
    mandate: string;
    startDate: string | null;
    endDate: string | null;
    annualRevenues: Array<{ year: number; amount: number }>;
  }>;
  directorships: Array<{
    company: string;
    role: string;
    startDate: string | null;
    endDate: string | null;
    annualRevenues: Array<{ year: number; amount: number }>;
  }>;
  spouseActivity: string | null;
  collaborators: Array<{ name: string; employer: string }>;
  // Computed summaries
  totalPortfolioValue: number | null;
  totalCompanies: number;
  latestAnnualIncome: number | null;
  totalDirectorships: number;
}
```

### 3. API — Enrichir la réponse

Route `GET /api/politiques/[slug]` : inclure `details` dans la réponse `declarations`.

```typescript
declarations: politician.declarations.map((d) => ({
  id: d.id,
  type: d.type,
  year: d.year,
  url: d.pdfUrl,
  hatvpUrl: d.hatvpUrl,
  details: d.details, // NEW: structured data from XML
})),
```

### 4. SEO — Métadonnées enrichies

- **Title** : `{Nom} — Déclarations d'intérêts | Poligraph`
- **Description** : Inclure les chiffres clés (portfolio, revenus) dans la meta description de la page politicien
- **Structured data** (JSON-LD) : `Person` schema avec `netWorth` si disponible, `memberOf` pour les sociétés
- **Open Graph** : Descriptions dynamiques incluant les données HATVP

### 5. Frontend — Design "Transparence Éditoriale"

**Repositionnement** : Du sidebar vers le contenu principal, après mandats, avant votes.

**Architecture visuelle** :

```
Card "Déclarations d'intérêts et d'activités"
├── Source badge (lien HATVP ↗) + date dernière déclaration
├── Metrics bar (grid 2×2 mobile / 4 cols desktop)
│   ├── Total portfolio (€)
│   ├── Nombre de sociétés
│   ├── Revenu annuel déclaré (€)
│   └── Nombre de mandats/postes
├── Participations financières (visible par défaut)
│   ├── HorizontalBars top 5 par valeur
│   └── <details> "Tout afficher" pour le reste
├── Revenus et activités (collapsible <details>)
│   └── Tableau compact année × montant par activité
├── Mandats et indemnités (collapsible <details>)
│   └── Liste avec indemnités par année
├── Postes de direction (collapsible <details>)
│   └── Société + rôle + dates
├── Conjoint & collaborateurs (collapsible <details>)
│   └── Info minimale
└── Toutes les déclarations (liens officiels)
    └── Badges cliquables : type + année → lien HATVP/PDF
```

**Composants** :
- `DeclarationCard` — Le bloc complet
- `DeclarationMetrics` — La barre de 4 chiffres clés
- Réutilisation : `HorizontalBars`, `Badge`, `Card` (shadcn)

**Principes** :
- Liens sources HATVP sur chaque section
- "Source: HATVP" visible en permanence
- Mention "Données issues de la déclaration officielle du [date]"
- Chiffres en `font-mono` pour lisibilité

### 6. Sources — Toujours visibles

- Lien vers la page HATVP du politicien en haut de la card
- Lien PDF direct pour chaque déclaration en bas
- Attribution "Haute Autorité pour la Transparence de la Vie Publique"
- Date de dernière mise à jour affichée

## Contraintes

- Rate limit HATVP : 200ms entre requêtes
- Certains champs sont `[Données non publiées]` — les ignorer proprement
- Les montants sont en texte libre (ex: "62 389") — parser avec regex
- Pas de DSP XML accessible — ne pas promettre les données patrimoine stricto sensu
- Licence Ouverte (Etalab) — réutilisation libre

## Acceptance criteria

- [ ] Parser les XML DIA pendant le sync HATVP
- [ ] Stocker les données structurées en JSON dans `Declaration.details`
- [ ] Afficher les 4 metrics clés sur la fiche politicien
- [ ] Afficher les participations financières avec barres horizontales
- [ ] Sections collapsibles pour revenus, mandats, direction
- [ ] Liens sources HATVP visibles sur chaque section
- [ ] SEO : meta description enrichie + JSON-LD Person
- [ ] API : inclure `details` dans GET /api/politiques/[slug]
- [ ] Tests : parser XML, composants frontend
