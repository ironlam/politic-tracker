# Transparence Politique - Spécification

> **Version**: 1.0.0
> **Dernière mise à jour**: 2026-01-24
> **Statut**: Production

---

## 1. Vision du projet

### 1.1 Objectif principal

Créer un **observatoire citoyen de la transparence politique française** permettant aux citoyens d'accéder facilement aux informations publiques concernant les représentants politiques : mandats, patrimoine, et affaires judiciaires documentées.

### 1.2 Principes fondamentaux

1. **Transparence** : Toute information affichée doit être sourcée et vérifiable
2. **Neutralité** : Présentation factuelle, sans orientation politique
3. **Légalité** : Uniquement des données publiques, respect du RGPD et de la présomption d'innocence
4. **Accessibilité** : Interface simple, compréhensible par tous les citoyens
5. **Open Source** : Code source disponible, données réutilisables

### 1.3 Ce que le projet N'EST PAS

- Un site de dénonciation ou de "name and shame"
- Un média d'opinion
- Une base de données de casiers judiciaires (illégal)
- Un outil de surveillance des citoyens

---

## 2. Périmètre fonctionnel

### 2.1 État actuel (v1.0)

#### Représentants couverts

- [x] **Députés** : 577 (Assemblée nationale - XVIIe législature)
- [x] **Sénateurs** : 348 (Sénat)
- [x] **Gouvernement** : ~36 membres (ministres, secrétaires d'État)
- [x] **Eurodéputés** : 81 (Parlement européen - députés français)

#### Données par représentant

- [x] **Identité** : Nom, prénom, civilité, photo, date de naissance/décès
- [x] **Mandat actuel** : Fonction, circonscription, groupe politique
- [x] **Parti politique** : Affiliation actuelle avec couleur
- [x] **Déclarations HATVP** : Patrimoine et intérêts (3000+ déclarations)
- [x] **Affaires judiciaires** : ~90 affaires documentées avec sources
- [x] **Votes parlementaires** : Scrutins publics (NosDéputés - 16e législature)

#### Fonctionnalités utilisateur

- [x] Recherche par nom avec autocomplétion
- [x] Filtres : parti, type de mandat, condamnation, statut (vivant/décédé)
- [x] Tri : alphabétique, récent, nombre d'affaires
- [x] Fiche détaillée par représentant
- [x] Liste des affaires avec super-catégories
- [x] Page statistiques (dashboard)
- [x] Page des partis politiques
- [x] Dark mode

#### Fonctionnalités admin

- [x] Authentification sécurisée
- [x] CRUD représentants politiques
- [x] CRUD affaires judiciaires (source obligatoire)
- [x] Gestion des identifiants externes (multi-sources)
- [x] Scripts de synchronisation automatique

### 2.2 Phase 2 - Enrichissement (En cours)

- [x] Votes à l'Assemblée avec positions (NosDéputés - 16e législature)
- [x] Eurodéputés (81 représentants français)
- [x] Votes du Sénat (367 scrutins, 122k votes)
- [x] API publique documentée (OpenAPI/Swagger)
- [x] Export des données (CSV)
- [x] Exposé des motifs : extraction .docx pour résumés IA enrichis
- [ ] Taux de présence aux séances
- [ ] Historique des législatures

### 2.3 Phase 3 - Communautaire (Futur)

- [ ] Contributions externes modérées
- [ ] Système de signalement d'erreurs
- [ ] Notifications sur nouvelles affaires
- [x] Comparateur entre représentants

---

## 3. Architecture multi-sources

### 3.1 Principe

Chaque représentant politique peut avoir des données provenant de **plusieurs sources**. Le système maintient la traçabilité via le modèle `ExternalId`.

### 3.2 Sources de données

| Source              | Code                  | Données                    | Fréquence sync       |
| ------------------- | --------------------- | -------------------------- | -------------------- |
| Assemblée Nationale | `ASSEMBLEE_NATIONALE` | Députés, mandats           | Hebdomadaire         |
| Sénat               | `SENAT`               | Sénateurs, mandats         | Hebdomadaire         |
| Gouvernement        | `GOUVERNEMENT`        | Ministres                  | À chaque remaniement |
| Parlement Européen  | `PARLEMENT_EUROPEEN`  | Eurodéputés                | Mensuelle            |
| HATVP               | `HATVP`               | Déclarations patrimoine    | Mensuelle            |
| Wikidata            | `WIKIDATA`            | Condamnations, dates décès | Hebdomadaire         |
| NosDéputés          | `NOSDEPUTES`          | Photos, activité, votes    | Mensuelle            |
| NosSénateurs        | `NOSSENATEURS`        | Photos, activité           | Mensuelle            |

### 3.3 Workflow de synchronisation

1. **Chercher par ID externe** (plus fiable)
2. **Sinon, matcher par nom** (fuzzy match)
3. **Créer si non trouvé**
4. **Toujours créer/mettre à jour l'ExternalId**

### 3.4 Priorité des photos

| Priorité | Source                    | Score |
| -------- | ------------------------- | ----- |
| 1        | AN / Sénat / Gouvernement | 10    |
| 2        | HATVP                     | 8     |
| 3        | NosDéputés / NosSénateurs | 5     |
| 4        | Wikidata                  | 3     |
| 5        | Manuel                    | 1     |

---

## 4. Catégorisation des affaires

### 4.1 Super-catégories

| Super-catégorie | Description                                               |
| --------------- | --------------------------------------------------------- |
| **Probité**     | Corruption, trafic d'influence, prise illégale d'intérêts |
| **Finances**    | Fraude fiscale, détournement, blanchiment                 |
| **Personnes**   | Harcèlement, violence, agressions                         |
| **Expression**  | Diffamation, injures, incitation à la haine               |
| **Autre**       | Autres infractions                                        |

### 4.2 Statuts judiciaires

| Statut                     | Présomption d'innocence |
| -------------------------- | ----------------------- |
| Enquête préliminaire       | Oui                     |
| Mise en examen             | Oui                     |
| Procès en cours            | Oui                     |
| Condamnation 1ère instance | Oui (appel possible)    |
| Condamnation définitive    | Non                     |
| Relaxe / Non-lieu          | N/A                     |

---

## 5. Métriques actuelles

| Métrique             | Valeur                  |
| -------------------- | ----------------------- |
| Représentants        | ~1100                   |
| Députés actifs       | 577                     |
| Sénateurs actifs     | 348                     |
| Eurodéputés          | 81                      |
| Membres gouvernement | 36                      |
| Partis politiques    | 55+                     |
| Déclarations HATVP   | 3000+                   |
| Affaires documentées | ~90                     |
| Scrutins (votes)     | ~2000 (16e législature) |
| Couverture photos    | ~91%                    |

---

## 6. Historique des versions

| Date       | Version | Changements                                                      |
| ---------- | ------- | ---------------------------------------------------------------- |
| 2026-01-18 | 0.1.0   | Setup initial, import députés                                    |
| 2026-01-20 | 0.5.0   | Import sénateurs, gouvernement, HATVP                            |
| 2026-01-22 | 0.8.0   | Affaires Wikidata, statistiques, filtres                         |
| 2026-01-24 | 1.0.0   | Dark mode, recherche avancée, documentation                      |
| 2026-01-24 | 1.1.0   | Eurodéputés, votes parlementaires, institutions                  |
| 2026-02-07 | 1.2.0   | Exposé des motifs : extraction .docx AN pour résumés IA enrichis |
