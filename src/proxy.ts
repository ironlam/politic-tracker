import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const vercelEnv = process.env.VERCEL_ENV;

  // Protect non-production environments (preview, staging) with Basic Auth
  if (vercelEnv && vercelEnv !== "production") {
    // Allow API routes (for MCP, webhooks, etc.)
    if (!request.nextUrl.pathname.startsWith("/api/")) {
      const auth = request.headers.get("authorization");

      if (auth) {
        const [scheme, encoded] = auth.split(" ");
        if (scheme === "Basic" && encoded) {
          const decoded = atob(encoded);
          const [, password] = decoded.split(":");
          if (password !== process.env.ADMIN_PASSWORD) {
            return new NextResponse("Accès restreint — staging", {
              status: 401,
              headers: { "WWW-Authenticate": 'Basic realm="Staging"' },
            });
          }
          // Auth OK, continue to admin check below
        }
      } else {
        return new NextResponse("Accès restreint — staging", {
          status: 401,
          headers: { "WWW-Authenticate": 'Basic realm="Staging"' },
        });
      }
    }
  }

  // Protect admin API routes (except auth endpoint)
  if (
    request.nextUrl.pathname.startsWith("/api/admin") &&
    !request.nextUrl.pathname.startsWith("/api/admin/auth")
  ) {
    const session = request.cookies.get("admin_session");
    if (!session?.value) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
  }

  // Protect admin pages - check session cookie
  if (
    request.nextUrl.pathname.startsWith("/admin") &&
    !request.nextUrl.pathname.startsWith("/admin/login")
  ) {
    const session = request.cookies.get("admin_session");
    if (!session?.value) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logo.png).*)"],
};
