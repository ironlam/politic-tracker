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
  // Top parties by published politician count
  const parties = await db.party.findMany({
    where: {
      politicians: { some: { publicationStatus: "PUBLISHED" } },
    },
    select: {
      shortName: true,
      name: true,
      _count: {
        select: {
          politicians: { where: { publicationStatus: "PUBLISHED" } },
        },
      },
    },
    orderBy: { politicians: { _count: "desc" } },
    take: 8,
  });

  // Affair counts per party (PUBLISHED + DIRECT only)
  const affairCounts = await db.affair.groupBy({
    by: ["politicianId"],
    where: {
      publicationStatus: "PUBLISHED",
      involvement: "DIRECT",
    },
    _count: true,
  });

  const politicianAffairs = new Map(affairCounts.map((a) => [a.politicianId, a._count]));

  const politiciansWithParty = await db.politician.findMany({
    where: {
      publicationStatus: "PUBLISHED",
      currentPartyId: { not: null },
    },
    select: { id: true, currentParty: { select: { shortName: true } } },
  });

  const partyAffairMap = new Map<string, number>();
  for (const p of politiciansWithParty) {
    const party = p.currentParty!.shortName;
    const count = politicianAffairs.get(p.id) || 0;
    partyAffairMap.set(party, (partyAffairMap.get(party) || 0) + count);
  }

  const topParties = parties
    .slice(0, 5)
    .map((p) => `${p.shortName} : ${p._count.politicians}`)
    .join(" | ");

  const drafts: TweetDraft[] = [
    {
      category: "📊 Stats",
      content: `Politiques référencés sur Poligraph par parti :\n${topParties}\nExplorez toutes les données →`,
      link: `${SITE_URL}/statistiques`,
    },
  ];

  // Second tweet: affairs by party (top 5)
  const sortedAffairs = [...partyAffairMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  if (sortedAffairs.length > 0) {
    const affairLines = sortedAffairs.map(([party, count]) => `${party} : ${count}`).join(" | ");

    drafts.push({
      category: "📊 Stats",
      content: `Affaires judiciaires documentées par parti :\n${affairLines}\nConsultez les détails →`,
      link: `${SITE_URL}/affaires`,
    });
  }

  return drafts;
}
async function recentAffairs(): Promise<TweetDraft[]> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const affairs = await db.affair.findMany({
    where: {
      publicationStatus: "PUBLISHED",
      involvement: "DIRECT",
      updatedAt: { gte: sevenDaysAgo },
    },
    include: {
      politician: {
        select: {
          fullName: true,
          slug: true,
          currentParty: { select: { shortName: true } },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 3,
  });

  return affairs.map((a) => {
    const statusLabel = AFFAIR_STATUS_LABELS[a.status];
    const categoryLabel = AFFAIR_CATEGORY_LABELS[a.category];
    const needsPresumption = AFFAIR_STATUS_NEEDS_PRESUMPTION[a.status];
    const party = a.politician.currentParty?.shortName
      ? ` (${a.politician.currentParty.shortName})`
      : "";

    let content = `${a.politician.fullName}${party} — ${a.title}\nStatut : ${statusLabel} | ${categoryLabel}`;
    if (needsPresumption) {
      content += "\n⚖️ Présomption d'innocence";
    }

    return {
      category: "⚖️ Affaires récentes",
      content,
      link: `${SITE_URL}/affaires/${a.slug}`,
    };
  });
}
async function factchecks(): Promise<TweetDraft[]> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const recent = await db.factCheck.findMany({
    where: { publishedAt: { gte: sevenDaysAgo } },
    select: { verdictRating: true },
  });

  if (recent.length < 3) return [];

  const truthy = recent.filter((f) => ["TRUE", "MOSTLY_TRUE"].includes(f.verdictRating)).length;
  const misleading = recent.filter((f) =>
    ["HALF_TRUE", "MISLEADING", "OUT_OF_CONTEXT"].includes(f.verdictRating)
  ).length;
  const falsy = recent.filter((f) => ["MOSTLY_FALSE", "FALSE"].includes(f.verdictRating)).length;

  return [
    {
      category: "🔍 Fact-checks",
      content: `Cette semaine, ${recent.length} déclarations de politiques vérifiées :\n✅ ${truthy} vraie(s) — ⚠️ ${misleading} trompeuse(s) — ❌ ${falsy} fausse(s)\nQui dit vrai ?`,
      link: `${SITE_URL}/factchecks`,
    },
  ];
}
async function deputySpotlight(): Promise<TweetDraft[]> {
  const count = await db.politician.count({
    where: {
      publicationStatus: "PUBLISHED",
      prominenceScore: { gte: 100 },
      mandates: { some: { isCurrent: true } },
    },
  });

  if (count === 0) return [];

  const skip = Math.floor(Math.random() * count);

  const politician = await db.politician.findFirst({
    where: {
      publicationStatus: "PUBLISHED",
      prominenceScore: { gte: 100 },
      mandates: { some: { isCurrent: true } },
    },
    include: {
      currentParty: { select: { shortName: true } },
      mandates: {
        where: { isCurrent: true },
        take: 1,
        select: { type: true, constituency: true },
      },
      _count: {
        select: {
          votes: true,
          affairs: { where: { publicationStatus: "PUBLISHED", involvement: "DIRECT" } },
        },
      },
    },
    skip,
  });

  if (!politician) return [];

  const mandate = politician.mandates[0];
  const mandateLabel = mandate ? MANDATE_TYPE_LABELS[mandate.type] : "";
  const constituency = mandate?.constituency ? ` de ${mandate.constituency}` : "";
  const party = politician.currentParty?.shortName ? ` (${politician.currentParty.shortName})` : "";

  const content = `${politician.fullName}${party}, ${mandateLabel.toLowerCase()}${constituency}.\n${politician._count.votes} votes enregistrés, ${politician._count.affairs} affaire(s) documentée(s).\nSa fiche complète →`;

  return [
    {
      category: "👤 Profil du jour",
      content,
      link: `${SITE_URL}/politiques/${politician.slug}`,
    },
  ];
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
