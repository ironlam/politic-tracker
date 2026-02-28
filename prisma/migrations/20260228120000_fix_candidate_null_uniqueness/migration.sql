-- Partial unique index for Candidate deduplication when politicianId IS NULL.
-- PostgreSQL treats NULL != NULL in unique constraints, so the existing
-- @@unique([firstName, lastName, politicianId]) doesn't prevent duplicates
-- when politicianId is NULL (which is the case for most ~900K candidates).

CREATE UNIQUE INDEX "Candidate_firstName_lastName_null_politician_key"
  ON "Candidate"("firstName", "lastName")
  WHERE "politicianId" IS NULL;
