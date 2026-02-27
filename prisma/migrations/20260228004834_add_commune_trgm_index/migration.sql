-- Enable pg_trgm extension for trigram-based fuzzy text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN index on commune name for fast ILIKE / contains queries
CREATE INDEX idx_commune_name_trgm ON "Commune" USING gin (name gin_trgm_ops);
