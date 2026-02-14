import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAuthenticated } from "@/lib/auth";
import { invalidateEntity } from "@/lib/cache";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/admin/mandates/[id]
 * Get a single mandate with politician and party included
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { id } = await context.params;

  const mandate = await db.mandate.findUnique({
    where: { id },
    include: {
      politician: { select: { id: true, fullName: true, slug: true, photoUrl: true } },
      party: { select: { id: true, name: true, shortName: true } },
    },
  });

  if (!mandate) {
    return NextResponse.json({ error: "Mandat non trouvé" }, { status: 404 });
  }

  return NextResponse.json(mandate);
}

/**
 * PATCH /api/admin/mandates/[id]
 * Partial update (URLs only — legacy)
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const data = await request.json();

    const existing = await db.mandate.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Mandat non trouvé" }, { status: 404 });
    }

    const mandate = await db.mandate.update({
      where: { id },
      data: {
        officialUrl: data.officialUrl ?? undefined,
        sourceUrl: data.sourceUrl ?? undefined,
      },
    });

    await db.auditLog.create({
      data: {
        action: "UPDATE",
        entityType: "Mandate",
        entityId: mandate.id,
        changes: {
          officialUrl: mandate.officialUrl,
          sourceUrl: mandate.sourceUrl,
        },
      },
    });

    invalidateEntity("mandate");

    return NextResponse.json(mandate);
  } catch (error) {
    console.error("Error updating mandate:", error);
    return NextResponse.json({ error: "Erreur lors de la mise à jour" }, { status: 500 });
  }
}

/**
 * PUT /api/admin/mandates/[id]
 * Full update of a leadership mandate
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const data = await request.json();
    const { title, startDate, endDate, sourceUrl, officialUrl } = data;

    const existing = await db.mandate.findUnique({
      where: { id },
      select: { id: true, partyId: true, type: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Mandat non trouvé" }, { status: 404 });
    }

    const isCurrent = !endDate;

    // If making this mandate current, close other current leadership mandates for same party
    if (isCurrent && existing.partyId && existing.type === "PRESIDENT_PARTI") {
      await db.mandate.updateMany({
        where: {
          type: "PRESIDENT_PARTI",
          partyId: existing.partyId,
          isCurrent: true,
          id: { not: id },
        },
        data: {
          isCurrent: false,
          endDate: new Date(startDate),
        },
      });
    }

    const mandate = await db.mandate.update({
      where: { id },
      data: {
        title: title ?? undefined,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : null,
        isCurrent,
        sourceUrl: sourceUrl ?? undefined,
        officialUrl: officialUrl ?? undefined,
      },
      include: {
        politician: { select: { id: true, fullName: true, slug: true } },
        party: { select: { id: true, name: true, shortName: true } },
      },
    });

    await db.auditLog.create({
      data: {
        action: "UPDATE",
        entityType: "Mandate",
        entityId: mandate.id,
        changes: { title, startDate, endDate, isCurrent },
      },
    });

    invalidateEntity("mandate");
    if (mandate.politician?.slug) invalidateEntity("politician", mandate.politician.slug);

    return NextResponse.json(mandate);
  } catch (error) {
    console.error("Error updating mandate:", error);
    return NextResponse.json({ error: "Erreur lors de la mise à jour" }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/mandates/[id]
 * Delete a mandate (warns if source is WIKIDATA)
 */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const existing = await db.mandate.findUnique({
      where: { id },
      select: { id: true, source: true, type: true, title: true, politicianId: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Mandat non trouvé" }, { status: 404 });
    }

    await db.mandate.delete({ where: { id } });

    await db.auditLog.create({
      data: {
        action: "DELETE",
        entityType: "Mandate",
        entityId: id,
        changes: {
          type: existing.type,
          title: existing.title,
          source: existing.source,
          politicianId: existing.politicianId,
        },
      },
    });

    invalidateEntity("mandate");
    const pol = await db.politician.findUnique({
      where: { id: existing.politicianId },
      select: { slug: true },
    });
    if (pol) invalidateEntity("politician", pol.slug);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting mandate:", error);
    return NextResponse.json({ error: "Erreur lors de la suppression" }, { status: 500 });
  }
}
