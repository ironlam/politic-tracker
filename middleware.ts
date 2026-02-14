import { NextRequest, NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// ─── Rate limit tiers ────────────────────────────────────────────

type RateLimitTier = "general" | "search" | "export";

const TIER_CONFIG: Record<RateLimitTier, { tokens: number; window: string }> = {
  general: { tokens: 60, window: "1m" },
  search: { tokens: 30, window: "1m" },
  export: { tokens: 5, window: "1m" },
};

// ─── Lazy-init rate limiters ─────────────────────────────────────

let redis: Redis | null = null;
const limiters = new Map<RateLimitTier, Ratelimit>();

function getRedis(): Redis | null {
  if (redis) return redis;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) return null;

  redis = new Redis({ url, token });
  return redis;
}

function getLimiter(tier: RateLimitTier): Ratelimit | null {
  if (limiters.has(tier)) return limiters.get(tier)!;

  const client = getRedis();
  if (!client) return null;

  const config = TIER_CONFIG[tier];
  const limiter = new Ratelimit({
    redis: client,
    limiter: Ratelimit.slidingWindow(config.tokens, config.window as `${number}${"s" | "m" | "h"}`),
    prefix: `rl:${tier}`,
  });

  limiters.set(tier, limiter);
  return limiter;
}

// ─── Route → tier mapping ────────────────────────────────────────

function getTier(pathname: string): RateLimitTier | null {
  // Excluded routes — handled by their own rate limiting or internal
  if (pathname.startsWith("/api/chat")) return null;
  if (pathname.startsWith("/api/admin")) return null;
  if (pathname.startsWith("/api/cron")) return null;

  if (pathname.startsWith("/api/export")) return "export";
  if (pathname.startsWith("/api/search")) return "search";
  if (pathname.startsWith("/api/")) return "general";

  return null;
}

// ─── Client IP extraction ────────────────────────────────────────

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    "127.0.0.1"
  );
}

// ─── Middleware ───────────────────────────────────────────────────

export async function middleware(request: NextRequest) {
  const tier = getTier(request.nextUrl.pathname);
  if (!tier) return NextResponse.next();

  const limiter = getLimiter(tier);
  if (!limiter) {
    // Upstash not configured — allow through
    return NextResponse.next();
  }

  const ip = getClientIp(request);
  const { success, limit, remaining, reset } = await limiter.limit(ip);

  if (!success) {
    const retryAfter = Math.ceil((reset - Date.now()) / 1000);
    return NextResponse.json(
      { error: "Trop de requêtes. Réessayez plus tard." },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfter),
          "X-RateLimit-Limit": String(limit),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(reset),
        },
      }
    );
  }

  const response = NextResponse.next();
  response.headers.set("X-RateLimit-Limit", String(limit));
  response.headers.set("X-RateLimit-Remaining", String(remaining));
  response.headers.set("X-RateLimit-Reset", String(reset));
  return response;
}

export const config = {
  matcher: "/api/:path*",
};
