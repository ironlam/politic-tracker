import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAuthenticated } from "@/lib/auth";
import { invalidateEntity } from "@/lib/cache";
import type { PartyRole } from "@/generated/prisma";

interface RouteContext {
  params: Promise<{ id: string; membershipId: string }>;
}

const VALID_ROLES: PartyRole[] = [
  "MEMBER",
  "FOUNDER",
  "SPOKESPERSON",
  "COORDINATOR",
  "HONORARY_PRESIDENT",
  "SECRETARY_GENERAL",
];

export async function PATCH(request: NextRequest, context: RouteContext) {
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { id, membershipId } = await context.params;

  try {
    const body = await request.json();

    const membership = await db.partyMembership.findUnique({
      where: { id: membershipId },
      select: { id: true, politicianId: true },
    });

    if (!membership || membership.politicianId !== id) {
      return NextResponse.json({ error: "Membership non trouvé" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};

    if (body.startDate !== undefined) {
      updateData.startDate = body.startDate ? new Date(body.startDate) : null;
    }

    if (body.endDate !== undefined) {
      updateData.endDate = body.endDate ? new Date(body.endDate) : null;
    }

    if (body.role !== undefined) {
      if (!VALID_ROLES.includes(body.role)) {
        return NextResponse.json({ error: "Rôle invalide" }, { status: 400 });
      }
      updateData.role = body.role;
    }

    // Validate dates
    if (updateData.startDate && updateData.endDate) {
      if (new Date(updateData.startDate as string) >= new Date(updateData.endDate as string)) {
        return NextResponse.json(
          { error: "La date de début doit être avant la date de fin" },
          { status: 400 }
        );
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "Aucun champ à mettre à jour" }, { status: 400 });
    }

    const updated = await db.partyMembership.update({
      where: { id: membershipId },
      data: updateData,
    });

    const politician = await db.politician.findUnique({
      where: { id },
      select: { slug: true },
    });

    await db.auditLog.create({
      data: {
        action: "UPDATE",
        entityType: "PartyMembership",
        entityId: membershipId,
        changes: updateData,
      },
    });

    if (politician) {
      invalidateEntity("politician", politician.slug);
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating party membership:", error);
    return NextResponse.json({ error: "Erreur lors de la mise à jour" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { id, membershipId } = await context.params;

  try {
    const membership = await db.partyMembership.findUnique({
      where: { id: membershipId },
      select: {
        id: true,
        politicianId: true,
        endDate: true,
        partyId: true,
      },
    });

    if (!membership || membership.politicianId !== id) {
      return NextResponse.json({ error: "Membership non trouvé" }, { status: 404 });
    }

    await db.partyMembership.delete({
      where: { id: membershipId },
    });

    // If deleting the current membership (no end date), clear currentPartyId
    if (!membership.endDate) {
      const politician = await db.politician.findUnique({
        where: { id },
        select: { currentPartyId: true },
      });

      if (politician?.currentPartyId === membership.partyId) {
        await db.politician.update({
          where: { id },
          data: { currentPartyId: null },
        });
      }
    }

    const politicianForSlug = await db.politician.findUnique({
      where: { id },
      select: { slug: true },
    });

    await db.auditLog.create({
      data: {
        action: "DELETE",
        entityType: "PartyMembership",
        entityId: membershipId,
        changes: { partyId: membership.partyId },
      },
    });

    if (politicianForSlug) {
      invalidateEntity("politician", politicianForSlug.slug);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting party membership:", error);
    return NextResponse.json({ error: "Erreur lors de la suppression" }, { status: 500 });
  }
}
