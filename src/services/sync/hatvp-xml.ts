import { XMLParser } from "fast-xml-parser";
import type {
  DeclarationDetails,
  FinancialParticipation,
  ProfessionalActivity,
  ElectoralMandate,
  Directorship,
  Collaborator,
  AnnualRevenue,
} from "@/types/hatvp";

const parser = new XMLParser({ ignoreAttributes: true, trimValues: true });

const REDACTED_PATTERN = /\[Données non publiées\]/i;

/**
 * Detect redacted fields from HATVP XML.
 */
export function isRedacted(value: string): boolean {
  if (value == null || typeof value !== "string") return false;
  return REDACTED_PATTERN.test(value);
}

/**
 * Parse a French-formatted amount string into a number.
 * Handles non-breaking and regular spaces as thousand separators.
 * Examples: "62 389" → 62389, "1 234 567" → 1234567
 */
export function parseAmount(raw: string): number | null {
  if (raw == null) return null;

  // Handle numbers passed as actual numbers from XML parser
  if (typeof raw === "number") return raw;

  const str = String(raw).trim();
  if (str === "") return null;
  if (isRedacted(str)) return null;

  // Remove all space characters (regular, non-breaking, narrow no-break)
  const cleaned = str.replace(/[\s\u00A0\u202F]+/g, "");

  const num = Number(cleaned);
  if (isNaN(num)) return null;
  return num;
}

/**
 * Handle the double-nested <items><items>...</items></items> XML quirk.
 * The parser may return an object (single item) or an array (multiple items).
 */
export function parseItems(node: unknown): unknown[] {
  if (node == null) return [];

  const section = node as Record<string, unknown>;

  // Check for neant (empty/none)
  if (String(section.neant) === "true") return [];

  const outerItems = section.items;
  if (outerItems == null) return [];

  // Double-nested: <items><items>...</items></items>
  // The outer "items" contains an "items" property which is the actual data
  const innerItems = (outerItems as Record<string, unknown>).items;

  if (innerItems == null) return [];

  // If it's an array, return it directly; if it's a single object, wrap it
  return Array.isArray(innerItems) ? innerItems : [innerItems];
}

/**
 * Parse the nested remuneration/montant structure into AnnualRevenue[].
 * Structure: remuneration.montant.montant (which can be array or single object)
 * Each montant entry has { annee, montant }
 */
export function parseAnnualRevenues(remunerationNode: unknown): AnnualRevenue[] {
  if (remunerationNode == null) return [];

  const remuneration = remunerationNode as Record<string, unknown>;
  const montantContainer = remuneration.montant;
  if (montantContainer == null) return [];

  // montant is also double-nested: <montant><montant>...</montant></montant>
  const innerMontant = (montantContainer as Record<string, unknown>).montant;
  if (innerMontant == null) return [];

  const entries = Array.isArray(innerMontant) ? innerMontant : [innerMontant];

  const revenues: AnnualRevenue[] = [];
  for (const entry of entries) {
    const e = entry as Record<string, unknown>;
    const year = Number(e.annee);
    const amount = parseAmount(String(e.montant ?? ""));
    if (!isNaN(year) && amount != null) {
      revenues.push({ year, amount });
    }
  }

  return revenues;
}

/**
 * Parse a date string, returning null for empty/redacted values.
 */
function parseDateStr(value: unknown): string | null {
  if (value == null) return null;
  const str = String(value).trim();
  if (str === "" || isRedacted(str)) return null;
  return str;
}

/**
 * Parse a string value, returning null for empty/redacted values.
 */
function parseStr(value: unknown): string | null {
  if (value == null) return null;
  const str = String(value).trim();
  if (str === "" || isRedacted(str)) return null;
  return str;
}

/**
 * Parse financial participations from participationFinanciereDto section.
 */
function parseFinancialParticipations(section: unknown): FinancialParticipation[] {
  const items = parseItems(section);
  return items.map((item) => {
    const i = item as Record<string, unknown>;
    const evalStr = String(i.evaluation ?? "");
    const sharesStr = String(i.nombreParts ?? "");
    const capitalStr = String(i.capitalDetenu ?? "");
    const remuStr = String(i.remuneration ?? "");

    return {
      company: String(i.nomSociete ?? ""),
      evaluation: isRedacted(evalStr) ? null : parseAmount(evalStr),
      shares: isRedacted(sharesStr) ? null : parseAmount(sharesStr),
      capitalPercent: isRedacted(capitalStr) ? null : parseAmount(capitalStr),
      dividends: isRedacted(remuStr) || remuStr.trim() === "" ? null : remuStr.trim(),
      isBoardMember: String(i.actiConseil ?? "").toLowerCase() === "oui",
    };
  });
}

