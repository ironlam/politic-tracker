import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import { db } from "../src/lib/db";
import {
  AFFAIR_STATUS_LABELS,
  AFFAIR_STATUS_NEEDS_PRESUMPTION,
  AFFAIR_CATEGORY_LABELS,
  VOTING_RESULT_LABELS,
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
const MAX_CHARS = 4000; // X Premium

// --- Helpers ---

function daysUntil(date: Date): number {
  const now = new Date();
  return Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

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
            select: {
              mandates: {
                where: { isCurrent: true, parliamentaryGroupId: { not: null } },
                take: 1,
                select: { parliamentaryGroup: { select: { name: true, code: true } } },
              },
            },
          },
        },
      },
    },
  });

  const drafts: TweetDraft[] = [];

  for (const s of scrutins) {
    if (s.votes.length < 50) continue;

    // Aggregate votes by parliamentary group
    const groupVotes = new Map<
      string,
      { name: string; pour: number; contre: number; abstention: number; total: number }
    >();
    for (const v of s.votes) {
      if (v.position === "ABSENT" || v.position === "NON_VOTANT") continue;
      const group = v.politician.mandates[0]?.parliamentaryGroup;
      const code = group?.code || "NI";
      const name = group?.name || "Non-inscrits";
      const entry = groupVotes.get(code) || { name, pour: 0, contre: 0, abstention: 0, total: 0 };
      if (v.position === "POUR") entry.pour++;
      else if (v.position === "CONTRE") entry.contre++;
      else if (v.position === "ABSTENTION") entry.abstention++;
      entry.total++;
      groupVotes.set(code, entry);
    }

    // Find the most divided large group (>10 voters)
    let maxDivision = 0;
    let dividedGroup = { code: "", name: "" };
    let dividedStats = { name: "", pour: 0, contre: 0, abstention: 0, total: 0 };

    for (const [code, counts] of groupVotes) {
      if (counts.total < 10) continue;
      const pourPct = counts.pour / counts.total;
      const division = Math.min(pourPct, 1 - pourPct);
      if (division > maxDivision) {
        maxDivision = division;
        dividedGroup = { code, name: counts.name };
        dividedStats = counts;
      }
    }

    if (maxDivision < 0.25) continue;

    const total = s.votesFor + s.votesAgainst + s.votesAbstain;
    const pourPct = Math.round((s.votesFor / total) * 100);
    const contrePct = Math.round((s.votesAgainst / total) * 100);
    const result = VOTING_RESULT_LABELS[s.result].toLowerCase();
    const pourPartyPct = Math.round((dividedStats.pour / dividedStats.total) * 100);
    const contrePartyPct = Math.round((dividedStats.contre / dividedStats.total) * 100);

    const date = s.votingDate.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    let content = `🗳️ Le groupe ${dividedGroup.name} vote en ordre dispersé\n\n`;
    content += `${s.title}\n\n`;
    content += `Résultat global : ${result} (${pourPct}% pour, ${contrePct}% contre) — scrutin du ${date}.\n\n`;
    content += `Au sein du groupe ${dividedGroup.name} (${dividedGroup.code}), le vote était loin d'être unanime : ${pourPartyPct}% des députés ont voté pour, ${contrePartyPct}% contre`;
    if (dividedStats.abstention > 0) {
      content += `, ${Math.round((dividedStats.abstention / dividedStats.total) * 100)}% se sont abstenus`;
    }
    content += `.`;

    if (s.summary) {
      content += `\n\n${s.summary}`;
    }

    drafts.push({
      category: "🗳️ Votes clivants",
      content,
      link: `${SITE_URL}/votes/${s.slug || s.id}`,
    });

    if (drafts.length >= 2) break;
  }

  return drafts;
}

