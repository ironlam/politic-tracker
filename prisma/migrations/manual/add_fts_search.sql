-- PostgreSQL Full-Text Search for Politician table
-- Run this migration manually: psql $DATABASE_URL < prisma/migrations/manual/add_fts_search.sql

-- 1. Add the search vector column
ALTER TABLE "Politician"
ADD COLUMN IF NOT EXISTS "searchVector" tsvector;

-- 2. Create GIN index for fast searching
CREATE INDEX IF NOT EXISTS idx_politician_search
ON "Politician" USING GIN("searchVector");

-- 3. Create function to update search vector (with unaccent for accent-insensitive search)
CREATE OR REPLACE FUNCTION politician_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW."searchVector" :=
    setweight(to_tsvector('french', unaccent(coalesce(NEW."firstName", ''))), 'A') ||
    setweight(to_tsvector('french', unaccent(coalesce(NEW."lastName", ''))), 'A') ||
    setweight(to_tsvector('french', unaccent(coalesce(NEW."fullName", ''))), 'B') ||
    setweight(to_tsvector('simple', coalesce(NEW."slug", '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Create trigger to auto-update search vector
DROP TRIGGER IF EXISTS politician_search_vector_trigger ON "Politician";
CREATE TRIGGER politician_search_vector_trigger
BEFORE INSERT OR UPDATE OF "firstName", "lastName", "fullName", "slug"
ON "Politician"
FOR EACH ROW
EXECUTE FUNCTION politician_search_vector_update();

-- 5. Populate search vector for existing rows (with unaccent)
UPDATE "Politician" SET
  "searchVector" =
    setweight(to_tsvector('french', unaccent(coalesce("firstName", ''))), 'A') ||
    setweight(to_tsvector('french', unaccent(coalesce("lastName", ''))), 'A') ||
    setweight(to_tsvector('french', unaccent(coalesce("fullName", ''))), 'B') ||
    setweight(to_tsvector('simple', coalesce("slug", '')), 'C');

-- 6. Create unaccent extension for accent-insensitive search
CREATE EXTENSION IF NOT EXISTS unaccent;

-- 7. Create function for accent-insensitive search
CREATE OR REPLACE FUNCTION search_politicians(search_query text, result_limit int DEFAULT 20)
RETURNS TABLE (
  id text,
  slug text,
  "fullName" text,
  "firstName" text,
  "lastName" text,
  "photoUrl" text,
  "currentPartyId" text,
  relevance real
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.slug,
    p."fullName",
    p."firstName",
    p."lastName",
    p."photoUrl",
    p."currentPartyId",
    ts_rank(p."searchVector", query) as relevance
  FROM "Politician" p,
       plainto_tsquery('french', unaccent(search_query)) as query
  WHERE p."searchVector" @@ query
     OR p."fullName" ILIKE '%' || search_query || '%'
     OR p."lastName" ILIKE '%' || search_query || '%'
  ORDER BY relevance DESC, p."lastName" ASC
  LIMIT result_limit;
END;
$$ LANGUAGE plpgsql;
