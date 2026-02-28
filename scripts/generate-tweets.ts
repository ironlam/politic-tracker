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
  hashtags?: string[]; // hashtags (sans #)
  mentions?: string[]; // comptes Twitter à tagger (sans @)
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://poligraph.fr";
const MAX_CHARS = 4000; // X Premium

// --- Hashtags par catégorie ---

const CATEGORY_HASHTAGS: Record<string, string[]> = {
  votes: ["DirectAN", "PolitiqueFR"],
  consensus: ["DirectAN", "PolitiqueFR"],
  chiffres: ["DataPolitique", "OpenData", "PolitiqueFR"],
  affaires: ["Justice", "PolitiqueFR"],
  factchecks: ["FactCheck", "PolitiqueFR"],
  profil: ["PolitiqueFR"],
  elections: ["Municipales2026", "Elections", "PolitiqueFR"],
  presse: ["PolitiqueFR"],
  presence: ["DirectAN", "Absenteisme", "PolitiqueFR"],
};

// --- Comptes Twitter des médias et institutions ---

const MEDIA_TWITTER: Record<string, string> = {
  lemonde: "lemondefr",
  lefigaro: "Le_Figaro",
  mediapart: "Mediapart",
  liberation: "libe",
  bfmtv: "BFMTV",
  france24: "France24_fr",
  lcp: "LCP",
  ouest_france: "OuestFrance",
};

// Handles institutionnels pour les votes selon la chambre
const CHAMBER_TWITTER: Record<string, string> = {
  AN: "AssembleeNat",
  SENAT: "Senat",
};

// --- Helpers ---

