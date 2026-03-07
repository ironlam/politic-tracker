import { NextRequest, NextResponse } from "next/server";
import { withPublicRoute } from "@/lib/api/with-public-route";
import { subscribeSchema } from "@/lib/security/schemas/newsletter";

export const POST = withPublicRoute(async (request: NextRequest) => {
  const body = await request.json();
  const parsed = subscribeSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Données invalides" },
      { status: 400 }
    );
  }

  const email = parsed.data.email.toLowerCase().trim();

  try {
    const { subscribeToNewsletter } = await import("@/lib/email/mailjet");
    await subscribeToNewsletter(email);
  } catch (error) {
    // Log full error server-side, return generic message to client
    console.error("[Newsletter] Subscribe error:", error);
    return NextResponse.json(
      { error: "Impossible de traiter votre inscription. Réessayez plus tard." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    message: "Un email de confirmation vous a été envoyé.",
  });
});
