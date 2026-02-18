# Sources de données

> **Derniere mise a jour** : 2026-02-18

Ce document decrit les sources de donnees utilisees par Poligraph, leur format, les rate limits a respecter, les prerequis pour chaque script et l'ordre d'execution recommande.

---

## Table des matieres

- [Vue d'ensemble](#1-vue-densemble)
- [Assemblee nationale](#2-assemblee-nationale)
- [Senat](#3-senat)
- [Gouvernement](#4-gouvernement)
- [President de la Republique](#5-president-de-la-republique)
- [Parlement europeen](#6-parlement-europeen)
- [HATVP](#7-hatvp)
- [Wikidata](#8-wikidata)
- [Votes Assemblee nationale](#9-votes-assemblee-nationale)
- [Votes Senat](#10-votes-senat)
- [Dossiers legislatifs](#11-dossiers-legislatifs)
- [Presse (RSS)](#12-presse-rss)
- [Google Fact Check](#13-google-fact-check)
- [RNE (Repertoire National des Elus)](#14-rne-repertoire-national-des-elus)
- [Judilibre (Cour de cassation)](#15-judilibre-cour-de-cassation)
- [Candidatures municipales](#16-candidatures-municipales)
- [Photos](#17-photos)
- [Analyse presse (IA)](#18-analyse-presse-ia)
- [Enrichissement IA](#19-enrichissement-ia)
- [Ordre d'execution](#20-ordre-dexecution)
- [Variables d'environnement](#21-variables-denvironnement)
- [Rate limits](#22-rate-limits)
- [Troubleshooting](#23-troubleshooting)
- [Credits](#24-credits)

---

## 1. Vue d'ensemble

| #   | Source               | Type d'acces     | Auth      | Donnees principales         | Script                       | Frequence    |
| --- | -------------------- | ---------------- | --------- | --------------------------- | ---------------------------- | ------------ |
| 2   | Assemblee nationale  | CSV (data.gouv)  | Aucune    | Deputes, groupes            | `sync:assemblee`             | Hebdomadaire |
| 3   | Senat                | API JSON         | Aucune    | Senateurs, groupes          | `sync:senat`                 | Hebdomadaire |
| 4   | Gouvernement         | CSV (data.gouv)  | Aucune    | Ministres, fonctions        | `sync:gouvernement`          | Remaniement  |
| 5   | President            | Statique         | Aucune    | President en exercice       | `sync:president`             | Manuelle     |
| 6   | Parlement europeen   | API JSON-LD      | Aucune    | Eurodeputes francais        | `sync:europarl`              | Hebdomadaire |
| 7   | HATVP                | CSV opendata     | Aucune    | Declarations patrimoine     | `sync:hatvp`                 | Mensuelle    |
| 8   | Wikidata             | REST + SPARQL    | Aucune    | IDs, condamnations, deces   | `sync:wikidata-ids`          | Hebdomadaire |
| 9   | Votes AN             | ZIP JSON         | Aucune    | Scrutins, votes individuels | `sync:votes-an`              | Quotidienne  |
| 10  | Votes Senat          | HTML + JSON      | Aucune    | Scrutins, votes individuels | `sync:votes-senat`           | Quotidienne  |
| 11  | Dossiers legislatifs | ZIP JSON         | Aucune    | Projets/propositions de loi | `sync:legislation`           | Quotidienne  |
| 12  | Presse (RSS)         | RSS/XML          | Aucune    | Articles, mentions          | `sync:press`                 | Quotidienne  |
| 13  | Google Fact Check    | API REST         | API key   | Fact-checks, verdicts       | `sync:factchecks`            | Quotidienne  |
| 14  | RNE                  | CSV (data.gouv)  | Aucune    | Maires                      | `sync:rne:maires`            | Ponctuelle   |
| 15  | Judilibre            | API REST (PISTE) | OAuth 2.0 | Decisions justice           | `sync:judilibre`             | Quotidienne  |
| 16  | Candidatures         | CSV (data.gouv)  | Aucune    | Candidats municipales       | `sync:elections:municipales` | Ponctuelle   |
| 17  | Photos               | HTTP HEAD        | Aucune    | Photos politiciens          | `sync:photos`                | Hebdomadaire |
| 18  | Analyse presse       | IA (Claude)      | API key   | Detection affaires          | `sync:press-analysis`        | Quotidienne  |

---

## 2. Assemblee nationale

- **URL de base** : `https://www.data.gouv.fr/api/1/datasets/deputes-actifs-de-lassemblee-nationale-informations-et-statistiques/`
- **Type d'acces** : API REST (decouverte URL) + telechargement CSV bulk
- **Authentification** : Aucune (donnees ouvertes)
- **Rate limit** : 200 ms (`DATA_GOUV_RATE_LIMIT_MS`) — politesse
- **Licence** : Licence Ouverte / Open Licence (Etalab)

### Donnees importees

- Politiciens : nom, prenom, civilite, date/lieu de naissance
- Mandats : type `DEPUTE`, circonscription, code departement, date de debut
- Groupes parlementaires : mappes vers les partis reels via `src/config/parties.ts`
- IDs externes : `ASSEMBLEE_NATIONALE` (PA...) + `NOSDEPUTES` (slug)
- Photos : depuis NosDéputes (`https://www.nosdeputes.fr/depute/photo/{slug}/120`)

### Script

```bash
npm run sync:assemblee          # Sync complete
npm run sync:assemblee --stats  # Statistiques uniquement
npm run sync:assemblee --dry-run
```

### Fonctionnement

Le script interroge l'API data.gouv.fr pour obtenir l'URL du dernier CSV, puis le telecharge et parse les deputes actifs. Les groupes parlementaires sont mappes vers les partis politiques reels via la configuration `ASSEMBLY_GROUPS` dans `src/config/parties.ts`.

---

## 3. Senat

- **URL de base** : `https://www.senat.fr/api-senat/senateurs.json`
- **URL enrichissement** : `https://archive.nossenateurs.fr/senateurs/json`
- **Type d'acces** : API REST JSON (2 endpoints publics)
- **Authentification** : Aucune
- **Rate limit** : 200 ms (`SENAT_RATE_LIMIT_MS`) — politesse
- **Licence** : Licence Ouverte (Senat) / CC-BY-SA (NosSenateurs)

### Donnees importees

- Politiciens : matricule, nom, prenom, civilite, date de naissance (via NosSenateurs)
- Mandats : type `SENATEUR`, circonscription, code departement
- Groupes parlementaires : mappes vers les partis reels
- IDs externes : `SENAT` (matricule) + `NOSDEPUTES` (slug NosSenateurs)
- Photos : `https://www.senat.fr/senimg/{matricule}.jpg`
- Fermeture automatique des mandats des senateurs absents de l'API

### Script

```bash
npm run sync:senat          # Sync complete
npm run sync:senat --stats  # Statistiques
npm run sync:senat --dry-run
```

---

## 4. Gouvernement

- **URL de base** : `https://static.data.gouv.fr/resources/historique-des-gouvernements-de-la-veme-republique/`
- **Type d'acces** : Telechargement CSV (separateur point-virgule)
- **Authentification** : Aucune
- **Rate limit** : 200 ms (`DATA_GOUV_RATE_LIMIT_MS`)
- **Licence** : Licence Ouverte (Etalab)

### Donnees importees

- Politiciens : nom, prenom
- Mandats : `PREMIER_MINISTRE`, `MINISTRE`, `MINISTRE_DELEGUE`, `SECRETAIRE_ETAT`
- Dates de debut/fin, gouvernement associe
- Corrections manuelles depuis `data/government-corrections.json`

### Mapping des fonctions

| Fonction CSV               | Type mandat            |
| -------------------------- | ---------------------- |
| President de la Republique | `PRESIDENT_REPUBLIQUE` |
| Premier ministre           | `PREMIER_MINISTRE`     |
| Ministre                   | `MINISTRE`             |
| Ministre delegue           | `MINISTRE_DELEGUE`     |
| Secretaire d'Etat          | `SECRETAIRE_ETAT`      |

### Script

```bash
npm run sync:gouvernement           # Gouvernement actuel
npm run sync:gouvernement -- --all  # Historique complet (Ve Republique)
npm run sync:gouvernement --stats
```

---

## 5. President de la Republique

- **URL de base** : `https://www.elysee.fr` (reference uniquement)
- **Type d'acces** : Donnees statiques dans le code (pas de requete HTTP)
- **Authentification** : Aucune
- **Rate limit** : N/A

### Donnees importees

- Emmanuel Macron (Q3052772) : identite, date/lieu de naissance, photo officielle
- Mandat `PRESIDENT_REPUBLIQUE` depuis le 2017-05-14
- Parti : Renaissance (RE)

### Script

```bash
npm run sync:president
```

> Ce script est specifique au president en exercice. Pour les presidents historiques, ils sont importes via `sync:gouvernement --all`.

---

## 6. Parlement europeen

- **URL de base** : `https://data.europarl.europa.eu/api/v2/meps/show-current`
- **Type d'acces** : API REST JSON-LD
- **Authentification** : Aucune
- **Rate limit** : 200 ms (`EUROPARL_RATE_LIMIT_MS`)
- **Licence** : Open Data

### Donnees importees

- Eurodeputes francais uniquement (filtre sur `country-of-representation = "FR"`)
- Politiciens : nom, prenom, date de naissance
- Mandats : type `DEPUTE_EUROPEEN`, legislature 10 (2024-2029)
- Groupes europeens : mappes depuis `src/config/parties.ts` (`EUROPEAN_GROUPS`)
- IDs externes : `PARLEMENT_EUROPEEN` (europarlId)
- Photos : `https://www.europarl.europa.eu/mepphoto/{id}.jpg`

### Script

```bash
npm run sync:europarl          # Sync deputes europeens FR
npm run sync:europarl --stats
npm run sync:mep-parties       # Sync partis nationaux des eurodeputes
```

---

## 7. HATVP

- **URL de base** : `https://www.hatvp.fr/livraison/opendata/liste.csv`
- **Type d'acces** : Telechargement CSV (separateur point-virgule, UTF-8)
- **Authentification** : Aucune
- **Rate limit** : 200 ms (`HATVP_RATE_LIMIT_MS`)
- **Licence** : Licence Ouverte (Etalab)

### Donnees importees

- Declarations : interets, patrimoine debut/fin/modification de mandat
- PDF officiels : `https://www.hatvp.fr/livraison/dossiers/{nom_fichier}`
- Photos : `https://www.hatvp.fr/livraison/photos_gouvernement/{nom}-{prenom}.jpg`
- Matching : par ID externe (AN `PA*` ou Senat matricule), puis par nom

### Types de declarations

| Code  | Type                                    |
| ----- | --------------------------------------- |
| di    | Declaration d'interets                  |
| dim   | Declaration d'interets modificative     |
| dsp   | Declaration de situation patrimoniale   |
| dspm  | Declaration de patrimoine modificative  |
| dspfm | Declaration de patrimoine fin de mandat |

### Script

```bash
npm run sync:hatvp
```

---

## 8. Wikidata

Wikidata est utilise comme source d'enrichissement a travers plusieurs scripts.

### 8.1 Matching des IDs (`sync:wikidata-ids`)

- **URL** : `https://www.wikidata.org/w/api.php` (action `wbsearchentities` + `wbgetclaims`)
- **Type d'acces** : API REST MediaWiki
- **Auth** : Aucune
- **Rate limit** : 200 ms (`WIKIDATA_RATE_LIMIT_MS`)
- **Donnees** : Associe un Q-ID Wikidata a chaque politicien (match par nom + date de naissance +-5 jours)
- **Script** : `npm run sync:wikidata-ids` (supporte `--resume` pour reprendre)

### 8.2 Condamnations (`import:wikidata`)

- **URL** : `https://query.wikidata.org/sparql`
- **Type d'acces** : SPARQL
- **Auth** : Aucune
- **Rate limit** : 300 ms (`WIKIDATA_SPARQL_RATE_LIMIT_MS`)
- **Donnees** : Propriete P1399 (condamnations) des politiciens francais
- **Filtres** : Ve Republique (1958+), nationalite francaise, deces apres 1958
- **Script** : `npm run import:wikidata`

### 8.3 Dates de deces (`sync:deceased`)

- **URL** : `https://www.wikidata.org/w/api.php` (action `wbgetclaims`, propriete P570)
- **Rate limit** : 200 ms
- **Donnees** : Date de deces des politiciens avec un Q-ID
- **Script** : `npm run sync:deceased`

### 8.4 Carrieres (`sync:careers`)

- **URL** : `https://query.wikidata.org/sparql`
- **Donnees** : Proprietes P39 (position occupee), P488 (dirigeant de parti), P112 (fondateur)
- **Script** : `npm run sync:careers` (long ~10-20 min)

### 8.5 Partis (`sync:parties`)

- **URL** : `https://www.wikidata.org/w/api.php`
- **Donnees** : Noms, abreviations, couleurs, logos, ideologies des partis
- **Configuration** : Q-IDs des partis dans `src/config/wikidata.ts`
- **Script** : `npm run sync:parties`

### 8.6 Dates de naissance (`sync:birthdates`)

- **URL** : `https://www.wikidata.org/w/api.php` (propriete P569)
- **Donnees** : Dates de naissance manquantes
- **Script** : `npm run sync:birthdates`

### Licence

CC0 (domaine public)

---

## 9. Votes Assemblee nationale

- **URL de base** : `https://data.assemblee-nationale.fr/static/openData/repository/{leg}/loi/scrutins/Scrutins.json.zip`
- **Type d'acces** : Telechargement ZIP (fichiers JSON individuels par scrutin)
- **Authentification** : Aucune
- **Rate limit** : N/A (telechargement unique)
- **Licence** : Licence Ouverte

### Donnees importees

- Scrutins : titre, date, resultat (adopte/rejete), decompte pour/contre/abstention
- Votes individuels par depute (POUR, CONTRE, ABSTENTION, NON_VOTANT)
- Matching des deputes via ID externe `ASSEMBLEE_NATIONALE` (acteurRef `PA*`)
- Incremental : utilise ETag + hash du contenu pour eviter les re-telechargements

### Script

```bash
npm run sync:votes-an          # Tous les scrutins (legislature 17)
npm run sync:votes-an:today    # Scrutins du jour uniquement
npm run sync:votes-an --stats
```

---

## 10. Votes Senat

- **URL de base** : `https://www.senat.fr/scrutin-public/`
- **Type d'acces** : Scraping HTML (liste + metadonnees) + API JSON (votes individuels)
- **Authentification** : Aucune
- **Rate limit** : 200 ms (`SENAT_RATE_LIMIT_MS`)

### Endpoints

| Endpoint                                                                        | Usage                    |
| ------------------------------------------------------------------------------- | ------------------------ |
| `https://www.senat.fr/scrutin-public/scr{session}.html`                         | Page index d'une session |
| `https://www.senat.fr/{session}/scr{session}-{number}.html`                     | Page HTML d'un scrutin   |
| `https://www.senat.fr/scrutin-public/{session}/json/scr{session}-{number}.json` | Votes JSON individuels   |

### Donnees importees

- Scrutins : titre, date, resultat, decompte
- Votes individuels par senateur (match via matricule)
- Sessions disponibles : 2006-2024
- Incremental : curseur pour eviter les re-syncs

### Script

```bash
npm run sync:votes-senat          # Derniere session
npm run sync:votes-senat:today    # Scrutins du jour
npm run sync:votes-senat:all      # Toutes les sessions (2006-2024)
npm run sync:votes-senat --stats
```

---

## 11. Dossiers legislatifs

- **URL de base** : `https://data.assemblee-nationale.fr/static/openData/repository/{leg}/loi/dossiers_legislatifs/Dossiers_Legislatifs.json.zip`
- **Type d'acces** : Telechargement ZIP (JSON)
- **Authentification** : Aucune
- **Rate limit** : N/A (telechargement unique)
- **Licence** : Licence Ouverte

### Donnees importees

- Dossiers legislatifs : titre, numero PJL/PPL, statut, categorie, dates
- Statut derive des actes parlementaires : DEPOSE, EN_COMMISSION, EN_COURS, ADOPTE, REJETE, RETIRE, CADUQUE

### Exposes des motifs

Un second script telecharge les documents `.docx` depuis `docparl.assemblee-nationale.fr` et en extrait la section "expose des motifs" :

- **URL** : `https://docparl.assemblee-nationale.fr/base/{id}?format=application/vnd.openxmlformats-officedocument.wordprocessingml.document`
- **Rate limit** : 300 ms (`ASSEMBLEE_DOCPARL_RATE_LIMIT_MS`)

### Script

```bash
npm run sync:legislation              # Tous les dossiers
npm run sync:legislation:today        # Dossiers actifs recemment modifies
npm run sync:legislation:content      # Telecharger les exposes des motifs
npm run sync:legislation:content -- --limit=20
```

---

## 12. Presse (RSS)

- **Type d'acces** : Flux RSS/XML parses avec `fast-xml-parser`
- **Authentification** : Aucune (les articles peuvent etre paywalled mais les en-tetes RSS sont publics)
- **Rate limit** : 1000 ms (`RSS_RATE_LIMIT_MS`)

### Sources configurees

| ID            | Nom                     | URL du flux                                                               |
| ------------- | ----------------------- | ------------------------------------------------------------------------- |
| `lemonde`     | Le Monde Politique      | `https://www.lemonde.fr/politique/rss_full.xml`                           |
| `lefigaro`    | Le Figaro Politique     | `https://www.lefigaro.fr/rss/figaro_politique.xml`                        |
| `franceinfo`  | Franceinfo Politique    | `https://www.francetvinfo.fr/politique.rss`                               |
| `liberation`  | Liberation Politique    | `https://www.liberation.fr/arc/outboundfeeds/rss-all/category/politique/` |
| `politico`    | Politico.eu             | `https://www.politico.eu/feed/`                                           |
| `mediapart`   | Mediapart               | `https://www.mediapart.fr/articles/feed`                                  |
| `publicsenat` | Public Senat            | `https://www.publicsenat.fr/rss.xml`                                      |
| `lcp`         | LCP Assemblee nationale | `https://lcp.fr/rss.xml`                                                  |

### Donnees importees

- Articles : titre, description, URL, image, date de publication
- Mentions de politiciens (matching nom dans titre + description)
- Mentions de partis

### Script

```bash
npm run sync:press
```

---

## 13. Google Fact Check

- **URL de base** : `https://factchecktools.googleapis.com/v1alpha1/claims:search`
- **Type d'acces** : API REST Google Cloud
- **Authentification** : **Cle API Google** (`GOOGLE_FACTCHECK_API_KEY`)
- **Rate limit** : 200 ms (`FACTCHECK_RATE_LIMIT_MS`)

### Prerequis

1. Creer un projet Google Cloud
2. Activer l'API "Fact Check Tools"
3. Generer une cle API
4. Ajouter `GOOGLE_FACTCHECK_API_KEY=...` au `.env`

### Donnees importees

- Fact-checks : texte de la claim, auteur, verdict, note, source, URL
- Mentions de politiciens (matching dans le texte)
- Sources : AFP Factuel, Les Decodeurs, Liberation CheckNews, etc.

### Script

```bash
npm run sync:factchecks              # Politiciens avec mandats actifs
npm run sync:factchecks -- --all     # Tous les politiciens
npm run sync:factchecks -- --limit=50
```

---

## 14. RNE (Repertoire National des Elus)

- **URL de base** : `https://static.data.gouv.fr/resources/repertoire-national-des-elus-1/`
- **Type d'acces** : Telechargement CSV (separateur point-virgule, ~35 000 lignes)
- **Authentification** : Aucune
- **Rate limit** : 200 ms (`DATA_GOUV_RATE_LIMIT_MS`)
- **Licence** : Licence Ouverte (Etalab)

### Donnees importees

- Maires : matching avec les politiciens existants (nom + date de naissance + departement)
- Mandats : type `MAIRE`, commune, code departement
- **Ne cree PAS de nouveaux politiciens** — associe uniquement aux fiches existantes

### Script

```bash
npm run sync:rne:maires
```

---

## 15. Judilibre (Cour de cassation)

- **URL de base** : configurable via `JUDILIBRE_BASE_URL` (defaut : `https://api.piste.gouv.fr/cassation/judilibre/v1.0`)
- **Type d'acces** : API REST via la plateforme PISTE
- **Authentification** : **OAuth 2.0** (client credentials flow)
- **Rate limit** : 500 ms (`JUDILIBRE_RATE_LIMIT_MS`)

### Prerequis

1. Creer un compte sur [PISTE](https://developer.aife.economie.gouv.fr/)
2. S'abonner a l'API Judilibre
3. Obtenir client_id, client_secret et API key
4. Configurer les 5 variables d'environnement (voir [section 21](#21-variables-denvironnement))

### Donnees importees

- Decisions criminelles de la Cour de cassation
- Recherche par nom de politicien (chambre criminelle uniquement)
- Filtrage des homonymes via date de naissance + proximite du nom dans le texte
- Enrichit les affaires existantes (ECLI, numero de pourvoi, URL decision)
- Cree de nouvelles affaires prefixees `[A VERIFIER]` (validation manuelle requise)
- Intervalle minimum entre syncs : 8 heures (`--force` pour ignorer)

### Script

```bash
npm run sync:judilibre              # Sync incrementale
npm run sync:judilibre -- --limit=20
npm run sync:judilibre -- --force   # Ignorer l'intervalle minimum
```

---

## 16. Candidatures municipales

- **URL de base** : `https://static.data.gouv.fr/resources/elections-municipales-2020-candidatures-au-1er-tour/`
- **Type d'acces** : Telechargement CSV (TSV, encodage ISO-8859-1)
- **Authentification** : Aucune
- **Rate limit** : 200 ms (`DATA_GOUV_RATE_LIMIT_MS`)
- **Licence** : Licence Ouverte (Etalab)

### Donnees importees

- Candidatures : nom, prenom, commune, code departement, nuance politique, liste
- Matching politiciens existants par nom + departement
- Matching partis via mapping nuance politique (`src/config/labels.ts`)

### Script

```bash
npm run sync:elections:municipales
npm run sync:elections:municipales -- --dry-run
npm run sync:elections:municipales -- --limit=100
```

---

## 17. Photos

La synchronisation des photos interroge plusieurs sources par ordre de priorite.

### Sources par priorite

| Priorite | Source              | Pattern URL                                                               |
| -------- | ------------------- | ------------------------------------------------------------------------- |
| 10       | Assemblee nationale | `https://www.assemblee-nationale.fr/dyn/static/tribun/17/photos/{id}.jpg` |
| 10       | Senat               | `https://www.senat.fr/senimg/{matricule}.jpg`                             |
| 10       | Gouvernement        | Via HATVP                                                                 |
| 8        | HATVP               | `https://www.hatvp.fr/livraison/photos_gouvernement/{nom}-{prenom}.jpg`   |
| 6        | Wikidata            | Wikimedia Commons via propriete P18 (thumbnail MD5)                       |
| 5        | NosDéputes          | `https://www.nosdeputes.fr/depute/photo/{slug}/120`                       |
| 5        | NosSenateurs        | `https://archive.nossenateurs.fr/senateur/photo/{slug}/120`               |

### Fonctionnement

Le script effectue des requetes HTTP HEAD pour valider chaque URL candidate, puis retient la source de plus haute priorite. Il ne downgrade jamais vers une source de priorite inferieure.

### Script

```bash
npm run sync:photos              # Photos manquantes
npm run sync:photos -- --validate  # Valider les URLs existantes + sync
```

---

## 18. Analyse presse (IA)

- **Type d'acces** : IA (Claude Haiku via Vercel AI SDK) + scraping d'articles
- **Authentification** : **`ANTHROPIC_API_KEY`** (requis) + `MEDIAPART_EMAIL`/`MEDIAPART_PASSWORD` (optionnel)
- **Rate limit** : 500 ms (`AI_RATE_LIMIT_MS`), backoff 30s sur 429

### Fonctionnement

1. Recupere les articles non analyses depuis la base
2. Scrape le contenu complet pour les sources accessibles (franceinfo, LCP, Public Senat, Politico, Liberation)
3. Analyse par Claude Haiku pour detecter d'eventuelles affaires judiciaires
4. Cree des affaires prefixees `[A VERIFIER]` (validation manuelle requise)
5. **Ne stocke PAS le contenu scrape** (copyright) — uniquement le resume et les faits extraits
6. Intervalle minimum entre syncs : 6 heures

### Script

```bash
npm run sync:press-analysis              # Articles non analyses
npm run sync:press-analysis -- --limit=20
npm run sync:press-analysis -- --force
```

---

## 19. Enrichissement IA

Scripts utilisant l'IA pour generer des contenus a partir des donnees existantes.

### Biographies

- **Script** : `npm run generate:biographies`
- **IA** : Claude Haiku
- **Donnees** : Genere une biographie factuelle pour chaque politicien

### Resumes de dossiers legislatifs

- **Script** : `npm run generate:summaries`
- **IA** : Claude Haiku
- **Donnees** : Resume l'expose des motifs de chaque dossier

### Resumes de scrutins

- **Script** : `npm run generate:scrutin-summaries`
- **IA** : Claude Haiku
- **Donnees** : Resume chaque scrutin (contexte, enjeux, resultat)

### Classification thematique

- **Script** : `npm run classify:themes`
- **IA** : Claude Haiku
- **Donnees** : Classifie les dossiers legislatifs par theme

### Embeddings (RAG)

- **Script** : `npm run index:embeddings`
- **IA** : Voyage AI (`voyage-3-lite`, 512 dimensions)
- **Env** : `VOYAGE_API_KEY`
- **Types** : POLITICIAN, PARTY, AFFAIR, DOSSIER, SCRUTIN, PRESS_ARTICLE, FACTCHECK

---

## 20. Ordre d'execution

Le script `npm run sync:full` execute toutes les etapes dans l'ordre de dependance. Voici les 8 phases :

### Phase 1 — Sources institutionnelles

```
1. sync:assemblee          # Deputes
2. sync:senat              # Senateurs
3. sync:gouvernement       # Ministres
4. sync:president          # President
5. sync:europarl           # Eurodeputes
```

### Phase 2 — Enrichissement Wikidata

```
6.  sync:wikidata-ids      # Associer les Q-IDs
7.  sync:parties           # Partis politiques
8.  sync:careers           # Carrieres (P39, P488, P112) — ~20 min
9.  populate-party-leaders # Dirigeants de partis historiques
```

### Phase 3 — Sources complementaires

```
10. sync:hatvp             # Declarations patrimoine
11. sync:mep-parties       # Partis des eurodeputes
12. sync:birthdates        # Dates de naissance
13. sync:deceased          # Deces
14. sync:photos            # Photos
15. sync:history           # Historique mandats
```

### Phase 4 — Votes et legislation

```
16. sync:votes-an          # Scrutins AN — ~20 min
17. sync:votes-senat --all # Scrutins Senat — ~20 min
18. sync:legislation       # Dossiers legislatifs — ~15 min
19. sync:legislation:content # Exposes des motifs — ~15 min
```

### Phase 5 — Presse et fact-checks

```
20. sync:press             # Flux RSS
21. sync:factchecks        # Google Fact Check
```

### Phase 6 — Elections

```
22. sync:rne:maires        # Maires (RNE)
23. sync:elections:municipales # Candidatures
```

### Phase 7 — Backfills

```
24. migrate-mandate-party-links  # Lier partis aux mandats
25. migrate-slugs                # Generer les slugs
```

### Phase 8 — IA (optionnel, `--skip-ai` pour ignorer)

```
26. classify:themes        # Classification thematique
27. generate:summaries     # Resumes dossiers
28. generate:scrutin-summaries # Resumes scrutins
29. generate:biographies   # Biographies
30. index:embeddings       # Embeddings vectoriels — ~20 min
```

### Commandes orchestrateur

```bash
npm run sync:full              # Tout (~30-60 min)
npm run sync:full -- --dry-run # Preview
npm run sync:full -- --skip-ai # Sans etapes IA
npm run sync:full -- --from=16 # Reprendre depuis l'etape 16
```

### Sync quotidienne

Le script `npm run sync:daily` execute un sous-ensemble incrementiel (3x/jour via GitHub Actions) :

```bash
npm run sync:daily              # Votes du jour + legislation active + presse + IA
npm run sync:daily -- --dry-run
```

---

## 21. Variables d'environnement

### Requises (toute utilisation)

| Variable       | Description                                 |
| -------------- | ------------------------------------------- |
| `DATABASE_URL` | URL PostgreSQL (Supabase connection pooler) |

### Par source

| Variable                   | Source                                                                     | Obligatoire                             |
| -------------------------- | -------------------------------------------------------------------------- | --------------------------------------- |
| `GOOGLE_FACTCHECK_API_KEY` | Google Fact Check (#13)                                                    | Pour `sync:factchecks`                  |
| `JUDILIBRE_CLIENT_ID`      | Judilibre (#15)                                                            | Pour `sync:judilibre`                   |
| `JUDILIBRE_CLIENT_SECRET`  | Judilibre (#15)                                                            | Pour `sync:judilibre`                   |
| `JUDILIBRE_API_KEY`        | Judilibre (#15)                                                            | Pour `sync:judilibre`                   |
| `JUDILIBRE_BASE_URL`       | Judilibre (#15)                                                            | Pour `sync:judilibre`                   |
| `JUDILIBRE_OAUTH_URL`      | Judilibre (#15)                                                            | Pour `sync:judilibre`                   |
| `ANTHROPIC_API_KEY`        | Analyse presse, resumes, biographies, classification thematique (#18, #19) | Pour scripts IA                         |
| `VOYAGE_API_KEY`           | Embeddings RAG (#19)                                                       | Pour `index:embeddings`                 |
| `MEDIAPART_EMAIL`          | Analyse presse (#18)                                                       | Optionnel (articles complets Mediapart) |
| `MEDIAPART_PASSWORD`       | Analyse presse (#18)                                                       | Optionnel                               |
| `CRON_SECRET`              | Cache revalidation (sync:daily)                                            | Optionnel                               |

### Configuration des URLs

```env
# Judilibre (PISTE)
JUDILIBRE_BASE_URL="https://api.piste.gouv.fr/cassation/judilibre/v1.0"
JUDILIBRE_OAUTH_URL="https://oauth.piste.gouv.fr/api/oauth/token"
```

---

## 22. Rate limits

Tous les rate limits sont centralises dans `src/config/rate-limits.ts`.

| Constante                         | Valeur    | Source             | Notes                         |
| --------------------------------- | --------- | ------------------ | ----------------------------- |
| `DATA_GOUV_RATE_LIMIT_MS`         | 200 ms    | data.gouv.fr       | Politesse                     |
| `ASSEMBLEE_DOCPARL_RATE_LIMIT_MS` | 300 ms    | docparl AN         | Documents .docx               |
| `SENAT_RATE_LIMIT_MS`             | 200 ms    | senat.fr           | Non documente, politesse      |
| `EUROPARL_RATE_LIMIT_MS`          | 200 ms    | europarl.europa.eu | Politesse                     |
| `HATVP_RATE_LIMIT_MS`             | 200 ms    | hatvp.fr           | Politesse                     |
| `WIKIDATA_RATE_LIMIT_MS`          | 200 ms    | Wikidata REST      | Politique officielle          |
| `WIKIDATA_SPARQL_RATE_LIMIT_MS`   | 300 ms    | Wikidata SPARQL    | Empirique (timeout frequents) |
| `LEGISLATION_RATE_LIMIT_MS`       | 300 ms    | Legifrance         | Non documente                 |
| `RSS_RATE_LIMIT_MS`               | 1000 ms   | Flux RSS           | Politesse standard            |
| `FACTCHECK_RATE_LIMIT_MS`         | 200 ms    | Google Fact Check  | Politesse                     |
| `JUDILIBRE_RATE_LIMIT_MS`         | 500 ms    | PISTE/Judilibre    | Politesse                     |
| `AI_RATE_LIMIT_MS`                | 500 ms    | Claude/OpenAI      | Entre appels IA               |
| `AI_429_BACKOFF_MS`               | 30 000 ms | Claude/OpenAI      | Backoff sur rate limit 429    |

### HTTPClient

Tous les scripts sync utilisent le `HTTPClient` centralise (`src/lib/api/http-client.ts`) qui fournit :

- **Retry automatique** : 3 tentatives avec backoff exponentiel
- **Gestion 429** : retry avec backoff + logging de la source
- **Rate limiting** : delai configurable entre requetes
- **Timeout** : 30s par defaut, configurable par script

---

## 23. Troubleshooting

### SPARQL timeout (Wikidata)

**Symptome** : `QueryTimeoutException` ou pas de reponse de `query.wikidata.org/sparql`

**Solutions** :

- Reduire la taille des requetes (moins de `VALUES` par batch)
- Preferer l'API REST Wikidata (`wbgetclaims`) au SPARQL quand possible
- Augmenter le delai entre requetes (`WIKIDATA_SPARQL_RATE_LIMIT_MS`)
- Relancer avec `--resume` (le script sauvegarde sa progression)

### 429 Too Many Requests

**Symptome** : `[HTTPClient] 429 Too Many Requests from {source}`

**Solutions** :

- Le HTTPClient retry automatiquement avec backoff exponentiel
- Si le probleme persiste, augmenter le rate limit dans `src/config/rate-limits.ts`
- Pour les API IA, le backoff est de 30s (`AI_429_BACKOFF_MS`)

### ZIP corrompus (Votes AN / Legislation)

**Symptome** : Erreur de decompression ZIP

**Solutions** :

- Le script utilise ETag + hash pour detecter les changements — relancer suffit generalement
- Verifier que `data.assemblee-nationale.fr` est accessible
- Utiliser `--force` pour forcer le re-telechargement

### CSV avec encodage incorrect

**Symptome** : Caracteres accentues casses (mojibake)

**Solutions** :

- Les CSV data.gouv.fr peuvent etre en ISO-8859-1 (pas UTF-8)
- Le `HTTPClient.getBuffer()` telecharge en binaire, puis `TextDecoder("iso-8859-1")` decode correctement
- Verifier l'encodage documente par la source

### Judilibre inaccessible

**Symptome** : Erreur OAuth ou 401/403

**Solutions** :

- Verifier que les 5 variables `JUDILIBRE_*` sont configurees
- Les tokens OAuth expirent — le script les renouvelle automatiquement
- Verifier l'abonnement PISTE (peut expirer)
- En sandbox : utiliser `https://sandbox-oauth.piste.gouv.fr/api/oauth/token`

### Sync interrompue

**Symptome** : Script arrete en cours de route

**Solutions** :

- `sync:full -- --from=N` pour reprendre depuis l'etape N
- `sync:wikidata-ids --resume` pour reprendre le matching Wikidata
- La plupart des scripts sont idempotents (upsert) — relancer est sans risque

---

## 24. Credits

Les donnees utilisees proviennent de sources officielles et de projets citoyens :

- **Assemblee Nationale** : https://data.assemblee-nationale.fr — Licence Ouverte (Etalab)
- **Senat** : https://www.senat.fr — Licence Ouverte
- **Gouvernement** : https://www.data.gouv.fr — Licence Ouverte (Etalab)
- **HATVP** : https://www.hatvp.fr/open-data/ — Licence Ouverte (Etalab)
- **Parlement europeen** : https://data.europarl.europa.eu — Open Data
- **Wikidata** : https://www.wikidata.org — CC0 (domaine public)
- **Regards Citoyens** : https://www.regardscitoyens.org — CC-BY-SA (NosDéputes, NosSenateurs)
- **data.gouv.fr** : https://www.data.gouv.fr — Licence Ouverte (Etalab)
- **PISTE / Judilibre** : https://developer.aife.economie.gouv.fr — API publique
- **Google Fact Check Tools** : https://developers.google.com/fact-check/tools/api

Merci a ces organisations pour leur engagement en faveur de l'Open Data et de la transparence democratique.
