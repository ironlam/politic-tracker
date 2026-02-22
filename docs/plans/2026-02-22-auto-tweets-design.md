# Auto-tweets — Design

**Date** : 22 février 2026
**Objectif** : Script qui interroge la DB Prisma, extrait des stats intéressantes et génère des brouillons de tweets prêts à poster dans un fichier Markdown.

---

## Architecture

Un seul script `scripts/generate-tweets.ts` avec 7 générateurs modulaires (fonctions internes). Chaque exécution produit un fichier `tweets/YYYY-MM-DD.md` contenant 7-10 brouillons.

**Commande** : `npm run tweets`

---

## Générateurs

### 1. Votes clivants (`divisiveVotes`)

Requête : Scrutins récents (30j) avec résultat serré ou division intra-parti.

```
Scrutin sur [titre] : adopté de justesse (52% pour).
Le groupe RN a voté contre à 94%, Renaissance divisé (67% pour).
Détails → poligraph.fr/votes/[slug]
```

### 2. Stats parti (`partyStats`)

Requête : Taux de participation, cohésion par parti à l'Assemblée.

```
Taux de participation aux scrutins (Assemblée) :
- Renaissance : 85%
- LFI : 78%
- RN : 71%
Qui vote le plus ? → poligraph.fr/statistiques
```

### 3. Affaires récentes (`recentAffairs`)

Requête : Affaires PUBLISHED ajoutées ou changement de statut (7 derniers jours), involvement DIRECT uniquement.

```
Nouvelle affaire documentée : [titre]
Statut : mise en examen | Catégorie : abus de confiance
Fiche complète → poligraph.fr/affaires/[slug]
```

### 4. Fact-checks (`factchecks`)

Requête : Fact-checks ajoutés dans la semaine, regroupés par verdict.

```
Cette semaine, 12 déclarations vérifiées :
✅ 3 vraies — ⚠️ 5 trompeuses — ❌ 4 fausses
Qui dit vrai ? → poligraph.fr/factchecks
```

### 5. Député du jour (`deputySpotlight`)

Requête : Député aléatoire avec prominence > seuil et activité récente.

```
Saviez-vous que [nom], député(e) de [circo], a participé à 92% des scrutins ?
Fiche complète → poligraph.fr/politiques/[slug]
```

### 6. Élections (`elections`)

Requête : Élections récentes ou à venir dans la DB.

```
Le saviez-vous ? Le maire est élu pour 6 ans au suffrage universel direct.
Suivez les élections → poligraph.fr/elections
```

### 7. Presse récente (`recentPress`)

Requête : Articles de presse analysés (48h), liés à des politiciens de la DB.

```
Dans la presse sur [nom] :
- "Titre" (Le Monde)
- "Titre" (Mediapart)
Sa fiche → poligraph.fr/politiques/[slug]
```

---

## Format de sortie

Fichier `tweets/YYYY-MM-DD.md` :

```markdown
# Brouillons tweets — [date]

## 🗳️ Votes clivants

### Tweet 1
[contenu du tweet]
👉 poligraph.fr/votes/[slug]

**Caractères** : 237/280

---

## ⚖️ Affaires récentes
...
```

Chaque tweet affiche le compteur de caractères (limite Twitter = 280).

---

## Contraintes de sécurité

- Seules les affaires `publicationStatus: PUBLISHED` avec `involvement: DIRECT`
- Présomption d'innocence rappelée pour les statuts non définitifs (enquête, mise en examen)
- Neutralité : données factuelles uniquement, pas d'adjectifs qualificatifs
- Fact-checks : citer la source (AFP Factuel, Les Décodeurs...) et le verdict exact

---

## Structure fichiers

```
scripts/generate-tweets.ts     # Script principal (7 générateurs)
tweets/                         # Dossier de sortie (gitignored)
  └── 2026-02-22.md             # Brouillons du jour
```

Ajout dans `package.json` :

```json
"tweets": "npx dotenv -e .env -- npx tsx scripts/generate-tweets.ts"
```

Ajout de `tweets/` dans `.gitignore`.
