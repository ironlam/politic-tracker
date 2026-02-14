import { NextRequest, NextResponse } from "next/server";
import { revalidateAll, revalidateTags } from "@/lib/cache";

/**
 * POST /api/cron/revalidate
 *
 * Invalidate Next.js cache after sync operations.
 * Protected by CRON_SECRET (same as other cron endpoints).
 *
 * Body: { tags: ["votes", "politicians"] } or { all: true }
 */
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;

  // Verify authorization
  const authHeader = request.headers.get("authorization");
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  try {
    const body = await request.json();

    if (body.all) {
      revalidateAll();
      return NextResponse.json({ revalidated: "all" });
    }

    if (Array.isArray(body.tags) && body.tags.length > 0) {
      const tags = body.tags.filter((t: unknown) => typeof t === "string");
      revalidateTags(tags);
      return NextResponse.json({ revalidated: tags });
    }

    return NextResponse.json(
      { error: "Body must contain { all: true } or { tags: string[] }" },
      { status: 400 }
    );
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
}
