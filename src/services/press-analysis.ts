/**
 * Press Article AI Analysis Service
 *
 * Uses Claude Haiku via tool_use to analyze press articles for judicial affairs.
 * Extracts structured data: affair detection, category, status, key excerpts.
 *
 * IMPORTANT: Legal safety is critical.
 * - Presumption of innocence for all mise en examen
 * - CONDAMNATION_DEFINITIVE only if article explicitly mentions rejected appeal
 * - Sensitive categories (AGRESSION_SEXUELLE, HARCELEMENT_SEXUEL, VIOL) only if facts are explicitly described
 * - When in doubt → less severe value
 */

import { AI_RATE_LIMIT_MS } from "@/config/rate-limits";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-5-20251001";
const MAX_TOKENS = 2000;

// ============================================
// TYPES
// ============================================

export interface ArticleAnalysisInput {
  title: string;
  content: string;
  feedSource: string;
  publishedAt: Date;
  mentionedPoliticians?: string[];
}

export interface ArticleAnalysisResult {
  isAffairRelated: boolean;
  summary: string;
  affairs: DetectedAffair[];
}

export interface DetectedAffair {
  politicianName: string;
  involvement: "DIRECT" | "INDIRECT" | "MENTIONED_ONLY";
  category: string;
  status: string;
  title: string;
  description: string;
  factsDate: string | null;
  court: string | null;
  charges: string[];
  excerpts: string[];
  isNewRevelation: boolean;
  confidenceScore: number;
}

// ============================================
// AFFAIR CATEGORIES & STATUS (enum values)
// ============================================

const AFFAIR_CATEGORIES = [
  "CORRUPTION",
  "CORRUPTION_PASSIVE",
  "TRAFIC_INFLUENCE",
  "PRISE_ILLEGALE_INTERETS",
  "FAVORITISME",
  "DETOURNEMENT_FONDS_PUBLICS",
  "FRAUDE_FISCALE",
  "BLANCHIMENT",
  "ABUS_BIENS_SOCIAUX",
  "ABUS_CONFIANCE",
  "EMPLOI_FICTIF",
  "FINANCEMENT_ILLEGAL_CAMPAGNE",
  "FINANCEMENT_ILLEGAL_PARTI",
  "HARCELEMENT_MORAL",
  "HARCELEMENT_SEXUEL",
  "AGRESSION_SEXUELLE",
  "VIOLENCE",
  "MENACE",
  "DIFFAMATION",
  "INJURE",
  "INCITATION_HAINE",
  "FAUX_ET_USAGE_FAUX",
  "RECEL",
  "CONFLIT_INTERETS",
  "AUTRE",
] as const;

const AFFAIR_STATUSES = [
  "ENQUETE_PRELIMINAIRE",
  "INSTRUCTION",
  "MISE_EN_EXAMEN",
  "RENVOI_TRIBUNAL",
  "PROCES_EN_COURS",
  "CONDAMNATION_PREMIERE_INSTANCE",
  "APPEL_EN_COURS",
  "CONDAMNATION_DEFINITIVE",
  "RELAXE",
  "ACQUITTEMENT",
  "NON_LIEU",
  "PRESCRIPTION",
  "CLASSEMENT_SANS_SUITE",
] as const;

const SENSITIVE_CATEGORIES = new Set(["AGRESSION_SEXUELLE", "HARCELEMENT_SEXUEL"]);

// ============================================
// TOOL DEFINITION (Anthropic tool_use)
// ============================================

