import type {
  Politician,
  Party,
  Mandate,
  Affair,
  AffairEvent,
  Source,
  Declaration,
  ExternalId,
  AffairStatus,
  AffairCategory,
  AffairEventType,
  MandateType,
  DataSource,
  PoliticalPosition,
} from "@/generated/prisma";

// Re-export Prisma types
export type {
  Politician,
  Party,
  Mandate,
  Affair,
  AffairEvent,
  Source,
  Declaration,
  ExternalId,
  AffairStatus,
  AffairCategory,
  AffairEventType,
  MandateType,
  DataSource,
  PoliticalPosition,
};

// Extended types with relations
export type PoliticianWithParty = Politician & {
  currentParty: Party | null;
};

export type PoliticianWithPartyAndCounts = Politician & {
  currentParty: Party | null;
  _count: {
    affairs: number;
  };
  hasConviction?: boolean;
  isDeceased?: boolean;
  // Current mandate info (for display on cards)
  currentMandate?: {
    type: MandateType;
    title: string;
    constituency: string | null;
  } | null;
};

export type PoliticianWithMandates = Politician & {
  currentParty: Party | null;
  mandates: Mandate[];
};

export type PoliticianFull = Politician & {
  currentParty: Party | null;
  mandates: Mandate[];
  affairs: AffairWithSources[];
  declarations: Declaration[];
};

export type AffairWithSources = Affair & {
  sources: Source[];
  events?: AffairEvent[];
};

export type AffairWithPolitician = Affair & {
  politician: PoliticianWithParty;
  sources: Source[];
};

// Search and filter types
export type PoliticianFilters = {
  search?: string;
  partyId?: string;
  mandateType?: MandateType;
  hasAffairs?: boolean;
  page?: number;
  limit?: number;
};

export type AffairFilters = {
  search?: string;
  politicianId?: string;
  status?: AffairStatus;
  category?: AffairCategory;
  page?: number;
  limit?: number;
};

// API response types
export type PaginatedResponse<T> = {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

// Form input types (for validation)
export type CreateAffairInput = {
  politicianId: string;
  title: string;
  description: string;
  status: AffairStatus;
  category: AffairCategory;
  factsDate?: Date;
  startDate?: Date;
  verdictDate?: Date;
  sentence?: string;
  sources: {
    url: string;
    title: string;
    publisher: string;
    publishedAt: Date;
  }[];
};
