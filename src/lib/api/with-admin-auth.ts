import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";

type RouteContext = { params: Promise<Record<string, string>> };

type RouteHandler = (
  request: NextRequest,
  context: RouteContext
) => Promise<NextResponse>;

/**
 * HOF wrapper for admin API routes.
 * Checks authentication and catches unhandled errors.
 */
export function withAdminAuth(handler: RouteHandler): RouteHandler {
  return async (request, context) => {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
    try {
      return await handler(request, context);
    } catch (error) {
      console.error(`[API Error] ${request.method} ${request.url}:`, error);
      return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
    }
  };
}
