-- Curseur de rotation de la découverte par recherche web.
--
-- Même contrat que photoCheckedAt et careerCheckedAt : NULLS FIRST pour
-- « jamais cherché », puis les plus anciens. Donne aussi la re-recherche
-- périodique, un élu sans affaire cette année pouvant en avoir une la suivante.
--
-- Fichier plat dans manual/ et non dossier versionné : la prod n'a pas de table
-- _prisma_migrations, et staging-migrate.yml lance `migrate deploy` sur tout
-- push touchant prisma/**. Un dossier versionné armerait ce workflow avec un
-- historique qu'il ne peut pas rejouer.
--
-- Appliqué en production le 2026-09-09.

ALTER TABLE "Politician" ADD COLUMN IF NOT EXISTS "webSearchCheckedAt" TIMESTAMP(3);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "Politician_webSearchCheckedAt_idx"
  ON "Politician" ("webSearchCheckedAt");
