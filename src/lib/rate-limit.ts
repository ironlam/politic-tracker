/**
 * Simple in-memory rate limiter for authentication endpoints
 *
 * Note: This works for single-instance deployments (Vercel serverless).
 * For multi-instance, use Redis or Vercel KV.
 */

interface RateLimitEntry {
  count: number;
  firstAttempt: number;
  blockedUntil?: number;
}

// In-memory store (reset on serverless cold start, which is acceptable for auth)
const attempts = new Map<string, RateLimitEntry>();

// Configuration
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const BLOCK_DURATION_MS = 30 * 60 * 1000; // 30 minutes block after max attempts

/**
 * Check if an IP is rate limited
 * @returns Object with limited status and retry info
 */
export function checkRateLimit(ip: string): {
  limited: boolean;
  remaining: number;
  retryAfter?: number;
} {
  const now = Date.now();
  const entry = attempts.get(ip);

  // No previous attempts
  if (!entry) {
    return { limited: false, remaining: MAX_ATTEMPTS };
  }

  // Currently blocked
  if (entry.blockedUntil && now < entry.blockedUntil) {
    const retryAfter = Math.ceil((entry.blockedUntil - now) / 1000);
    return { limited: true, remaining: 0, retryAfter };
  }

  // Block expired, reset
  if (entry.blockedUntil && now >= entry.blockedUntil) {
    attempts.delete(ip);
    return { limited: false, remaining: MAX_ATTEMPTS };
  }

  // Window expired, reset
  if (now - entry.firstAttempt > WINDOW_MS) {
    attempts.delete(ip);
    return { limited: false, remaining: MAX_ATTEMPTS };
  }

  // Within window, check count
  const remaining = MAX_ATTEMPTS - entry.count;
  return { limited: remaining <= 0, remaining: Math.max(0, remaining) };
}

/**
 * Record a failed login attempt
 */
export function recordFailedAttempt(ip: string): void {
  const now = Date.now();
  const entry = attempts.get(ip);

  if (!entry || now - entry.firstAttempt > WINDOW_MS) {
    // New window
    attempts.set(ip, { count: 1, firstAttempt: now });
  } else {
    // Increment in current window
    entry.count++;

    // Block if max attempts reached
    if (entry.count >= MAX_ATTEMPTS) {
      entry.blockedUntil = now + BLOCK_DURATION_MS;
    }
  }
}

/**
 * Clear attempts for an IP (call on successful login)
 */
export function clearAttempts(ip: string): void {
  attempts.delete(ip);
}

/**
 * Get client IP from request (handles proxies)
 */
export function getClientIp(request: Request): string {
  // Vercel/Cloudflare headers
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]!.trim();
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp;
  }

  // Fallback (local dev)
  return "127.0.0.1";
}

// Cleanup old entries periodically (every 10 minutes)
if (typeof setInterval !== "undefined") {
  setInterval(
    () => {
      const now = Date.now();
      for (const [ip, entry] of attempts.entries()) {
        // Remove if window expired and not blocked
        if (!entry.blockedUntil && now - entry.firstAttempt > WINDOW_MS) {
          attempts.delete(ip);
        }
        // Remove if block expired
        if (entry.blockedUntil && now >= entry.blockedUntil) {
          attempts.delete(ip);
        }
      }
    },
    10 * 60 * 1000
  );
}
