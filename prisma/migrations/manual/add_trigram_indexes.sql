-- Trigram GIN indexes for fast ILIKE search on text columns
-- Run this migration manually: psql $DATABASE_URL < prisma/migrations/manual/add_trigram_indexes.sql
--
-- These indexes accelerate Prisma `contains` queries (mode: "insensitive")
-- which generate ILIKE '%term%' — without trigram index, PG does a sequential scan.

-- 1. Enable pg_trgm extension (already available on Supabase)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Trigram index on Politician.fullName for ILIKE search
-- Covers: { fullName: { contains: search, mode: "insensitive" } }
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Politician_fullName_trgm"
ON "Politician" USING gin ("fullName" gin_trgm_ops);

-- 3. Trigram index on Politician.lastName for ILIKE search
-- Covers: { lastName: { contains: search, mode: "insensitive" } }
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Politician_lastName_trgm"
ON "Politician" USING gin ("lastName" gin_trgm_ops);

-- 4. Trigram index on Scrutin.title for ILIKE search
-- Covers: { title: { contains: search, mode: "insensitive" } }
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Scrutin_title_trgm"
ON "Scrutin" USING gin ("title" gin_trgm_ops);

-- 5. Trigram indexes on LocalOfficial for maires search (/maires page)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "LocalOfficial_fullName_trgm"
ON "LocalOfficial" USING gin ("fullName" gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "LocalOfficial_lastName_trgm"
ON "LocalOfficial" USING gin ("lastName" gin_trgm_ops);
