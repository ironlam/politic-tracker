import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAuthenticated } from "@/lib/auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  try {
    const post = await db.socialPost.findUnique({ where: { id } });
    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }
    if (post.status !== "PENDING_REVIEW") {
      return NextResponse.json({ error: `Post is already ${post.status}` }, { status: 400 });
    }

    const updated = await db.socialPost.update({
      where: { id },
      data: { status: "REJECTED" },
    });

    return NextResponse.json({ post: updated });
  } catch (error) {
    console.error("Error rejecting social post:", error);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