async function partyStats(): Promise<TweetDraft[]> {
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

  const partyAffairMap = new Map<string, { count: number; members: number }>();
  for (const p of politiciansWithParty) {
    const party = p.currentParty!.shortName;
    const entry = partyAffairMap.get(party) || { count: 0, members: 0 };
    entry.count += politicianAffairs.get(p.id) || 0;
    entry.members++;
    partyAffairMap.set(party, entry);
  }

  const totalPoliticians = parties.reduce((sum, p) => sum + p._count.politicians, 0);
  const topParties = parties.slice(0, 6);

  let content = `📊 Que surveille Poligraph ?\n\n`;
  content += `${totalPoliticians} responsables politiques français sont documentés sur Poligraph, avec leurs votes, mandats et affaires judiciaires.\n\n`;
  content += `Répartition par parti :\n`;
  for (const p of topParties) {
    content += `• ${p.name} (${p.shortName}) : ${p._count.politicians} élus\n`;
  }
  content += `\nCes données sont publiques et vérifiables — on ne fait que les rendre accessibles.`;

  const drafts: TweetDraft[] = [
    {
      category: "📊 Stats",
      content,
      link: `${SITE_URL}/statistiques`,
    },
  ];

  // Second tweet: affairs by party with ratio
  const sortedAffairs = [...partyAffairMap.entries()]
    .filter(([, v]) => v.count > 0)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 6);

  if (sortedAffairs.length > 0) {
    const totalAffairs = sortedAffairs.reduce((sum, [, v]) => sum + v.count, 0);

    let affairContent = `⚖️ Affaires judiciaires : quel parti est le plus concerné ?\n\n`;
    affairContent += `${totalAffairs} affaires documentées (implication directe uniquement) :\n\n`;
    for (const [party, { count, members }] of sortedAffairs) {
      const ratio = (count / members).toFixed(1);
      affairContent += `• ${party} : ${count} affaires (${ratio} par élu référencé)\n`;
    }
    affairContent += `\nToutes les affaires sont sourcées et vérifiables. La présomption d'innocence s'applique tant qu'aucune condamnation définitive n'est prononcée.`;

    drafts.push({
      category: "📊 Stats",
      content: affairContent,
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
          currentParty: { select: { shortName: true, name: true } },
          mandates: {
            where: { isCurrent: true },
            take: 1,
            select: { type: true },
          },
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
    const party = a.politician.currentParty?.shortName || "";
    const mandate = a.politician.mandates[0];
    const mandateLabel = mandate ? MANDATE_TYPE_LABELS[mandate.type].toLowerCase() : "";

    let content = `⚖️ ${a.title}\n\n`;
    content += `${a.politician.fullName}`;
    if (party) content += ` (${party})`;
    if (mandateLabel) content += `, ${mandateLabel}`;
    content += `.\n\n`;
    content += `Catégorie : ${categoryLabel}\nStatut : ${statusLabel}\n`;

    if (a.description) {
      const desc =
        a.description.length > 500 ? a.description.substring(0, 497) + "..." : a.description;
      content += `\n${desc}\n`;
    }

    if (needsPresumption) {
      content += `\n⚖️ Rappel : la présomption d'innocence s'applique — aucune condamnation définitive n'a été prononcée à ce stade.`;
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
    select: { verdictRating: true, claimant: true, title: true, source: true },
  });

  if (recent.length < 3) return [];

  const truthy = recent.filter((f) => ["TRUE", "MOSTLY_TRUE"].includes(f.verdictRating)).length;
  const misleading = recent.filter((f) =>
    ["HALF_TRUE", "MISLEADING", "OUT_OF_CONTEXT"].includes(f.verdictRating)
  ).length;
  const falsy = recent.filter((f) => ["MOSTLY_FALSE", "FALSE"].includes(f.verdictRating)).length;

  // Pick one notable false claim for the hook
  const notableFalse = recent.find(
    (f) => ["MOSTLY_FALSE", "FALSE"].includes(f.verdictRating) && f.claimant
  );

  let content = `🔍 Fact-checking de la semaine\n\n`;
  content += `${recent.length} déclarations de responsables politiques passées au crible cette semaine :\n\n`;
  content += `✅ ${truthy} vraie(s) ou plutôt vraie(s)\n`;
  content += `⚠️ ${misleading} trompeuse(s) ou sortie(s) de contexte\n`;
  content += `❌ ${falsy} fausse(s) ou plutôt fausse(s)\n`;

  if (notableFalse) {
    content += `\nExemple : "${notableFalse.title}"`;
    if (notableFalse.claimant) content += ` (${notableFalse.claimant})`;
    if (notableFalse.source) content += ` — vérifié par ${notableFalse.source}`;
  }

  content += `\n\nQui dit vrai ? Vérifiez par vous-même.`;

  return [
    {
      category: "🔍 Fact-checks",
      content,
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
      currentParty: { select: { shortName: true, name: true } },
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
  const mandateLabel = mandate ? MANDATE_TYPE_LABELS[mandate.type].toLowerCase() : "";
  const constituency = mandate?.constituency ? ` (${mandate.constituency})` : "";
  const partyName = politician.currentParty?.name || "";

  let content = `👤 Connaissez-vous votre élu ?\n\n`;
  content += `${politician.fullName}`;
  if (partyName) content += `, ${partyName}`;
  if (mandateLabel) content += `, ${mandateLabel}${constituency}`;
  content += `.\n\n`;

  if (politician._count.votes > 0) {
    content += `📊 ${politician._count.votes.toLocaleString("fr-FR")} votes enregistrés au Parlement\n`;
  }
  if (politician._count.affairs > 0) {
    content += `⚖️ ${politician._count.affairs} affaire(s) judiciaire(s) documentée(s)\n`;
  }
  if (politician._count.affairs === 0) {
    content += `✅ Aucune affaire judiciaire documentée\n`;
  }

  if (politician.biography) {
    const bio =
      politician.biography.length > 400
        ? politician.biography.substring(0, 397) + "..."
        : politician.biography;
    content += `\n${bio}\n`;
  }

  content += `\nRetrouvez sa fiche complète : votes, mandats, patrimoine déclaré.`;

  return [
    {
      category: "👤 Profil du jour",
      content,
      link: `${SITE_URL}/politiques/${politician.slug}`,
    },
  ];
}

async function elections(): Promise<TweetDraft[]> {
  const now = new Date();

  const upcoming = await db.election.findFirst({
    where: {
      status: { in: ["UPCOMING", "REGISTRATION", "CANDIDACIES", "CAMPAIGN"] },
      round1Date: { gte: now },
    },
    orderBy: { round1Date: "asc" },
    include: {
      _count: { select: { candidacies: true } },
    },
  });

  if (upcoming) {
    const typeLabel = ELECTION_TYPE_LABELS[upcoming.type];
    const statusLabel = ELECTION_STATUS_LABELS[upcoming.status];
    const date = upcoming.round1Date!.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const days = daysUntil(upcoming.round1Date!);

    let content = `🗳️ ${typeLabel} : J-${days}\n\n`;
    content += `${upcoming.title}\n`;
    content += `📅 1er tour le ${date}\n`;
    content += `📌 Statut : ${statusLabel}\n`;

    if (upcoming._count.candidacies > 0) {
      content += `👥 ${upcoming._count.candidacies} candidature(s) enregistrée(s)\n`;
    }

    if (upcoming.description) {
      const desc =
        upcoming.description.length > 300
          ? upcoming.description.substring(0, 297) + "..."
          : upcoming.description;
      content += `\n${desc}\n`;
    }

    content += `\nSuivez les candidatures et résultats en temps réel.`;

    return [
      {
        category: "🗳️ Élections",
        content,
        link: `${SITE_URL}/elections/${upcoming.slug}`,
      },
    ];
  }

  const recent = await db.election.findFirst({
    where: { status: "COMPLETED" },
    orderBy: { round1Date: "desc" },
  });

  if (recent) {
    const typeLabel = ELECTION_TYPE_LABELS[recent.type];
    let content = `🗳️ Résultats : ${typeLabel.toLowerCase()}\n\n`;
    content += `${recent.title}\n\n`;
    content += `Retrouvez tous les résultats, les élus et les candidats.`;

    return [
      {
        category: "🗳️ Élections",
        content,
        link: `${SITE_URL}/elections/${recent.slug}`,
      },
    ];
  }

  return [];
}

const FEED_NAMES: Record<string, string> = {
  lemonde: "Le Monde",
  lefigaro: "Le Figaro",
  mediapart: "Mediapart",
  liberation: "Libération",
  bfmtv: "BFMTV",
  france24: "France 24",
  politico: "Politico",
  google: "Google News",
  ouest_france: "Ouest-France",
  la_depeche: "La Dépêche",
  laprovence: "La Provence",
  dernieresnouvellesalsace: "DNA",
  contexte: "Contexte",
  lcp: "LCP",
};

async function recentPress(): Promise<TweetDraft[]> {
  const twoDaysAgo = new Date();
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

  const mentions = await db.pressArticleMention.findMany({
    where: {
      article: { publishedAt: { gte: twoDaysAgo } },
      politician: { publicationStatus: "PUBLISHED", prominenceScore: { gte: 200 } },
    },
    include: {
      article: { select: { title: true, feedSource: true, publishedAt: true } },
      politician: {
        select: {
          fullName: true,
          slug: true,
          currentParty: { select: { shortName: true } },
        },
      },
    },
    orderBy: { article: { publishedAt: "desc" } },
    take: 20,
  });

  if (mentions.length === 0) return [];

  // Group by politician, pick the one with most mentions
  const byPolitician = new Map<string, typeof mentions>();
  for (const m of mentions) {
    const key = m.politician.slug;
    const list = byPolitician.get(key) || [];
    list.push(m);
    byPolitician.set(key, list);
  }

  const topEntry = [...byPolitician.entries()].sort((a, b) => b[1].length - a[1].length)[0];

  if (!topEntry) return [];

  const [, pMentions] = topEntry;
  const pol = pMentions[0].politician;
  const party = pol.currentParty?.shortName ? ` (${pol.currentParty.shortName})` : "";

  // Deduplicate by feedSource, take top 5
  const seen = new Set<string>();
  const uniqueArticles = pMentions
    .filter((m) => {
      if (seen.has(m.article.feedSource)) return false;
      seen.add(m.article.feedSource);
      return true;
    })
    .slice(0, 5);

  let content = `📰 ${pol.fullName}${party} dans la presse\n\n`;
  content += `${pMentions.length} mention(s) dans les dernières 48h :\n\n`;

  for (const m of uniqueArticles) {
    const source = FEED_NAMES[m.article.feedSource] || m.article.feedSource;
    content += `• ${m.article.title} (${source})\n`;
  }

  content += `\nRetrouvez toute la couverture presse sur sa fiche.`;

  return [
    {
      category: "📰 Presse",
      content,
      link: `${SITE_URL}/politiques/${pol.slug}`,
    },
  ];
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
      const fullText = t.link ? `${t.content}\n\n👉 ${t.link}` : t.content;
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
