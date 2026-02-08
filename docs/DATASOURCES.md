# Sources de données

> **Dernière mise à jour**: 2026-01-24

Ce document décrit les sources de données utilisées par Transparence Politique, leur format, leur fréquence de mise à jour et les scripts associés.

---

## 1. Vue d'ensemble

| Source              | Type             | Données              | Script                             | Fréquence    |
| ------------------- | ---------------- | -------------------- | ---------------------------------- | ------------ |
| Assemblée Nationale | API JSON         | Députés              | `sync:assemblee`                   | Hebdomadaire |
| Sénat               | API JSON         | Sénateurs            | `sync:senat`                       | Hebdomadaire |
| Gouvernement        | CSV data.gouv.fr | Ministres            | `sync:gouvernement`                | Remaniement  |
| HATVP               | CSV opendata     | Déclarations         | `sync:hatvp`                       | Mensuelle    |
| Wikidata            | SPARQL           | Condamnations, décès | `import:wikidata`, `sync:deceased` | Hebdomadaire |

---

## 2. Assemblée Nationale

### 2.1 Source

- **URL** : https://data.assemblee-nationale.fr
- **Format** : JSON (API REST)
- **Licence** : Licence Ouverte / Open Licence (Etalab)

### 2.2 Données récupérées

- Identité : nom, prénom, civilité, date de naissance
- Mandat : circonscription, date début, groupe politique
- Contact : email officiel
- Photo : URL officielle AN

### 2.3 Script

```bash
npm run sync:assemblee
```

### 2.4 Mapping des groupes politiques

| Code AN | Parti                       |
| ------- | --------------------------- |
| RN      | Rassemblement National      |
| LFI-NFP | La France Insoumise         |
| EPR     | Ensemble pour la République |
| SOC     | Parti Socialiste            |
| DR      | Droite Républicaine         |
| ...     | ...                         |

---

## 3. Sénat

### 3.1 Source

- **URL principale** : https://www.senat.fr/api-senat/senateurs.json
- **URL enrichissement** : https://archive.nossenateurs.fr/senateurs/json
- **Format** : JSON
- **Licence** : Licence Ouverte (données officielles), CC-BY-SA (NosSénateurs)

### 3.2 Données récupérées

- Identité : matricule, nom, prénom, civilité
- Mandat : groupe politique, circonscription
- Photo : URL officielle Sénat

### 3.3 Script

```bash
npm run sync:senat
```

---

## 4. Gouvernement

### 4.1 Source

- **URL** : https://static.data.gouv.fr/resources/historique-des-gouvernements/
- **Format** : CSV (séparateur point-virgule)
- **Licence** : Licence Ouverte (Etalab)

### 4.2 Données récupérées

- Identité : nom, prénom
- Fonction : titre ministériel
- Dates : début et fin de fonction
- Gouvernement : nom du gouvernement

### 4.3 Script

```bash
npm run sync:gouvernement           # Gouvernement actuel uniquement
npm run sync:gouvernement --all     # Historique complet
```

### 4.4 Mapping des fonctions

| Fonction CSV               | Type mandat          |
| -------------------------- | -------------------- |
| Président de la République | PRESIDENT_REPUBLIQUE |
| Premier ministre           | PREMIER_MINISTRE     |
| Ministre                   | MINISTRE             |
| Ministre délégué           | MINISTRE_DELEGUE     |
| Secrétaire d'État          | SECRETAIRE_ETAT      |

---

## 5. HATVP (Haute Autorité pour la Transparence)

### 5.1 Source

- **URL** : https://www.hatvp.fr/livraison/opendata/liste.csv
- **Photos** : https://www.hatvp.fr/livraison/photos_gouvernement/{nom}-{prenom}.jpg
- **Format** : CSV (séparateur point-virgule, encodage UTF-8)
- **Licence** : Licence Ouverte (Etalab)

### 5.2 Données récupérées

- Identité : civilité, prénom, nom
- Mandat : type (député, sénateur, gouvernement...)
- Déclarations : type (intérêts, patrimoine), date, PDF
- Photo : URL si disponible (colonne `url_photo`)

### 5.3 Types de déclarations

| Code  | Type                                    |
| ----- | --------------------------------------- |
| di    | Déclaration d'intérêts                  |
| dim   | Déclaration d'intérêts modificative     |
| dsp   | Déclaration de situation patrimoniale   |
| dspm  | Déclaration de patrimoine modificative  |
| dspfm | Déclaration de patrimoine fin de mandat |

### 5.4 Script

```bash
npm run sync:hatvp
```

### 5.5 Matching

1. Par `id_origine` → ID Assemblée Nationale (`PA*`) ou Sénat
2. Par nom/prénom (fallback)

---

## 6. Wikidata

### 6.1 Source

- **Endpoint** : https://query.wikidata.org/sparql
- **Format** : SPARQL → JSON
- **Licence** : CC0 (domaine public)

### 6.2 Requêtes utilisées

#### Condamnations de politiciens français