/**
 * Parse professional activities from activProfCinqDerniereDto section.
 */
function parseProfessionalActivities(section: unknown): ProfessionalActivity[] {
  const items = parseItems(section);
  return items.map((item) => {
    const i = item as Record<string, unknown>;
    return {
      description: String(i.description ?? ""),
      employer: String(i.employeur ?? ""),
      startDate: parseDateStr(i.dateDebut),
      endDate: parseDateStr(i.dateFin),
      annualRevenues: parseAnnualRevenues(i.remuneration),
    };
  });
}

/**
 * Parse electoral mandates from mandatElectifDto section.
 */
function parseElectoralMandates(section: unknown): ElectoralMandate[] {
  const items = parseItems(section);
  return items.map((item) => {
    const i = item as Record<string, unknown>;
    return {
      mandate: String(i.descriptionMandat ?? ""),
      startDate: parseDateStr(i.dateDebut),
      endDate: parseDateStr(i.dateFin),
      annualRevenues: parseAnnualRevenues(i.remuneration),
    };
  });
}

/**
 * Parse directorships from participationDirigeantDto section.
 */
function parseDirectorships(section: unknown): Directorship[] {
  const items = parseItems(section);
  return items.map((item) => {
    const i = item as Record<string, unknown>;
    return {
      company: String(i.nomSociete ?? ""),
      role: String(i.activite ?? ""),
      startDate: parseDateStr(i.dateDebut),
      endDate: parseDateStr(i.dateFin),
      annualRevenues: parseAnnualRevenues(i.remuneration),
    };
  });
}

/**
 * Parse spouse activity from activProfConjointDto section.
 * Combines activiteProf and employeurConjoint into a single string.
 */
function parseSpouseActivity(section: unknown): string | null {
  const items = parseItems(section);
  if (items.length === 0) return null;

  // Take the first entry (typically only one)
  const i = items[0] as Record<string, unknown>;
  const activity = parseStr(i.activiteProf);
  const employer = parseStr(i.employeurConjoint);

  if (!activity && !employer) return null;
  if (activity && employer) return `${activity} (${employer})`;
  return activity || employer;
}

/**
 * Parse collaborators from activCollaborateursDto section.
 */
function parseCollaborators(section: unknown): Collaborator[] {
  const items = parseItems(section);
  return items.map((item) => {
    const i = item as Record<string, unknown>;
    return {
      name: String(i.nom ?? ""),
      employer: String(i.employeur ?? ""),
    };
  });
}

/**
 * Collect all annual revenues from all sources and compute the sum
 * for the most recent year.
 */
function computeLatestAnnualIncome(
  professionalActivities: ProfessionalActivity[],
  electoralMandates: ElectoralMandate[],
  directorships: Directorship[]
): number | null {
  const allRevenues: AnnualRevenue[] = [
    ...professionalActivities.flatMap((a) => a.annualRevenues),
    ...electoralMandates.flatMap((m) => m.annualRevenues),
    ...directorships.flatMap((d) => d.annualRevenues),
  ];

  if (allRevenues.length === 0) return null;

  const maxYear = Math.max(...allRevenues.map((r) => r.year));
  const latestRevenues = allRevenues.filter((r) => r.year === maxYear);
  return latestRevenues.reduce((sum, r) => sum + r.amount, 0);
}

/**
 * Main entry point: parse HATVP DIA XML into structured DeclarationDetails.
 */
export function parseHATVPXml(xmlString: string): DeclarationDetails {
  const parsed = parser.parse(xmlString);
  const declaration = parsed.declaration ?? {};

  const financialParticipations = parseFinancialParticipations(
    declaration.participationFinanciereDto
  );
  const professionalActivities = parseProfessionalActivities(declaration.activProfCinqDerniereDto);
  const electoralMandates = parseElectoralMandates(declaration.mandatElectifDto);
  const directorships = parseDirectorships(declaration.participationDirigeantDto);
  const spouseActivity = parseSpouseActivity(declaration.activProfConjointDto);
  const collaborators = parseCollaborators(declaration.activCollaborateursDto);

  // Computed summaries
  const evaluations = financialParticipations
    .map((p) => p.evaluation)
    .filter((e): e is number => e != null);
  const totalPortfolioValue =
    evaluations.length > 0 ? evaluations.reduce((sum, e) => sum + e, 0) : null;

  const latestAnnualIncome = computeLatestAnnualIncome(
    professionalActivities,
    electoralMandates,
    directorships
  );

  return {
    financialParticipations,
    professionalActivities,
    electoralMandates,
    directorships,
    spouseActivity,
    collaborators,
    totalPortfolioValue,
    totalCompanies: financialParticipations.length,
    latestAnnualIncome,
    totalDirectorships: directorships.length,
  };
}
