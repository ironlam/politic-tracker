# Roadmap - Transparence Politique

> **Dernière mise à jour** : 2026-01-31

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

### 3.1 Eurodéputés ✅ FAIT

- [x] Import depuis le Parlement Européen (81 MEPs)
- [x] Groupes politiques européens avec couleurs
- [x] Intégration dans la recherche unifiée

### 3.2 Candidats aux élections

- Données des candidatures (législatives, présidentielles)
- Historique des résultats
- Évolution des scores

### 3.3 Activité parlementaire (En cours)

- [x] Votes publics depuis NosDéputés (16e législature)
- [x] **Votes 17e législature** depuis data.assemblee-nationale.fr (5283 scrutins, ~880k votes)
- [x] Page /votes avec liste des scrutins
- [x] Votes par politicien sur leur fiche
- [ ] Votes du Sénat (NosSénateurs)
- [ ] Présence en commission
- [ ] Questions au gouvernement

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

- **Graphe des relations** : ✅ FAIT - Visualisation des connexions (parti, gouvernement, législature, département)
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

### 4.6 Engagement citoyen (2026-01-31)

Objectif : Permettre aux citoyens de comprendre et d'interagir avec leurs représentants.

| Idée | Description | Effort | Valeur |
|------|-------------|--------|--------|
| **Liens permanences élus** | Contact direct avec son député/sénateur | Faible | Haute |
| **Stats présence/activité** | Équilibre avec données positives (pas que les affaires) | Moyen | Haute |
| **Glossaire juridique** | Explication des statuts (mise en examen ≠ condamnation) | Faible | Moyenne |
| **"Ce vote me concerne"** | Expliquer l'impact d'un vote sur la vie quotidienne | Moyen | Haute |

### 4.7 Chatbot IA / RAG (2026-01-31)

**Objectif** : Permettre aux citoyens de poser des questions en langage naturel.

**Architecture envisagée** :
```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (Next.js)                       │
│  Chat UI avec streaming + citations cliquables              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    API ROUTE (Edge)                         │
│  Rate limiting + Input validation + Modération              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    RAG PIPELINE                             │
│  1. Query Understanding (classifier)                        │
│  2. Retrieval (pgvector sur Supabase)                      │
│     ├─ Politiciens (bio, mandats)                          │
│     ├─ Votes (scrutins, positions)                         │
│     ├─ Affaires (condamnations, sources)                   │
│     └─ Dossiers législatifs (résumés IA)                   │
│  3. LLM Generation (Claude Haiku / Sonnet)                 │
│  4. Response + Citations                                    │
└─────────────────────────────────────────────────────────────┘
```

**Exemples de questions** :
- "Qui est mon député à Lyon ?"
- "Comment Marine Le Pen a-t-elle voté sur les retraites ?"
- "Quels ministres ont été condamnés ?"
- "Qu'est-ce que ce vote sur la loi X peut changer pour un étudiant ?"

**Idée avancée** : RAG capable d'expliquer ce qu'une situation personnelle peut attendre de certains votes (ex: "En tant que locataire, que change cette loi ?")

#### Plan d'implémentation MVP

| Phase | Tâches | Effort |
|-------|--------|--------|
| **Phase 1 : Infrastructure** | Setup pgvector, embeddings politiciens/votes | 1 semaine |
| **Phase 2 : API Chat** | Route `/api/chat` avec streaming, rate limiting | 1 semaine |
| **Phase 3 : UI** | Interface chat (shadcn/ui), suggestions, citations | 1 semaine |
| **Phase 4 : Itération** | Feedback utilisateur, amélioration prompts | Continu |

#### Sécurité et fiabilité (CRITIQUE)

| Risque | Solution |
|--------|----------|
| Hallucinations | RAG strict, refuse si pas de source |
| Diffamation | Toujours citer sources, présomption d'innocence auto |
| Abus/spam | Rate limiting (10 req/min IP, 50/jour user) |
| Coûts | Plafond quotidien, Haiku par défaut |
| Injection prompt | Sanitization + system prompt robuste |

#### Stack technique

- **Embeddings** : OpenAI `text-embedding-3-small`
- **Vector DB** : pgvector (Supabase)
- **LLM** : Claude Haiku (défaut) → Sonnet (questions complexes)
- **Streaming** : Vercel AI SDK
- **Rate limit** : Upstash Redis

### 4.8 Admin : Gestion des dossiers législatifs (2026-01-31)

**Objectif** : Permettre aux administrateurs de gérer les fiches des dossiers parlementaires avec génération IA assistée.

#### Fonctionnalités

