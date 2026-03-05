import { NextRequest, NextResponse } from "next/server";
import type { z } from "zod/v4";

interface RouteContext {
  params: Promise<Record<string, string>>;
}

type ValidatedHandler<T> = (
  request: NextRequest,
  context: RouteContext,
  body: T
) => Promise<NextResponse>;

/**
 * Zod validation HOF for API routes.
 * Composable with withAdminAuth: `withAdminAuth(withValidation(schema, handler))`
 *
 * - Parses request body with schema
 * - Strips unknown fields (default Zod behavior)
 * - Returns 400 with sanitized error issues on failure
 * - Returns 400 on malformed JSON
 */
export function withValidation<T extends z.ZodType>(
  schema: T,
  handler: ValidatedHandler<z.infer<T>>
) {
  return async (request: NextRequest, context: RouteContext): Promise<NextResponse> => {
    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const result = schema.safeParse(raw);
    if (!result.success) {
      return NextResponse.json(
        {
          error: "Validation error",
          issues: result.error.issues.map((i) => ({
            path: i.path,
            message: i.message,
          })),
        },
        { status: 400 }
      );
    }

    return handler(request, context, result.data);
  };
}
