-- Add isClaimant boolean to FactCheckMention
-- Distinguishes politicians who made the claim from those merely mentioned
ALTER TABLE "FactCheckMention" ADD COLUMN "isClaimant" BOOLEAN NOT NULL DEFAULT false;

-- Composite index for stats queries filtering on isClaimant
CREATE INDEX "FactCheckMention_politicianId_isClaimant_idx" ON "FactCheckMention"("politicianId", "isClaimant");