| Fonctionnalité | Description | Priorité |
|----------------|-------------|----------|
| **Liste des dossiers** | Tableau avec filtres (statut, commission, date) | Haute |
| **Édition manuelle** | Modifier titre, résumé, statut | Haute |
| **Bouton "Generate with AI"** | Générer/régénérer le résumé via Claude | Haute |
| **Prévisualisation** | Voir le résumé avant validation | Moyenne |
| **Historique** | Voir les versions précédentes | Basse |

#### Principe de fiabilité (FONDAMENTAL)

```
┌─────────────────────────────────────────────────────────────┐
│  ⚠️  RÈGLE D'OR : TOUJOURS SE BASER SUR DE VRAIES SOURCES  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  La génération IA doit UNIQUEMENT résumer les données       │
│  officielles de l'Assemblée nationale :                     │
│                                                             │
│  ✅ Texte intégral du dossier (data.assemblee-nationale.fr) │
│  ✅ Exposé des motifs                                       │
│  ✅ Amendements adoptés                                     │
│  ✅ Rapports de commission                                  │
│                                                             │
│  ❌ JAMAIS d'invention ou d'interprétation                  │
│  ❌ JAMAIS de données externes non vérifiées                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### Workflow de génération

```
1. Admin clique "Generate with AI"
           │
           ▼
2. Fetch données officielles AN
   (texte, exposé, amendements)
           │
           ▼
3. Envoi à Claude avec prompt strict :
   "Résume ce dossier en te basant
    UNIQUEMENT sur le texte fourni"
           │
           ▼
4. Affichage prévisualisation
           │
           ▼
5. Admin valide ou modifie
           │
           ▼
6. Sauvegarde avec flag "ai_generated"
   + timestamp + source_urls
