-- Add blobPhotoUrl column for Vercel Blob cached photos
ALTER TABLE "Politician" ADD COLUMN IF NOT EXISTS "blobPhotoUrl" TEXT;
