import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAdminAuth } from "@/lib/api/with-admin-auth";
import { revalidateTags } from "@/lib/cache";

export const GET = withAdminAuth(async () => {
  const flags = await db.featureFlag.findMany({
    orderBy: { name: "asc" },
  });

  return NextResponse.json(flags);
});

export const POST = withAdminAuth(async (request) => {
  const data = await request.json();
  if (!data.name || !data.label) {
    return NextResponse.json({ error: "name et label requis" }, { status: 400 });
  }

  const flag = await db.featureFlag.create({ data });
  revalidateTags(["feature-flags"]);

  return NextResponse.json(flag, { status: 201 });
});
