import { NextRequest, NextResponse } from "next/server";

/**
 * Cron job for automatic data synchronization
 *
 * This endpoint is called by Vercel Cron or GitHub Actions to trigger sync.
 * On Vercel free tier, serverless functions timeout at 10s, which is too short
 * for full sync. Use GitHub Actions for complete sync, or this endpoint for
 * lightweight checks.
 *
 * Security: Requires CRON_SECRET header to prevent unauthorized access.
 */
export async function GET(request: NextRequest) {
  // Verify authorization
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // For now, just return sync status
    // Full sync should be done via GitHub Actions due to timeout limits
    const timestamp = new Date().toISOString();

    return NextResponse.json({
      success: true,
      message: "Cron endpoint reached",
      timestamp,
      note: "Full sync should be triggered via GitHub Actions",
    });
  } catch (error) {
    console.error("Cron sync error:", error);
    return NextResponse.json({ error: "Sync failed", details: String(error) }, { status: 500 });
  }
}
