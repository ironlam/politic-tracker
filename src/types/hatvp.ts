/**
 * Structured data extracted from HATVP DIA XML declarations.
 * Stored as JSON in Declaration.details.
 */

export interface FinancialParticipation {
  company: string;
  evaluation: number | null;
  shares: number | null;
  capitalPercent: number | null;
  dividends: string | null;
  isBoardMember: boolean;
}

export interface AnnualRevenue {
  year: number;
  amount: number;
}

export interface ProfessionalActivity {
  description: string;
  employer: string;
  startDate: string | null;
  endDate: string | null;
  annualRevenues: AnnualRevenue[];
}

export interface ElectoralMandate {
  mandate: string;
  startDate: string | null;
  endDate: string | null;
  annualRevenues: AnnualRevenue[];
}

export interface Directorship {
  company: string;
  role: string;
  startDate: string | null;
  endDate: string | null;
  annualRevenues: AnnualRevenue[];
}

export interface Collaborator {
  name: string;
  employer: string;
}

export interface DeclarationDetails {
  financialParticipations: FinancialParticipation[];
  professionalActivities: ProfessionalActivity[];
  electoralMandates: ElectoralMandate[];
  directorships: Directorship[];
  spouseActivity: string | null;
  collaborators: Collaborator[];
  // Computed summaries
  totalPortfolioValue: number | null;
  totalCompanies: number;
  latestAnnualIncome: number | null;
  totalDirectorships: number;
}
