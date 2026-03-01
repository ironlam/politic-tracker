# Stratégie de résolution d'identité — Poligraph

## Le problème

Poligraph agrège des données de 10+ sources institutionnelles françaises pour construire des profils complets de politiciens : Assemblée nationale, Sénat, RNE (35 000 maires), HATVP, Wikidata, Judilibre, Wikipedia, presse, fact-checks.

Chaque source utilise ses propres identifiants. L'Assemblée nationale a des codes "PA", le Sénat a des slugs, le RNE n'a pas d'identifiant par personne — seulement le nom, la date de naissance et le code commune.

Le défi : **comment savoir que deux enregistrements de sources différentes désignent la même personne ?**

Les homonymes rendent la question non triviale. La France compte plusieurs "Thierry Cousin", plusieurs "Jean-Pierre Martin", plusieurs "Marie Dupont" parmi ses élus. Un matching naïf par nom conduit à des erreurs de réconciliation — avec des conséquences potentiellement graves quand il s'agit d'affaires judiciaires ou de votes parlementaires.

## Notre approche

L'Identity Resolution Engine de Poligraph suit un pipeline en 7 étapes, centralisé et auditable :

1. **Décisions antérieures** — Le système consulte d'abord son historique. Si une personne a déjà été explicitement identifiée comme "même personne" (SAME) ou "personne différente" (NOT_SAME), cette décision est respectée.

2. **Matching déterministe** — Si un identifiant externe partagé existe (ex. même code PA de l'Assemblée nationale), c'est un match certain (confiance 1.0).

3. **Date de naissance** — Une correspondance nom + date de naissance donne une confiance de 0.9 — signal fort mais pas infaillible (erreurs de saisie).

4. **Département** — Un candidat avec un mandat existant dans le même département obtient une confiance de 0.7.

5. **Nom seul** — En l'absence d'autres signaux, le nom donne une confiance de 0.5 — insuffisante pour un match automatique.

6. **Seuils de décision** — >= 0.95 : match automatique. 0.70–0.94 : file d'attente de revue humaine. < 0.70 : rejeté comme nouvelle personne.

7. **Journalisation** — Chaque décision est enregistrée dans une table d'audit (`IdentityDecision`) avec la méthode, la confiance, les preuves et l'auteur.

## Le poligraphId

Chaque politicien dans Poligraph reçoit un identifiant public stable : le **poligraphId**.

Format : `PG-XXXXXX` (ex. `PG-000542`)

Cet identifiant est :

- **Stable** — Il ne change jamais, même si le nom, le slug ou les données changent
- **Séquentiel** — Attribué par ordre de création dans la base
- **Public** — Utilisable dans les URLs, les APIs et les exports de données
- **Unique** — Un seul poligraphId par personne physique

Le poligraphId est le point d'ancrage pour toutes les références externes. Il apparaît dans l'API de réconciliation W3C et sera à terme ajouté comme identifiant externe sur Wikidata.

## Carte des sources de données

| Source              | Identifiant   | Confiance | Méthode              | Données principales                   |
| ------------------- | ------------- | --------- | -------------------- | ------------------------------------- |
| Assemblée nationale | Code PA       | 1.0       | ID institutionnel    | Mandats, votes, commissions           |
| Sénat               | Slug sénat    | 1.0       | ID institutionnel    | Mandats, votes, questions             |
| Parlement européen  | ID MEP        | 1.0       | ID institutionnel    | Mandats européens                     |
| HATVP               | Référence     | 0.9       | ID institutionnel    | Déclarations patrimoine/intérêts      |
| Wikidata            | Q-ID          | 0.95      | Pivot Wikidata       | Données biographiques, liens externes |
| Gouvernement        | Slug gouv     | 0.9       | ID institutionnel    | Portefeuilles ministériels            |
| NosDeputes          | Slug ND       | 0.85      | ID institutionnel    | Statistiques parlementaires           |
| RNE                 | Code INSEE    | 0.7       | Nom + date naissance | Maires (35 000+)                      |
| Wikipedia           | Titre article | 0.7       | Nom seul             | Biographies                           |
| Judilibre           | N° décision   | Variable  | Multi-critères       | Décisions de justice                  |
| Presse              | URL article   | Variable  | Mentions textuelles  | Couverture médiatique                 |

## Contribuer

### Signaler une erreur de matching

Si vous identifiez un politicien dont les données semblent mélangées avec un homonyme :

1. Ouvrez une issue sur [GitHub](https://github.com/ldiaby/politic-tracker/issues)
2. Indiquez le poligraphId ou le slug du politicien concerné
3. Précisez quelle donnée semble incorrecte et de quelle source elle provient

L'équipe créera une décision `NOT_SAME` pour bloquer le matching erroné de façon permanente.

### Proposer une nouvelle source de données

Les sources doivent :

- Être publiques et librement accessibles
- Concerner des personnalités politiques françaises
- Fournir au minimum un nom complet et un identifiant ou contexte de désambiguïsation

### Le Wikibot

Le Poligraph Wikibot est un bot Wikidata qui synchronise bidirectionnellement les données entre Poligraph et Wikidata. Il utilise les Q-IDs Wikidata comme pivot principal pour le matching cross-source.

## API de réconciliation

Poligraph expose une API compatible avec la [spécification W3C Reconciliation Service API v0.2](https://www.w3.org/community/reports/reconciliation/CG-FINAL-specs-0.2-20230410/).

**Endpoint :** `GET /api/reconcile`

### Manifeste du service

```
GET /api/reconcile
```

Retourne les métadonnées du service (nom, types supportés, espace d'identifiants).

### Requête de réconciliation

```
GET /api/reconcile?queries={"q0":{"query":"Marine Le Pen"}}
```

Ou en POST :

```json
POST /api/reconcile
{
  "queries": {
    "q0": {
      "query": "Marine Le Pen",
      "properties": [
        { "pid": "birthDate", "v": "1968-08-05" },
        { "pid": "department", "v": "62" }
      ]
    }
  }
}
```

### Propriétés supportées

| Propriété    | Description                  | Effet sur le score                |
| ------------ | ---------------------------- | --------------------------------- |
| `birthDate`  | Date de naissance (ISO 8601) | +20 si match, -30 si mismatch     |
| `department` | Code département             | +10 si mandat dans ce département |

### Intégration OpenRefine

L'API est compatible avec [OpenRefine](https://openrefine.org/) pour la réconciliation de jeux de données. Ajoutez l'URL du service dans OpenRefine > Reconcile > Add Standard Service.
