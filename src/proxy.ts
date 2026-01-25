import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  // Protect admin routes - check session cookie
  const session = request.cookies.get("admin_session");

  if (!session?.value) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Match all admin routes EXCEPT /admin/login
  matcher: [
    "/admin",
    "/admin/((?!login).*)",
  ],
};
