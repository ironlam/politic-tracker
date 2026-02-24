import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const politician = await db.politician.findUnique({
    where: { id },
    select: { photoUrl: true, blobPhotoUrl: true },
  });

  if (!politician?.photoUrl) {
    return new NextResponse(null, { status: 404 });
  }

  // Cache hit — redirect to Blob CDN
  if (politician.blobPhotoUrl) {
    return NextResponse.redirect(politician.blobPhotoUrl, {
      status: 302,
      headers: {
        "Cache-Control": "public, max-age=86400, s-maxage=2592000",
      },
    });
  }

  // Cache miss — download from source, upload to Blob
  try {
    const sourceResponse = await fetch(politician.photoUrl, {
      signal: AbortSignal.timeout(10000),
    });

    if (!sourceResponse.ok || !sourceResponse.body) {
      return new NextResponse(null, { status: 404 });
    }

    const contentType = sourceResponse.headers.get("content-type") || "image/jpeg";

    const blob = await put(`politicians/${id}`, sourceResponse.body, {
      access: "public",
      contentType,
    });

    // Save Blob URL to DB
    await db.politician.update({
      where: { id },
      data: { blobPhotoUrl: blob.url },
    });

    return NextResponse.redirect(blob.url, {
      status: 302,
      headers: {
        "Cache-Control": "public, max-age=86400, s-maxage=2592000",
      },
    });
  } catch {
    // Source download failed — fall back to source URL directly
    return NextResponse.redirect(politician.photoUrl, {
      status: 302,
      headers: {
        "Cache-Control": "public, max-age=3600",
      },
    });
  }
}
