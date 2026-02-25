const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";

/**
 * Submit URLs to IndexNow for faster indexing on Bing, Yandex, Naver, Seznam.
 * Does nothing if INDEXNOW_KEY is not set.
 *
 * Setup:
 * - Set INDEXNOW_KEY env var (UUID format) on Vercel
 * - Create a file `public/{key}.txt` containing the key for verification
 *
 * @see https://www.indexnow.org/documentation
 */
export async function submitToIndexNow(urls: string[]): Promise<void> {
  const key = process.env.INDEXNOW_KEY;
  if (!key || urls.length === 0) return;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://poligraph.fr";
  const host = new URL(siteUrl).host;

  // IndexNow accepts max 10,000 URLs per request
  const BATCH_SIZE = 10000;
  for (let i = 0; i < urls.length; i += BATCH_SIZE) {
    const batch = urls.slice(i, i + BATCH_SIZE);
    try {
      const response = await fetch(INDEXNOW_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          host,
          key,
          keyLocation: `${siteUrl}/${key}.txt`,
          urlList: batch,
        }),
      });

      if (!response.ok && response.status !== 202) {
        console.error(`[IndexNow] Error: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error("[IndexNow] Submission failed:", error);
    }
  }
}
