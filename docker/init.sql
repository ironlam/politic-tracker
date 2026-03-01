-- Extensions required by Poligraph
-- pg_trgm: fuzzy text search (ILIKE optimization)
-- pgvector: embedding similarity search (RAG chatbot)
-- uuid-ossp: UUID generation (Prisma default)

CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
