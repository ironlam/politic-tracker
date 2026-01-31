import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAuthenticated } from "@/lib/auth";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/admin/dossiers/[id] - Get dossier details
export async function GET(request: NextRequest, { params }: RouteParams) {
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const dossier = await db.legislativeDossier.findUnique({
      where: { id },
      include: {
        amendments: {
          orderBy: { number: "asc" },
        },
      },
    });

    if (!dossier) {
      return NextResponse.json({ error: "Dossier non trouvé" }, { status: 404 });
    }

    return NextResponse.json(dossier);
  } catch (error) {
    console.error("Error fetching dossier:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération du dossier" },
      { status: 500 }
    );
  }
}

// PUT /api/admin/dossiers/[id] - Update dossier
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const { summary, shortTitle, category, status } = body;

    // Check dossier exists
    const existing = await db.legislativeDossier.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Dossier non trouvé" }, { status: 404 });
    }

    // Build update data
    const updateData: Record<string, unknown> = {};

    if (summary !== undefined) {
      updateData.summary = summary;
      updateData.summaryDate = new Date();
    }

    if (shortTitle !== undefined) {
      updateData.shortTitle = shortTitle;
    }

    if (category !== undefined) {
      updateData.category = category;
    }

    if (status !== undefined) {
      updateData.status = status;
    }

    const updated = await db.legislativeDossier.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating dossier:", error);
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour du dossier" },
      { status: 500 }
    );
  }
}
