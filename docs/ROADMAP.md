# Roadmap - Transparence Politique

> **Dernière mise à jour** : 2026-01-24

Ce document recense les évolutions envisagées pour le projet, classées par priorité et complexité.

---

## Vision du projet

Transparence Politique vise à rendre accessible l'information sur les représentants politiques français : leurs mandats, affiliations, déclarations de patrimoine et éventuelles affaires judiciaires.

**Objectif principal** : Permettre aux citoyens de s'informer sur leurs élus actuels et leur historique.

---

## 1. Priorité haute (impact fort, faisable)

### 1.1 Améliorer les filtres

| Évolution | Détail | Effort |
|-----------|--------|--------|
| Remplacer "en vie/décédé" | Filtre "Actifs" (mandat en cours) vs "Anciens" | Faible |
| Filtre par département | Recherche géographique | Moyen |
| Filtre par législature | XVe, XVIe, XVIIe | Moyen |
| Masquer les décédés par défaut | Afficher uniquement sur demande | Faible |

### 1.2 Afficher les circonscriptions

- Ajouter le département/circo sur les cartes politiques
- Page dédiée par département avec ses élus
- Lien vers la fiche depuis la recherche

### 1.3 Améliorer les fiches politiques

- Frise chronologique des mandats
- Historique des affiliations partisanes
- Évolution du patrimoine (si plusieurs déclarations HATVP)

### 1.4 SEO et accessibilité

- Balises meta dynamiques
- Données structurées (JSON-LD)
- Amélioration du contraste (WCAG AA)
- Navigation clavier complète

---

## 2. Priorité moyenne (utile, effort modéré)

### 2.1 Carte interactive

| Option | Complexité | Valeur |
|--------|------------|--------|
| Carte des départements | Moyenne | Stats par zone |
| Carte des circonscriptions | Élevée | Précision maximale |
| Carte des affaires | Moyenne | Angle original |

**Recommandation** : Commencer par une carte départementale avec compte d'élus et d'affaires.

### 2.2 Recherche avancée

- Opérateurs booléens (AND, OR, NOT)
- Recherche par date de condamnation
- Recherche par type d'infraction
- Export des résultats (CSV)

### 2.3 Statistiques enrichies

- Évolution temporelle des affaires
- Comparaison entre législatures
- Taux de condamnation par catégorie
- Âge moyen des élus par parti

### 2.4 API publique documentée

- Documentation OpenAPI/Swagger
- Rate limiting
- Clés API (optionnel)
- Endpoints RESTful complets

---

## 3. Priorité basse (nice-to-have)

### 3.1 Eurodéputés

- Import depuis le Parlement Européen
- Intégration dans la recherche unifiée
- ~79 élus français

### 3.2 Candidats aux élections

- Données des candidatures (législatives, présidentielles)
- Historique des résultats
- Évolution des scores

### 3.3 Activité parlementaire

- Intégration NosDéputés/NosSénateurs
- Présence en commission
- Votes sur les textes majeurs
- Questions au gouvernement

### 3.4 Biographies enrichies

- Import Wikipedia
- Parcours professionnel
- Formation

### 3.5 Notifications

- Alertes sur nouvelles affaires
- Suivi de politiques spécifiques
- Newsletter hebdomadaire

---

## 4. Idées à explorer

### 4.1 Analyse et dataviz

- **Graphe des relations** : Qui a travaillé avec qui (gouvernements, cabinets)
- **Timeline des affaires** : Visualisation chronologique
- **Heatmap des condamnations** : Par année, par type

### 4.2 Comparaison

- Comparer deux politiques (mandats, déclarations)
- Comparer deux partis (affaires, évolution)
- Comparer deux législatures

### 4.3 Transparence renforcée

- Suivi des votes nominatifs
- Conflits d'intérêts détectés automatiquement
- Liens avec les lobbies (registre HATVP)

### 4.4 Communauté

- Signalement d'erreurs par les utilisateurs
- Proposition de sources (modérées)
- Traductions (anglais, allemand)

### 4.5 Nouvelles idées (2026-01-24)

