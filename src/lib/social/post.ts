import { BskyAgent, RichText } from "@atproto/api";
import { TwitterApi } from "twitter-api-v2";

// --- Bluesky ---

const BLUESKY_MAX_CHARS = 300;

export function truncateForBluesky(content: string, link?: string): string {
  const linkSuffix = link ? `\n\n${link}` : "";
  const linkLen = linkSuffix.length;
  const maxContentLen = BLUESKY_MAX_CHARS - linkLen;

  let truncated = content;
  if (truncated.length > maxContentLen) {
    truncated = truncated.substring(0, maxContentLen - 3).trimEnd() + "...";
  }

  return truncated + linkSuffix;
}

export async function postToBluesky(content: string, link?: string): Promise<string> {
  const handle = process.env.BLUESKY_HANDLE;
  const password = process.env.BLUESKY_APP_PASSWORD;
  if (!handle || !password) {
    throw new Error("BLUESKY_HANDLE and BLUESKY_APP_PASSWORD required");
  }

  const agent = new BskyAgent({ service: "https://bsky.social" });
  await agent.login({ identifier: handle, password });

  const text = truncateForBluesky(content, link);
  const rt = new RichText({ text });
  await rt.detectFacets(agent);

  const response = await agent.post({
    text: rt.text,
    facets: rt.facets,
    createdAt: new Date().toISOString(),
  });

  const rkey = response.uri.split("/").pop();
  return `https://bsky.app/profile/${handle}/post/${rkey}`;
}

// --- Twitter ---

const TCO_URL_LENGTH = 23;
const TWITTER_MAX_CHARS = 25_000;

export function twitterCharCount(text: string): number {
  const withoutUrls = text.replace(/https?:\/\/\S+/g, "");
  const urlCount = (text.match(/https?:\/\/\S+/g) || []).length;
  return withoutUrls.length + urlCount * TCO_URL_LENGTH;
}

export function truncateForTwitter(content: string, link?: string): string {
  const linkCost = link ? TCO_URL_LENGTH + 2 : 0;
  const maxContentChars = TWITTER_MAX_CHARS - linkCost;

  let truncated = content;
  if (twitterCharCount(truncated) > maxContentChars) {
    while (twitterCharCount(truncated) > maxContentChars - 3 && truncated.length > 0) {
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

export async function postToTwitter(content: string, link?: string): Promise<string> {
  const apiKey = process.env.TWITTER_API_KEY;
  const apiSecret = process.env.TWITTER_API_SECRET;
  const accessToken = process.env.TWITTER_ACCESS_TOKEN;
  const accessSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET;
  const handle = process.env.TWITTER_HANDLE || "poligraph_fr";

  if (!apiKey || !apiSecret || !accessToken || !accessSecret) {
    throw new Error("Twitter API credentials required");
  }

  const client = new TwitterApi({
    appKey: apiKey,
    appSecret: apiSecret,
    accessToken,
    accessSecret,
  });

  const text = truncateForTwitter(content, link);
  const response = await client.v2.tweet(text);
  return `https://x.com/${handle}/status/${response.data.id}`;
}

// --- Both platforms ---

export interface PostResult {
  blueskyUrl?: string;
  blueskyError?: string;
  twitterUrl?: string;
  twitterError?: string;
}

export async function postToBothPlatforms(content: string, link?: string): Promise<PostResult> {
  const result: PostResult = {};

  try {
    result.blueskyUrl = await postToBluesky(content, link);
  } catch (err) {
    result.blueskyError = err instanceof Error ? err.message : String(err);
  }

  // Small delay between platforms to avoid looking like automated spam
  await new Promise((r) => setTimeout(r, 2000));

  try {
    result.twitterUrl = await postToTwitter(content, link);
  } catch (err) {
    result.twitterError = err instanceof Error ? err.message : String(err);
  }

  return result;
}
