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
const SYSTEM_PROMPT = `Tu es l'assistant de Transparence Politique, un site d'information sur les représentants politiques français.

RÈGLES ABSOLUES :
1. Ne JAMAIS inventer d'information - réponds uniquement avec les données fournies
2. Toujours citer tes sources avec des liens cliquables quand disponibles
3. Pour toute mise en examen : rappeler systématiquement la présomption d'innocence
4. Si tu n'as pas l'info dans le contexte fourni, dis clairement : "Je n'ai pas cette information dans ma base de données. Vous pouvez consulter les fiches détaillées sur le site."
5. Ne pas donner d'opinions politiques personnelles
6. Rester factuel et neutre
7. En cas de doute, privilégier la prudence

FORMAT DE RÉPONSE :
- Réponds de manière concise et structurée
- Utilise des listes à puces pour les informations multiples
- Cite toujours les sources à la fin de ta réponse
- Si tu mentionnes une personne, utilise son nom complet

CONTEXTE FOURNI :
Tu recevras des informations de notre base de données avant chaque question. Base tes réponses UNIQUEMENT sur ce contexte.`;

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

    // First try direct context lookup
    let context = await fetchDirectContext(userQuery);

    // If no direct context, use RAG search
    if (!context) {
      // Check if OpenAI API key is configured for embeddings
      if (!process.env.OPENAI_API_KEY) {
        // Fallback: simple database search without embeddings
        context = "Base de données de Transparence Politique.\n";
        context += "Pour des informations détaillées, consultez les fiches sur le site.";
      } else {
        try {
          const searchResults = await searchSimilar({
            query: userQuery,
            limit: 5,
            threshold: 0.65,
          });
          context = buildContext(searchResults);
        } catch (error) {
          console.error("RAG search error:", error);
          context = "Erreur lors de la recherche. Veuillez reformuler votre question.";
        }
      }
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
