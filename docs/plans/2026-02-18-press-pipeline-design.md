# Amélioration du Pipeline Presse — Design

> **Pour Claude :** REQUIRED SUB-SKILL: Use superpowers:writing-plans pour créer le plan d'implémentation.

**Goal:** Passer de 8% à ~100% des articles analysés, avec une meilleure détection des affaires judiciaires et une protection renforcée contre les homonymes.

**Contexte :** Audit du système de découverte d'affaires (février 2026). Le pipeline presse actuel ingère ~240 articles/jour mais n'en analyse que 20 (8.3%). Le modèle Haiku manque parfois de précision sur les cas juridiques complexes et les homonymes.

---

## Architecture : Deux tiers d'analyse

```
RSS (13 sources, ~400 articles/jour)
    ↓
[Ingestion & stockage PressArticle]
    ↓
[Pré-filtre mots-clés judiciaires]
    ↓                    ↓
TIER 1 (Sonnet)      TIER 2 (Haiku)
~20 articles/jour    ~80 articles/jour
Haute précision      Large couverture
~$0.40/jour          ~$0.16/jour
    ↓                    ↓
[Matching affaires existantes]
    ↓
[Création/enrichissement affaires]
```

### Pourquoi deux tiers ?

Sonnet 4.5 est ~10x plus cher que Haiku. Avec un budget de ~$1/jour, Sonnet seul = ~50 articles. En combinant les deux modèles, on obtient **~100 articles/jour** avec la précision Sonnet sur les articles les plus sensibles juridiquement.

---

## 1. Pré-filtre par mots-clés judiciaires

### Mots-clés de priorisation (Tier 1)

Un article est classé Tier 1 si son titre OU sa description contient un des termes suivants :

**Procédure pénale :**
`mis en examen`, `mise en examen`, `condamné`, `condamnée`, `condamnation`, `renvoyé devant`, `poursuivi`, `poursuivie`, `garde à vue`, `perquisition`, `tribunal correctionnel`, `procès`, `relaxé`, `relaxée`, `acquitté`, `acquittée`, `jugé`, `jugée`, `inculpé`, `inculpée`, `écroué`, `écrouée`, `détention`, `mandat d'arrêt`, `contrôle judiciaire`

**Infractions :**
`détournement`, `corruption`, `fraude`, `abus de bien`, `prise illégale`, `favoritisme`, `harcèlement`, `agression sexuelle`, `viol`, `blanchiment`, `emploi fictif`, `conflit d'intérêts`, `trafic d'influence`

**Juridictions :**
`cour d'appel`, `cour de cassation`, `tribunal`, `parquet`, `PNF`, `procureur`

### Implémentation

- Matching insensible à la casse et aux accents
- Appliqué sur `title + description` (pas besoin de scraper pour le pré-filtre)
- Articles Tier 1 : analysés en premier avec Sonnet 4.5
- Articles Tier 2 : analysés ensuite avec Haiku 4.5 (même prompt, modèle différent)

---

## 2. Nouvelles sources RSS (6 ajouts)

### Presse régionale (5 sources)

| Source | Feed ID | Couverture géographique |
|--------|---------|------------------------|
| Ouest-France | `ouestfrance` | Bretagne, Normandie, Pays de la Loire |
| Sud-Ouest | `sudouest` | Nouvelle-Aquitaine |
| La Dépêche du Midi | `ladepeche` | Occitanie |
| La Voix du Nord | `lavoixdunord` | Hauts-de-France |
| DNA | `dna` | Grand Est (Alsace) |

### Agrégateur national (1 source)

| Source | Feed ID | Description |
|--------|---------|-------------|
| Google News FR | `googlenews` | Filtre `politique france justice` — capte AFP + sources non couvertes |

### URLs RSS à valider

Les URLs exactes des RSS devront être vérifiées au moment de l'implémentation (les quotidiens régionaux changent parfois leurs feeds). Priorité :
1. Feed `/politique` ou `/justice` dédié si disponible
2. Feed général sinon (le pré-filtre mots-clés fera le tri)

### Impact volume estimé

- Sources actuelles : ~240 articles/jour
- +5 régionaux : ~+100-150 articles/jour
- +Google News : ~+50 articles/jour
- **Total : ~400-440 articles/jour**

---

## 3. Upgrade modèle : Sonnet 4.5

### Changements dans le service d'analyse

