# Politique de sécurité

## Signaler une vulnérabilité

Si vous découvrez une vulnérabilité de sécurité dans Poligraph, merci de la signaler de manière responsable.

**Ne publiez PAS de vulnérabilité dans les issues GitHub publiques.**

### Contact

Envoyez un email à : **contact@poligraph.fr** avec le sujet `[SECURITY]`.

### Informations à inclure

- Description de la vulnérabilité
- Étapes pour la reproduire
- Impact potentiel
- Suggestion de correction (si applicable)

### Délai de réponse

- **Accusé de réception** : sous 72 heures
- **Évaluation initiale** : sous 7 jours
- **Correction** : selon la gravité, entre 7 et 30 jours

### Périmètre

| Dans le périmètre              | Hors périmètre                                       |
| ------------------------------ | ---------------------------------------------------- |
| Application web (poligraph.fr) | Services tiers (Supabase, Vercel)                    |
| API publique (/api/\*)         | Attaques par déni de service                         |
| Scripts de synchronisation     | Ingénierie sociale                                   |
| Configuration de déploiement   | Vulnérabilités dans les dépendances non exploitables |

### Engagement

- Nous ne poursuivrons pas les chercheurs en sécurité agissant de bonne foi
- Nous créditerons les découvertes (sauf demande contraire)
- Nous communiquerons de manière transparente sur les corrections
