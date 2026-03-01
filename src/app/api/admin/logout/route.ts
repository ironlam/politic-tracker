import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth";
import { withAdminAuth } from "@/lib/api/with-admin-auth";

export const POST = withAdminAuth(async () => {
  await destroySession();
  return NextResponse.redirect(
    new URL("/admin/login", process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000")
  );
});
