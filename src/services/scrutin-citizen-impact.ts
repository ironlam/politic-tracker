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
const MAX_TOKENS = 2000;

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
  // Internal links for the AI to embed as markdown
  links: {
    dossierUrl: string | null;
    dossierLabel: string | null;
    relatedVotes: { url: string; label: string }[];
    politicians: { url: string; label: string; position: string }[];
  };
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
          "Explication factuelle et neutre en français courant (pas de limite stricte, utiliser autant de mots que nécessaire pour bien expliquer). " +
          "Structure : contexte de la loi en langage simple → ce que la mesure proposait → résultat du vote → arguments pour ET contre (même poids) → qui est concerné. " +
          "JAMAIS de référence à un numéro d'article sans expliquer son sujet. " +
          "Utilise le **gras** pour la mesure concrète et des liens markdown vers les pages Poligraph fournies dans LIENS DISPONIBLES. " +
          "Vouvoie le lecteur. NEUTRALITÉ STRICTE.",
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

MISSION : Expliquer factuellement ce que ce vote parlementaire change, ce que la mesure proposait, et pourquoi elle a été adoptée ou rejetée — en restant STRICTEMENT neutre. Le lecteur n'a AUCUNE connaissance juridique ou parlementaire préalable.

FORMAT :
- Pas de limite de mots — utiliser autant de mots que nécessaire pour bien expliquer le contexte et la mesure. Viser la clarté, pas la brièveté
- Français courant (pas de jargon parlementaire)
- Vouvoyer le lecteur avec "vous"
- Mettre en **gras** la mesure concrète votée
- Pas de bullet points, pas de titres — texte fluide
- Utiliser des liens markdown vers les pages Poligraph quand des LIENS DISPONIBLES sont fournis (dossier législatif, votes liés, profils de députés). Exemples : [consulter le dossier complet](url), [Bastien Lachaud](/politiques/bastien-lachaud) (pour), des députés comme [Louis Boyard](/politiques/louis-boyard)

STRUCTURE :
1. CONTEXTE — De quoi parle la loi/le texte en question, en une phrase accessible (1-2 phrases). Ne JAMAIS écrire "l'article 21" ou "l'article 3 bis" sans expliquer en langage courant ce que cet article traite. Exemple : au lieu de "l'article 21 du projet de loi contre les fraudes", écrire "la partie du projet de loi qui porte sur [sujet concret de l'article]"
2. MESURE — Ce que la mesure/l'amendement proposait concrètement (1-2 phrases)
3. RÉSULTAT — Le résultat du vote et ce que cela implique (1 phrase)
4. DÉBAT — Les arguments des partisans ET des opposants, présentés avec le même poids (2-3 phrases)
5. CONCERNÉS — Qui est directement concerné par cette décision (1 phrase)
6. MAILLAGE — Quand des LIENS DISPONIBLES vers des profils de députés sont fournis, mentionner naturellement 1-2 députés notables avec un lien vers leur profil Poligraph. Intégrer dans le texte (pas en liste séparée). Exemple : "Parmi les députés ayant voté pour, on retrouve [Bastien Lachaud](/politiques/bastien-lachaud)."

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
13. Si le scrutin porte sur un amendement, expliquer DANS LE CONTEXTE DE LA LOI ce que l'amendement proposait de modifier — le lecteur doit d'abord comprendre de quoi parle la loi
14. Utiliser le contexte du dossier législatif et de la page source quand disponibles

VULGARISATION — RÈGLES CRITIQUES :
15. JAMAIS référencer un numéro d'article seul ("l'article 21", "l'article 3 bis") — TOUJOURS expliquer en langage courant le sujet de cet article. Le lecteur ne connaît PAS le contenu des articles de loi
16. JAMAIS utiliser de termes techniques sans les expliquer : "examen prioritaire", "irrecevabilité", "motion de renvoi", "scrutin public", "première lecture" → reformuler en français simple
17. Commencer par poser le CONTEXTE concret : quelle loi, quel sujet de société, pourquoi ça existe — avant d'entrer dans le détail de la mesure votée
19. JAMAIS briser le 4e mur. Formulations INTERDITES : "sans avoir le contenu exact", "le contenu précis n'est pas détaillé", "les informations disponibles", "les données fournies", "on peut inférer", "selon le contenu précis de l'amendement". Tu écris un article de presse pour un citoyen, PAS un rapport sur tes sources. Si tu ne sais pas ce qu'un amendement modifie exactement, décris UNIQUEMENT le contexte de la loi et le résultat du vote — ne dis JAMAIS que tu ne sais pas. Si vraiment tu ne peux rien expliquer → confidence < 40
18. Si le titre mentionne un "projet de loi relatif à X", expliquer en 1 phrase ce que X signifie concrètement dans la vie quotidienne`;

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
    citizenImpact: sanitizeInternalLinks(output.citizen_impact),
    confidence: output.confidence ?? 0,
  };
}

export { SONNET_MODEL, HAIKU_MODEL };

// ============================================
// HELPERS
// ============================================

/**
 * Fix AI hallucination where the model adds https:// to our relative internal links.
 * e.g. https://assemblee/slug → /assemblee/slug, https://votes/slug → /votes/slug
 */
function sanitizeInternalLinks(text: string): string {
  return text.replace(/https?:\/\/(assemblee|votes|partis|elections)\//g, "/$1/");
}

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

  // Available Poligraph links for the AI to embed
  const linkLines: string[] = [];
  if (input.links.dossierUrl) {
    linkLines.push(`Dossier législatif : [${input.links.dossierLabel}](${input.links.dossierUrl})`);
  }
  for (const v of input.links.relatedVotes) {
    linkLines.push(`Vote lié : [${v.label}](${v.url})`);
  }
  for (const p of input.links.politicians) {
    linkLines.push(`Député·e (${p.position}) : [${p.label}](${p.url})`);
  }
  if (linkLines.length > 0) {
    sections.push("");
    sections.push("LIENS DISPONIBLES (à insérer dans l'explication quand pertinent) :");
    sections.push(...linkLines);
  }

  return sections.join("\n");
}
