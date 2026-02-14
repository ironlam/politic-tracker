import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateSlug } from "@/lib/utils";
import { isAuthenticated } from "@/lib/auth";
import { invalidateEntity } from "@/lib/cache";
import type { AffairStatus, AffairCategory } from "@/generated/prisma";

interface SourceInput {
  url: string;
  title: string;
  publisher: string;
  publishedAt: string;
  excerpt?: string;
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
  sources: SourceInput[];
}

export async function GET() {
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const affairs = await db.affair.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      politician: { select: { id: true, fullName: true, slug: true } },
      sources: true,
    },
  });

  return NextResponse.json(affairs);
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
        sources: {
          create: data.sources.map((s) => ({
            url: s.url,
            title: s.title,
            publisher: s.publisher,
            publishedAt: new Date(s.publishedAt),
            excerpt: s.excerpt || null,
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
