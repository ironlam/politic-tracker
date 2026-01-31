import { anthropic } from "@ai-sdk/anthropic";
import { streamText } from "ai";
import { headers } from "next/headers";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { searchSimilar, type SearchResult } from "@/services/embeddings";
import { db } from "@/lib/db";

// Runtime configuration for streaming
export const runtime = "nodejs";
export const maxDuration = 30;

// System prompt for the chatbot - STRICT RAG RULES
const SYSTEM_PROMPT = `Tu es l'assistant IA intégré au site Transparence Politique.

INTERDICTIONS ABSOLUES :
- Ne JAMAIS dire "consultez le site", "recherchez sur le site", "visitez Transparence Politique"
- Ne JAMAIS mentionner "contexte fourni", "base de données fournie", "informations fournies"
- Ne JAMAIS inventer d'information non présente dans le CONTEXTE

SI TU N'AS PAS L'INFO :
Dis simplement : "Je n'ai pas trouvé d'information sur ce sujet dans nos données."
Ne propose PAS d'aller chercher ailleurs.

POUR LES AFFAIRES JUDICIAIRES :
Rappelle toujours : "Rappel : toute personne est présumée innocente jusqu'à preuve du contraire."

FORMAT DE RÉPONSE :
- Phrases complètes et terminées
- Listes avec tirets (-)
- Liens internes : [Nom](/politiques/slug) ou [Voir le vote](/votes/123)
- Jamais de "Source: contexte" - cite les vraies pages

CONTEXTE :
Tu reçois des données extraites de notre base. Utilise-les directement sans mentionner leur origine.`;

// Rate limiting configuration
let ratelimit: Ratelimit | null = null;

function getRatelimit(): Ratelimit | null {
  if (ratelimit) return ratelimit;

  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!redisUrl || !redisToken) {
    console.warn("Upstash Redis not configured, rate limiting disabled");
    return null;
  }

  const redis = new Redis({
    url: redisUrl,
    token: redisToken,
  });

  ratelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, "1 m"), // 10 requests per minute
    analytics: true,
    prefix: "chat",
  });

  return ratelimit;
}

// Get client IP for rate limiting
async function getClientIP(): Promise<string> {
  const headersList = await headers();
  const forwarded = headersList.get("x-forwarded-for");
  const realIP = headersList.get("x-real-ip");

  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  if (realIP) {
    return realIP;
  }
  return "unknown";
}

// Build context from RAG search results
function buildContext(results: SearchResult[]): string {
  if (results.length === 0) {
    return "Aucune information trouvée dans la base de données pour cette requête.";
  }

  const sections: string[] = [];

  for (const result of results) {
    const metadata = result.metadata || {};
    let section = `[${result.entityType}] `;

    switch (result.entityType) {
      case "POLITICIAN":
        section += `**${metadata.name || "Inconnu"}**\n`;
        section += result.content;
        if (metadata.slug) {
          section += `\n→ Fiche complète: /politiques/${metadata.slug}`;
        }
        break;

      case "DOSSIER":
        section += `**${metadata.title || "Dossier législatif"}**\n`;
        section += result.content;
        if (metadata.sourceUrl) {
          section += `\n→ Source: ${metadata.sourceUrl}`;
        }
        break;

      case "SCRUTIN":
        section += `**Vote: ${metadata.title || "Scrutin"}**\n`;
        section += result.content;
        if (metadata.sourceUrl) {
          section += `\n→ Source: ${metadata.sourceUrl}`;
        }
        break;

      case "AFFAIR":
        section += `**Affaire: ${metadata.title || "Affaire judiciaire"}**\n`;
        section += result.content;
        section += "\n⚠️ Rappel: Toute personne est présumée innocente jusqu'à preuve du contraire.";
        if (metadata.politicianSlug) {
          section += `\n→ Fiche: /politiques/${metadata.politicianSlug}`;
        }
        break;

      case "PARTY":
        section += `**Parti: ${metadata.name || "Parti politique"}**\n`;
        section += result.content;
        if (metadata.slug) {
          section += `\n→ Page parti: /partis/${metadata.slug}`;
        }
        break;

      default:
        section += result.content;
    }

    sections.push(section);
  }

  return sections.join("\n\n---\n\n");
}

