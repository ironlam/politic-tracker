import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAuthenticated } from "@/lib/auth";
import { revalidateTags } from "@/lib/cache";
import { revalidatePath } from "next/cache";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { id } = await context.params;
  const data = await request.json();

  const flag = await db.featureFlag.update({
    where: { id },
    data: {
      ...(data.label !== undefined && { label: data.label }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.enabled !== undefined && { enabled: data.enabled }),
      ...(data.value !== undefined && { value: data.value }),
      ...(data.startDate !== undefined && {
        startDate: data.startDate ? new Date(data.startDate) : null,
      }),
      ...(data.endDate !== undefined && {
        endDate: data.endDate ? new Date(data.endDate) : null,
      }),
    },
  });

  revalidateTags(["feature-flags"]);
  revalidatePath("/", "layout");
  return NextResponse.json(flag);
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { id } = await context.params;
  await db.featureFlag.delete({ where: { id } });
  revalidateTags(["feature-flags"]);
  revalidatePath("/", "layout");

  return NextResponse.json({ success: true });
}
