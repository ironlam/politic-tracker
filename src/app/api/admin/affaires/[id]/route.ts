import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAuthenticated } from "@/lib/auth";
import { invalidateEntity } from "@/lib/cache";
import { generateSlug } from "@/lib/utils";
import { trackStatusChange } from "@/services/affairs/status-tracking";
import { updateAffairSchema } from "@/lib/validations/affairs";

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
    const body = await request.json();

    const parsed = updateAffairSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const data = parsed.data;

    // Check affair exists
    const existing = await db.affair.findUnique({
      where: { id },
      include: { sources: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Affaire non trouvée" }, { status: 404 });
    }

    // Regenerate slug if title changed
    let newSlug: string | undefined;
    if (existing.title !== data.title) {
      const baseSlug = generateSlug(data.title);
      newSlug = baseSlug;
      let counter = 1;
      while (
        await db.affair.findFirst({
          where: { slug: newSlug, id: { not: id } },
        })
      ) {
        newSlug = `${baseSlug}-${counter}`;
        counter++;
      }
    }

    // Update affair
    const affair = await db.affair.update({
      where: { id },
      data: {
        politicianId: data.politicianId,
        title: data.title,
        ...(newSlug && { slug: newSlug }),
        description: data.description,
        status: data.status,
        category: data.category,
        involvement: data.involvement || "DIRECT",
        ...(data.publicationStatus && { publicationStatus: data.publicationStatus }),
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
        // Judicial identifiers
        ecli: data.ecli || null,
        pourvoiNumber: data.pourvoiNumber || null,
        caseNumbers: data.caseNumbers || [],
      },
    });

    // Track status change for audit trail
    if (existing.status !== data.status) {
      await trackStatusChange(id, existing.status, data.status, {
        type: "MANUAL",
        title: "Modification manuelle via l'admin",
      });
    }

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
        sourceType: s.sourceType || "MANUAL",
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

    // Invalidate cache for affair and related politician
    invalidateEntity("affair");
    const pol = await db.politician.findUnique({
      where: { id: data.politicianId },
      select: { slug: true },
    });
    if (pol) invalidateEntity("politician", pol.slug);

    return NextResponse.json(affair);
  } catch (error) {
    console.error("Error updating affair:", error);
    return NextResponse.json({ error: "Erreur lors de la mise à jour" }, { status: 500 });
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
      select: { id: true, title: true, politician: { select: { slug: true } } },
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

    invalidateEntity("affair");
    if (affair.politician?.slug) invalidateEntity("politician", affair.politician.slug);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting affair:", error);
    return NextResponse.json({ error: "Erreur lors de la suppression" }, { status: 500 });
  }
}
