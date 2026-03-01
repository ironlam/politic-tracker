import { NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/api/with-admin-auth";
import { sendTestWebhook } from "@/services/notifications";

/**
 * POST /api/admin/webhook/test
 *
 * Send a test webhook to verify connectivity.
 */
export const POST = withAdminAuth(async () => {
  const result = await sendTestWebhook();
  if (result.success) {
    return NextResponse.json({ success: true });
  }
  return NextResponse.json({ success: false, error: result.error }, { status: 422 });
});

/**
 * GET /api/admin/webhook/test
 *
 * Check if webhook is configured (does not reveal the URL).
 */
export const GET = withAdminAuth(async () => {
  const url = process.env.ADMIN_WEBHOOK_URL;
  return NextResponse.json({
    configured: !!url,
    hint: url ? `${url.slice(0, 30)}...` : null,
  });
});
