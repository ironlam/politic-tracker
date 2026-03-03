import { NextRequest, NextResponse } from "next/server";

type RouteContext = { params: Promise<Record<string, string>> };

type RouteHandler = (request: NextRequest, context: RouteContext) => Promise<Response>;

/**
 * HOF wrapper for public API routes.
 * Catches unhandled errors and returns a consistent 500 response.
 */
export function withPublicRoute(handler: RouteHandler): RouteHandler {
  return async (request: NextRequest, context: RouteContext) => {
    try {
      return await handler(request, context);
    } catch (error) {
      console.error(`[API Error] ${request.method} ${request.url}:`, error);
      return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
    }
  };
}
