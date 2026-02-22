import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import { db } from "../src/lib/db";
import {
  AFFAIR_STATUS_LABELS,
  AFFAIR_STATUS_NEEDS_PRESUMPTION,
  AFFAIR_CATEGORY_LABELS,
  VOTING_RESULT_LABELS,
  FACTCHECK_RATING_LABELS,
  MANDATE_TYPE_LABELS,
  ELECTION_TYPE_LABELS,
  ELECTION_STATUS_LABELS,
} from "../src/config/labels";

// --- Types ---

interface TweetDraft {
  category: string; // emoji + titre de section
  content: string; // texte du tweet
  link?: string; // lien poligraph.fr
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://poligraph.fr";
const MAX_CHARS = 280;

// --- Générateurs ---

async function divisiveVotes(): Promise<TweetDraft[]> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const scrutins = await db.scrutin.findMany({
    where: { votingDate: { gte: thirtyDaysAgo } },
    orderBy: { votingDate: "desc" },
    take: 20,
    include: {
      votes: {
        include: {
          politician: {
            select: { currentParty: { select: { shortName: true } } },
          },
        },
      },
    },
  });

  const drafts: TweetDraft[] = [];

  for (const s of scrutins) {
    if (s.votes.length < 50) continue;

    // Aggregate votes by party
    const partyVotes = new Map<string, { pour: number; contre: number; total: number }>();
    for (const v of s.votes) {
      if (v.position === "ABSENT" || v.position === "NON_VOTANT") continue;
      const party = v.politician.currentParty?.shortName || "Sans parti";
      const entry = partyVotes.get(party) || {
        pour: 0,
        contre: 0,
        total: 0,
      };
      if (v.position === "POUR") entry.pour++;
      else if (v.position === "CONTRE") entry.contre++;
      entry.total++;
      partyVotes.set(party, entry);
    }

    // Find the most divided large party (>10 voters)
    let maxDivision = 0;
    let dividedParty = "";
    let dividedPct = 0;

    for (const [party, counts] of partyVotes) {
      if (counts.total < 10) continue;
      const pourPct = counts.pour / counts.total;
      const division = Math.min(pourPct, 1 - pourPct); // 0 = unanimous, 0.5 = split
      if (division > maxDivision) {
        maxDivision = division;
        dividedParty = party;
        dividedPct = Math.round(pourPct * 100);
      }
    }

    // Only tweet if there's a meaningfully divided party (>25% minority)
    if (maxDivision < 0.25) continue;

    const total = s.votesFor + s.votesAgainst + s.votesAbstain;
    const pourPct = Math.round((s.votesFor / total) * 100);
    const result = VOTING_RESULT_LABELS[s.result].toLowerCase();
    const title = s.title.length > 80 ? s.title.substring(0, 77) + "..." : s.title;

    drafts.push({
      category: "🗳️ Votes clivants",
      content: `${title} : ${result} (${pourPct}% pour).\n${dividedParty} divisé : ${dividedPct}% pour, ${100 - dividedPct}% contre.`,
      link: `${SITE_URL}/votes/${s.slug || s.id}`,
    });

    if (drafts.length >= 2) break;
  }

  return drafts;
}
async function partyStats(): Promise<TweetDraft[]> {
  return [];
}
async function recentAffairs(): Promise<TweetDraft[]> {
  return [];
}
async function factchecks(): Promise<TweetDraft[]> {
  return [];
}
async function deputySpotlight(): Promise<TweetDraft[]> {
  return [];
}
async function elections(): Promise<TweetDraft[]> {
  return [];
}
async function recentPress(): Promise<TweetDraft[]> {
  return [];
}

// --- Rendu Markdown ---

function renderMarkdown(drafts: TweetDraft[]): string {
  const today = new Date().toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
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
      const fullText = t.link ? `${t.content}\n👉 ${t.link}` : t.content;
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

// --- Main ---

async function main() {
  console.log("Génération des brouillons de tweets...\n");

  const generators = [
    { name: "Votes clivants", fn: divisiveVotes },
    { name: "Stats parti", fn: partyStats },
    { name: "Affaires récentes", fn: recentAffairs },
    { name: "Fact-checks", fn: factchecks },
    { name: "Député du jour", fn: deputySpotlight },
    { name: "Élections", fn: elections },
    { name: "Presse récente", fn: recentPress },
  ];

  const allDrafts: TweetDraft[] = [];

  for (const gen of generators) {
    try {
      const drafts = await gen.fn();
      allDrafts.push(...drafts);
      console.log(`  ✓ ${gen.name}: ${drafts.length} tweet(s)`);
    } catch (error) {
      console.error(`  ✗ ${gen.name}: ${error}`);
    }
  }

  if (allDrafts.length === 0) {
    console.log("\nAucun brouillon généré (pas de données récentes).");
    return;
  }

  // Write file
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