- **Tier 1** : `claude-sonnet-4-5-20250929` (articles avec mots-clés judiciaires)
- **Tier 2** : `claude-haiku-4-5-20251001` (articles sans mots-clés, couverture large)
- Le prompt système reste identique, seul le modèle change

### Protection homonymes renforcée

Ajout au contexte de chaque analyse (Tier 1 uniquement, pour limiter les tokens) :

1. **Liste de politiciens connus** : noms + prénoms + parti + mandat actuel, injectés dans le prompt pour cross-référence
2. **Instruction explicite** : "Si le nom correspond mais que le contexte ne mentionne pas de fonction politique (député, sénateur, ministre, maire, etc.), retourner confidence_score < 30 et involvement: MENTIONED_ONLY"
3. **Cross-check département** (si disponible) : "Vérifier que la juridiction mentionnée correspond au département du politicien connu"

### Budget estimé

| Tier | Modèle | Input/article | Output/article | Coût/article | Articles/jour | Coût/jour |
|------|--------|--------------|----------------|-------------|--------------|-----------|
| Tier 1 | Sonnet 4.5 | ~4000 tok | ~500 tok | ~$0.02 | ~20 | ~$0.40 |
| Tier 2 | Haiku 4.5 | ~2500 tok | ~500 tok | ~$0.002 | ~80 | ~$0.16 |
| **Total** | | | | | **~100** | **~$0.56** |

Marge confortable sous le budget de $1/jour.

---

## 4. Augmentation du volume

### Changement de config

- `sync-daily.ts` : passer `--limit=20` à `--limit=100`
- Le pré-filtre s'applique AVANT le limit : les articles Tier 1 sont traités en premier
- Si plus de 100 articles en attente, seuls les 100 plus prioritaires sont analysés

### Ordre de priorité

1. Articles Tier 1 (mots-clés judiciaires) — modèle Sonnet
2. Articles Tier 2 avec mention de politicien connu — modèle Haiku
3. Articles Tier 2 restants — modèle Haiku
4. Articles déjà analysés (skip)

---

## 5. Fichiers impactés

| Fichier | Modification |
|---------|-------------|
| `src/lib/api/rss.ts` | Ajouter 6 nouvelles sources RSS |
| `src/services/press-analysis.ts` | Système de tiers (Sonnet/Haiku), pré-filtre mots-clés |
| `src/services/sync/press-analysis.ts` | Logique de priorisation, contexte politiciens pour Tier 1 |
| `src/config/rate-limits.ts` | Ajuster rate limits si nécessaire |
| `scripts/sync-daily.ts` | Passer `--limit=100` |
| `scripts/sync-press.ts` | Supporter les nouveaux feeds |

---

## Hors périmètre (noté pour plus tard)

Les sujets suivants ont été identifiés dans l'audit mais sont reportés :

1. **Couverture judiciaire élargie** — Intégrer Legifrance ou APIs de tribunaux correctionnels/cours d'appel (rate 70% des jugements actuellement). Effort élevé, APIs limitées.
2. **Cross-check département/juridiction Judilibre** — TODO existant dans le code pour réduire les homonymes Judilibre en croisant la juridiction mentionnée avec le département du politicien.
3. **Automatisation Wikidata** — Intégrer `wikidata-affairs.ts` dans le daily sync au lieu du trigger manuel.
4. **Downgrade de statut** — Si Judilibre trouve un acquittement/relaxe après une condamnation détectée par la presse, permettre le downgrade du statut de l'affaire.
5. **Bornage du score de confiance** — Clamper le `confidenceScore` entre 0 et 100 pour éviter les valeurs aberrantes du modèle.
6. **Sources spécialisées justice** — Dalloz Actualité, Gazette du Palais si besoin de couverture jurisprudentielle.
7. **AFP API officielle** — Abonnement payant pour accès direct aux dépêches AFP si Google News RSS s'avère insuffisant.

---

## Critères de succès

- [ ] 13 sources RSS fonctionnelles (8 existantes + 5 régionales + Google News)
- [ ] Pré-filtre mots-clés avec taux de détection > 90% sur les articles judiciaires
- [ ] Tier 1 (Sonnet) analyse les articles les plus sensibles
- [ ] Tier 2 (Haiku) couvre le reste
- [ ] ~100 articles/jour analysés (vs 20 actuellement)
- [ ] Budget < $1/jour
- [ ] Aucune régression sur les gardes-fous juridiques existants
- [ ] Protection homonymes améliorée (liste politiciens en contexte)
