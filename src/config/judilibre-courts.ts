/**
 * Mapping of French appeal court cities to the departments they cover.
 *
 * France has 36 cours d'appel. This table maps each court's city to
 * the department names under its jurisdiction.
 *
 * Source: Code de l'organisation judiciaire, stable since 1958.
 */

const COURT_DEPARTMENTS: Record<string, string[]> = {
  Agen: ["Gers", "Lot", "Lot-et-Garonne"],
  "Aix-en-Provence": [
    "Alpes-de-Haute-Provence",
    "Bouches-du-Rhône",
    "Var",
    "Hautes-Alpes",
    "Vaucluse",
  ],
  Amiens: ["Aisne", "Oise", "Somme"],
  Angers: ["Maine-et-Loire", "Mayenne", "Sarthe"],
  Bastia: ["Corse-du-Sud", "Haute-Corse"],
  Besançon: ["Doubs", "Haute-Saône", "Jura", "Territoire de Belfort"],
  Bordeaux: ["Charente", "Dordogne", "Gironde"],
  Bourges: ["Cher", "Indre", "Nièvre"],
  Caen: ["Calvados", "Manche", "Orne"],
  Chambéry: ["Savoie", "Haute-Savoie"],
  Colmar: ["Bas-Rhin", "Haut-Rhin"],
  Dijon: ["Côte-d'Or", "Haute-Marne", "Saône-et-Loire", "Yonne"],
  Douai: ["Nord", "Pas-de-Calais"],
  Grenoble: ["Drôme", "Hautes-Alpes", "Isère"],
  Limoges: ["Corrèze", "Creuse", "Haute-Vienne"],
  Lyon: ["Ain", "Loire", "Rhône"],
  Metz: ["Moselle"],
  Montpellier: ["Aude", "Aveyron", "Hérault", "Pyrénées-Orientales"],
  Nancy: ["Meurthe-et-Moselle", "Meuse", "Vosges"],
  Nîmes: ["Ardèche", "Gard", "Lozère", "Vaucluse"],
  Orléans: ["Indre-et-Loire", "Loir-et-Cher", "Loiret"],
  Paris: ["Paris", "Essonne", "Seine-et-Marne", "Val-de-Marne", "Yonne", "Seine-Saint-Denis"],
  Pau: ["Hautes-Pyrénées", "Landes", "Pyrénées-Atlantiques"],
  Poitiers: ["Charente-Maritime", "Deux-Sèvres", "Vendée", "Vienne"],
  Reims: ["Ardennes", "Aube", "Marne"],
  Rennes: ["Côtes-d'Armor", "Finistère", "Ille-et-Vilaine", "Loire-Atlantique", "Morbihan"],
  Riom: ["Allier", "Cantal", "Haute-Loire", "Puy-de-Dôme"],
  Rouen: ["Eure", "Seine-Maritime"],
  Toulouse: ["Ariège", "Haute-Garonne", "Tarn", "Tarn-et-Garonne"],
  Versailles: ["Eure-et-Loir", "Hauts-de-Seine", "Val-d'Oise", "Yvelines"],
  "Basse-Terre": ["Guadeloupe"],
  Cayenne: ["Guyane"],
  "Fort-de-France": ["Martinique"],
  "Saint-Denis": ["La Réunion"],
  Nouméa: ["Nouvelle-Calédonie"],
  Papeete: ["Polynésie française"],
};

/** Normalized lookup (lowercase) built once */
const NORMALIZED_LOOKUP = new Map<string, string[]>();
for (const [city, deps] of Object.entries(COURT_DEPARTMENTS)) {
  NORMALIZED_LOOKUP.set(city.toLowerCase(), deps);
}

/**
 * Find the departments covered by a court city.
 * Returns null if the city is not a known court location.
 */
export function findCourtDepartments(city: string): string[] | null {
  return NORMALIZED_LOOKUP.get(city.toLowerCase()) ?? null;
}

/**
 * Extract a jurisdiction city name from free-text (decision summary or body).
 *
 * Matches patterns like:
 * - "cour d'appel de Lyon"
 * - "cour d'appel d'Orléans"
 * - "cour d'assises de Paris"
 * - "tribunal correctionnel de Paris"
 * - "tribunal judiciaire de Marseille"
 * - "tribunal de grande instance de Bordeaux"
 */
export function extractJurisdictionName(text: string): string | null {
  const pattern =
    /(?:cour d'appel|cour d'assises|tribunal(?:\s+[\wÀ-ÿ]+)+?)\s+d[e']\s*([A-ZÀ-Ÿ][\wÀ-ÿ]+(?:[- ][\wÀ-ÿ]+)*)/i;
  const match = text.match(pattern);
  return match ? match[1]! : null;
}
