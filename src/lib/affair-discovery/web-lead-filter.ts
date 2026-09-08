/**
 * Deciding which web results are worth an AI call.
 *
 * The discovery pass runs one Brave query per politician. Judging every result
 * with a model would cost one call per result for a base rate that measurement
 * puts very low: on the press queue, a sample of twelve "best" candidates held
 * one real hit, the rest being homonyms or officials quoted about someone
 * else's case.
 *
 * So the model is only asked the question it alone can answer, "is this person
 * the subject", and only about results that already carry a judicial predicate
 * and the person's surname. Everything else is dropped for free.
 */

/** Words that mark an actual judicial procedure, not a comment about one. */
const JUDICIAL_TERMS = [
  "condamn", // condamné, condamnation, condamnée
  "mis en examen",
  "mise en examen",
  "prévenu",
  "relaxe",
  "relaxé",
  "procès",
  "jugé",
  "jugement",
  "tribunal correctionnel",
  "garde à vue",
  "poursuivi",
  "inculp",
  "plainte contre",
  "détournement",
  "prise illégale",
  "abus de confiance",
  "favoritisme",
  "prison avec sursis",
  "inéligibilité",
];

/**
 * Titles that name a case belonging to someone else. The dominant French press
 * pattern is `Affaire X : "quote", selon Y`, which puts both names in the title
 * and makes a name match meaningless on its own.
 */
const OTHERS_CASE = /\baffaire\s+(?!de\s|du\s|des\s)([A-ZÉÈÀÂÎÔÛ][\wéèàâîôûç-]+)/i;

export interface WebResult {
  title: string;
  url: string;
  description: string;
  publisher: string | null;
}

export interface LeadDecision {
  keep: boolean;
  /** Why it was dropped, for the report. Never null when keep is false. */
  reason: string | null;
}

export function normalize(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function hasJudicialTerm(haystack: string): boolean {
  return JUDICIAL_TERMS.some((term) => haystack.includes(normalize(term)));
}

/**
 * Does the title present a case belonging to a different person?
 *
 * Returns false when the case is named after the politician themselves: an
 * article titled "Affaire Dupont" about Dupont is exactly what we are looking
 * for.
 */
function namesSomeoneElsesCase(title: string, surname: string): boolean {
  const match = OTHERS_CASE.exec(title);
  if (!match) return false;
  return !normalize(match[1]!).includes(normalize(surname));
}

/**
 * Keep a result only if it is from a trusted publisher, names the politician,
 * carries a judicial term, and does not announce someone else's case.
 */
export function screenWebResult(
  result: WebResult,
  politician: { firstName: string; lastName: string }
): LeadDecision {
  if (!result.publisher) {
    return { keep: false, reason: "éditeur hors liste de confiance" };
  }

  const haystack = normalize(`${result.title} ${result.description}`);
  const surname = normalize(politician.lastName);

  if (surname.length < 3) {
    // A two-letter surname matches everywhere; the noise is not worth the call.
    return { keep: false, reason: "patronyme trop court pour être discriminant" };
  }
  if (!haystack.includes(surname)) {
    return { keep: false, reason: "patronyme absent du résultat" };
  }
  if (!hasJudicialTerm(haystack)) {
    return { keep: false, reason: "aucun terme judiciaire" };
  }
  if (namesSomeoneElsesCase(result.title, politician.lastName)) {
    return { keep: false, reason: "le titre nomme l'affaire d'un tiers" };
  }

  return { keep: true, reason: null };
}
