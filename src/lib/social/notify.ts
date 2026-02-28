import { SLACK_SOCIAL_WEBHOOK_URL, SITE_URL } from "./config";

interface ReviewDraft {
  id: string;
  category: string;
  content: string;
  link?: string;
}

/**
 * Send a Slack notification for a tweet pending editorial review.
 * Returns true if sent successfully, false otherwise.
 */
export async function notifySlackReview(draft: ReviewDraft): Promise<boolean> {
  const url = SLACK_SOCIAL_WEBHOOK_URL;
  if (!url) {
    console.warn("[social] SLACK_SOCIAL_WEBHOOK_URL not set, skipping notification");
    return false;
  }

  const categoryEmoji: Record<string, string> = {
    affaires: "⚖️",
    factchecks: "🔍",
  };

  const emoji = categoryEmoji[draft.category] || "📝";
  const truncatedContent =
    draft.content.length > 500 ? draft.content.substring(0, 497) + "..." : draft.content;

  const payload = {
    text: `${emoji} Tweet en attente de review — ${draft.category}`,
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `${emoji} Tweet en attente — ${draft.category}`,
          emoji: true,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: truncatedContent,
        },
      },
      ...(draft.link
        ? [
            {
              type: "section",
              text: { type: "mrkdwn", text: `🔗 ${draft.link}` },
            },
          ]
        : []),
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "Approuver dans l'admin" },
            url: `${SITE_URL}/admin/social?action=review&id=${draft.id}`,
            style: "primary",
          },
        ],
      },
    ],
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch (err) {
    console.error("[social] Slack webhook failed:", err);
    return false;
  }
}
