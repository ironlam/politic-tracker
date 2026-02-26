# Croisement de donnees et matching

> **Derniere mise a jour** : 2026-02-26

Comment Poligraph reconcilie les donnees de 14+ sources pour construire une fiche unique par politicien. Ce document decrit les identifiants, les strategies de matching et les bonnes pratiques pour ajouter une nouvelle source.

---

## Table des matieres

- [Principe general](#1-principe-general)
- [Carte des identifiants](#2-carte-des-identifiants)
- [Strategies de matching](#3-strategies-de-matching)
- [Croisement Wikidata](#4-croisement-wikidata)
- [Cas concrets](#5-cas-concrets)
- [Ajouter une nouvelle source](#6-ajouter-une-nouvelle-source)
- [Pieges connus](#7-pieges-connus)

---

## 1. Principe general

Chaque politicien possede un `id` interne (CUID) et zero ou plusieurs `ExternalId` qui le relient aux sources externes :

```
Politician (id: cuid)
  ├── ExternalId(ASSEMBLEE_NATIONALE, "PA841729")
  ├── ExternalId(SENAT, "21077")
  ├── ExternalId(WIKIDATA, "Q3052772")
  ├── ExternalId(HATVP, "macronaaaemmanuel5835")
  ├── ExternalId(PARLEMENT_EUROPEEN, "97236")
  ├── ExternalId(NOSDEPUTES, "jean-luc-melenchon")
  └── ExternalId(RNE, "...")
```

Le modele `ExternalId` a une contrainte unique sur `(source, externalId)`. Un politicien peut avoir plusieurs IDs de la meme source (ex: mandat depute + mandat senateur).

**Workflow d'import standard** : chercher par ID externe → sinon matcher par nom → creer si absent → toujours creer/mettre a jour l'ExternalId.

---

## 2. Carte des identifiants

### Identifiants par source

| Source              | Champ source     | Format              | Exemple                 | ExternalId.source     | Wikidata P-ID |
| ------------------- | ---------------- | ------------------- | ----------------------- | --------------------- | ------------- |
| Assemblee nationale | ID CSV           | `PA` + chiffres     | `PA841729`              | `ASSEMBLEE_NATIONALE` | P4123         |
| Senat               | matricule        | chiffres + lettre   | `21077M`                | `SENAT`               | P4324         |
| HATVP               | classement (CSV) | `nomaaaprenom12345` | `macronaaaemmanuel5835` | `HATVP`               | P4703         |
| Parlement europeen  | identifier (API) | chiffres            | `97236`                 | `PARLEMENT_EUROPEEN`  | —             |
| Wikidata            | Q-ID             | `Q` + chiffres      | `Q3052772`              | `WIKIDATA`            | —             |
| NosDéputes          | slug             | prenom-nom          | `jean-luc-melenchon`    | `NOSDEPUTES`          | P7384         |
| RNE                 | —                | —                   | —                       | `RNE`                 | —             |

### URLs de resolution

Chaque identifiant permet de construire l'URL vers la fiche d'origine :

| Source              | Pattern URL                                                     |
| ------------------- | --------------------------------------------------------------- |
| Assemblee nationale | `https://www.assemblee-nationale.fr/dyn/deputes/{id}`           |
| Senat               | `https://www.senat.fr/senateur/{matricule}.html`                |
| HATVP               | `https://www.hatvp.fr/fiche-nominative/?declarant={classement}` |
| Parlement europeen  | `https://www.europarl.europa.eu/meps/fr/{id}`                   |
| Wikidata            | `https://www.wikidata.org/wiki/{qid}`                           |
| NosDéputes          | `https://www.nosdeputes.fr/{slug}`                              |

---

## 3. Strategies de matching

### Strategie 1 : Matching par identifiant externe (fiable)

Quand la source fournit un identifiant connu (AN, Senat), on cherche directement dans `ExternalId` :

```
Source → id_origine → ExternalId.findFirst({ source, externalId }) → politicianId
```

**Utilise par** : HATVP (via `id_origine` pour deputes/senateurs), votes AN/Senat, legislation.

**Fiabilite** : 100% — un ID est un ID.

### Strategie 2 : Matching par nom (fallback)

Quand il n'y a pas d'identifiant, on matche par nom (prenom + nom, case-insensitive) :

```
Source → (prenom, nom) → Politician.findFirst({ firstName, lastName, mode: insensitive }) → id
```

**Utilise par** : HATVP (pour gouvernement, president, communes), presse, fact-checks.

**Fiabilite** : ~95% — risque d'homonymes.

**Ameliorations** :

- Normalisation des accents (`Eléonore` vs `Eleonore`)
- Particules (`Le Pen` vs `LE PEN`)
- Thesaurus de prenoms (`src/lib/french-names.ts`) : `Jean-Luc` ↔ `Jean Luc`

### Strategie 3 : Matching par nom + date de naissance (anti-homonymes)

Pour les sources a risque d'homonymes (Wikidata, RNE), on croise nom + date de naissance :

```
Source → (nom, dateNaissance) → Politician.findFirst({
  lastName: nom,
  birthDate: { gte: date - 5j, lte: date + 5j }
})
```

**Utilise par** : Wikidata IDs, RNE maires.

**Fiabilite** : ~99.9% — quasi impossible d'avoir deux homonymes nes le meme jour.

### Strategie 4 : Matching par nom + departement (geographique)

Pour les elus locaux, le departement reduit les homonymes :

```
Source → (nom, departement) → Politician + Mandate.findFirst({
  lastName: nom,
  mandates: { departmentCode: dept }
})
```

**Utilise par** : Candidatures municipales, RNE.

**Fiabilite** : ~98%.

---

## 4. Croisement Wikidata

Wikidata est le **hub de croisement** central. Chaque politicien avec un Q-ID peut etre relie a toutes les autres sources via les proprietes Wikidata :

```
Wikidata Q3052772 (Emmanuel Macron)
  ├── P4123 → ID Assemblee nationale
  ├── P4324 → ID Senat
  ├── P4703 → ID HATVP (classement)
  ├── P7384 → Slug NosDéputes
  ├── P569  → Date de naissance (verification)
  ├── P18   → Photo Wikimedia Commons
  ├── P39   → Positions occupees (carriere)
  ├── P102  → Parti politique
  └── P1399 → Condamnations
```

### Configuration centralisee

Toutes les proprietes Wikidata sont dans `src/config/wikidata.ts` (`WD_PROPS`). Ne jamais utiliser un P-ID en dur dans le code — toujours passer par cette config.

### Matching Wikidata → Politicien

Le script `sync:wikidata-ids` :

1. Cherche par nom sur l'API REST Wikidata (`wbsearchentities`)
2. Recupere les claims du candidat (`wbgetclaims`)
3. Verifie la date de naissance (P569) a +-5 jours
4. Stocke le Q-ID comme `ExternalId(WIKIDATA, qid)`

---

## 5. Cas concrets

### HATVP : trois niveaux de matching

Le sync HATVP illustre la cascade complete :

1. **Deputes** : `id_origine` (ex: `841729`) → cherche `ExternalId(ASSEMBLEE_NATIONALE, "PA841729")` ✅
2. **Senateurs** : `id_origine` (ex: `21077M`) → cherche `ExternalId(SENAT, "21077")` ✅
3. **Gouvernement/President/Communes** : `id_origine` vide → fallback nom ✅

Le champ `classement` est ensuite stocke comme `ExternalId(HATVP, classement)`, permettant le croisement avec Wikidata P4703.

### Types de mandats HATVP importes

| `type_mandat` CSV | Importe | Raison                                           |
| ----------------- | ------- | ------------------------------------------------ |
| `depute`          | Oui     | Nos politiciens                                  |
| `senateur`        | Oui     | Nos politiciens                                  |
| `gouvernement`    | Oui     | Nos politiciens                                  |
| `europe`          | Oui     | Eurodeputes                                      |
| `president`       | Oui     | President(s)                                     |
| `commune`         | Oui     | Maires (matching par nom)                        |
| `departement`     | Non     | Pas encore de conseillers departementaux en base |
| `region`          | Non     | Pas encore de conseillers regionaux en base      |
| `epci`            | Non     | Intercommunalites                                |
| `ctsp`            | Non     | Collectivites a statut particulier               |
| `autre`           | Non     | Divers                                           |

### Presse : matching prudent

La presse utilise le matching par nom dans le titre/description de l'article. Pour eviter les faux positifs :

- Noms courts (< 4 lettres) : match mot entier uniquement
- Thesaurus de prenoms pour les variantes

---

## 6. Ajouter une nouvelle source

Checklist pour integrer une nouvelle source de donnees :

### 1. Identifier les identifiants disponibles

- La source fournit-elle un ID unique par personne ?
- Cet ID existe-t-il sur Wikidata (propriete P-xxx) ?
- Si oui, ajouter le P-ID dans `src/config/wikidata.ts` (`WD_PROPS`)

### 2. Choisir la strategie de matching

| Situation                                       | Strategie                                                    |
| ----------------------------------------------- | ------------------------------------------------------------ |
| La source a un ID qu'on a deja (ex: ID AN)      | Matching par ExternalId existant                             |
| La source a un nouvel ID croisable via Wikidata | Matching par Q-ID → P-xxx                                    |
| La source n'a pas d'ID                          | Matching par nom (+ date de naissance si risque d'homonymes) |

### 3. Stocker l'ExternalId

Si la source a un identifiant unique :

1. Ajouter la source dans l'enum `DataSource` (`prisma/schema.prisma`)
2. `prisma db push` pour appliquer
3. Dans le sync, appeler `db.externalId.upsert()` apres le matching

### 4. Documenter

- Ajouter la source dans `docs/DATASOURCES.md`
- Ajouter les identifiants dans ce document (section 2)
- Mettre a jour `src/config/wikidata.ts` si pertinent

---

## 7. Pieges connus

### Accents et normalisation

Les noms dans les sources officielles varient : `Eléonore` vs `Eleonore` vs `ELEONORE`. Le matching case-insensitive de Prisma (`mode: "insensitive"`) gere la casse mais **pas les accents manquants**.

**Solution** : le thesaurus de prenoms (`src/lib/french-names.ts`) inclut les variantes avec/sans accents.

### Homonymes

Risque reel pour les noms courants (Martin, Durand). Le matching par nom seul ne suffit pas.

**Solution** : croiser avec la date de naissance (+-5 jours) ou le departement.

### IDs qui changent

Certaines sources changent les IDs entre legislatures (ex: ID AN `PA*` change d'une legislature a l'autre).

**Solution** : stocker l'ID + la source, accepter plusieurs ExternalIds par politicien pour la meme source.

### Double creation

Si le matching echoue (nom mal normalise, accent different), le sync peut creer un doublon.

**Solution** : ne jamais creer de politicien dans un sync d'enrichissement (HATVP, RNE, presse). Seuls les syncs institutionnels (AN, Senat, Gouvernement) creent.

### Champs vides dans le CSV HATVP

Le champ `id_origine` est vide pour certains types de mandats (gouvernement, president, commune). C'est normal — le fallback par nom prend le relais.
