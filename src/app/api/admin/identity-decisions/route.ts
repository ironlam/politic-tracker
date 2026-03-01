import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAdminAuth } from "@/lib/api/with-admin-auth";
import { parsePagination } from "@/lib/api/pagination";
import { Judgement } from "@/generated/prisma";

export const GET = withAdminAuth(async (request) => {
  const url = new URL(request.url);
  const { page, limit, skip } = parsePagination(url.searchParams);
  const judgement = url.searchParams.get("judgement") as Judgement | null;

  const where = {
    supersededBy: null, // Only active decisions
    ...(judgement && Object.values(Judgement).includes(judgement) ? { judgement } : {}),
  };

  const [decisions, total] = await Promise.all([
    db.identityDecision.findMany({
      where,
      include: {
        politician: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            slug: true,
            publicId: true,
          },
        },
      },
      orderBy: { decidedAt: "desc" },
      skip,
      take: limit,
    }),
    db.identityDecision.count({ where }),
  ]);

  return NextResponse.json({
    data: decisions,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});
