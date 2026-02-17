import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateSlug } from "@/lib/utils";
import { isAuthenticated } from "@/lib/auth";
import { invalidateEntity } from "@/lib/cache";
import type {
  AffairStatus,
  AffairCategory,
  PublicationStatus,
  SourceType,
} from "@/generated/prisma";

interface SourceInput {
  url: string;
  title: string;
  publisher: string;
  publishedAt: string;
  excerpt?: string;
  sourceType?: SourceType;
}

interface AffairInput {
  politicianId: string;
  title: string;
  description: string;
  status: AffairStatus;
  category: AffairCategory;
  factsDate?: string;
  startDate?: string;
  verdictDate?: string;
  sentence?: string;
  appeal?: boolean;
  // Detailed sentence
  prisonMonths?: number;
  prisonSuspended?: boolean;
  fineAmount?: number;
  ineligibilityMonths?: number;
  communityService?: number;
  otherSentence?: string;
  // Jurisdiction
  court?: string;
  chamber?: string;
  caseNumber?: string;
  // Judicial identifiers
  ecli?: string;
  pourvoiNumber?: string;
  caseNumbers?: string[];
  sources: SourceInput[];
}

export async function GET(request: NextRequest) {
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const pubStatus = searchParams.get("publicationStatus") as PublicationStatus | null;
  const category = searchParams.get("category") as AffairCategory | null;
  const status = searchParams.get("status") as AffairStatus | null;
  const search = searchParams.get("search");
  const hasEcli = searchParams.get("hasEcli");
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)));
  const skip = (page - 1) * limit;

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
}

export async function POST(request: NextRequest) {
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  try {
    const data: AffairInput = await request.json();

    // Validation
    if (!data.politicianId || !data.title || !data.description) {
      return NextResponse.json({ error: "Champs requis manquants" }, { status: 400 });
    }

    if (!data.sources || data.sources.length === 0) {
      return NextResponse.json({ error: "Au moins une source est requise" }, { status: 400 });
    }

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

    // Create affair with sources
    const affair = await db.affair.create({
      data: {
        politicianId: data.politicianId,
        title: data.title,
        slug,
        description: data.description,
        status: data.status,
        category: data.category,
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
  } catch (error) {
    console.error("Error creating affair:", error);
    return NextResponse.json({ error: "Erreur lors de la création" }, { status: 500 });
  }
}