function daysUntil(date: Date): number {
  const now = new Date();
  return Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function plural(n: number, singular: string, pluralForm?: string): string {
  return n <= 1 ? singular : pluralForm || singular + "s";
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

    let content = `🗳️ ${pourPartyPct}% pour, ${contrePartyPct}% contre — au sein du même groupe.\n\n`;
    content += `Le groupe ${dividedGroup.name} s'est fracturé sur « ${s.title} ».`;
    if (dividedStats.abstention > 0) {
      content += ` ${Math.round((dividedStats.abstention / dividedStats.total) * 100)}% se sont abstenus.`;
    }
    content += `\n\n`;
    content += `Résultat final : ${result} (${pourPct}–${contrePct}). Scrutin du ${formatDate(s.votingDate)}.`;

    if (s.summary) {
      content += `\n\n${s.summary}`;
    }

    const chamberHandle = CHAMBER_TWITTER[s.chamber || "AN"];
    drafts.push({
      category: "🗳️ Votes clivants",
      content,
      link: `${SITE_URL}/votes/${s.slug || s.id}`,
      hashtags: s.chamber === "SENAT" ? ["DirectSenat", "PolitiqueFR"] : CATEGORY_HASHTAGS.votes,
      mentions: chamberHandle ? [chamberHandle] : [],
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

  const condamnationCounts = await db.affair.groupBy({
    by: ["politicianId"],
    where: {
      publicationStatus: "PUBLISHED",
      involvement: "DIRECT",
      status: {
        in: ["CONDAMNATION_DEFINITIVE", "CONDAMNATION_PREMIERE_INSTANCE", "APPEL_EN_COURS"],
      },
    },
    _count: true,
  });

  const politicianCondamnations = new Map(
    condamnationCounts.map((a) => [a.politicianId, a._count])
  );

  const politiciansWithParty = await db.politician.findMany({
    where: {
      publicationStatus: "PUBLISHED",
      currentPartyId: { not: null },
    },
    select: { id: true, currentParty: { select: { shortName: true } } },
  });

  const partyCondamnationMap = new Map<string, { count: number; members: number }>();
  for (const p of politiciansWithParty) {
    const party = p.currentParty!.shortName;
    const entry = partyCondamnationMap.get(party) || { count: 0, members: 0 };
    entry.count += politicianCondamnations.get(p.id) || 0;
    entry.members++;
    partyCondamnationMap.set(party, entry);
  }

  const totalPoliticians = parties.reduce((sum, p) => sum + p._count.politicians, 0);
  const topParties = parties.slice(0, 6);

  let content = `📊 ${totalPoliticians} responsables politiques passés au crible.\n\n`;
  for (const p of topParties) {
    content += `• ${p.shortName} — ${p._count.politicians} élus\n`;
  }
  content += `\nVotes, mandats, affaires, patrimoine : données publiques, mêmes critères pour chacun.`;

  const drafts: TweetDraft[] = [
    {
      category: "📊 Chiffres",
      content,
      link: `${SITE_URL}/statistiques`,
      hashtags: CATEGORY_HASHTAGS.chiffres,
    },
  ];

  // Second tweet: condamnations by party
  const sortedCondamnations = [...partyCondamnationMap.entries()]
    .filter(([, v]) => v.count > 0)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 6);

  if (sortedCondamnations.length > 0) {
    const totalCondamnations = sortedCondamnations.reduce((sum, [, v]) => sum + v.count, 0);

    let condContent = `⚖️ ${totalCondamnations} condamnations d'élus, réparties comment ?\n\n`;
    for (const [party, { count, members }] of sortedCondamnations) {
      const ratio = (count / members).toFixed(1);
      condContent += `• ${party} : ${count} ${plural(count, "condamnation")} (ratio ${ratio} pour ${members} ${plural(members, "élu")})\n`;
    }
    condContent += `\n1ère instance, appel ou définitive. Implication directe uniquement.`;

    drafts.push({
      category: "📊 Chiffres",
      content: condContent,
      link: `${SITE_URL}/affaires`,
      hashtags: ["Justice", "DataPolitique", "PolitiqueFR"],
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

    let content = `⚖️ ${a.politician.fullName}`;
    if (party) content += ` (${party})`;
    if (mandateLabel) content += `, ${mandateLabel}`;
    content += `\n${statusLabel} pour ${categoryLabel.toLowerCase()}.\n\n`;
    content += `${a.title}`;

    if (a.description) {
      const desc =
        a.description.length > 500 ? a.description.substring(0, 497) + "..." : a.description;
      content += `\n\n${desc}`;
    }

    if (needsPresumption) {
      content += `\n\n⚠️ Présomption d'innocence : pas de condamnation définitive à ce stade.`;
    }

    return {
      category: "⚖️ Affaires récentes",
      content,
      link: `${SITE_URL}/affaires/${a.slug}`,
      hashtags: CATEGORY_HASHTAGS.affaires,
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

  let content = `🔍 `;
  if (notableFalse) {
    content += `« ${notableFalse.title} »\n`;
    if (notableFalse.claimant) content += `— ${notableFalse.claimant}`;
    content += `\n\nVerdict : faux`;
    if (notableFalse.source) content += ` (source : ${notableFalse.source})`;
    content += `.\n\n`;
  } else {
    content += `${falsy} déclaration${falsy > 1 ? "s" : ""} politique${falsy > 1 ? "s" : ""} épinglée${falsy > 1 ? "s" : ""} cette semaine.\n\n`;
  }
  content += `Bilan des ${recent.length} déclarations vérifiées :\n`;
  content += `✅ ${truthy} ${plural(truthy, "vraie")}\n`;
  content += `⚠️ ${misleading} ${plural(misleading, "trompeuse")}\n`;
  content += `❌ ${falsy} ${plural(falsy, "fausse")}`;

  return [
    {
      category: "🔍 Fact-checks",
      content,
      link: `${SITE_URL}/factchecks`,
      hashtags: CATEGORY_HASHTAGS.factchecks,
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
  const constituency = mandate?.constituency ? `, ${mandate.constituency}` : "";
  const partyName = politician.currentParty?.shortName || "";

  // Build the hook — lead with the most striking stat
  let hook = "";
  if (politician._count.votes > 0 && politician._count.affairs > 0) {
    hook = `${politician._count.votes.toLocaleString("fr-FR")} votes enregistrés, ${politician._count.affairs} ${plural(politician._count.affairs, "affaire")} judiciaire${politician._count.affairs > 1 ? "s" : ""}`;
  } else if (politician._count.votes > 0) {
    hook = `${politician._count.votes.toLocaleString("fr-FR")} votes enregistrés, aucune affaire judiciaire`;
  } else {
    hook = mandateLabel || "élu en exercice";
  }

  let content = `👤 ${politician.fullName} — ${hook}.\n\n`;

  const details = [partyName, mandateLabel ? `${mandateLabel}${constituency}` : ""]
    .filter(Boolean)
    .join(" · ");
  if (details) content += `🏛️ ${details}\n`;

  if (politician.biography) {
    const bio =
      politician.biography.length > 400
        ? politician.biography.substring(0, 397) + "..."
        : politician.biography;
    content += `\n${bio}`;
  }

  return [
    {
      category: "👤 Profil du jour",
      content,
      link: `${SITE_URL}/politiques/${politician.slug}`,
      hashtags: CATEGORY_HASHTAGS.profil,
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
    const days = daysUntil(upcoming.round1Date!);
    const date = formatDate(upcoming.round1Date!);

    let content = `🗳️ J-${days}.\n\n`;
    content += `${upcoming.title} — 1er tour le ${date}.`;

    if (upcoming._count.candidacies > 0) {
      content += `\n${upcoming._count.candidacies} ${plural(upcoming._count.candidacies, "candidature")} enregistrée${upcoming._count.candidacies > 1 ? "s" : ""}.`;
    }

    if (upcoming.description) {
      const desc =
        upcoming.description.length > 300
          ? upcoming.description.substring(0, 297) + "..."
          : upcoming.description;
      content += `\n\n${desc}`;
    }

    return [
      {
        category: "🗳️ Élections",
        content,
        link: `${SITE_URL}/elections/${upcoming.slug}`,
        hashtags: CATEGORY_HASHTAGS.elections,
      },
    ];
  }

  const recent = await db.election.findFirst({
    where: { status: "COMPLETED" },
    orderBy: { round1Date: "desc" },
  });

  if (recent) {
    const typeLabel = ELECTION_TYPE_LABELS[recent.type];
    let content = `🗳️ ${recent.title}\n\n`;
    content += `Résultats, élus, candidats — tout est en ligne.`;

    return [
      {
        category: "🗳️ Élections",
        content,
        link: `${SITE_URL}/elections/${recent.slug}`,
        hashtags: CATEGORY_HASHTAGS.elections,
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

  // Lead with the first headline
  const firstArticle = uniqueArticles[0];
  const firstSource =
    FEED_NAMES[firstArticle.article.feedSource] || firstArticle.article.feedSource;

  let content = `📰 « ${firstArticle.article.title} »\n${firstSource}\n\n`;
  content += `${pol.fullName}${party} — ${pMentions.length} ${plural(pMentions.length, "mention")} presse en 48h.`;

  if (uniqueArticles.length > 1) {
    content += `\n\nDans la presse aussi :\n`;
    for (const m of uniqueArticles.slice(1)) {
      const source = FEED_NAMES[m.article.feedSource] || m.article.feedSource;
      content += `• ${m.article.title} (${source})\n`;
    }
  }

  // Collect media Twitter handles from cited sources
  const mediaMentions = uniqueArticles
    .map((m) => MEDIA_TWITTER[m.article.feedSource])
    .filter(Boolean);
  // Deduplicate
  const uniqueMentions = [...new Set(mediaMentions)];

  return [
    {
      category: "📰 Revue de presse",
      content,
      link: `${SITE_URL}/politiques/${pol.slug}`,
      hashtags: CATEGORY_HASHTAGS.presse,
      mentions: uniqueMentions,
    },
  ];
}

// --- Nouveaux générateurs ---

async function participationRanking(): Promise<TweetDraft[]> {
  // Bottom 5 participation — who shows up the least?
  const bottom = await db.politicianParticipation.findMany({
    where: { eligibleScrutins: { gte: 50 } },
    orderBy: { participationRate: "asc" },
    take: 5,
    select: {
      firstName: true,
      lastName: true,
      slug: true,
      participationRate: true,
      votesCount: true,
      eligibleScrutins: true,
      chamber: true,
      groupName: true,
    },
  });

  const top = await db.politicianParticipation.findMany({
    where: { eligibleScrutins: { gte: 50 } },
    orderBy: { participationRate: "desc" },
    take: 5,
    select: {
      firstName: true,
      lastName: true,
      slug: true,
      participationRate: true,
      votesCount: true,
      eligibleScrutins: true,
      chamber: true,
      groupName: true,
    },
  });

  const drafts: TweetDraft[] = [];

  if (bottom.length >= 3) {
    const worst = bottom[0];
    let content = `📉 ${worst.firstName} ${worst.lastName} a participé à ${Math.round(worst.participationRate)}% des scrutins.\n\n`;
    content += `${worst.votesCount} votes sur ${worst.eligibleScrutins} possibles`;
    if (worst.groupName) content += ` (${worst.groupName})`;
    content += `.\n\nLes 5 taux de participation les plus bas :\n`;
    for (const p of bottom) {
      content += `• ${p.firstName} ${p.lastName} — ${Math.round(p.participationRate)}%\n`;
    }

    drafts.push({
      category: "📉 Présence au Parlement",
      content,
      link: `${SITE_URL}/statistiques`,
      hashtags: CATEGORY_HASHTAGS.presence,
    });
  }

  if (top.length >= 3) {
    const best = top[0];
    let content = `📈 ${best.firstName} ${best.lastName} : ${Math.round(best.participationRate)}% de participation aux scrutins.\n\n`;
    content += `${best.votesCount} votes sur ${best.eligibleScrutins}`;
    if (best.groupName) content += ` (${best.groupName})`;
    content += `.\n\nLes 5 parlementaires les plus assidus :\n`;
    for (const p of top) {
      content += `• ${p.firstName} ${p.lastName} — ${Math.round(p.participationRate)}%\n`;
    }

    drafts.push({
      category: "📈 Présence au Parlement",
      content,
      link: `${SITE_URL}/statistiques`,
      hashtags: CATEGORY_HASHTAGS.presence,
    });
  }

  return drafts;
}

async function unanimousVotes(): Promise<TweetDraft[]> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const scrutins = await db.scrutin.findMany({
    where: {
      votingDate: { gte: thirtyDaysAgo },
      result: "ADOPTED",
    },
    orderBy: { votingDate: "desc" },
    take: 30,
    select: {
      id: true,
      slug: true,
      title: true,
      votingDate: true,
      votesFor: true,
      votesAgainst: true,
      votesAbstain: true,
      summary: true,
      chamber: true,
    },
  });

  const drafts: TweetDraft[] = [];

  for (const s of scrutins) {
    const total = s.votesFor + s.votesAgainst + s.votesAbstain;
    if (total < 50) continue;

    const pourPct = (s.votesFor / total) * 100;
    if (pourPct < 90) continue; // Only near-unanimous

    const chamberLabel = s.chamber === "AN" ? "l'Assemblée" : "le Sénat";

    let content = `🤝 ${Math.round(pourPct)}% pour, ${s.votesAgainst} contre.\n\n`;
    content += `« ${s.title} » — adopté quasi à l'unanimité par ${chamberLabel} le ${formatDate(s.votingDate)}.`;
    content += `\n\n${s.votesFor} pour, ${s.votesAgainst} contre, ${s.votesAbstain} abstentions.`;

    if (s.summary) {
      const sum = s.summary.length > 300 ? s.summary.substring(0, 297) + "..." : s.summary;
      content += `\n\n${sum}`;
    }

    const chamberTag = s.chamber === "SENAT" ? "DirectSenat" : "DirectAN";
    drafts.push({
      category: "🤝 Consensus",
      content,
      link: `${SITE_URL}/votes/${s.slug || s.id}`,
      hashtags: [chamberTag, "PolitiqueFR"],
      mentions: CHAMBER_TWITTER[s.chamber] ? [CHAMBER_TWITTER[s.chamber]] : [],
    });

    if (drafts.length >= 1) break;
  }

  return drafts;
}

// --- Rendu Markdown ---

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

// --- Main ---

async function main() {
  console.log("Génération des brouillons de tweets...\n");

  const generators = [
    { name: "Votes clivants", fn: divisiveVotes },
    { name: "Consensus", fn: unanimousVotes },
    { name: "Chiffres", fn: partyStats },
    { name: "Affaires récentes", fn: recentAffairs },
    { name: "Fact-checks", fn: factchecks },
    { name: "Profil du jour", fn: deputySpotlight },
    { name: "Élections", fn: elections },
    { name: "Revue de presse", fn: recentPress },
    { name: "Présence", fn: participationRanking },
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
