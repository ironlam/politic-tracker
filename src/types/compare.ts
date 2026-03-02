export const COMPARE_CATEGORIES = [
  "deputes",
  "senateurs",
  "partis",
  "groupes",
  "ministres",
] as const;

export type CompareCategory = (typeof COMPARE_CATEGORIES)[number];

export const COMPARE_CATEGORY_LABELS: Record<CompareCategory, string> = {
  deputes: "Députés",
  senateurs: "Sénateurs",
  partis: "Partis",
  groupes: "Groupes parlementaires",
  ministres: "Ministres",
};

export const CATEGORY_MANDATE_TYPES: Partial<Record<CompareCategory, string[]>> = {
  deputes: ["DEPUTE"],
  senateurs: ["SENATEUR"],
  ministres: ["MINISTRE", "PREMIER_MINISTRE", "MINISTRE_DELEGUE", "SECRETAIRE_ETAT"],
};

export function isCategoryPolitician(cat: CompareCategory): boolean {
  return cat === "deputes" || cat === "senateurs" || cat === "ministres";
}
