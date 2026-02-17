import { cookies } from "next/headers";
import { timingSafeEqual, createHmac } from "crypto";

const ADMIN_COOKIE_NAME = "admin_session";
const SESSION_DURATION = 60 * 60 * 24 * 7; // 7 days in seconds

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
 * Create a signed session token (stateless — no server-side store needed).
 * Format: "timestamp.hmac_signature"
 * The HMAC key is ADMIN_PASSWORD, so only someone who knows the password can forge a token.
 */
function signToken(timestamp: number): string {
  const secret = process.env.ADMIN_PASSWORD || "";
  const sig = createHmac("sha256", secret).update(String(timestamp)).digest("hex");
  return `${timestamp}.${sig}`;
}

function verifyToken(token: string): boolean {
  const secret = process.env.ADMIN_PASSWORD;
  if (!secret) return false;

  const dotIndex = token.indexOf(".");
  if (dotIndex === -1) return false;

  const timestamp = token.substring(0, dotIndex);
  const signature = token.substring(dotIndex + 1);

  // Verify HMAC signature
  const expected = createHmac("sha256", secret).update(timestamp).digest("hex");
  if (expected.length !== signature.length) return false;
  if (!timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) return false;

  // Check expiry
  const created = parseInt(timestamp, 10);
  if (isNaN(created)) return false;
  const elapsed = (Date.now() - created) / 1000;
  return elapsed < SESSION_DURATION;
}

/**
 * Create admin session with HMAC-signed cookie (stateless)
 */
export async function createSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = signToken(Date.now());

  cookieStore.set(ADMIN_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_DURATION,
    path: "/",
  });
}

/**
 * Check if user is authenticated (verifies HMAC signature + expiry)
 */
export async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const session = cookieStore.get(ADMIN_COOKIE_NAME);
  if (!session?.value) return false;
  return verifyToken(session.value);
}

/**
 * Destroy admin session
 */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_COOKIE_NAME);
}
