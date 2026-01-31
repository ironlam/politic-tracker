/**
 * AI Summary Service for Legislative Dossiers
 *
 * Uses Claude Haiku for cost-effective summarization of legislative texts.
 * Designed for batch processing, not real-time use.
 */

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-3-haiku-20240307";
const MAX_TOKENS = 500;

export interface SummaryRequest {
  title: string;
  content: string;
  procedure?: string;
}

export interface SummaryResponse {
  shortSummary: string; // 1-2 sentences
  keyPoints: string[]; // 3-5 bullet points
}

/**
 * Generate a summary for a legislative dossier
 */
export async function summarizeDossier(request: SummaryRequest): Promise<SummaryResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY environment variable is not set");
  }

  const prompt = `Tu es un expert en politique française. Résume ce dossier législatif de manière claire et accessible pour les citoyens.

Titre: ${request.title}
${request.procedure ? `Type: ${request.procedure}` : ""}

${request.content}

Réponds en JSON avec ce format exact:
{
  "shortSummary": "Résumé en 1-2 phrases simples expliquant l'essentiel du texte",
  "keyPoints": [
    "Point clé 1 (court, factuel)",
    "Point clé 2",
    "Point clé 3"
  ]
}

Consignes:
- Utilise un langage simple, évite le jargon juridique
- Sois objectif et factuel, pas de jugement politique
- Les points clés doivent être concrets et précis
- Maximum 5 points clés
- Si le contenu est insuffisant, génère un résumé basé uniquement sur le titre`;

  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic API error: ${response.status} - ${error}`);
  }

  const data = await response.json();

  // Extract the text content
  const textContent = data.content?.find((c: { type: string }) => c.type === "text");
  if (!textContent?.text) {
    throw new Error("No text content in API response");
  }

  // Parse the JSON response
  try {
    // Try to extract JSON from the response (may have markdown code blocks)
    let jsonStr = textContent.text;

    // Remove markdown code blocks if present
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }

    const parsed = JSON.parse(jsonStr.trim());

    return {
      shortSummary: parsed.shortSummary || "",
      keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [],
    };
  } catch {
    // If JSON parsing fails, try to extract content manually
    console.error("Failed to parse JSON response:", textContent.text);

    return {
      shortSummary: request.title,
      keyPoints: [],
    };
  }
}

/**
 * Rate-limited batch summarization
 */
export async function summarizeBatch(
  requests: SummaryRequest[],
  options: {
    delayMs?: number;
    onProgress?: (current: number, total: number) => void;
    onError?: (error: Error, index: number) => void;
  } = {}
): Promise<(SummaryResponse | null)[]> {
  const { delayMs = 500, onProgress, onError } = options;
  const results: (SummaryResponse | null)[] = [];

  for (let i = 0; i < requests.length; i++) {
    try {
      const result = await summarizeDossier(requests[i]);
      results.push(result);
    } catch (err) {
      if (onError) {
        onError(err instanceof Error ? err : new Error(String(err)), i);
      }
      results.push(null);
    }

    if (onProgress) {
      onProgress(i + 1, requests.length);
    }

    // Rate limiting
    if (i < requests.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return results;
}
