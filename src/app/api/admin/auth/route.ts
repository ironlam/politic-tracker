import { NextRequest, NextResponse } from "next/server";
import { verifyPassword, createSession, destroySession } from "@/lib/auth";
import {
  checkRateLimit,
  recordFailedAttempt,
  clearAttempts,
  getClientIp,
} from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);

  // Check rate limit before processing
  const rateLimit = checkRateLimit(ip);
  if (rateLimit.limited) {
    return NextResponse.json(
      {
        error: `Trop de tentatives. Réessayez dans ${rateLimit.retryAfter} secondes.`,
        retryAfter: rateLimit.retryAfter,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimit.retryAfter),
        },
      }
    );
  }

  try {
    const { password } = await request.json();

    if (!password) {
      return NextResponse.json(
        { error: "Mot de passe requis" },
        { status: 400 }
      );
    }

    const isValid = await verifyPassword(password);

    if (!isValid) {
      // Record failed attempt
      recordFailedAttempt(ip);

      const newLimit = checkRateLimit(ip);
      const message =
        newLimit.remaining > 0
          ? `Mot de passe incorrect. ${newLimit.remaining} tentative(s) restante(s).`
          : "Mot de passe incorrect. Compte temporairement bloqué.";

      return NextResponse.json({ error: message }, { status: 401 });
    }

    // Success - clear rate limit and create session
    clearAttempts(ip);
    await createSession();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Auth error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE() {
  await destroySession();
  return NextResponse.json({ success: true });
}
