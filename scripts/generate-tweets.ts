import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import { db } from "../src/lib/db";
import { GENERATORS, type TweetDraft } from "../src/lib/social/generators";
import { formatDate } from "../src/lib/utils";

const MAX_CHARS = 4000; // X Premium

function renderMarkdown(drafts: TweetDraft[]): string {
  const today = formatDate(new Date());
  let md = `# Brouillons tweets — ${today}\n\n`;

  // Group by category
  const grouped = new Map<string, TweetDraft[]>();
  for (const d of drafts) {
    const list = grouped.get(d.category) || [];
    list.push(d);
    grouped.set(d.category, list);
  }

  let tweetNum = 1;
  for (const [category, tweets] of grouped) {
    md += `## ${category}\n\n`;
    for (const t of tweets) {
      // Build the full tweet text with tags
      let fullText = t.content;
      if (t.link) fullText += `\n\n👉 ${t.link}`;

      // Add mentions and hashtags on the last line
      const tagParts: string[] = [];
      if (t.mentions?.length) tagParts.push(t.mentions.map((m) => `@${m}`).join(" "));
      if (t.hashtags?.length) tagParts.push(t.hashtags.map((h) => `#${h}`).join(" "));
      if (tagParts.length > 0) fullText += `\n\n${tagParts.join(" ")}`;

      const charCount = fullText.length;
      const status = charCount > MAX_CHARS ? "⚠️ TROP LONG" : "✅";
      md += `### Tweet ${tweetNum}\n\n`;
      md += `${fullText}\n\n`;
      md += `**Caractères** : ${charCount}/${MAX_CHARS} ${status}\n\n---\n\n`;
      tweetNum++;
    }
  }

  return md;
}

async function main() {
  console.log("Génération des brouillons de tweets...\n");

  const generators = Object.entries(GENERATORS);
  const allDrafts: TweetDraft[] = [];

  for (const [name, fn] of generators) {
    try {
      const drafts = await fn();
      allDrafts.push(...drafts);
      console.log(`  ✓ ${name}: ${drafts.length} tweet(s)`);
    } catch (error) {
      console.error(`  ✗ ${name}: ${error}`);
    }
  }

  if (allDrafts.length === 0) {
    console.log("\nAucun brouillon généré (pas de données récentes).");
    return;
  }

  const tweetsDir = path.join(process.cwd(), "tweets");
  if (!fs.existsSync(tweetsDir)) {
    fs.mkdirSync(tweetsDir, { recursive: true });
  }

  const dateStr = new Date().toISOString().split("T")[0];
  const filePath = path.join(tweetsDir, `${dateStr}.md`);
  fs.writeFileSync(filePath, renderMarkdown(allDrafts), "utf-8");

  console.log(`\n${allDrafts.length} brouillon(s) générés → ${filePath}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