// Fetch additional context for specific queries
async function fetchDirectContext(query: string): Promise<string | null> {
  const lowerQuery = query.toLowerCase();

  // Direct politician lookup by name
  const nameMatch = lowerQuery.match(
    /(?:qui est|informations? sur|fiche de?|parle[z-]?\s*moi de)\s+(.+)/
  );
  if (nameMatch) {
    const searchName = nameMatch[1].trim();
    const politician = await db.politician.findFirst({
      where: {
        OR: [
          { fullName: { contains: searchName, mode: "insensitive" } },
          { lastName: { contains: searchName, mode: "insensitive" } },
        ],
      },
      include: {
        currentParty: true,
        mandates: { where: { isCurrent: true }, take: 3 },
        affairs: { take: 3 },
      },
    });

    if (politician) {
      let context = `**${politician.civility || ""} ${politician.fullName}**\n`;
      if (politician.currentParty) {
        context += `Parti: ${politician.currentParty.name}\n`;
      }
      if (politician.birthDate) {
        context += `Né(e) le: ${politician.birthDate.toLocaleDateString("fr-FR")}\n`;
      }
      if (politician.mandates.length > 0) {
        context += "\nMandats actuels:\n";
        for (const m of politician.mandates) {
          context += `- ${m.title}\n`;
        }
      }
      if (politician.affairs.length > 0) {
        context += `\n⚠️ ${politician.affairs.length} affaire(s) judiciaire(s) référencée(s).\n`;
        context += "Rappel: Toute personne est présumée innocente jusqu'à preuve du contraire.\n";
      }
      context += `\n→ Fiche complète: /politiques/${politician.slug}`;
      return context;
    }
  }

  return null;
}

// Thematic keyword expansion
const THEME_KEYWORDS: Record<string, string[]> = {
  agriculture: ["agricole", "agriculteur", "paysan", "ferme", "exploitation", "pac", "élevage", "culture"],
  santé: ["santé", "hôpital", "médecin", "soin", "maladie", "sécu", "médical"],
  éducation: ["éducation", "école", "enseignant", "professeur", "étudiant", "université", "scolaire"],
  environnement: ["environnement", "écologie", "climat", "carbone", "énergie", "pollution", "vert"],
  économie: ["économie", "entreprise", "emploi", "travail", "chômage", "salaire", "fiscal"],
  retraite: ["retraite", "pension", "âge", "cotisation"],
  logement: ["logement", "loyer", "locataire", "propriétaire", "hlm", "immobilier"],
  sécurité: ["sécurité", "police", "gendarmerie", "délinquance", "criminalité"],
  immigration: ["immigration", "migrant", "asile", "frontière", "étranger"],
};

