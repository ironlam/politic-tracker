import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAuthenticated } from "@/lib/auth";
import { PoliticalPosition } from "@/generated/prisma";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const { id } = await params;

    const party = await db.party.findUnique({
      where: { id },
      include: {
        predecessor: {
          select: { id: true, name: true, shortName: true },
        },
      },
    });

    if (!party) {
      return NextResponse.json({ error: "Parti non trouvé" }, { status: 404 });
    }

    return NextResponse.json(party);
  } catch (error) {
    console.error("Error fetching party:", error);
    return NextResponse.json({ error: "Erreur lors de la récupération du parti" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    // Validate required fields
    if (!body.name || !body.shortName || !body.slug) {
      return NextResponse.json({ error: "Nom, abréviation et slug sont requis" }, { status: 400 });
    }

    // Check if slug is unique (excluding current party)
    const existingSlug = await db.party.findFirst({
      where: {
        slug: body.slug,
        NOT: { id },
      },
    });

    if (existingSlug) {
      return NextResponse.json(
        { error: "Ce slug est déjà utilisé par un autre parti" },
        { status: 400 }
      );
    }

    // Check if shortName is unique (excluding current party)
    const existingShortName = await db.party.findFirst({
      where: {
        shortName: body.shortName,
        NOT: { id },
      },
    });

    if (existingShortName) {
      return NextResponse.json(
        { error: "Cette abréviation est déjà utilisée par un autre parti" },
        { status: 400 }
      );
    }

    // Validate political position if provided
    const validPositions = Object.values(PoliticalPosition);
    if (body.politicalPosition && !validPositions.includes(body.politicalPosition)) {
      return NextResponse.json({ error: "Position politique invalide" }, { status: 400 });
    }

    // Prevent circular predecessor references
    if (body.predecessorId) {
      // Check if the predecessor would create a cycle
      let currentId = body.predecessorId;
      const visited = new Set<string>([id]);

      while (currentId) {
        if (visited.has(currentId)) {
          return NextResponse.json(
            { error: "Référence circulaire détectée dans la chaîne des prédécesseurs" },
            { status: 400 }
          );
        }
        visited.add(currentId);

        const predecessor = await db.party.findUnique({
          where: { id: currentId },
          select: { predecessorId: true },
        });

        currentId = predecessor?.predecessorId || null;
      }
    }

    const updatedParty = await db.party.update({
      where: { id },
      data: {
        slug: body.slug,
        name: body.name,
        shortName: body.shortName,
        description: body.description || null,
        color: body.color || null,
        foundedDate: body.foundedDate ? new Date(body.foundedDate) : null,
        dissolvedDate: body.dissolvedDate ? new Date(body.dissolvedDate) : null,
        politicalPosition: body.politicalPosition || null,
        ideology: body.ideology || null,
        headquarters: body.headquarters || null,
        website: body.website || null,
        predecessorId: body.predecessorId || null,
      },
    });

    await db.auditLog.create({
      data: {
        action: "UPDATE",
        entityType: "Party",
        entityId: id,
        changes: { name: updatedParty.name, shortName: updatedParty.shortName },
      },
    });

    return NextResponse.json(updatedParty);
  } catch (error) {
    console.error("Error updating party:", error);
    return NextResponse.json({ error: "Erreur lors de la mise à jour du parti" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const { id } = await params;

    // Check if party has any references
    const party = await db.party.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            politicians: true,
            partyMemberships: true,
            affairsAtTime: true,
            pressMentions: true,
          },
        },
      },
    });

    if (!party) {
      return NextResponse.json({ error: "Parti non trouvé" }, { status: 404 });
    }

    if (party._count.politicians > 0) {
      return NextResponse.json(
        {
          error: `Ce parti a ${party._count.politicians} membres actuels. Supprimez d'abord les liens.`,
        },
        { status: 400 }
      );
    }

    if (party._count.partyMemberships > 0) {
      return NextResponse.json(
        {
          error: `Ce parti a ${party._count.partyMemberships} adhésions historiques. Supprimez d'abord l'historique.`,
        },
        { status: 400 }
      );
    }

    if (party._count.affairsAtTime > 0) {
      return NextResponse.json(
        {
          error: `Ce parti est référencé dans ${party._count.affairsAtTime} affaires judiciaires. Supprimez d'abord les références.`,
        },
        { status: 400 }
      );
    }

    if (party._count.pressMentions > 0) {
      return NextResponse.json(
        {
          error: `Ce parti est mentionné dans ${party._count.pressMentions} articles de presse. Supprimez d'abord les mentions.`,
        },
        { status: 400 }
      );
    }

    // Delete associated external IDs first, then the party
    await db.externalId.deleteMany({ where: { partyId: id } });
    await db.party.delete({ where: { id } });

    await db.auditLog.create({
      data: {
        action: "DELETE",
        entityType: "Party",
        entityId: id,
        changes: { name: party.name, shortName: party.shortName },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting party:", error);
    return NextResponse.json({ error: "Erreur lors de la suppression du parti" }, { status: 500 });
  }
}
