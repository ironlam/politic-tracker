import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateSlug } from "@/lib/utils";
import { withAdminAuth } from "@/lib/api/with-admin-auth";
import { invalidateEntity } from "@/lib/cache";
import { createAffairSchema } from "@/lib/validations/affairs";
import type { AffairCategory, PublicationStatus, AffairStatus } from "@/generated/prisma";
import { computeSeverity, isInherentlyMandateCategory } from "@/config/labels";
import { parsePagination } from "@/lib/api/pagination";

export const GET = withAdminAuth(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const pubStatus = searchParams.get("publicationStatus") as PublicationStatus | null;
  const category = searchParams.get("category") as AffairCategory | null;
  const status = searchParams.get("status") as AffairStatus | null;
  const search = searchParams.get("search");
  const hasEcli = searchParams.get("hasEcli");
  const { page, limit, skip } = parsePagination(searchParams);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};
  if (pubStatus) where.publicationStatus = pubStatus;
  if (category) where.category = category;
  if (status) where.status = status;
  if (hasEcli === "true") where.ecli = { not: null };
  if (hasEcli === "false") where.ecli = null;
  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { politician: { fullName: { contains: search, mode: "insensitive" } } },
    ];
  }

  const [affairs, total, countDraft, countPublished, countRejected] = await Promise.all([
    db.affair.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        politician: {
          select: { id: true, fullName: true, slug: true, photoUrl: true },
        },
        sources: { select: { id: true, sourceType: true } },
        moderationReviews: {
          where: { appliedAt: null },
          orderBy: { createdAt: "desc" as const },
          take: 1,
          select: {
            id: true,
            recommendation: true,
            confidence: true,
            reasoning: true,
            suggestedTitle: true,
            suggestedDescription: true,
            suggestedStatus: true,
            suggestedCategory: true,
            issues: true,
            duplicateOfId: true,
          },
        },
      },
    }),
    db.affair.count({ where }),
    db.affair.count({ where: { publicationStatus: "DRAFT" } }),
    db.affair.count({ where: { publicationStatus: "PUBLISHED" } }),
    db.affair.count({ where: { publicationStatus: "REJECTED" } }),
  ]);

  return NextResponse.json({
    data: affairs,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    counts: {
      all: countDraft + countPublished + countRejected,
      DRAFT: countDraft,
      PUBLISHED: countPublished,
      REJECTED: countRejected,
    },
  });
});

export const POST = withAdminAuth(async (request: NextRequest) => {
  const body = await request.json();

  const parsed = createAffairSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  // Check politician exists
  const politician = await db.politician.findUnique({
    where: { id: data.politicianId },
  });

  if (!politician) {
    return NextResponse.json({ error: "Politique non trouvé" }, { status: 404 });
  }

  // Generate unique slug
  const baseSlug = generateSlug(data.title);
  let slug = baseSlug;
  let counter = 1;

  while (await db.affair.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  // Compute severity
  const mandateRelated = data.isRelatedToMandate ?? isInherentlyMandateCategory(data.category);
  const severity = computeSeverity(data.category, mandateRelated);

  // Create affair with sources
  const affair = await db.affair.create({
    data: {
      politicianId: data.politicianId,
      title: data.title,
      slug,
      description: data.description,
      status: data.status,
      category: data.category,
      severity,
      isRelatedToMandate: mandateRelated,
      involvement: data.involvement || "DIRECT",
      factsDate: data.factsDate ? new Date(data.factsDate) : null,
      startDate: data.startDate ? new Date(data.startDate) : null,
      verdictDate: data.verdictDate ? new Date(data.verdictDate) : null,
      sentence: data.sentence || null,
      appeal: data.appeal || false,
      // Detailed sentence
      prisonMonths: data.prisonMonths || null,
      prisonSuspended: data.prisonSuspended ?? null,
      fineAmount: data.fineAmount || null,
      ineligibilityMonths: data.ineligibilityMonths || null,
      communityService: data.communityService || null,
      otherSentence: data.otherSentence || null,
      // Jurisdiction
      court: data.court || null,
      chamber: data.chamber || null,
      caseNumber: data.caseNumber || null,
      // Judicial identifiers
      ecli: data.ecli || null,
      pourvoiNumber: data.pourvoiNumber || null,
      caseNumbers: data.caseNumbers || [],
      sources: {
        create: data.sources.map((s) => ({
          url: s.url,
          title: s.title,
          publisher: s.publisher,
          publishedAt: new Date(s.publishedAt),
          excerpt: s.excerpt || null,
          sourceType: s.sourceType || "MANUAL",
        })),
      },
    },
    include: {
      sources: true,
      politician: { select: { fullName: true } },
    },
  });

  // Log action
  await db.auditLog.create({
    data: {
      action: "CREATE",
      entityType: "Affair",
      entityId: affair.id,
      changes: { title: affair.title, politician: affair.politician.fullName },
    },
  });

  invalidateEntity("affair");
  invalidateEntity("politician", politician.slug);

  return NextResponse.json(affair, { status: 201 });
});
