/**
 * AI generation of citizen-facing impact explanations for parliamentary votes.
 *
 * Generates "Ce que ça change pour vous" explanations that translate
 * procedural parliamentary language into plain French for citizens.
 *
 * Supports both Sonnet 4.6 (high quality, recent scrutins) and
 * Haiku 4.5 (cost-effective, bulk processing).
 */

import { callAnthropic, extractToolUse } from "@/lib/api/anthropic";

const HAIKU_MODEL = "claude-haiku-4-5-20251001";
const SONNET_MODEL = "claude-sonnet-4-5-20250929";
const MAX_TOKENS = 800;

// ============================================
// TYPES
// ============================================

export interface CitizenImpactInput {
  title: string;
  summary: string | null;
  theme: string | null;
  result: "ADOPTED" | "REJECTED";
  votesFor: number;
  votesAgainst: number;
  votesAbstain: number;
  chamber: "AN" | "SENAT";
  votingDate: string;
  // Enriched context (optional)
  dossierTitle: string | null;
  dossierSummary: string | null;
  sourcePageText: string | null;
}

export interface CitizenImpactOutput {
  citizenImpact: string;
  confidence: number;
}

// ============================================
// TOOL DEFINITION
// ============================================

const CITIZEN_IMPACT_TOOL = {
  name: "explain_citizen_impact",
  description:
    "Explique en langage clair ce que ce vote parlementaire change concrètement pour les citoyens français.",
  input_schema: {
    type: "object" as const,
    properties: {
      citizen_impact: {
        type: "string",
        description:
          "Explication factuelle et neutre en 80-200 mots, en français courant. " +
          "Structure : ce que la mesure proposait → résultat du vote → arguments pour ET contre (même poids) → qui est concerné. " +
          "Utilise le **gras** pour la mesure concrète. Vouvoie le lecteur. " +
          "NEUTRALITÉ STRICTE : pas de jugement de valeur, pas de réassurance, pas de parti-pris.",
      },
      confidence: {
        type: "integer",
        minimum: 0,
        maximum: 100,
        description:
          "Confiance dans la pertinence de l'explication (0-100). " +
          "80+ si l'impact citoyen est clair et concret. " +
          "40-79 si l'explication est correcte mais l'impact reste indirect ou abstrait. " +
          "< 40 si c'est un vote purement procédural sans impact citoyen identifiable.",
      },
    },
    required: ["citizen_impact", "confidence"],
  },
};

const SYSTEM_PROMPT = `Tu es un rédacteur factuel pour Poligraph, un observatoire citoyen de la politique française.

MISSION : Expliquer factuellement ce que ce vote parlementaire change, ce que la mesure proposait, et pourquoi elle a été adoptée ou rejetée — en restant STRICTEMENT neutre.

FORMAT :
- 80 à 200 mots, en français courant (pas de jargon parlementaire)
- Vouvoyer le lecteur avec "vous"
- Mettre en **gras** la mesure concrète votée
- Pas de bullet points, pas de titres — texte fluide

STRUCTURE :
1. Ce que la mesure/l'amendement proposait concrètement (1-2 phrases)
2. Le résultat du vote et ce que cela implique (1 phrase)
3. Les arguments des partisans ET des opposants, présentés avec le même poids (2-3 phrases)
4. Qui est directement concerné par cette décision (1 phrase)

NEUTRALITÉ — RÈGLES ABSOLUES :
1. JAMAIS de jugement de valeur : pas de "bonne foi", "juste", "important", "nécessaire", "dangereux"
2. JAMAIS présenter un résultat comme positif ou négatif — décrire factuellement ce qui change
3. Présenter les arguments POUR et CONTRE avec le même poids et la même longueur
4. Ne PAS rassurer le lecteur ("vous n'êtes pas concerné", "pas de panique") — c'est du parti-pris
5. Ne PAS utiliser de formulations qui prennent parti : "renforcer la lutte contre" (= c'est bien), "porter atteinte aux libertés" (= c'est mal). Préférer : "augmenter les contrôles sur..." / "élargir les pouvoirs de..."
6. Vote ADOPTÉ → "cette mesure entre en vigueur" / "cela signifie que..."
7. Vote REJETÉ → "cette mesure n'a pas été retenue" / "le texte initial est maintenu"
8. Traduire TOUT le jargon parlementaire en français courant
9. JAMAIS inventer de mesures concrètes absentes des données fournies
10. Si les données sont trop minces pour identifier un impact citoyen → confidence < 40
11. Votes purement procéduraux (organisation des débats, demande de scrutin public, renvoi en commission) → confidence < 40
12. Ne PAS commencer par "Ce vote..." — varier les accroches
13. Si le scrutin porte sur un amendement, expliquer ce que l'amendement proposait de modifier
14. Utiliser le contexte du dossier législatif et de la page source quand disponibles`;

// ============================================
// MAIN FUNCTION
// ============================================

export async function generateCitizenImpact(
  input: CitizenImpactInput,
  model?: string
): Promise<CitizenImpactOutput> {
  const userMessage = buildUserMessage(input);

  const response = await callAnthropic([{ role: "user", content: userMessage }], {
    model: model || HAIKU_MODEL,
    maxTokens: MAX_TOKENS,
    system: SYSTEM_PROMPT,
    tools: [CITIZEN_IMPACT_TOOL],
    toolChoice: { type: "tool", name: "explain_citizen_impact" },
  });

  const output = extractToolUse(response) as {
    citizen_impact: string;
    confidence: number;
  } | null;

  if (!output) {
    return { citizenImpact: "", confidence: 0 };
  }

  return {
    citizenImpact: output.citizen_impact,
    confidence: output.confidence ?? 0,
  };
}

export { SONNET_MODEL, HAIKU_MODEL };

// ============================================
// HELPERS
// ============================================

function buildUserMessage(input: CitizenImpactInput): string {
  const sections: string[] = [];

  // Vote data
  sections.push(`SCRUTIN : ${input.title}`);
  sections.push(
    `Résultat : ${input.result === "ADOPTED" ? "ADOPTÉ" : "REJETÉ"} (${input.votesFor} pour, ${input.votesAgainst} contre, ${input.votesAbstain} abstentions)`
  );
  sections.push(`Chambre : ${input.chamber === "AN" ? "Assemblée nationale" : "Sénat"}`);
  sections.push(`Date : ${input.votingDate}`);
  if (input.theme) sections.push(`Thème : ${input.theme}`);

  // Existing summary
  if (input.summary) {
    sections.push("");
    sections.push(`RÉSUMÉ EXISTANT :`);
    sections.push(input.summary);
  }

  // Enriched context: dossier
  if (input.dossierTitle || input.dossierSummary) {
    sections.push("");
    sections.push("DOSSIER LÉGISLATIF :");
    if (input.dossierTitle) sections.push(`Titre : ${input.dossierTitle}`);
    if (input.dossierSummary) sections.push(`Résumé : ${input.dossierSummary}`);
  }

  // Enriched context: source page
  if (input.sourcePageText) {
    sections.push("");
    sections.push("CONTENU DE LA PAGE SOURCE :");
    sections.push(input.sourcePageText);
  }

  return sections.join("\n");
}
