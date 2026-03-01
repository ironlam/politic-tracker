import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAdminAuth } from "@/lib/api/with-admin-auth";
import { generateSlug } from "@/lib/utils";
import { invalidateEntity } from "@/lib/cache";
import { computeSeverity, isInherentlyMandateCategory } from "@/config/labels";
import type { AffairCategory, AffairStatus } from "@/generated/prisma";

interface DetectedAffair {
  title: string;
  description: string;
  category: string;
  status: string;
  involvement: string;
  factsDate: string | null;
  court: string | null;
  excerpts: string[];
  confidenceScore: number;
  politicianName: string;
}

const FEED_PUBLISHERS: Record<string, string> = {
  lemonde: "Le Monde",
  lefigaro: "Le Figaro",
  franceinfo: "Franceinfo",
  liberation: "Libération",
  politico: "Politico",
  mediapart: "Mediapart",
  publicsenat: "Public Sénat",
  lcp: "LCP",
  ouestfrance: "Ouest-France",
  sudouest: "Sud Ouest",
  ladepeche: "La Dépêche du Midi",
  ledauphine: "Le Dauphiné Libéré",
  dna: "DNA",
  googlenews: "Google News",
};

export const POST = withAdminAuth(async (request: NextRequest) => {
  const body = await request.json();
  const { rejectionId } = body;

  if (!rejectionId || typeof rejectionId !== "string") {
    return NextResponse.json({ error: "rejectionId requis" }, { status: 400 });
  }

  // Load rejection with article data
  const rejection = await db.pressAnalysisRejection.findUnique({
    where: { id: rejectionId },
    include: {
      article: {
        select: { id: true, title: true, url: true, feedSource: true, publishedAt: true },
      },
    },
  });

  if (!rejection) {
    return NextResponse.json({ error: "Rejet introuvable" }, { status: 404 });
  }

  if (!rejection.politicianId) {
    return NextResponse.json(
      { error: "Pas de politicien lié — récupération impossible" },
      { status: 400 }
    );
  }

  const detected = rejection.detectedAffair as unknown as DetectedAffair;
  const title = `[À VÉRIFIER] ${detected.title}`;

  // Generate unique slug
  const baseSlug = generateSlug(title);
  let slug = baseSlug;
  let counter = 1;
  while (await db.affair.findUnique({ where: { slug }, select: { id: true } })) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  const category = detected.category as AffairCategory;
  const mandateRelated = isInherentlyMandateCategory(category);
  const severity = computeSeverity(category, mandateRelated);
  const publisher = FEED_PUBLISHERS[rejection.article.feedSource] || rejection.article.feedSource;

  // Create affair in a transaction
  const affair = await db.$transaction(async (tx) => {
    const created = await tx.affair.create({
      data: {
        politicianId: rejection.politicianId!,
        title,
        slug,
        description: detected.description,
        status: detected.status as AffairStatus,
        category,
        severity,
        isRelatedToMandate: mandateRelated,
        involvement:
          (detected.involvement as
            | "DIRECT"
            | "INDIRECT"
            | "MENTIONED_ONLY"
            | "VICTIM"
            | "PLAINTIFF") || "MENTIONED_ONLY",
        publicationStatus: "DRAFT",
        confidenceScore: detected.confidenceScore,
        factsDate: detected.factsDate ? new Date(detected.factsDate) : null,
        court: detected.court,
        verifiedAt: null,
        sources: {
          create: {
            url: rejection.article.url,
            title: rejection.article.title,
            publisher,
            publishedAt: rejection.article.publishedAt,
            sourceType: "PRESSE",
            excerpt: detected.excerpts[0] || null,
          },
        },
      },
    });

    // Link article to affair
    await tx.pressArticleAffair.upsert({
      where: {
        articleId_affairId: {
          articleId: rejection.article.id,
          affairId: created.id,
        },
      },
      create: {
        articleId: rejection.article.id,
        affairId: created.id,
        role: "REVELATION",
      },
      update: { role: "REVELATION" },
    });

    // Delete the rejection record
    await tx.pressAnalysisRejection.delete({ where: { id: rejectionId } });

    return created;
  });

  invalidateEntity("affair");

  return NextResponse.json({ affairId: affair.id, title: affair.title }, { status: 201 });
});
