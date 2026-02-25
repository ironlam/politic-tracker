import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { db } from "@/lib/db";
import { ALL_TAGS, revalidateAll, revalidateTags } from "@/lib/cache";
import type { CacheTag } from "@/lib/cache";

/**
 * POST /api/admin/cache/revalidate
 *
 * Invalidate Next.js cache from the admin UI.
 * Body: { all: true } or { tags: CacheTag[] }
 */
export async function POST(request: NextRequest) {
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  let body: { all?: boolean; tags?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (body.all) {
    revalidateAll();

    await db.auditLog.create({
      data: {
        action: "INVALIDATE",
        entityType: "Cache",
        entityId: "all",
        changes: { scope: "all" },
      },
    });

    return NextResponse.json({ revalidated: "all" });
  }

  if (Array.isArray(body.tags) && body.tags.length > 0) {
    const validTags = body.tags.filter((t): t is CacheTag =>
      (ALL_TAGS as readonly string[]).includes(t)
    );

    if (validTags.length === 0) {
      return NextResponse.json({ error: "Aucun tag valide fourni" }, { status: 400 });
    }

    revalidateTags(validTags);

    await db.auditLog.create({
      data: {
        action: "INVALIDATE",
        entityType: "Cache",
        entityId: validTags.join(","),
        changes: { scope: "selective", tags: validTags },
      },
    });

    return NextResponse.json({ revalidated: validTags });
  }

  return NextResponse.json(
    { error: "Body must contain { all: true } or { tags: string[] }" },
    { status: 400 }
  );
}
