-- RLS Public Read Policies
-- Defense-in-depth: even if anon key is compromised, only PUBLISHED data is readable.
-- The postgres role (used by Prisma) bypasses RLS — app logic is unaffected.
--
-- Applied manually via Supabase SQL Editor or:
--   psql $DATABASE_URL -f prisma/migrations/manual/rls-public-read-policies.sql

-- Politician: only PUBLISHED
CREATE POLICY "anon_read_published_politicians"
  ON "Politician" FOR SELECT TO anon
  USING ("publicationStatus" = 'PUBLISHED');

-- Affair: only PUBLISHED + DIRECT involvement
CREATE POLICY "anon_read_published_affairs"
  ON "Affair" FOR SELECT TO anon
  USING ("publicationStatus" = 'PUBLISHED' AND involvement = 'DIRECT');

-- Party: all readable (public data)
CREATE POLICY "anon_read_parties"
  ON "Party" FOR SELECT TO anon
  USING (true);

-- Scrutin: all readable
CREATE POLICY "anon_read_scrutins"
  ON "Scrutin" FOR SELECT TO anon
  USING (true);

-- Vote: all readable
CREATE POLICY "anon_read_votes"
  ON "Vote" FOR SELECT TO anon
  USING (true);

-- FactCheck: all readable
CREATE POLICY "anon_read_factchecks"
  ON "FactCheck" FOR SELECT TO anon
  USING (true);

-- PressArticle: all readable
CREATE POLICY "anon_read_press_articles"
  ON "PressArticle" FOR SELECT TO anon
  USING (true);

-- Election: all readable
CREATE POLICY "anon_read_elections"
  ON "Election" FOR SELECT TO anon
  USING (true);

-- Mandate: all readable
CREATE POLICY "anon_read_mandates"
  ON "Mandate" FOR SELECT TO anon
  USING (true);

-- LegislativeDossier: all readable
CREATE POLICY "anon_read_dossiers"
  ON "LegislativeDossier" FOR SELECT TO anon
  USING (true);

-- All other tables (AuditLog, AdminUser, SyncMetadata, ExternalId,
-- ChatConversation, ChatMessage, ChatEmbedding, Declaration, Source,
-- AffairEvent, Amendment, Candidacy, ElectionRound, EuropeanGroup,
-- FactCheckMention, PartyMembership, PressArticleMention,
-- PressArticlePartyMention): NO POLICY = blocked by default for anon.