// Keyword-based database search (no embeddings required)
async function searchDatabaseByKeywords(query: string): Promise<string | null> {
  const lowerQuery = query.toLowerCase();
  const results: string[] = [];

  // Extract potential keywords
  let words = lowerQuery
    .replace(/[?!.,;:]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 2);

  // Expand thematic keywords
  for (const [theme, keywords] of Object.entries(THEME_KEYWORDS)) {
    if (keywords.some((kw) => lowerQuery.includes(kw))) {
      words = [...words, theme, ...keywords.slice(0, 3)];
      break;
    }
  }

  // Search for politicians by name
  if (words.length > 0) {
    const politicians = await db.politician.findMany({
      where: {
        OR: words.map((word) => ({
          OR: [
            { fullName: { contains: word, mode: "insensitive" as const } },
            { lastName: { contains: word, mode: "insensitive" as const } },
          ],
        })),
      },
      include: {
        currentParty: true,
        mandates: { where: { isCurrent: true }, take: 2 },
      },
      take: 3,
    });

    for (const p of politicians) {
      let info = `**${p.civility || ""} ${p.fullName}**`;
      if (p.currentParty) info += ` (${p.currentParty.name})`;
      if (p.mandates.length > 0) {
        info += ` - ${p.mandates[0].title}`;
      }
      info += `\n→ /politiques/${p.slug}`;
      results.push(info);
    }
  }

  // Check for party-related questions
  if (lowerQuery.includes("parti") || lowerQuery.includes("groupe")) {
    const parties = await db.party.findMany({
      where: {
        OR: words.map((word) => ({
          OR: [
            { name: { contains: word, mode: "insensitive" as const } },
            { shortName: { contains: word, mode: "insensitive" as const } },
          ],
        })),
      },
      include: {
        _count: { select: { politicians: true } },
      },
      take: 3,
    });

    for (const party of parties) {
      results.push(
        `**${party.name}** (${party.shortName}) - ${party._count.politicians} membre(s)\n→ /partis/${party.slug}`
      );
    }
  }

  // Check for thematic or vote-related questions (loi, vote, or theme keywords)
  const isThematicQuery = Object.values(THEME_KEYWORDS).some((keywords) =>
    keywords.some((kw) => lowerQuery.includes(kw))
  );
  const isVoteQuery = lowerQuery.includes("vote") || lowerQuery.includes("scrutin") || lowerQuery.includes("loi");

  if (isThematicQuery || isVoteQuery) {
    // Search for relevant dossiers
    const searchTerms = words.filter((w) => w.length > 3);
    if (searchTerms.length > 0) {
      const dossiers = await db.legislativeDossier.findMany({
        where: {
          OR: searchTerms.map((term) => ({
            OR: [
              { title: { contains: term, mode: "insensitive" as const } },
              { shortTitle: { contains: term, mode: "insensitive" as const } },
              { category: { contains: term, mode: "insensitive" as const } },
            ],
          })),
        },
        orderBy: { filingDate: "desc" },
        take: 3,
      });

      for (const d of dossiers) {
        const statusLabels: Record<string, string> = {
          EN_COURS: "En discussion",
          ADOPTE: "Adopté",
          REJETE: "Rejeté",
          RETIRE: "Retiré",
        };
        results.push(
          `**${d.shortTitle || d.title.slice(0, 80)}**\n` +
          `Statut: ${statusLabels[d.status] || d.status}` +
          (d.category ? ` | Catégorie: ${d.category}` : "") +
          (d.filingDate ? `\nDate: ${d.filingDate.toLocaleDateString("fr-FR")}` : "") +
          `\n→ [Voir le dossier](/assemblee/${d.id})`
        );
      }

      // Also search for votes
      const scrutins = await db.scrutin.findMany({
        where: {
          OR: searchTerms.map((term) => ({
            title: { contains: term, mode: "insensitive" as const },
          })),
        },
        orderBy: { votingDate: "desc" },
        take: 3,
      });

      for (const s of scrutins) {
        const result = s.result === "ADOPTED" ? "Adopté" : "Rejeté";
        results.push(
          `**Vote: ${s.title.slice(0, 100)}${s.title.length > 100 ? "..." : ""}**\n` +
          `Date: ${s.votingDate.toLocaleDateString("fr-FR")} - ${result}\n` +
          `Pour: ${s.votesFor}, Contre: ${s.votesAgainst}, Abstention: ${s.votesAbstain}`
        );
      }
    }
  }

  // Check for statistics questions
  if (lowerQuery.includes("combien") || lowerQuery.includes("nombre") || lowerQuery.includes("statistique")) {
    const [deputeCount, senateurCount, partyCount] = await Promise.all([
      db.mandate.count({ where: { type: "DEPUTE", isCurrent: true } }),
      db.mandate.count({ where: { type: "SENATEUR", isCurrent: true } }),
      db.party.count(),
    ]);

    results.push(
      `**Statistiques actuelles:**\n` +
      `- ${deputeCount} députés en exercice\n` +
      `- ${senateurCount} sénateurs en exercice\n` +
      `- ${partyCount} partis politiques référencés\n` +
      `→ Plus de détails sur /statistiques`
    );
  }

  // Check for institution questions
  if (
    lowerQuery.includes("assemblée") ||
    lowerQuery.includes("sénat") ||
    lowerQuery.includes("gouvernement") ||
    lowerQuery.includes("institution")
  ) {
    results.push(
      `Pour comprendre le fonctionnement des institutions françaises, consultez:\n→ /institutions`
    );
  }

  if (results.length === 0) {
    return null;
  }

  return results.join("\n\n---\n\n");
}

