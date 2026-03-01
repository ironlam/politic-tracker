import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAdminAuth } from "@/lib/api/with-admin-auth";
import { invalidateEntity } from "@/lib/cache";

// GET /api/admin/dossiers/[id] - Get dossier details
export const GET = withAdminAuth(async (_request: NextRequest, context) => {
  const { id } = await context.params;

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
});

// PUT /api/admin/dossiers/[id] - Update dossier
export const PUT = withAdminAuth(async (request: NextRequest, context) => {
  const { id } = await context.params;

  const body = await request.json();
  const { summary, shortTitle, category, status, theme } = body;

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

  if (theme !== undefined) {
    updateData.theme = theme;
  }

  const updated = await db.legislativeDossier.update({
    where: { id },
    data: updateData,
  });

  invalidateEntity("dossier");

  return NextResponse.json(updated);
});
