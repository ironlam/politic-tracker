// src/services/notifications.ts

import { db } from "@/lib/db";

export interface WebhookPayload {
  event: "sync.failed" | "sync.new_affairs";
  script: string;
  status: string;
  duration: string | null;
  error?: string;
  stats?: { processed?: number | null; total?: number | null };
  timestamp: string;
  url: string;
}

/**
 * Send a webhook notification to the configured ADMIN_WEBHOOK_URL.
 * No-op if the env var is not set. Logs to audit on every attempt.
 */
export async function sendWebhook(payload: WebhookPayload): Promise<boolean> {
  const url = process.env.ADMIN_WEBHOOK_URL;
  if (!url) return false;

  let success = false;
  let errorMessage: string | undefined;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });
    success = res.ok;
    if (!success) {
      errorMessage = `HTTP ${res.status}`;
    }
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : "Unknown error";
  }

  // Audit log
  await db.auditLog
    .create({
      data: {
        action: "WEBHOOK",
        entityType: "Notification",
        entityId: payload.event,
        changes: {
          script: payload.script,
          status: payload.status,
          success,
          ...(errorMessage ? { error: errorMessage } : {}),
        },
      },
    })
    .catch(() => {
      // Don't let audit log failure break the sync
    });

  return success;
}

/**
 * Send a test webhook to verify connectivity.
 */
export async function sendTestWebhook(): Promise<{
  success: boolean;
  error?: string;
}> {
  const url = process.env.ADMIN_WEBHOOK_URL;
  if (!url) return { success: false, error: "ADMIN_WEBHOOK_URL non configuré" };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "test",
        message: "Test de connectivité webhook Poligraph",
        timestamp: new Date().toISOString(),
        url: `${process.env.NEXT_PUBLIC_BASE_URL || "https://poligraph.fr"}/admin/syncs`,
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      return { success: false, error: `HTTP ${res.status}` };
    }
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Erreur inconnue",
    };
  }
}

/**
 * Format a duration in milliseconds to a human-readable string.
 */
export function formatDuration(startedAt: Date | null, completedAt: Date | null): string | null {
  if (!startedAt || !completedAt) return null;
  const sec = Math.floor((completedAt.getTime() - startedAt.getTime()) / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  const rem = sec % 60;
  return `${min}m ${rem}s`;
}