```

#### Interface admin envisagée

```
┌─────────────────────────────────────────────────────────────┐
│  📋 Dossier : Projet de loi finances 2026                  │
├─────────────────────────────────────────────────────────────┤
│  Statut: En commission  │  Commission: Finances            │
├─────────────────────────────────────────────────────────────┤
│  Résumé actuel:                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Ce projet de loi définit le budget de l'État...     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  [✏️ Modifier]  [🤖 Generate with AI]  [👁️ Prévisualiser] │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  Sources officielles:                                       │
│  • https://data.assemblee-nationale.fr/dossier/DLR123      │
│  • Dernière sync: 2026-01-31 14:30                         │
└─────────────────────────────────────────────────────────────┘
```

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
| OpenGraph images | ✅ Fait |
| JSON-LD (Person, Organization, WebSite, FAQ) | ✅ Fait |
| Sitemap dynamique | ✅ Fait |
| robots.txt | ✅ Fait |
| Canonical URLs | ✅ Fait (via metadataBase) |

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

## 10. Automatisation et maintenance

### 10.1 Synchronisation des données

| Tâche | Description | Priorité |
|-------|-------------|----------|
| Cron job Vercel | Sync hebdomadaire automatique (assemblee, senat, hatvp) | Moyenne |
| Logger les changements | Audit log des modifications détectées | Moyenne |
| Email d'alerte | Notification si changements majeurs (décès, démission) | Basse |
| Webhook data.gouv.fr | Être notifié des mises à jour des sources | Basse |

### 10.2 Scripts existants

```bash
npm run sync:assemblee      # Députés (577)
npm run sync:senat          # Sénateurs (348)
npm run sync:gouvernement   # Gouvernement actuel
npm run sync:europarl       # Eurodéputés (81)
npm run sync:hatvp          # Déclarations patrimoine
npm run sync:photos         # Photos manquantes
npm run sync:deceased       # Dates de décès (Wikidata)
npm run sync:votes          # Votes parlementaires (NosDéputés)
npm run sync:parties        # Partis politiques
```

---

## 11. Prochaines étapes immédiates

### Fait (janvier 2026)
- [x] Remplacer filtre "décédé" par "actifs/anciens"
- [x] Afficher la circonscription sur les cartes politiques
- [x] Améliorer l'affichage des carrières (MandateTimeline)
- [x] Ajouter loaders sur les filtres
- [x] Page "Mon député" (recherche par code postal)
- [x] Ajouter OpenGraph metadata
- [x] Créer sitemap.xml dynamique
- [x] Créer robots.txt
- [x] Page /departements avec liste des élus
- [x] Améliorer image OG (PNG avec design via opengraph-image.tsx)
- [x] Cron job sync automatique (GitHub Actions hebdomadaire)
- [x] Import eurodéputés (81 MEPs français)
- [x] Page /institutions (AN, Sénat, PE, Gouvernement)
- [x] Import votes parlementaires (NosDéputés - 16e législature)
- [x] Page /votes avec liste des scrutins
- [x] **Documentation API** (OpenAPI/Swagger sur /docs/api)
- [x] **Graphe de relations** entre politiciens (/politiques/[slug]/relations)
- [x] **JSON-LD SEO** complet (WebSite, Person, Organization, FAQ, ItemList)
- [x] Votes sur fiches politiciens (stats + derniers votes)
- [x] Script sync-votes amélioré (barre de progression, matching fuzzy)
- [x] Filtre "Avec décision de justice" (remplace "Avec condamnation")
- [x] Lien API dans header + liens secondaires menu mobile

### En cours
- [ ] Améliorer le graphe de relations (trop dense, positionnement)
- [ ] Statistiques de vote par parti
- [ ] Enrichir les carrières politiques via Wikidata (mandats historiques)

### 🤖 Priorité IA (février 2026)

#### Admin : Gestion dossiers législatifs
- [ ] Page `/admin/dossiers` - Liste des dossiers avec filtres
- [ ] Édition manuelle des fiches (titre, résumé, statut)
- [ ] Bouton "Generate with AI" - Génération résumé via Claude
- [ ] Prévisualisation avant validation
- [ ] Traçabilité : flag `ai_generated`, timestamp, source_urls

#### Chatbot citoyen (MVP)
- [ ] Setup pgvector + embeddings (politiciens, votes, dossiers)
- [ ] API `/api/chat` avec streaming (Vercel AI SDK)
- [ ] Rate limiting (Upstash Redis)
- [ ] UI chat basique (shadcn/ui)
- [ ] Citations automatiques des sources

### Refactoring - Scripts d'import/sync

**Objectif** : Rendre les scripts d'import plus intelligents et robustes.

| Amélioration | Description | Priorité |
|--------------|-------------|----------|
| **Pattern unifié** | Créer une classe/interface commune pour tous les scripts de sync | Haute |
| **Gestion des erreurs** | Retry automatique, logging structuré, rapport de fin | Haute |
| **Rate limiting centralisé** | Module partagé pour respecter les limites des APIs | Moyenne |
| **Mode incrémental** | Ne récupérer que les changements depuis la dernière sync | Moyenne |
| **Validation des données** | Schéma Zod pour valider les données avant insertion | Moyenne |
| **Tests automatisés** | Tests unitaires pour les fonctions de parsing/matching | Basse |
| **Dry-run partout** | Option `--dry-run` sur tous les scripts | Faible |

**Leçons apprises Wikidata** :
- SPARQL timeout sur gros volumes → utiliser l'API REST (`wbsearchentities`)
- Toujours partir de notre base de données, pas de la source externe
- Matcher par nom + date de naissance pour éviter les homonymes

### À faire court terme
- [ ] Votes du Sénat (NosSénateurs)
- [ ] Page comparative entre politiciens
- [ ] Export CSV des données
- [ ] Carte interactive des départements

### Configuration du Cron Job

Le workflow GitHub Actions `.github/workflows/sync-data.yml` s'exécute :
- **Automatiquement** : Tous les dimanches à 4h (heure Paris)
- **Manuellement** : Via l'onglet Actions sur GitHub

**Secret requis** : `DATABASE_URL` doit être configuré dans les secrets du repo GitHub.

---

## 12. Liste d'évolutions proposées (2026)

### Court terme (1-2 semaines)

| Évolution | Impact | Effort | Statut |
|-----------|--------|--------|--------|
| Progression sync votes | UX dev | Faible | ✅ Fait |
| Votes sur fiches politiciens | UX utilisateur | Moyen | ✅ Fait |
| Stats votes par parti | Insight | Moyen | |
| Améliorer mobile menu | UX mobile | Faible | |
| **Admin dossiers législatifs** | Gestion contenu | Moyen | 🎯 Prioritaire |
| **Bouton "Generate with AI"** | Productivité admin | Moyen | 🎯 Prioritaire |

### Moyen terme (1-2 mois)

| Évolution | Impact | Effort | Statut |
|-----------|--------|--------|--------|
| **Chatbot IA citoyen (MVP)** | Engagement | Élevé | 🎯 Prioritaire |
| Votes Sénat (NosSénateurs) | Complétude | Moyen | |
| Carte interactive départements | Visualisation | Élevé | |
| Comparateur politiciens | Feature | Moyen | |
| API documentée (OpenAPI) | Réutilisation | Moyen | ✅ FAIT |
| PWA (offline, install) | UX mobile | Moyen | |
| Export CSV | Data | Faible | |

### Long terme (3-6 mois)

| Évolution | Impact | Effort | Statut |
|-----------|--------|--------|--------|
| Recherche avancée (Meilisearch) | UX recherche | Élevé | |
| Graphe des relations | Visualisation | Élevé | ✅ FAIT |
| JSON-LD SEO avancé | SEO | Moyen | ✅ FAIT |
| Alertes nouvelles affaires | Engagement | Moyen | |
| Widget embeddable | Distribution | Moyen | |
| i18n (anglais) | Audience | Élevé | |
