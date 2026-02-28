import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

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
}
