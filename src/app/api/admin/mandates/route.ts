import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAuthenticated } from "@/lib/auth";

/**
 * POST /api/admin/mandates
 * Create a party leadership mandate (PRESIDENT_PARTI)
 */
export async function POST(request: NextRequest) {
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  try {
    const data = await request.json();
    const { politicianId, partyId, title, startDate, endDate, sourceUrl, officialUrl } = data;

    if (!politicianId || !partyId || !title || !startDate) {
      return NextResponse.json(
        { error: "politicianId, partyId, title et startDate sont requis" },
        { status: 400 }
      );
    }

    // Validate politician exists
    const politician = await db.politician.findUnique({
      where: { id: politicianId },
      select: { id: true, fullName: true },
    });
    if (!politician) {
      return NextResponse.json({ error: "Politicien non trouvé" }, { status: 404 });
    }

    // Validate party exists
    const party = await db.party.findUnique({
      where: { id: partyId },
      select: { id: true, name: true },
    });
    if (!party) {
      return NextResponse.json({ error: "Parti non trouvé" }, { status: 404 });
    }

    const isCurrent = !endDate;

    // If this is a current mandate, close previous current leadership mandates for this party
    if (isCurrent) {
      await db.mandate.updateMany({
        where: {
          type: "PRESIDENT_PARTI",
          partyId,
          isCurrent: true,
        },
        data: {
          isCurrent: false,
          endDate: new Date(startDate),
        },
      });
    }

    const mandate = await db.mandate.create({
      data: {
        politicianId,
        partyId,
        type: "PRESIDENT_PARTI",
        title,
        institution: party.name,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        isCurrent,
        source: "MANUAL",
        sourceUrl: sourceUrl || null,
        officialUrl: officialUrl || null,
      },
      include: {
        politician: { select: { id: true, fullName: true, slug: true } },
        party: { select: { id: true, name: true, shortName: true } },
      },
    });

    await db.auditLog.create({
      data: {
        action: "CREATE",
        entityType: "Mandate",
        entityId: mandate.id,
        changes: {
          type: "PRESIDENT_PARTI",
          politicianId,
          partyId,
          title,
          startDate,
          endDate: endDate || null,
          source: "MANUAL",
        },
      },
    });

    return NextResponse.json(mandate, { status: 201 });
  } catch (error) {
    console.error("Error creating leadership mandate:", error);
    return NextResponse.json({ error: "Erreur lors de la création" }, { status: 500 });
  }
}

/**
 * GET /api/admin/mandates?partyId=...&type=PRESIDENT_PARTI
 * List mandates with optional filters
 */
export async function GET(request: NextRequest) {
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const partyId = searchParams.get("partyId");
    const type = searchParams.get("type");

    const mandates = await db.mandate.findMany({
      where: {
        ...(partyId && { partyId }),
        ...(type && { type: type as "PRESIDENT_PARTI" }),
      },
      include: {
        politician: { select: { id: true, fullName: true, slug: true, photoUrl: true } },
        party: { select: { id: true, name: true, shortName: true } },
      },
      orderBy: [{ isCurrent: "desc" }, { startDate: "desc" }],
    });

    return NextResponse.json(mandates);
  } catch (error) {
    console.error("Error fetching mandates:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
