-- Phase 1: Multi-source judicial affairs foundations (#92)
-- Backfill sourceType for existing sources

-- Sources from Wikidata sync have publisher = 'Wikidata'
UPDATE "Source" SET "sourceType" = 'WIKIDATA' WHERE publisher = 'Wikidata';

-- All other sources default to PRESSE (already set by @default in schema)

-- GIN index for efficient search within caseNumbers array
CREATE INDEX IF NOT EXISTS "Affair_caseNumbers_idx" ON "Affair" USING GIN ("caseNumbers");