const ANALYSIS_TOOL = {
  name: "analyze_press_article",
  description:
    "Analyse un article de presse politique française pour détecter les affaires judiciaires mentionnées.",
  input_schema: {
    type: "object" as const,
    properties: {
      is_affair_related: {
        type: "boolean",
        description:
          "L'article mentionne-t-il une ou plusieurs affaires judiciaires impliquant des politiciens français ?",
      },
      summary: {
        type: "string",
        description: "Résumé factuel de l'article en 2-3 phrases.",
      },
      affairs: {
        type: "array",
        description:
          "Liste des affaires judiciaires détectées dans l'article. Vide si is_affair_related est false.",
        items: {
          type: "object",
          properties: {
            politician_name: {
              type: "string",
              description: "Nom complet du politicien concerné (ex: 'Nicolas Sarkozy')",
            },
            involvement: {
              type: "string",
              enum: ["DIRECT", "INDIRECT", "MENTIONED_ONLY"],
              description:
                "Niveau d'implication du politicien dans l'affaire. DIRECT = mis en cause, poursuivi, condamné ou directement visé. INDIRECT = témoin, victime ou acteur secondaire. MENTIONED_ONLY = simplement cité dans l'article sans lien réel avec l'affaire judiciaire.",
            },
            category: {
              type: "string",
              enum: [...AFFAIR_CATEGORIES],
              description: "Catégorie juridique de l'affaire",
            },
            status: {
              type: "string",
              enum: [...AFFAIR_STATUSES],
              description: "Statut judiciaire actuel mentionné dans l'article",
            },
            title: {
              type: "string",
              description: "Titre court de l'affaire (ex: 'Affaire des emplois fictifs du MoDem')",
            },
            description: {
              type: "string",
              description: "Description factuelle en 2-3 phrases",
            },
            facts_date: {
              type: ["string", "null"],
              description: "Date des faits si mentionnée (format YYYY-MM-DD), null sinon",
            },
            court: {
              type: ["string", "null"],
              description:
                "Juridiction mentionnée (ex: 'Tribunal correctionnel de Paris'), null sinon",
            },
            charges: {
              type: "array",
              items: { type: "string" },
              description: "Chefs d'accusation ou infractions mentionnés dans l'article",
            },
            excerpts: {
              type: "array",
              items: { type: "string" },
              description: "2-3 citations clés de l'article relatives à cette affaire",
            },
            is_new_revelation: {
              type: "boolean",
              description:
                "L'article révèle-t-il cette affaire pour la première fois (investigation journalistique) ?",
            },
            confidence_score: {
              type: "integer",
              minimum: 0,
              maximum: 100,
              description:
                "Score de confiance (0-100) que cette affaire est correctement attribuée au politicien. 90+ = certain (nommément cité comme mis en cause). 70-89 = probable. 50-69 = incertain. <50 = peu fiable.",
            },
          },
          required: [
            "politician_name",
            "involvement",
            "category",
            "status",
            "title",
            "description",
            "facts_date",
            "court",
            "charges",
            "excerpts",
            "is_new_revelation",
            "confidence_score",
          ],
        },
      },
    },
    required: ["is_affair_related", "summary", "affairs"],
  },
};

// ============================================
// SYSTEM PROMPT
// ============================================

const SYSTEM_PROMPT = `Tu es un analyste juridique spécialisé en affaires judiciaires politiques françaises. Tu analyses des articles de presse pour en extraire les informations sur les affaires judiciaires.

RÈGLES STRICTES :
1. PRÉSOMPTION D'INNOCENCE : toute mise en examen est une MISE_EN_EXAMEN, pas une condamnation
2. CONDAMNATION_DEFINITIVE : UNIQUEMENT si l'article mentionne EXPLICITEMENT que le pourvoi en cassation a été rejeté OU que les délais de recours sont expirés. En cas de doute → CONDAMNATION_PREMIERE_INSTANCE ou APPEL_EN_COURS
3. CATÉGORIES SENSIBLES (AGRESSION_SEXUELLE, HARCELEMENT_SEXUEL) : UNIQUEMENT si les faits reprochés sont EXPLICITEMENT décrits dans l'article. Ne PAS déduire la catégorie à partir du contexte seul
4. NE JAMAIS INVENTER d'informations absentes de l'article
5. En cas de doute sur la catégorie → AUTRE
6. En cas de doute sur le statut → choisir la valeur MOINS GRAVE
7. Les excerpts doivent être des CITATIONS EXACTES de l'article (mot pour mot)
8. Si l'article ne contient pas d'affaire judiciaire, retourner is_affair_related: false avec un résumé simple

RÈGLE CRITIQUE — IMPLICATION DIRECTE :
9. Un politicien doit être DIRECTEMENT MIS EN CAUSE (mis en examen, poursuivi, condamné, placé en garde à vue) pour avoir involvement: "DIRECT". Un politicien simplement MENTIONNÉ dans l'article (réaction politique, commentaire, contexte, autre sujet) → involvement: MENTIONED_ONLY
10. Si l'article parle d'une affaire où le politicien est VICTIME, TÉMOIN ou simple commentateur → involvement: INDIRECT ou MENTIONED_ONLY
11. Si un article mentionne un politicien dans un contexte politique (débat, vote, déclaration) et qu'une affaire judiciaire est mentionnée séparément dans le même article, NE PAS attribuer l'affaire au politicien

SCORE DE CONFIANCE (confidence_score) :
- 90-100 : le politicien est NOMMÉMENT cité comme mis en cause/condamné/poursuivi dans l'article
- 70-89 : le politicien est fortement lié à l'affaire mais le rôle n'est pas 100% explicite
- 50-69 : mention ambiguë, le lien entre le politicien et l'affaire n'est pas clair
- 0-49 : le politicien est probablement juste mentionné, pas impliqué

EXEMPLES DE FAUX POSITIFS À ÉVITER :
- Un article sur "la mort de X" qui mentionne la réaction d'un politicien → le politicien n'est PAS impliqué dans la mort
- Un article sur une affaire judiciaire qui cite un politicien comme source ou commentateur → MENTIONED_ONLY
- Un article politique mentionnant en passant un procès en cours d'un autre politicien → seul le politicien poursuivi est DIRECT`;

