import { db } from "@/lib/db";
import {
  AFFAIR_STATUS_LABELS,
  AFFAIR_STATUS_NEEDS_PRESUMPTION,
  VOTING_RESULT_LABELS,
  MANDATE_TYPE_LABELS,
} from "@/config/labels";
import { SITE_URL } from "./config";

// --- Types ---

export interface TweetDraft {
  category: string; // emoji + titre de section
  content: string; // texte du tweet
  link?: string; // lien poligraph.fr
  hashtags?: string[]; // hashtags (sans #)
  mentions?: string[]; // comptes Twitter a tagger (sans @)
}

// --- Hashtags par categorie ---

export const CATEGORY_HASHTAGS: Record<string, string[]> = {
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

// --- Comptes Twitter des medias et institutions ---

export const MEDIA_TWITTER: Record<string, string> = {
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
export const CHAMBER_TWITTER: Record<string, string> = {
  AN: "AssembleeNat",
  SENAT: "Senat",
};

export const FEED_NAMES: Record<string, string> = {
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

export const VERDICT_LABELS: Record<string, string> = {
  TRUE: "vrai",
  MOSTLY_TRUE: "plutôt vrai",
  HALF_TRUE: "à nuancer",
  MISLEADING: "trompeur",
  OUT_OF_CONTEXT: "hors contexte",
  MOSTLY_FALSE: "plutôt faux",
  FALSE: "faux",
  UNVERIFIABLE: "invérifiable",
};

// --- Helpers ---

export function daysUntil(date: Date): number {
  const now = new Date();
  return Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export function formatDate(d: Date): string {
  return d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function plural(n: number, singular: string, pluralForm?: string): string {
  return n <= 1 ? singular : pluralForm || singular + "s";
}

// --- Generateurs ---

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

    let content = `\u{1F5F3}\uFE0F ${pourPartyPct}% pour, ${contrePartyPct}% contre \u2014 au sein du m\u00EAme groupe.\n\n`;
    content += `Le groupe ${dividedGroup.name} s'est fractur\u00E9 sur \u00AB ${s.title} \u00BB.`;
    if (dividedStats.abstention > 0) {
      content += ` ${Math.round((dividedStats.abstention / dividedStats.total) * 100)}% se sont abstenus.`;
    }
    content += `\n\n`;
    content += `R\u00E9sultat final : ${result} (${pourPct}\u2013${contrePct}). Scrutin du ${formatDate(s.votingDate)}.`;

    if (s.summary) {
      content += `\n\n${s.summary}`;
    }

    const chamberHandle = CHAMBER_TWITTER[s.chamber || "AN"];
    drafts.push({
      category: "\u{1F5F3}\uFE0F Votes clivants",
      content,
      link: `${SITE_URL}/votes/${s.slug || s.id}`,
      hashtags: s.chamber === "SENAT" ? ["DirectSenat", "PolitiqueFR"] : CATEGORY_HASHTAGS.votes,
      mentions: chamberHandle ? [chamberHandle] : [],
    });

    if (drafts.length >= 2) break;
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

    const chamberLabel = s.chamber === "AN" ? "l'Assembl\u00E9e" : "le S\u00E9nat";

    let content = `\u{1F91D} ${Math.round(pourPct)}% pour, ${s.votesAgainst} contre.\n\n`;
    content += `\u00AB ${s.title} \u00BB \u2014 adopt\u00E9 quasi \u00E0 l'unanimit\u00E9 par ${chamberLabel} le ${formatDate(s.votingDate)}.`;
    content += `\n\n${s.votesFor} pour, ${s.votesAgainst} contre, ${s.votesAbstain} abstentions.`;

    if (s.summary) {
      const sum = s.summary.length > 300 ? s.summary.substring(0, 297) + "..." : s.summary;
      content += `\n\n${sum}`;
    }

    const chamberTag = s.chamber === "SENAT" ? "DirectSenat" : "DirectAN";
    drafts.push({
      category: "\u{1F91D} Consensus",
      content,
      link: `${SITE_URL}/votes/${s.slug || s.id}`,
      hashtags: [chamberTag, "PolitiqueFR"],
      mentions: CHAMBER_TWITTER[s.chamber] ? [CHAMBER_TWITTER[s.chamber]] : [],
    });

    if (drafts.length >= 1) break;
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

  let content = `\u{1F4CA} ${totalPoliticians} responsables politiques pass\u00E9s au crible.\n\n`;
  for (const p of topParties) {
    content += `\u2022 ${p.shortName} \u2014 ${p._count.politicians} \u00E9lus\n`;
  }
  content += `\nVotes, mandats, affaires, patrimoine : donn\u00E9es publiques, m\u00EAmes crit\u00E8res pour chacun.`;

  const drafts: TweetDraft[] = [
    {
      category: "\u{1F4CA} Chiffres",
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

    let condContent = `\u2696\uFE0F ${totalCondamnations} condamnations d'\u00E9lus, r\u00E9parties comment ?\n\n`;
    for (const [party, { count, members }] of sortedCondamnations) {
      const ratio = (count / members).toFixed(1);
      condContent += `\u2022 ${party} : ${count} ${plural(count, "condamnation")} (ratio ${ratio} pour ${members} ${plural(members, "\u00E9lu")})\n`;
    }
    condContent += `\n1\u00E8re instance, appel ou d\u00E9finitive. Implication directe uniquement.`;

    drafts.push({
      category: "\u{1F4CA} Chiffres",
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
    const needsPresumption = AFFAIR_STATUS_NEEDS_PRESUMPTION[a.status];
    const party = a.politician.currentParty?.shortName || "";
    const mandate = a.politician.mandates[0];
    const mandateLabel = mandate ? MANDATE_TYPE_LABELS[mandate.type].toLowerCase() : "";

    let content = `\u2696\uFE0F ${a.politician.fullName}`;
    if (party) content += ` (${party})`;
    if (mandateLabel) content += `, ${mandateLabel}`;
    content += `\n\n${a.title}\n\n`;
    content += `Statut : ${statusLabel}.`;

    if (a.description) {
      const desc =
        a.description.length > 500 ? a.description.substring(0, 497) + "..." : a.description;
      content += `\n\n${desc}`;
    }

    if (needsPresumption) {
      content += `\n\n\u26A0\uFE0F Pr\u00E9somption d'innocence : pas de condamnation d\u00E9finitive \u00E0 ce stade.`;
    }

    return {
      category: "\u2696\uFE0F Affaires r\u00E9centes",
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
    select: {
      slug: true,
      title: true,
      claimText: true,
      claimant: true,
      verdict: true,
      verdictRating: true,
      source: true,
      publishedAt: true,
      mentions: {
        where: { isClaimant: true },
        include: {
          politician: {
            select: {
              fullName: true,
              slug: true,
              currentParty: { select: { shortName: true } },
            },
          },
        },
        take: 1,
      },
    },
    orderBy: { publishedAt: "desc" },
  });

  if (recent.length === 0) return [];

  const drafts: TweetDraft[] = [];

  // --- Tweet 1: One notable factcheck with context ---

  // Prefer a factcheck linked to a known politician, or a notable false claim
  const notable =
    recent.find(
      (f) => ["MOSTLY_FALSE", "FALSE"].includes(f.verdictRating) && f.mentions.length > 0
    ) ||
    recent.find((f) => f.mentions.length > 0) ||
    recent.find((f) => ["MOSTLY_FALSE", "FALSE"].includes(f.verdictRating) && f.claimant) ||
    recent[0];

  const verdictLabel = VERDICT_LABELS[notable.verdictRating] || notable.verdict;
  const politician = notable.mentions[0]?.politician;
  const party = politician?.currentParty?.shortName;

  let content = `\u{1F50D} `;
  if (politician) {
    content += `V\u00E9rifi\u00E9 \u2014 ${politician.fullName}`;
    if (party) content += ` (${party})`;
    content += ` a d\u00E9clar\u00E9 :\n\n`;
  } else if (notable.claimant) {
    // Skip generic claimants like "utilisateurs de reseaux sociaux"
    const isGenericClaimant = /utilisateur|r\u00E9seaux|social|internet|viral/i.test(notable.claimant);
    if (isGenericClaimant) {
      content += `Cette affirmation circule en ligne :\n\n`;
    } else {
      content += `V\u00E9rifi\u00E9 \u2014 ${notable.claimant} a d\u00E9clar\u00E9 :\n\n`;
    }
  } else {
    content += `Cette affirmation circule en ligne :\n\n`;
  }

  // Use claimText (the actual claim) if available, otherwise title
  const claim = notable.claimText || notable.title;
  const claimTruncated = claim.length > 300 ? claim.substring(0, 297) + "..." : claim;
  content += `\u00AB ${claimTruncated} \u00BB\n\n`;
  content += `Verdict : ${verdictLabel}`;
  if (notable.source) content += ` (v\u00E9rifi\u00E9 par ${notable.source})`;
  content += `.`;

  // Link to the specific factcheck page, or the politician's page
  const link = notable.slug
    ? `${SITE_URL}/factchecks/${notable.slug}`
    : politician?.slug
      ? `${SITE_URL}/politiques/${politician.slug}`
      : `${SITE_URL}/factchecks`;

  drafts.push({
    category: "\u{1F50D} Fact-checks",
    content,
    link,
    hashtags: CATEGORY_HASHTAGS.factchecks,
  });

  // --- Tweet 2 (optional): Weekly summary if enough data ---

  if (recent.length >= 3) {
    const truthy = recent.filter((f) => ["TRUE", "MOSTLY_TRUE"].includes(f.verdictRating)).length;
    const misleading = recent.filter((f) =>
      ["HALF_TRUE", "MISLEADING", "OUT_OF_CONTEXT"].includes(f.verdictRating)
    ).length;
    const falsy = recent.filter((f) => ["MOSTLY_FALSE", "FALSE"].includes(f.verdictRating)).length;

    let summary = `\u{1F50D} ${recent.length} d\u00E9clarations politiques v\u00E9rifi\u00E9es cette semaine.\n\n`;
    summary += `\u2705 ${truthy} ${plural(truthy, "vraie")}\n`;
    summary += `\u26A0\uFE0F ${misleading} ${plural(misleading, "trompeuse")}\n`;
    summary += `\u274C ${falsy} ${plural(falsy, "fausse")}\n\n`;
    summary += `Qui dit vrai ? Qui d\u00E9forme la r\u00E9alit\u00E9 ? Les fact-checks compil\u00E9s sur une seule page.`;

    drafts.push({
      category: "\u{1F50D} Fact-checks",
      content: summary,
      link: `${SITE_URL}/factchecks`,
      hashtags: CATEGORY_HASHTAGS.factchecks,
    });
  }

  return drafts;
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

  // Build the hook -- lead with the most striking stat
  let hook = "";
  if (politician._count.votes > 0 && politician._count.affairs > 0) {
    hook = `${politician._count.votes.toLocaleString("fr-FR")} votes enregistr\u00E9s, ${politician._count.affairs} ${plural(politician._count.affairs, "affaire")} judiciaire${politician._count.affairs > 1 ? "s" : ""}`;
  } else if (politician._count.votes > 0) {
    hook = `${politician._count.votes.toLocaleString("fr-FR")} votes enregistr\u00E9s, aucune affaire judiciaire`;
  } else {
    hook = mandateLabel || "\u00E9lu en exercice";
  }

  let content = `\u{1F464} ${politician.fullName} \u2014 ${hook}.\n\n`;

  const details = [partyName, mandateLabel ? `${mandateLabel}${constituency}` : ""]
    .filter(Boolean)
    .join(" \u00B7 ");
  if (details) content += `\u{1F3DB}\uFE0F ${details}\n`;

  if (politician.biography) {
    const bio =
      politician.biography.length > 400
        ? politician.biography.substring(0, 397) + "..."
        : politician.biography;
    content += `\n${bio}`;
  }

  return [
    {
      category: "\u{1F464} Profil du jour",
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

    let content = `\u{1F5F3}\uFE0F J-${days}.\n\n`;
    content += `${upcoming.title} \u2014 1er tour le ${date}.`;

    if (upcoming._count.candidacies > 0) {
      content += `\n${upcoming._count.candidacies} ${plural(upcoming._count.candidacies, "candidature")} enregistr\u00E9e${upcoming._count.candidacies > 1 ? "s" : ""}.`;
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
        category: "\u{1F5F3}\uFE0F \u00C9lections",
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
    let content = `\u{1F5F3}\uFE0F ${recent.title}\n\n`;
    content += `R\u00E9sultats, \u00E9lus, candidats \u2014 tout est en ligne.`;

    return [
      {
        category: "\u{1F5F3}\uFE0F \u00C9lections",
        content,
        link: `${SITE_URL}/elections/${recent.slug}`,
        hashtags: CATEGORY_HASHTAGS.elections,
      },
    ];
  }

  return [];
}

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

  let content = `\u{1F4F0} \u00AB ${firstArticle.article.title} \u00BB\n${firstSource}\n\n`;
  content += `${pol.fullName}${party} \u2014 ${pMentions.length} ${plural(pMentions.length, "mention")} presse en 48h.`;

  if (uniqueArticles.length > 1) {
    content += `\n\nDans la presse aussi :\n`;
    for (const m of uniqueArticles.slice(1)) {
      const source = FEED_NAMES[m.article.feedSource] || m.article.feedSource;
      content += `\u2022 ${m.article.title} (${source})\n`;
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
      category: "\u{1F4F0} Revue de presse",
      content,
      link: `${SITE_URL}/politiques/${pol.slug}`,
      hashtags: CATEGORY_HASHTAGS.presse,
      mentions: uniqueMentions,
    },
  ];
}

async function participationRanking(): Promise<TweetDraft[]> {
  const participationSelect = {
    firstName: true,
    lastName: true,
    slug: true,
    participationRate: true,
    votesCount: true,
    eligibleScrutins: true,
    chamber: true,
    groupName: true,
  } as const;

  // Query separately per chamber to avoid mixing AN/SENAT rankings
  const [bottomAN, topAN] = await Promise.all([
    db.politicianParticipation.findMany({
      where: { eligibleScrutins: { gte: 50 }, chamber: "AN" },
      orderBy: { participationRate: "asc" },
      take: 5,
      select: participationSelect,
    }),
    db.politicianParticipation.findMany({
      where: { eligibleScrutins: { gte: 50 }, chamber: "AN" },
      orderBy: { participationRate: "desc" },
      take: 5,
      select: participationSelect,
    }),
  ]);

  const drafts: TweetDraft[] = [];

  if (bottomAN.length >= 3) {
    const worst = bottomAN[0];
    let content = `\u{1F4C9} ${worst.firstName} ${worst.lastName} a particip\u00E9 \u00E0 ${Math.round(worst.participationRate)}% des scrutins.\n\n`;
    content += `${worst.votesCount} votes sur ${worst.eligibleScrutins} possibles`;
    if (worst.groupName) content += ` (${worst.groupName})`;
    content += `.\n\nLes 5 taux de participation les plus bas (Assembl\u00E9e nationale) :\n`;
    for (const p of bottomAN) {
      content += `\u2022 ${p.firstName} ${p.lastName} \u2014 ${Math.round(p.participationRate)}%\n`;
    }

    drafts.push({
      category: "\u{1F4C9} Pr\u00E9sence au Parlement",
      content,
      link: `${SITE_URL}/statistiques`,
      hashtags: CATEGORY_HASHTAGS.presence,
    });
  }

  if (topAN.length >= 3) {
    const best = topAN[0];
    let content = `\u{1F4C8} ${best.firstName} ${best.lastName} : ${Math.round(best.participationRate)}% de participation aux scrutins.\n\n`;
    content += `${best.votesCount} votes sur ${best.eligibleScrutins}`;
    if (best.groupName) content += ` (${best.groupName})`;
    content += `.\n\nLes 5 parlementaires les plus assidus (Assembl\u00E9e nationale) :\n`;
    for (const p of topAN) {
      content += `\u2022 ${p.firstName} ${p.lastName} \u2014 ${Math.round(p.participationRate)}%\n`;
    }

    drafts.push({
      category: "\u{1F4C8} Pr\u00E9sence au Parlement",
      content,
      link: `${SITE_URL}/statistiques`,
      hashtags: CATEGORY_HASHTAGS.presence,
    });
  }

  return drafts;
}

// --- Exports ---

export const GENERATORS: Record<string, () => Promise<TweetDraft[]>> = {
  votes: divisiveVotes,
  consensus: unanimousVotes,
  chiffres: partyStats,
  affaires: recentAffairs,
  factchecks: factchecks,
  profil: deputySpotlight,
  elections: elections,
  presse: recentPress,
  presence: participationRanking,
};

/** Generate a single tweet draft for a given category. Returns null if the generator produces nothing. */
export async function generateForCategory(category: string): Promise<TweetDraft | null> {
  const gen = GENERATORS[category];
  if (!gen) return null;
  try {
    const drafts = await gen();
    return drafts[0] || null;
  } catch (err) {
    console.error(`[social] Generator "${category}" failed:`, err);
    return null;
  }
}
