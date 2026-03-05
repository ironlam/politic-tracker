import { NextRequest } from "next/server";

export interface RequestMeta {
  ip: string;
  userAgent: string;
}

/**
 * Extract security-relevant metadata from a request.
 * Use in audit logs to track who performed admin operations.
 */
export function getRequestMeta(request: NextRequest): RequestMeta {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";

  const userAgent = request.headers.get("user-agent") || "unknown";

  return { ip, userAgent };
}
