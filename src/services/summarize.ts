/**
 * AI Summary Service for Legislative Dossiers and Scrutins
 *
 * Uses Claude Haiku for cost-effective summarization of legislative texts.
 * Designed for batch processing, not real-time use.
 */

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-3-haiku-20240307";
const MAX_TOKENS = 800;

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

  const hasRichContent = request.content !== request.title && request.content.length > 200;

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
${hasRichContent ? "- Un exposé des motifs complet est fourni : extrais les mesures concrètes proposées et le contexte politique" : "- Si le contenu est insuffisant, génère un résumé basé uniquement sur le titre"}`;

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

export interface ScrutinSummaryRequest {
  title: string;
  chamber: "AN" | "SENAT";
  votingDate: string;
  result: "ADOPTED" | "REJECTED";
  votesFor: number;
  votesAgainst: number;
  votesAbstain: number;
}

/**
 * Generate a summary for a parliamentary scrutin (vote)
 */
export async function summarizeScrutin(request: ScrutinSummaryRequest): Promise<SummaryResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY environment variable is not set");
  }

  const chamberLabel = request.chamber === "AN" ? "Assemblée nationale" : "Sénat";
  const resultLabel = request.result === "ADOPTED" ? "Adopté" : "Rejeté";
  const total = request.votesFor + request.votesAgainst + request.votesAbstain;

  const prompt = `Tu es un expert en politique française. Résume ce scrutin parlementaire de manière claire et accessible pour les citoyens.

Titre du scrutin: ${request.title}
Chambre: ${chamberLabel}
Date du vote: ${request.votingDate}
Résultat: ${resultLabel}
Votes pour: ${request.votesFor}/${total}
Votes contre: ${request.votesAgainst}/${total}
Abstentions: ${request.votesAbstain}/${total}

Réponds en JSON avec ce format exact:
{
  "shortSummary": "Résumé en 1-2 phrases simples expliquant l'objet du vote et son résultat",
  "keyPoints": [
    "Point clé 1 (court, factuel)",
    "Point clé 2",
    "Point clé 3"
  ]
}

Consignes:
- Traduis le jargon parlementaire en français simple et compréhensible
- Explique concrètement ce sur quoi les parlementaires ont voté
- Mentionne le résultat du vote (adopté/rejeté)
- Sois objectif et factuel, pas de jugement politique
- Maximum 4 points clés
- Si le titre mentionne un article, un amendement ou un texte de loi, explique brièvement de quoi il s'agit`;

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

  const textContent = data.content?.find((c: { type: string }) => c.type === "text");
  if (!textContent?.text) {
    throw new Error("No text content in API response");
  }

  try {
    let jsonStr = textContent.text;

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
    console.error("Failed to parse JSON response:", textContent.text);

    return {
      shortSummary: request.title,
      keyPoints: [],
    };
  }
}

// ============================================
// BIOGRAPHY GENERATION
// ============================================

export interface BiographyRequest {
  fullName: string;
  civility: string | null;
  birthDate: Date | null;
  birthPlace: string | null;
  deathDate: Date | null;
  currentParty: string | null;
  mandates: Array<{
    type: string;
    title: string;
    isCurrent: boolean;
    startDate: Date;
    endDate: Date | null;
  }>;
  voteStats: {
    total: number;
    pour: number;
    contre: number;
    abstention: number;
  } | null;
  affairsCount: number;
  declarationsCount: number;
  latestDeclarationYear: number | null;
}

/**
 * Generate a factual biography for a politician based on structured data
 */
export async function generateBiography(request: BiographyRequest): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY environment variable is not set");
  }

  const currentMandates = request.mandates.filter((m) => m.isCurrent);
  const pastMandates = request.mandates.filter((m) => !m.isCurrent);

  let dataSection = `Nom complet : ${request.fullName}`;
  if (request.civility) dataSection += `\nCivilité : ${request.civility}`;
  if (request.birthDate)
    dataSection += `\nDate de naissance : ${request.birthDate.toISOString().split("T")[0]}`;
  if (request.birthPlace) dataSection += `\nLieu de naissance : ${request.birthPlace}`;
  if (request.deathDate)
    dataSection += `\nDate de décès : ${request.deathDate.toISOString().split("T")[0]}`;
  if (request.currentParty) dataSection += `\nParti actuel : ${request.currentParty}`;

  if (currentMandates.length > 0) {
    dataSection += `\n\nMandats actuels :`;
    for (const m of currentMandates) {
      dataSection += `\n- ${m.title} (depuis ${m.startDate.toISOString().split("T")[0]})`;
    }
  }

  if (pastMandates.length > 0) {
    dataSection += `\n\nMandats passés :`;
    for (const m of pastMandates) {
      const end = m.endDate ? m.endDate.toISOString().split("T")[0] : "?";
      dataSection += `\n- ${m.title} (${m.startDate.toISOString().split("T")[0]} → ${end})`;
    }
  }

  if (request.voteStats && request.voteStats.total > 0) {
    const vs = request.voteStats;
    dataSection += `\n\nVotes parlementaires : ${vs.total} scrutins (${vs.pour} pour, ${vs.contre} contre, ${vs.abstention} abstentions)`;
  }

  if (request.declarationsCount > 0) {
    dataSection += `\n\nDéclarations HATVP : ${request.declarationsCount} déclaration(s)`;
    if (request.latestDeclarationYear)
      dataSection += ` (dernière en ${request.latestDeclarationYear})`;
  }

  const prompt = `Tu es un rédacteur encyclopédique pour le site Poligraph. Rédige une biographie factuelle et neutre de ce responsable politique à partir EXCLUSIVEMENT des données ci-dessous.

DONNÉES :
${dataSection}

CONSIGNES STRICTES :
- 100 à 200 mots maximum, en français
- Commence par "${request.fullName} est${request.deathDate ? "/était" : ""}..."
- Mentionne : mandat actuel, parti, parcours antérieur, statistiques de votes (si disponibles), déclarations HATVP (si disponibles)
- Ne mentionne PAS les affaires judiciaires
- N'invente RIEN au-delà des données fournies
- Ton factuel, neutre, style encyclopédique
- Pas de listes à puces, un paragraphe fluide
- Pas de formule d'introduction ou de conclusion laudative`;

  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 500,
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

  const textContent = data.content?.find((c: { type: string }) => c.type === "text");
  if (!textContent?.text) {
    throw new Error("No text content in API response");
  }

  return textContent.text.trim();
}