// ============================================
// MAIN ANALYSIS FUNCTION
// ============================================

/**
 * Analyze a press article for judicial affairs using Claude Haiku tool_use
 */
export async function analyzeArticle(input: ArticleAnalysisInput): Promise<ArticleAnalysisResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY environment variable is not set");
  }

  let userContent = `Analyse cet article de presse politique :\n\nTitre : ${input.title}\nSource : ${input.feedSource}\nDate : ${input.publishedAt.toISOString().split("T")[0]}\n\nContenu :\n${input.content}`;

  if (input.mentionedPoliticians && input.mentionedPoliticians.length > 0) {
    userContent += `\n\nPoliticiens mentionnés (pré-détectés) : ${input.mentionedPoliticians.join(", ")}`;
  }

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
      system: SYSTEM_PROMPT,
      tools: [ANALYSIS_TOOL],
      tool_choice: { type: "tool", name: "analyze_press_article" },
      messages: [{ role: "user", content: userContent }],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic API error: ${response.status} - ${error}`);
  }

  const data = await response.json();

  const toolUse = data.content?.find((c: { type: string }) => c.type === "tool_use");
  if (!toolUse?.input) {
    throw new Error("No tool_use content in API response");
  }

  const result = toolUse.input;

  // Validate and sanitize the result
  const affairs: DetectedAffair[] = (result.affairs || []).map((a: Record<string, unknown>) => {
    const category = validateEnum(a.category as string, AFFAIR_CATEGORIES, "AUTRE");
    const status = validateEnum(a.status as string, AFFAIR_STATUSES, "ENQUETE_PRELIMINAIRE");
    const involvement = validateEnum(
      a.involvement as string,
      ["DIRECT", "INDIRECT", "MENTIONED_ONLY"] as const,
      "DIRECT"
    );

    return {
      politicianName: String(a.politician_name || ""),
      involvement,
      category,
      status,
      title: String(a.title || ""),
      description: String(a.description || ""),
      factsDate: a.facts_date ? String(a.facts_date) : null,
      court: a.court ? String(a.court) : null,
      charges: Array.isArray(a.charges) ? a.charges.map(String) : [],
      excerpts: Array.isArray(a.excerpts) ? a.excerpts.map(String).slice(0, 3) : [],
      isNewRevelation: Boolean(a.is_new_revelation),
      confidenceScore: typeof a.confidence_score === "number" ? a.confidence_score : 50,
    };
  });

  return {
    isAffairRelated: Boolean(result.is_affair_related),
    summary: String(result.summary || ""),
    affairs,
  };
}

/**
 * Check if a detected affair has a sensitive category
 */
export function isSensitiveCategory(category: string): boolean {
  return SENSITIVE_CATEGORIES.has(category);
}

/**
 * Get the rate limit delay for AI calls
 */
export function getAIRateLimitMs(): number {
  return AI_RATE_LIMIT_MS;
}

// ============================================
// HELPERS
// ============================================

function validateEnum<T extends string>(value: string, validValues: readonly T[], fallback: T): T {
  if ((validValues as readonly string[]).includes(value)) {
    return value as T;
  }
  return fallback;
}