```sparql
SELECT ?person ?personLabel ?crimeLabel ?convictionDate WHERE {
  ?person wdt:P27 wd:Q142 .        # Nationalité française
  ?person wdt:P106 wd:Q82955 .     # Profession: politicien
  ?person p:P1399 ?conviction .    # A une condamnation
  ?conviction ps:P1399 ?crime .
  OPTIONAL { ?conviction pq:P585 ?convictionDate }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "fr,en" }
}
```

#### Dates de décès

```sparql
SELECT ?person ?deathDate WHERE {
  VALUES ?person { wd:Q123 wd:Q456 ... }
  ?person wdt:P570 ?deathDate .
}
```

### 6.3 Scripts

```bash
npm run import:wikidata    # Import condamnations
npm run sync:deceased      # Sync dates de décès
```

### 6.4 Filtres appliqués

- Nationalité française obligatoire (P27 = Q142)
- Décédé après 1958 (Ve République)
- Condamnation après 1958
- Exclusion des ID Wikidata non résolus

---

## 7. Photos

### 7.1 Sources par priorité

| Priorité | Source              | Pattern URL                                                               |
| -------- | ------------------- | ------------------------------------------------------------------------- |
| 1        | Assemblée Nationale | `https://www.assemblee-nationale.fr/dyn/static/tribun/17/photos/{id}.jpg` |
| 1        | Sénat               | `https://www.senat.fr/senimg/{matricule}.jpg`                             |
| 2        | HATVP               | `https://www.hatvp.fr/livraison/photos_gouvernement/{nom}-{prenom}.jpg`   |
| 3        | NosDéputés          | `https://www.nosdeputes.fr/depute/photo/{slug}/120`                       |
| 3        | NosSénateurs        | `https://archive.nossenateurs.fr/senateur/photo/{slug}/120`               |
| 4        | Wikidata            | URL image P18                                                             |

### 7.2 Script

```bash
npm run sync:photos              # Photos manquantes
npm run sync:photos --validate   # Valider + sync
```

---

## 8. Embeddings RAG (Chatbot IA)

### 8.1 Vue d'ensemble

Le chatbot utilise des embeddings vectoriels pour la recherche sémantique. Les embeddings sont générés par **Voyage AI** (gratuit, 200M tokens/mois).

| Type       | Contenu indexé                | Quantité |
| ---------- | ----------------------------- | -------- |
| POLITICIAN | Nom, parti, mandats, affaires | ~1000    |
| PARTY      | Nom, idéologie, membres       | ~150     |
| AFFAIR     | Titre, description, sources   | ~90      |
| DOSSIER    | Titre, résumé, statut         | ~1700    |
| SCRUTIN    | Titre, date, résultat         | ~5000    |

### 8.2 Commandes

```bash
# Voir les stats actuelles
npm run index:embeddings:stats

# Indexer un type spécifique
npm run index:embeddings -- --type=POLITICIAN
npm run index:embeddings -- --type=PARTY
npm run index:embeddings -- --type=AFFAIR
npm run index:embeddings -- --type=DOSSIER
npm run index:embeddings -- --type=SCRUTIN

# Indexer tout (long ~30min)
npm run index:embeddings

# Limiter le nombre (pour tests)
npm run index:embeddings -- --type=POLITICIAN --limit=100
```

### 8.3 Quand ré-indexer ?

| Événement                | Action                                  |
| ------------------------ | --------------------------------------- |
| Après `sync:assemblee`   | `index:embeddings -- --type=POLITICIAN` |
| Après `sync:senat`       | `index:embeddings -- --type=POLITICIAN` |
| Après `sync:parties`     | `index:embeddings -- --type=PARTY`      |
| Après ajout d'affaires   | `index:embeddings -- --type=AFFAIR`     |
| Après `sync:legislation` | `index:embeddings -- --type=DOSSIER`    |
| Après `sync:votes`       | `index:embeddings -- --type=SCRUTIN`    |

### 8.4 Automatisation recommandée

Ajouter après chaque sync dans le cron GitHub Actions :

```yaml
# .github/workflows/sync-data.yml
- name: Re-index embeddings
  run: |
    npm run index:embeddings -- --type=POLITICIAN
    npm run index:embeddings -- --type=PARTY
  env:
    VOYAGE_API_KEY: ${{ secrets.VOYAGE_API_KEY }}
```

### 8.5 Configuration requise

```env
VOYAGE_API_KEY=pa-xxxxxxxx  # Obtenir sur https://dash.voyageai.com
```

### 8.6 Modèle utilisé

- **Modèle** : `voyage-3-lite` (512 dimensions, optimisé latence)
- **Alternative** : `voyage-3` (1024 dims) ou `voyage-3-large` (meilleure qualité)

Pour changer de modèle, modifier `src/services/embeddings.ts`.

---

## 9. Crédits et remerciements

Les données utilisées proviennent de sources officielles et de projets citoyens :

- **Assemblée Nationale** : https://data.assemblee-nationale.fr
- **Sénat** : https://www.senat.fr
- **HATVP** : https://www.hatvp.fr/open-data/
- **data.gouv.fr** : https://www.data.gouv.fr
- **Wikidata** : https://www.wikidata.org
- **Regards Citoyens** : https://www.regardscitoyens.org (NosDéputés, NosSénateurs)

Merci à ces organisations pour leur engagement en faveur de l'Open Data et de la transparence démocratique.