// ============================================
// THEME CLASSIFICATION
// ============================================

const THEME_VALUES = [
  "ECONOMIE_BUDGET",
  "SOCIAL_TRAVAIL",
  "SECURITE_JUSTICE",
  "ENVIRONNEMENT_ENERGIE",
  "SANTE",
  "EDUCATION_CULTURE",
  "INSTITUTIONS",
  "AFFAIRES_ETRANGERES_DEFENSE",
  "NUMERIQUE_TECH",
  "IMMIGRATION",
  "AGRICULTURE_ALIMENTATION",
  "LOGEMENT_URBANISME",
  "TRANSPORTS",
] as const;

export type ThemeCategoryValue = (typeof THEME_VALUES)[number];

/**
 * Classify a legislative text or scrutin into a theme category using AI
 */
export async function classifyTheme(
  title: string,
  summary?: string | null,
  context?: string | null
): Promise<ThemeCategoryValue | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY environment variable is not set");
  }

  let input = `Titre : ${title}`;
  if (summary) input += `\nRésumé : ${summary}`;
  if (context) input += `\nContexte : ${context}`;

  const prompt = `Tu es un classificateur thématique pour des textes législatifs français. Classe le texte suivant dans une catégorie en utilisant l'outil classify_theme.

${input}

Guide des catégories :
- ECONOMIE_BUDGET : fiscalité, budget de l'État, finances publiques, commerce, entreprises
- SOCIAL_TRAVAIL : emploi, droit du travail, retraites, protection sociale, handicap
- SECURITE_JUSTICE : police, justice, pénal, prisons, terrorisme, ordre public
- ENVIRONNEMENT_ENERGIE : écologie, climat, énergie, biodiversité, pollution
- SANTE : santé publique, hôpitaux, médicaments, bioéthique, pandémies
- EDUCATION_CULTURE : éducation, université, recherche, culture, sport, médias
- INSTITUTIONS : Constitution, élections, collectivités, réforme de l'État, outre-mer
- AFFAIRES_ETRANGERES_DEFENSE : diplomatie, défense, armée, coopération internationale, UE
- NUMERIQUE_TECH : numérique, données, IA, télécommunications, cybersécurité
- IMMIGRATION : immigration, asile, nationalité, intégration, frontières
- AGRICULTURE_ALIMENTATION : agriculture, pêche, alimentation, ruralité
- LOGEMENT_URBANISME : logement, urbanisme, construction, copropriété
- TRANSPORTS : transports, mobilité, routes, ferroviaire, aérien, maritime`;

  const tools = [
    {
      name: "classify_theme",
      description: "Classifie un texte législatif dans une catégorie thématique.",
      input_schema: {
        type: "object" as const,
        properties: {
          theme: {
            type: "string",
            enum: [...THEME_VALUES],
            description: "La catégorie thématique du texte législatif",
          },
        },
        required: ["theme"],
      },
    },
  ];

  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 100,
      tools,
      tool_choice: { type: "tool", name: "classify_theme" },
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

  const toolUse = data.content?.find((c: { type: string }) => c.type === "tool_use");
  if (!toolUse?.input?.theme) {
    throw new Error("No tool_use content in API response");
  }

  let theme = toolUse.input.theme;

  // Fallback: AI may still rarely return inverted names despite enum constraint
  const THEME_ALIASES: Record<string, ThemeCategoryValue> = {
    CULTURE_EDUCATION: "EDUCATION_CULTURE",
    JUSTICE_SECURITE: "SECURITE_JUSTICE",
    CULTURE_PATRIMOINE: "EDUCATION_CULTURE",
    BUDGET_ECONOMIE: "ECONOMIE_BUDGET",
    TRAVAIL_SOCIAL: "SOCIAL_TRAVAIL",
    ENERGIE_ENVIRONNEMENT: "ENVIRONNEMENT_ENERGIE",
    DEFENSE_AFFAIRES_ETRANGERES: "AFFAIRES_ETRANGERES_DEFENSE",
    TECH_NUMERIQUE: "NUMERIQUE_TECH",
    ALIMENTATION_AGRICULTURE: "AGRICULTURE_ALIMENTATION",
    URBANISME_LOGEMENT: "LOGEMENT_URBANISME",
  };

  if (theme && THEME_ALIASES[theme]) {
    theme = THEME_ALIASES[theme];
  }

  if (THEME_VALUES.includes(theme)) {
    return theme;
  }

  console.warn(`Invalid theme value: ${theme}`);
  return null;
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
