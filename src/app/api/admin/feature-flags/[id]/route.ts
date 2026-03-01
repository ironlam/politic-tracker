import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAdminAuth } from "@/lib/api/with-admin-auth";
import { revalidateTags } from "@/lib/cache";
import { revalidatePath } from "next/cache";

export const PUT = withAdminAuth(async (request, context) => {
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
});

export const DELETE = withAdminAuth(async (_request, context) => {
  const { id } = await context.params;
  await db.featureFlag.delete({ where: { id } });
  revalidateTags(["feature-flags"]);
  revalidatePath("/", "layout");

  return NextResponse.json({ success: true });
});
