import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAuthenticated } from "@/lib/auth";
import { generateSlug } from "@/lib/utils";
import { invalidateEntity } from "@/lib/cache";
import type { DataSource } from "@/generated/prisma";

interface ExternalIdInput {
  id?: string;
  source: DataSource;
  externalId: string;
  url?: string;
}

interface PoliticianInput {
  id: string;
  slug: string;
  civility: string | null;
  firstName: string;
  lastName: string;
  fullName?: string;
  birthDate: string | null;
  birthPlace: string | null;
  photoUrl: string | null;
  photoSource: string | null;
  currentPartyId: string | null;
  externalIds: ExternalIdInput[];
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

  const politician = await db.politician.findUnique({
    where: { id },
    include: {
      currentParty: true,
      externalIds: true,
      mandates: { where: { isCurrent: true } },
    },
  });

  if (!politician) {
    return NextResponse.json({ error: "Politique non trouvé" }, { status: 404 });
  }

  return NextResponse.json(politician);
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const data: PoliticianInput = await request.json();

    // Check politician exists
    const existing = await db.politician.findUnique({
      where: { id },
      include: { externalIds: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Politique non trouvé" }, { status: 404 });
    }

    // Validation
    if (!data.firstName?.trim() || !data.lastName?.trim()) {
      return NextResponse.json({ error: "Prénom et nom sont requis" }, { status: 400 });
    }

    // Generate fullName and slug if needed
    const fullName = `${data.firstName.trim()} ${data.lastName.trim()}`;
    const slug = data.slug?.trim() || generateSlug(fullName);

    // Check slug uniqueness (if changed)
    if (slug !== existing.slug) {
      const slugExists = await db.politician.findUnique({
        where: { slug },
        select: { id: true },
      });
      if (slugExists) {
        return NextResponse.json(
          { error: "Ce slug est déjà utilisé par un autre politique" },
          { status: 400 }
        );
      }
    }

    // Update politician
    const politician = await db.politician.update({
      where: { id },
      data: {
        slug,
        civility: data.civility || null,
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        fullName,
        birthDate: data.birthDate ? new Date(data.birthDate) : null,
        birthPlace: data.birthPlace || null,
        photoUrl: data.photoUrl || null,
        photoSource: data.photoSource || null,
        currentPartyId: data.currentPartyId || null,
      },
    });

    // Handle external IDs
    // Strategy: delete removed ones, update existing, create new ones
    const existingIds = existing.externalIds.map((e) => e.id);
    const newIds = data.externalIds.filter((e) => e.id).map((e) => e.id!);

    // Delete removed IDs
    const toDelete = existingIds.filter((eid) => !newIds.includes(eid));
    if (toDelete.length > 0) {
      await db.externalId.deleteMany({
        where: { id: { in: toDelete } },
      });
    }

    // Upsert each external ID
    for (const extId of data.externalIds) {
      if (!extId.externalId?.trim()) continue;

      if (extId.id) {
        // Update existing
        await db.externalId.update({
          where: { id: extId.id },
          data: {
            source: extId.source,
            externalId: extId.externalId.trim(),
            url: extId.url || null,
          },
        });
      } else {
        // Create new - check for duplicates first
        const exists = await db.externalId.findUnique({
          where: {
            source_externalId: {
              source: extId.source,
              externalId: extId.externalId.trim(),
            },
          },
        });

        if (exists) {
          // Update the existing record to point to this politician
          await db.externalId.update({
            where: { id: exists.id },
            data: {
              politicianId: id,
              url: extId.url || null,
            },
          });
        } else {
          // Create new
          await db.externalId.create({
            data: {
              politicianId: id,
              source: extId.source,
              externalId: extId.externalId.trim(),
              url: extId.url || null,
            },
          });
        }
      }
    }

    // Log action
    await db.auditLog.create({
      data: {
        action: "UPDATE",
        entityType: "Politician",
        entityId: politician.id,
        changes: {
          fullName: politician.fullName,
          photoUrl: politician.photoUrl,
          externalIdsCount: data.externalIds.length,
        },
      },
    });

    invalidateEntity("politician", politician.slug);

    return NextResponse.json(politician);
  } catch (error) {
    console.error("Error updating politician:", error);
    return NextResponse.json({ error: "Erreur lors de la mise à jour" }, { status: 500 });
  }
}
