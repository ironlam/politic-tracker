/**
 * Post tweets to X/Twitter via API v2
 *
 * Usage:
 *   npx dotenv -e .env -- npx tsx scripts/post-twitter.ts              # Dry-run (preview only)
 *   npx dotenv -e .env -- npx tsx scripts/post-twitter.ts --post       # Post to X
 *   npx dotenv -e .env -- npx tsx scripts/post-twitter.ts --post --pick 1,3  # Post specific tweets
 *
 * Required env vars (OAuth 1.0a User Context — read+write):
 *   TWITTER_API_KEY=xxxxxxxx
 *   TWITTER_API_SECRET=xxxxxxxx
 *   TWITTER_ACCESS_TOKEN=xxxxxxxx
 *   TWITTER_ACCESS_TOKEN_SECRET=xxxxxxxx
 *
 * How to get these keys:
 *   1. Go to https://developer.x.com/en/portal/dashboard
 *   2. Create a project + app (Free tier allows posting)
 *   3. In app settings → "Keys and tokens"
 *   4. Generate "API Key and Secret" (= Consumer Keys)
 *   5. Generate "Access Token and Secret" (with Read+Write permissions)
 *   6. Copy all 4 values to your .env
 */

import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import { postToTwitter, truncateForTwitter, twitterCharCount } from "../src/lib/social/post";

// --- Config ---

const TWITTER_MAX_CHARS = 25_000; // For preview display only

// --- Parse tweet drafts from markdown ---

interface ParsedTweet {
  number: number;
  category: string;
  content: string; // content including hashtags/mentions
  link?: string;
  charCount: number;
}

function parseTweetsFromMarkdown(filePath: string): ParsedTweet[] {
  const md = fs.readFileSync(filePath, "utf-8");
  const tweets: ParsedTweet[] = [];

  let currentCategory = "";
  const sections = md.split("### Tweet ");

  for (let i = 1; i < sections.length; i++) {
    const section = sections[i];
    const numberMatch = section.match(/^(\d+)/);
    if (!numberMatch) continue;

    const number = parseInt(numberMatch[1]);

    // Find the category (last ## heading before this tweet)
    const beforeSection = md.substring(0, md.indexOf(`### Tweet ${number}`));
    const allCategories = [...beforeSection.matchAll(/^## ([^\n]+)/gm)];
    if (allCategories.length > 0) {
      currentCategory = allCategories[allCategories.length - 1][1].trim();
    }

    // Extract content (between tweet header and **Caractères**)
    const contentMatch = section.match(/\d+\s*\n\n([\s\S]*?)\n\n\*\*Caractères\*\*/);
    if (!contentMatch) continue;

    let fullContent = contentMatch[1].trim();

    // Separate link from content
    let link: string | undefined;
    const linkMatch = fullContent.match(/\n\n👉\s*(https?:\/\/\S+)/);
    if (linkMatch) {
      link = linkMatch[1];
      fullContent = fullContent.replace(/\n\n👉\s*https?:\/\/\S+/, "").trim();
    }

    tweets.push({
      number,
      category: currentCategory,
      content: fullContent,
      link,
      charCount: fullContent.length,
    });
  }

  return tweets;
}

// --- Main ---

async function main() {
  const args = process.argv.slice(2);
  const shouldPost = args.includes("--post");
  const pickIndex = args.indexOf("--pick");
  const pickNumbers =
    pickIndex !== -1 && args[pickIndex + 1] ? args[pickIndex + 1].split(",").map(Number) : null;

  // Find today's tweets file
  const tweetsDir = path.join(process.cwd(), "tweets");
  const dateStr = new Date().toISOString().split("T")[0];
  const filePath = path.join(tweetsDir, `${dateStr}.md`);

  if (!fs.existsSync(filePath)) {
    console.error(`Pas de brouillons pour aujourd'hui. Lance d'abord :`);
    console.error(`  npx dotenv -e .env -- npx tsx scripts/generate-tweets.ts`);
    process.exit(1);
  }

  const tweets = parseTweetsFromMarkdown(filePath);
  console.log(`${tweets.length} tweets trouvés dans ${filePath}\n`);

  // Filter if --pick is specified
  const selectedTweets = pickNumbers
    ? tweets.filter((t) => pickNumbers.includes(t.number))
    : tweets;

  if (selectedTweets.length === 0) {
    console.log("Aucun tweet sélectionné.");
    return;
  }

  // Preview
  for (const tweet of selectedTweets) {
    const twitterText = truncateForTwitter(tweet.content, tweet.link);
    const charCount = twitterCharCount(twitterText);
    const fits = charCount <= TWITTER_MAX_CHARS;

    console.log(`--- Tweet ${tweet.number} [${tweet.category}] ---`);
    console.log(twitterText);
    console.log(
      `\nCaractères (Twitter): ${charCount}/${TWITTER_MAX_CHARS} ${fits ? "✅" : "⚠️ tronqué"}`
    );
    console.log();
  }

  if (!shouldPost) {
    console.log("=== Mode dry-run. Ajoute --post pour publier sur X. ===");
    return;
  }

  // Post each selected tweet
  for (const tweet of selectedTweets) {
    try {
      const url = await postToTwitter(tweet.content, tweet.link);
      console.log(`✓ Tweet ${tweet.number} publié → ${url}`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`✗ Tweet ${tweet.number} échoué: ${message}`);

      // Check for rate limit
      if (message.includes("429") || message.includes("Rate limit")) {
        console.error("  Rate limit atteint. Attente de 15 minutes...");
        await new Promise((resolve) => setTimeout(resolve, 15 * 60 * 1000));
      }
    }

    // Rate limit: wait 3s between posts (X is stricter than Bluesky)
    if (selectedTweets.indexOf(tweet) < selectedTweets.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }

  console.log("\nTerminé.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
