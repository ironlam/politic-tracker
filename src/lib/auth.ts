import { cookies } from "next/headers";
import { timingSafeEqual } from "crypto";

const ADMIN_COOKIE_NAME = "admin_session";
const SESSION_DURATION = 60 * 60 * 24 * 7; // 7 days in seconds

// In-memory session store
// Note: in serverless (Vercel), this resets on cold start — admin must re-login. Acceptable for MVP.
const activeSessions = new Map<string, { createdAt: number }>();

/**
 * Simple admin authentication using ADMIN_PASSWORD env var
 * Uses timing-safe comparison to prevent timing attacks
 */
export async function verifyPassword(password: string): Promise<boolean> {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    console.error("ADMIN_PASSWORD not set in environment");
    return false;
  }

  const a = Buffer.from(password);
  const b = Buffer.from(adminPassword);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Create admin session with tracked token
 */
export async function createSession(): Promise<void> {
  const cookieStore = await cookies();
  const sessionToken = generateSessionToken();

  activeSessions.set(sessionToken, { createdAt: Date.now() });

  cookieStore.set(ADMIN_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_DURATION,
    path: "/",
  });
}

/**
 * Check if user is authenticated (validates token against session store)
 */
export async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const session = cookieStore.get(ADMIN_COOKIE_NAME);
  if (!session?.value) return false;
  return activeSessions.has(session.value);
}

/**
 * Destroy admin session
 */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const session = cookieStore.get(ADMIN_COOKIE_NAME);
  if (session?.value) {
    activeSessions.delete(session.value);
  }
  cookieStore.delete(ADMIN_COOKIE_NAME);
}

/**
 * Generate a random session token
 */
function generateSessionToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
