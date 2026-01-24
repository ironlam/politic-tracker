import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAuthenticated } from "@/lib/auth";
import type { AffairStatus, AffairCategory } from "@/generated/prisma";

interface SourceInput {
  id?: string;
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

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { id } = await context.params;

  const affair = await db.affair.findUnique({
    where: { id },
    include: {
      politician: { select: { id: true, fullName: true, slug: true } },
      sources: true,
    },
  });

  if (!affair) {
    return NextResponse.json({ error: "Affaire non trouvée" }, { status: 404 });
  }

  return NextResponse.json(affair);
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const data: AffairInput = await request.json();

    // Check affair exists
    const existing = await db.affair.findUnique({
      where: { id },
      include: { sources: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Affaire non trouvée" }, { status: 404 });
    }

    // Validation
    if (!data.politicianId || !data.title || !data.description) {
      return NextResponse.json(
        { error: "Champs requis manquants" },
        { status: 400 }
      );
    }

    if (!data.sources || data.sources.length === 0) {
      return NextResponse.json(
        { error: "Au moins une source est requise" },
        { status: 400 }
      );
    }

    // Update affair
    const affair = await db.affair.update({
      where: { id },
      data: {
        politicianId: data.politicianId,
        title: data.title,
        description: data.description,
        status: data.status,
        category: data.category,
        factsDate: data.factsDate ? new Date(data.factsDate) : null,
        startDate: data.startDate ? new Date(data.startDate) : null,
        verdictDate: data.verdictDate ? new Date(data.verdictDate) : null,
        sentence: data.sentence || null,
        appeal: data.appeal || false,
        // Detailed sentence
        prisonMonths: data.prisonMonths ?? null,
        prisonSuspended: data.prisonSuspended ?? null,
        fineAmount: data.fineAmount ?? null,
        ineligibilityMonths: data.ineligibilityMonths ?? null,
        communityService: data.communityService ?? null,
        otherSentence: data.otherSentence || null,
        // Jurisdiction
        court: data.court || null,
        chamber: data.chamber || null,
        caseNumber: data.caseNumber || null,
      },
    });

    // Handle sources: delete old ones and create new ones
    // (simpler than diffing for MVP)
    await db.source.deleteMany({ where: { affairId: id } });

    await db.source.createMany({
      data: data.sources.map((s) => ({
        affairId: id,
        url: s.url,
        title: s.title,
        publisher: s.publisher,
        publishedAt: new Date(s.publishedAt),
        excerpt: s.excerpt || null,
      })),
    });

    // Log action
    await db.auditLog.create({
      data: {
        action: "UPDATE",
        entityType: "Affair",
        entityId: affair.id,
        changes: { title: affair.title },
      },
    });

    return NextResponse.json(affair);
  } catch (error) {
    console.error("Error updating affair:", error);
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const affair = await db.affair.findUnique({
      where: { id },
      select: { id: true, title: true },
    });

    if (!affair) {
      return NextResponse.json({ error: "Affaire non trouvée" }, { status: 404 });
    }

    // Delete affair (sources will cascade)
    await db.affair.delete({ where: { id } });

    // Log action
    await db.auditLog.create({
      data: {
        action: "DELETE",
        entityType: "Affair",
        entityId: id,
        changes: { title: affair.title },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting affair:", error);
    return NextResponse.json(
      { error: "Erreur lors de la suppression" },
      { status: 500 }
    );
  }
}
