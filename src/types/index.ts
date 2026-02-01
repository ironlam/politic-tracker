import type {
  Politician,
  Party,
  Mandate,
  Affair,
  AffairEvent,
  Source,
  Declaration,
  ExternalId,
  Scrutin,
  Vote,
  AffairStatus,
  AffairCategory,
  AffairEventType,
  MandateType,
  DataSource,
  PoliticalPosition,
  VotePosition,
  VotingResult,
  Chamber,
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
  Scrutin,
  Vote,
  AffairStatus,
  AffairCategory,
  AffairEventType,
  MandateType,
  DataSource,
  PoliticalPosition,
  VotePosition,
  VotingResult,
  Chamber,
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

// Vote/Scrutin types
export type ScrutinWithVotes = Scrutin & {
  votes: (Vote & {
    politician: PoliticianWithParty;
  })[];
};

export type VoteWithScrutin = Vote & {
  scrutin: Scrutin;
};

export type PoliticianVoteStats = {
  total: number;
  pour: number;
  contre: number;
  abstention: number;
  absent: number;
  participationRate: number;
};

export type ScrutinFilters = {
  search?: string;
  result?: VotingResult;
  legislature?: number;
  chamber?: Chamber;
  dateFrom?: Date;
  dateTo?: Date;
  page?: number;
  limit?: number;
};
