# Auto-Modération des Affaires — Design

> **Date** : 2026-02-20
> **Statut** : Approuvé
> **Issue liée** : À créer
> **Dépendance** : #151 (VICTIM/PLAINTIFF involvement)

## Problème

302 affaires en DRAFT à modérer manuellement. Les affaires sont importées par Wikidata, Judilibre et le pipeline presse, souvent avec des données incomplètes, des titres préfixés "[À VÉRIFIER]", des descriptions parasites, des doublons par politicien, et des statuts/catégories parfois incorrects.

La modération manuelle est impossible à maintenir pour un projet solo.

## Solution : Auto-triage IA (Approche A — Script de sync)

Un script `sync-moderate-affairs.ts` (pattern SyncHandler) qui tourne toutes les heures via cron. L'IA analyse chaque affaire DRAFT et **propose** des décisions, mais **ne publie jamais automatiquement**. L'humain valide en bulk dans l'admin.

### Philosophie

- **Auto-triage, pas auto-publish** : zéro risque de publication automatique d'erreur
- **Catégories sensibles = toujours revue humaine** (AGRESSION_SEXUELLE, HARCELEMENT_SEXUEL, VIOLENCE)
- **En cas de doute → NEEDS_REVIEW** (garde-fou anti-diffamation)
- **Doublons CERTAIN/HIGH → auto-fusion** ; POSSIBLE → flag pour revue

## Architecture

```
Cron (1h) ou Admin UI (manuel)
  → POST /api/admin/syncs { script: "moderate-affairs" }
    → sync-moderate-affairs.ts
      1. Check feature flag "auto-moderate-affairs"
      2. Fetch DRAFT affairs (pas encore reviewées)
      3. Phase 1: Détection doublons (findPotentialDuplicates)
         → Auto-merge CERTAIN/HIGH (mergeAffairs existant)
         → Flag POSSIBLE dans ModerationReview
      4. Phase 2: Analyse IA par batch (Sonnet 4.5 + tool_use)
         → Pour chaque affaire : analyser sources, titre, description
         → Proposer corrections + recommandation
      5. Stocker ModerationReview en DB
      6. Log AuditLog + SyncJob stats

Admin UI "/admin/affaires" onglet "À modérer"
  → Badge recommandation IA (PUBLISH/REJECT/NEEDS_REVIEW)
  → Diff titre si correction proposée
  → Bouton "Appliquer les recommandations IA" (bulk)
  → Override individuel possible
```

## Modèle de données

### Nouvelle table : ModerationReview

```prisma
model ModerationReview {
  id       String @id @default(cuid())
  affair   Affair @relation(fields: [affairId], references: [id], onDelete: Cascade)
  affairId String

  // Recommandation
  recommendation  ModerationRecommendation
  confidence      Int                        // 0-100
  reasoning       String @db.Text

  // Corrections proposées
  suggestedTitle       String?
  suggestedDescription String? @db.Text
  suggestedStatus      AffairStatus?
  suggestedCategory    AffairCategory?

  // Problèmes détectés
  issues Json? // [{type: "MISSING_SOURCE", detail: "..."}]

  // Doublon détecté
  duplicateOfId String? // ID de l'affaire principale si doublon

  // Traçabilité
  model     String    // "claude-sonnet-4-5-20250929"
  appliedAt DateTime? // null tant que pas validé par humain
  appliedBy String?   // admin qui a validé

  createdAt DateTime @default(now())

  @@index([affairId])
  @@index([recommendation])
  @@index([createdAt])
}

enum ModerationRecommendation {
  PUBLISH
  REJECT
  NEEDS_REVIEW
}
```

### Relation sur Affair

```prisma
model Affair {
  // ... champs existants ...
  moderationReviews ModerationReview[]
}
```

## Modèle IA : Sonnet 4.5

- `claude-sonnet-4-5-20250929` (même que TIER_1 presse)
- Tool_use pour extraction structurée
- ~$0.50 pour le backlog de 302, ~$0.01/run ensuite

## Prompt système

Le prompt reprend les règles juridiques du pipeline presse :
- Présomption d'innocence stricte
- Catégories sensibles → toujours NEEDS_REVIEW
- En cas de doute → statut MOINS grave
- Ne jamais inventer d'informations

### Tool schema (retour IA)

```json
{
  "name": "moderate_affair",
  "input_schema": {
    "properties": {
      "recommendation": { "enum": ["PUBLISH", "REJECT", "NEEDS_REVIEW"] },
      "confidence": { "type": "integer", "minimum": 0, "maximum": 100 },
      "reasoning": { "type": "string" },
      "corrected_title": { "type": ["string", "null"] },
      "corrected_description": { "type": ["string", "null"] },
      "corrected_status": { "type": ["string", "null"], "enum": [...AffairStatus] },
      "corrected_category": { "type": ["string", "null"], "enum": [...AffairCategory] },
      "issues": {
        "type": "array",
        "items": { "enum": [
          "MISSING_SOURCE", "POOR_DESCRIPTION", "WRONG_STATUS",
          "WRONG_CATEGORY", "SENSITIVE_CATEGORY", "POSSIBLE_DUPLICATE",
          "INVALID_DATES", "NOT_A_REAL_AFFAIR", "HOMONYM_RISK"
        ]}
      }
    }
  }
}
```

## Règles de décision

| Cas | Recommandation | Notes |
|-----|---------------|-------|
| Sources valides, statut cohérent, catégorie non-sensible | PUBLISH (80+) | Titre nettoyé automatiquement |
| Catégorie AGRESSION_SEXUELLE, HARCELEMENT_SEXUEL, VIOLENCE | NEEDS_REVIEW | Toujours, même si tout semble correct |
| Description vide ou parasite | NEEDS_REVIEW + correction proposée | |
| Pas une vraie affaire judiciaire | REJECT (70+) | |
| Doublon CERTAIN/HIGH | Auto-fusion via mergeAffairs() | Pas de ModerationReview, action directe |
| Doublon POSSIBLE | NEEDS_REVIEW + duplicateOfId | |
| Doute sur statut juridique | NEEDS_REVIEW + suggestion | |
| Involvement VICTIM/PLAINTIFF (#151) | Moins de risque diffamation, seuils plus souples | |

## Actions du modérateur sur le titre

1. Retirer le préfixe "[À VÉRIFIER]" systématiquement
2. Corriger les titres tronqués ou malformés
3. Supprimer les descriptions parasites ("le titre est tronqué...", etc.)
4. Vérifier la cohérence dates des sources

## Contrôle et sécurité

- **Feature flag** `auto-moderate-affairs` → désactivable instantanément
- **Dry run** : `--dry-run` pour tester sans écrire
- **Rate limit** : 500ms entre appels IA
- **Audit log** : chaque action tracée
- **Rollback** : ModerationReview conserve l'historique
- **Anti-diffamation** : catégories sensibles = toujours NEEDS_REVIEW

## Admin UI

L'onglet "À modérer" existant est enrichi :
- Badge IA coloré (vert/rouge/orange) avec confiance
- Diff titre si correction proposée
- Reasoning IA expandable
- Bulk actions : "Appliquer PUBLISH", "Appliquer REJECT"
- NEEDS_REVIEW → revue individuelle obligatoire

## Hors scope (futur)

- Redis/queue pour l'infra de sync globale
- Auto-publish (même avec garde-fous)
- Enrichissement automatique des sources manquantes
- Scraping des URLs sources pour vérification

## Dépendances

- #151 : VICTIM/PLAINTIFF involvement — le prompt doit connaître ces valeurs
- Feature flags système (déjà en place)
- SyncJob infrastructure (déjà en place)
