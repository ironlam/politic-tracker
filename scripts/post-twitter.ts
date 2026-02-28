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
import { TwitterApi } from "twitter-api-v2";

// --- Config ---

const TWITTER_API_KEY = process.env.TWITTER_API_KEY;
const TWITTER_API_SECRET = process.env.TWITTER_API_SECRET;
const TWITTER_ACCESS_TOKEN = process.env.TWITTER_ACCESS_TOKEN;
const TWITTER_ACCESS_TOKEN_SECRET = process.env.TWITTER_ACCESS_TOKEN_SECRET;
const TWITTER_HANDLE = process.env.TWITTER_HANDLE || "poligraph_fr";

// Twitter counts URLs as 23 chars (t.co shortening)
const TCO_URL_LENGTH = 23;
// Standard X limit (280 free, 4000+ premium)
const TWITTER_MAX_CHARS = 280;

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

// --- Twitter character counting ---
// Twitter uses a "weighted" char count:
// - Regular chars: 1 each
// - URLs: always 23 chars (t.co)
// - CJK chars: 2 each (not relevant for French)

function twitterCharCount(text: string): number {
  // Replace all URLs with 23-char placeholders for counting
  const withoutUrls = text.replace(/https?:\/\/\S+/g, "");
  const urlCount = (text.match(/https?:\/\/\S+/g) || []).length;
  return withoutUrls.length + urlCount * TCO_URL_LENGTH;
}

function truncateForTwitter(content: string, link?: string): string {
  // The link will be appended as a separate line
  // Twitter counts it as 23 chars + 2 for the newlines
  const linkCost = link ? TCO_URL_LENGTH + 2 : 0;
  const maxContentChars = TWITTER_MAX_CHARS - linkCost;

  let truncated = content;
  if (twitterCharCount(truncated) > maxContentChars) {
    // Truncate progressively until within budget
    while (twitterCharCount(truncated) > maxContentChars - 3 && truncated.length > 0) {
      // Cut at last newline or space
      const lastBreak = Math.max(truncated.lastIndexOf("\n"), truncated.lastIndexOf(" "));
      if (lastBreak > truncated.length / 2) {
        truncated = truncated.substring(0, lastBreak);
      } else {
        truncated = truncated.substring(0, truncated.length - 10);
      }
    }
    truncated = truncated.trimEnd() + "...";
  }

  if (link) {
    truncated += `\n\n${link}`;
  }

  return truncated;
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

  // Validate env
  if (
    !TWITTER_API_KEY ||
    !TWITTER_API_SECRET ||
    !TWITTER_ACCESS_TOKEN ||
    !TWITTER_ACCESS_TOKEN_SECRET
  ) {
    console.error("Variables d'environnement manquantes :");
    console.error("  TWITTER_API_KEY=xxxxxxxx");
    console.error("  TWITTER_API_SECRET=xxxxxxxx");
    console.error("  TWITTER_ACCESS_TOKEN=xxxxxxxx");
    console.error("  TWITTER_ACCESS_TOKEN_SECRET=xxxxxxxx");
    console.error("");
    console.error("→ https://developer.x.com/en/portal/dashboard");
    process.exit(1);
  }

  // Login with OAuth 1.0a (User Context)
  console.log(`Connexion à X (@${TWITTER_HANDLE})...`);
  const client = new TwitterApi({
    appKey: TWITTER_API_KEY,
    appSecret: TWITTER_API_SECRET,
    accessToken: TWITTER_ACCESS_TOKEN,
    accessSecret: TWITTER_ACCESS_TOKEN_SECRET,
  });

  // Verify credentials
  try {
    const me = await client.v2.me();
    console.log(`Connecté en tant que @${me.data.username}\n`);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`Erreur d'authentification: ${message}`);
    console.error("Vérifie que tes tokens ont les permissions Read+Write.");
    process.exit(1);
  }

  // Post each selected tweet
  for (const tweet of selectedTweets) {
    const twitterText = truncateForTwitter(tweet.content, tweet.link);

    try {
      const response = await client.v2.tweet(twitterText);
      const tweetId = response.data.id;
      const url = `https://x.com/${TWITTER_HANDLE}/status/${tweetId}`;
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