| Idée | Description | Valeur |
|------|-------------|--------|
| **"Qui est mon député ?"** | Recherche par code postal → circo | Haute |
| **Alertes affaires** | Email quand nouvelle affaire ajoutée | Haute |
| **Comparateur** | Comparer 2 politiques côte à côte | Moyenne |
| **Export PDF** | Générer une fiche PDF d'un politique | Moyenne |
| **Badges de transparence** | "A déclaré son patrimoine", "Présent en commission" | Moyenne |
| **Widget embeddable** | `<iframe>` pour intégration médias | Moyenne |
| **Historique des changements** | Voir l'évolution des fiches (audit log public) | Basse |

---

## 5. Non prioritaire / Hors scope

| Idée | Raison |
|------|--------|
| Élus locaux (maires, conseillers) | Volume trop important (~500k) |
| Historique avant 1958 | Hors Ve République |
| Prédictions électorales | Hors mission du projet |
| Forum/commentaires | Risque juridique, modération lourde |

---

## 6. Décisions techniques à prendre

### 6.1 Carte

- **Bibliothèque** : Leaflet, Mapbox, ou D3.js ?
- **GeoJSON** : Source officielle IGN vs simplifiée ?
- **Hébergement tuiles** : Self-hosted vs service tiers ?

### 6.2 Recherche avancée

- **Solution** : PostgreSQL full-text vs Meilisearch vs Algolia ?
- Meilisearch recommandé (open source, rapide, facile)

### 6.3 Cache et performance

- **CDN** : Vercel Edge vs Cloudflare ?
- **Cache API** : Redis vs in-memory ?
- **ISR** : Quelles pages en statique vs dynamique ?

---

## 7. Métriques de succès

| Métrique | Objectif |
|----------|----------|
| Couverture députés | 100% (577/577) |
| Couverture sénateurs | 100% (348/348) |
| Photos disponibles | >90% |
| Affaires sourcées | 100% |
| Temps de réponse | <200ms (P95) |
| Score Lighthouse | >90 |
| Accessibilité | WCAG AA |

---

## 8. Décisions prises

### 8.1 URL `/politiques` vs `/representants`

**Décision** : Garder `/politiques`

| Critère | `/politiques` | `/representants` |
|---------|---------------|------------------|
| Longueur | ✅ Court | ❌ Long |
| Recherche naturelle | ✅ "politique france" | ❌ Moins tapé |
| Cohérence UI | ❌ On dit "représentants" | ✅ Cohérent |

Le SEO et l'intuitivité priment sur la cohérence terminologique interne.

### 8.2 Multilingue

**Décision** : Non prioritaire

- Audience cible 100% francophone
- Terminologie trop spécifique (circo, mise en examen, HATVP...)
- Coût de maintenance élevé pour un gain minimal
- Si un jour : next-intl, anglais seulement

### 8.3 SEO - Actions

| Élément | Statut |
|---------|--------|
| Title/description dynamiques | ✅ Fait |
| OpenGraph images | À faire |
| JSON-LD (Person, Organization) | À faire |
| Sitemap dynamique | À faire |
| robots.txt | À faire |
| Canonical URLs | À faire |

### 8.4 GEO - Approche incrémentale

1. **Phase 1** : Afficher département sur les cartes politiques
2. **Phase 2** : Page `/departements` avec liste des élus
3. **Phase 3** : Carte départementale cliquable (Leaflet)
4. **Phase 4** : Carte des circonscriptions (si demandé)

---

## 9. Améliorations UX identifiées

| Problème | Solution | Priorité |
|----------|----------|----------|
| Pas de loader lors changement de filtres | Ajouter skeleton/spinner sur la grille | Haute |
| Carrière politique peu lisible | Liste chronologique groupée (actuel/passé) | Haute |
| Recherche par localisation absente | "Qui est mon député ?" par code postal | Moyenne |

---

## 10. Prochaines étapes immédiates

1. [x] ~~Remplacer filtre "décédé" par "actifs/anciens"~~
2. [x] ~~Afficher la circonscription sur les cartes politiques~~
3. [ ] Améliorer l'affichage des carrières (liste chronologique)
4. [ ] Ajouter loaders sur les filtres
5. [ ] Ajouter OpenGraph metadata
6. [ ] Créer sitemap.xml dynamique
7. [ ] Créer robots.txt
