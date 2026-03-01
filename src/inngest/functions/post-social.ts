import { inngest } from "../client";

export const postSocial = inngest.createFunction(
  {
    id: "social/auto-post",
    retries: 2,
    concurrency: { limit: 1, key: '"social-post"' },
  },
  [
    { cron: "0 7 * * *" }, // 07:00 UTC = 08:00 Paris (CET)
    { cron: "30 11 * * *" }, // 11:30 UTC = 12:30 Paris
    { cron: "0 17 * * *" }, // 17:00 UTC = 18:00 Paris
  ],
  async ({ step }) => {
    // Step 1 + 2: Generate tweet — try current category, skip if empty (max 3 attempts)
    const draft = await step.run("generate", async () => {
      const { generateForCategory } = await import("@/lib/social/generators");
      const { SOCIAL_CATEGORIES } = await import("@/lib/social/config");
      const { getRotationIndex } = await import("@/lib/social/rotation");

      let idx = await getRotationIndex();
      for (let attempt = 0; attempt < 3; attempt++) {
        const cat = SOCIAL_CATEGORIES[idx % SOCIAL_CATEGORIES.length];
        const result = await generateForCategory(cat!);
        if (result) return { ...result, resolvedCategory: cat };
        idx++;
      }
      return null;
    });

    if (!draft) {
      await step.run("advance-empty", async () => {
        const { advanceRotation } = await import("@/lib/social/rotation");
        await advanceRotation();
      });
      return { status: "skipped", reason: "no content generated" };
    }

    const { resolvedCategory, ...tweetDraft } = draft;
    const { isSensitiveCategory } = await import("@/lib/social/config");

    if (isSensitiveCategory(resolvedCategory!)) {
      // Queue for editorial review
      const postId = await step.run("queue-review", async () => {
        const { db } = await import("@/lib/db");
        const { notifySlackReview } = await import("@/lib/social/notify");
        const { advanceRotation } = await import("@/lib/social/rotation");

        let fullText = tweetDraft.content;
        if (tweetDraft.link) fullText += `\n\n${tweetDraft.link}`;
        if (tweetDraft.hashtags?.length) {
          fullText += `\n\n${tweetDraft.hashtags.map((h: string) => `#${h}`).join(" ")}`;
        }

        const post = await db.socialPost.create({
          data: {
            category: resolvedCategory,
            content: fullText,
            link: tweetDraft.link,
            status: "PENDING_REVIEW",
          },
        });

        await notifySlackReview({
          id: post.id,
          category: resolvedCategory!,
          content: fullText,
          link: tweetDraft.link,
        });

        await advanceRotation();
        return post.id;
      });

      return { status: "queued_review", category: resolvedCategory, postId };
    }

    // Auto-post safe categories
    const result = await step.run("post", async () => {
      const { isAutoPostEnabled } = await import("@/lib/social/config");
      const { postToBothPlatforms } = await import("@/lib/social/post");
      const { db } = await import("@/lib/db");
      const { advanceRotation } = await import("@/lib/social/rotation");

      let fullText = tweetDraft.content;
      if (tweetDraft.hashtags?.length) {
        fullText += `\n\n${tweetDraft.hashtags.map((h: string) => `#${h}`).join(" ")}`;
      }
      if (tweetDraft.mentions?.length) {
        fullText += ` ${tweetDraft.mentions.map((m: string) => `@${m}`).join(" ")}`;
      }

      if (!isAutoPostEnabled()) {
        console.log(`[social] Dry-run [${resolvedCategory}]: ${fullText.substring(0, 100)}...`);
        await advanceRotation();
        return { status: "dry_run", category: resolvedCategory };
      }

      const postResult = await postToBothPlatforms(fullText, tweetDraft.link);
      const status = postResult.blueskyUrl || postResult.twitterUrl ? "POSTED" : "FAILED";
      const error = [postResult.blueskyError, postResult.twitterError].filter(Boolean).join("; ");

      await db.socialPost.create({
        data: {
          category: resolvedCategory,
          content: fullText,
          link: tweetDraft.link,
          status,
          blueskyUrl: postResult.blueskyUrl,
          twitterUrl: postResult.twitterUrl,
          error: error || null,
          postedAt: status === "POSTED" ? new Date() : null,
        },
      });

      await advanceRotation();
      return {
        status: status.toLowerCase(),
        category: resolvedCategory,
        blueskyUrl: postResult.blueskyUrl,
        twitterUrl: postResult.twitterUrl,
        error: error || undefined,
      };
    });

    return result;
  }
);
