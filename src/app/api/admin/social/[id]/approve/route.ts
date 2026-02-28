import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { postToBothPlatforms } from "@/lib/social/post";
import { isAutoPostEnabled } from "@/lib/social/config";

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

  if (!isAutoPostEnabled()) {
    return NextResponse.json(
      { error: "Auto-post is disabled (SOCIAL_AUTO_POST=false)" },
      { status: 400 }
    );
  }

  const result = await postToBothPlatforms(post.content, post.link || undefined);
  const status = result.blueskyUrl || result.twitterUrl ? "POSTED" : "FAILED";
  const error = [result.blueskyError, result.twitterError].filter(Boolean).join("; ");

  const updated = await db.socialPost.update({
    where: { id },
    data: {
      status,
      blueskyUrl: result.blueskyUrl,
      twitterUrl: result.twitterUrl,
      error: error || null,
      postedAt: status === "POSTED" ? new Date() : null,
    },
  });

  return NextResponse.json({ post: updated });
}
