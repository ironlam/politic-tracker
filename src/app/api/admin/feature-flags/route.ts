import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAuthenticated } from "@/lib/auth";
import { revalidateTags } from "@/lib/cache";

export async function GET() {
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const flags = await db.featureFlag.findMany({
    orderBy: { name: "asc" },
  });

  return NextResponse.json(flags);
}

export async function POST(request: NextRequest) {
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const data = await request.json();
  if (!data.name || !data.label) {
    return NextResponse.json({ error: "name et label requis" }, { status: 400 });
  }

  const flag = await db.featureFlag.create({ data });
  revalidateTags(["feature-flags"]);

  return NextResponse.json(flag, { status: 201 });
}