export async function POST(request: Request) {
  try {
    // Rate limiting
    const limiter = getRatelimit();
    if (limiter) {
      const ip = await getClientIP();
      const { success, remaining, reset } = await limiter.limit(ip);

      if (!success) {
        return new Response(
          JSON.stringify({
            error: "Trop de requêtes. Veuillez réessayer dans quelques instants.",
            retryAfter: Math.ceil((reset - Date.now()) / 1000),
          }),
          {
            status: 429,
            headers: {
              "Content-Type": "application/json",
              "X-RateLimit-Remaining": remaining.toString(),
              "X-RateLimit-Reset": reset.toString(),
            },
          }
        );
      }
    }

    // Parse request
    const { messages } = await request.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "Messages requis" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Get the last user message for RAG search
    const lastUserMessage = messages
      .filter((m: { role: string }) => m.role === "user")
      .pop();

    if (!lastUserMessage) {
      return new Response(
        JSON.stringify({ error: "Aucun message utilisateur" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const userQuery = lastUserMessage.content;

    // First try direct context lookup from database
    let context = await fetchDirectContext(userQuery);

    // PRIORITY 1: Use semantic RAG search with Voyage AI embeddings
    if (!context && process.env.VOYAGE_API_KEY) {
      try {
        const searchResults = await searchSimilar({
          query: userQuery,
          limit: 8,
          threshold: 0.45, // Lower threshold to get more semantic matches
        });
        if (searchResults.length > 0) {
          context = buildContext(searchResults);
        }
      } catch (error) {
        console.error("RAG search error:", error);
      }
    }

    // PRIORITY 2: Fallback to keyword search if RAG found nothing
    if (!context) {
      context = await searchDatabaseByKeywords(userQuery);
    }

    // Fallback message
    if (!context) {
      context = "Aucune information trouvée pour cette requête.";
    }

    // Check for Anthropic API key
    if (!process.env.ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({
          error: "Service temporairement indisponible. Veuillez réessayer plus tard.",
        }),
        { status: 503, headers: { "Content-Type": "application/json" } }
      );
    }

    // Build messages with context
    const messagesWithContext = [
      ...messages.slice(0, -1), // Previous messages
      {
        role: "user",
        content: `CONTEXTE DE LA BASE DE DONNÉES:\n${context}\n\nQUESTION DE L'UTILISATEUR:\n${userQuery}`,
      },
    ];

    // Stream response using Vercel AI SDK
    const result = streamText({
      model: anthropic("claude-3-haiku-20240307"),
      system: SYSTEM_PROMPT,
      messages: messagesWithContext,
    });

    // Return streaming response
    return result.toTextStreamResponse();
  } catch (error) {
    console.error("Chat API error:", error);

    return new Response(
      JSON.stringify({
        error: "Une erreur s'est produite. Veuillez réessayer.",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

// Health check endpoint
export async function GET() {
  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  const hasUpstash =
    !!process.env.UPSTASH_REDIS_REST_URL &&
    !!process.env.UPSTASH_REDIS_REST_TOKEN;

  return new Response(
    JSON.stringify({
      status: "ok",
      features: {
        chat: hasAnthropic,
        rag: hasOpenAI,
        rateLimit: hasUpstash,
      },
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
}
