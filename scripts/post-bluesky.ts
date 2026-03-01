/**
 * Post tweets to Bluesky via AT Protocol
 *
 * Usage:
 *   npx dotenv -e .env -- npx tsx scripts/post-bluesky.ts              # Dry-run (preview only)
 *   npx dotenv -e .env -- npx tsx scripts/post-bluesky.ts --post       # Post to Bluesky
 *   npx dotenv -e .env -- npx tsx scripts/post-bluesky.ts --post --pick 1,3  # Post specific tweets by number
 *
 * Required env vars:
 *   BLUESKY_HANDLE=poligraph-fr.bsky.social
 *   BLUESKY_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx
 */

import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import { postToBluesky, truncateForBluesky } from "../src/lib/social/post";

// --- Config ---

const BLUESKY_MAX_CHARS = 300; // For preview display only

// --- Parse tweet drafts from markdown ---

interface ParsedTweet {
  number: number;
  category: string;
  content: string;
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
    const numberMatch = section!.match(/^(\d+)/);
    if (!numberMatch) continue;

    const number = parseInt(numberMatch[1]!);

    // Find the category from the preceding ## header (take the last one before this tweet)
    const beforeSection = md.substring(0, md.indexOf(`### Tweet ${number}`));
    const allCategories = [...beforeSection.matchAll(/^## ([^\n]+)/gm)];
    if (allCategories.length > 0) {
      currentCategory = allCategories[allCategories.length - 1]![1]!.trim();
    }

    // Extract content (between tweet header and **Caractères**)
    const contentMatch = section!.match(/\d+\s*\n\n([\s\S]*?)\n\n\*\*Caractères\*\*/);
    if (!contentMatch) continue;

    let fullContent = contentMatch[1]!.trim();

    // Separate link from content
    let link: string | undefined;
    const linkMatch = fullContent.match(/\n\n👉\s*(https?:\/\/\S+)$/);
    if (linkMatch) {
      link = linkMatch[1];
      fullContent = fullContent.replace(/\n\n👉\s*https?:\/\/\S+$/, "").trim();
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
  const pickArg = args.find((a) => a.startsWith("--pick"));
  const pickIndex = args.indexOf("--pick");
  const pickNumbers =
    pickIndex !== -1 && args[pickIndex + 1] ? args[pickIndex + 1]!.split(",").map(Number) : null;

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
    const blueskyText = truncateForBluesky(tweet.content, tweet.link);
    const graphemeCount = [...blueskyText].length;
    const fits = graphemeCount <= BLUESKY_MAX_CHARS;

    console.log(`--- Tweet ${tweet.number} [${tweet.category}] ---`);
    console.log(blueskyText);
    console.log(`\nGraphèmes: ${graphemeCount}/${BLUESKY_MAX_CHARS} ${fits ? "✅" : "⚠️ tronqué"}`);
    console.log();
  }

  if (!shouldPost) {
    console.log("=== Mode dry-run. Ajoute --post pour publier sur Bluesky. ===");
    return;
  }

  // Post each selected tweet
  for (const tweet of selectedTweets) {
    try {
      const url = await postToBluesky(tweet.content, tweet.link);
      console.log(`✓ Tweet ${tweet.number} publié → ${url}`);
    } catch (error) {
      console.error(`✗ Tweet ${tweet.number} échoué:`, error);
    }

    // Rate limit: wait 2s between posts
    if (selectedTweets.indexOf(tweet) < selectedTweets.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  console.log("\nTerminé.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
