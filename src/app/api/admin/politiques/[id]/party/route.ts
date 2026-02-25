import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAuthenticated } from "@/lib/auth";
import { invalidateEntity } from "@/lib/cache";
import { setCurrentParty, removeParty } from "@/services/politician";
import type { PartyRole } from "@/generated/prisma";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const VALID_ROLES: PartyRole[] = [
  "MEMBER",
  "FOUNDER",
  "SPOKESPERSON",
  "COORDINATOR",
  "HONORARY_PRESIDENT",
  "SECRETARY_GENERAL",
];

export async function POST(request: NextRequest, context: RouteContext) {
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const body = await request.json();

    if (!body.partyId) {
      return NextResponse.json({ error: "partyId est requis" }, { status: 400 });
    }

    const politician = await db.politician.findUnique({
      where: { id },
      select: { id: true, slug: true },
    });

    if (!politician) {
      return NextResponse.json({ error: "Politicien non trouvé" }, { status: 404 });
    }

    // Validate role if provided
    if (body.role && !VALID_ROLES.includes(body.role)) {
      return NextResponse.json({ error: "Rôle invalide" }, { status: 400 });
    }

    await setCurrentParty(id, body.partyId, {
      startDate: body.startDate ? new Date(body.startDate) : new Date(),
      role: body.role || undefined,
    });

    await db.auditLog.create({
      data: {
        action: "UPDATE",
        entityType: "Politician",
        entityId: id,
        changes: { partyChanged: body.partyId, startDate: body.startDate },
      },
    });

    invalidateEntity("politician", politician.slug);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error setting party:", error);
    return NextResponse.json({ error: "Erreur lors de la mise à jour du parti" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const politician = await db.politician.findUnique({
      where: { id },
      select: { id: true, slug: true, currentPartyId: true },
    });

    if (!politician) {
      return NextResponse.json({ error: "Politicien non trouvé" }, { status: 404 });
    }

    if (!politician.currentPartyId) {
      return NextResponse.json({ error: "Aucun parti actuel" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const endDate = body.endDate ? new Date(body.endDate) : new Date();

    await removeParty(id, endDate);

    await db.auditLog.create({
      data: {
        action: "UPDATE",
        entityType: "Politician",
        entityId: id,
        changes: {
          partyRemoved: politician.currentPartyId,
          endDate: endDate.toISOString(),
        },
      },
    });

    invalidateEntity("politician", politician.slug);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing party:", error);
    return NextResponse.json({ error: "Erreur lors du retrait du parti" }, { status: 500 });
  }
}
