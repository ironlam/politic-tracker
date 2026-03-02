import { DataSource, Judgement, MatchMethod, MandateType } from "@/generated/prisma";

export interface ResolveInput {
  firstName: string;
  lastName: string;
  birthDate?: Date | null;
  source: DataSource;
  sourceId: string;
  department?: string;
  gender?: string | null;
  mandateType?: MandateType;
  context?: Record<string, unknown>;
}

export interface CandidateMatch {
  politicianId: string;
  firstName: string;
  lastName: string;
  birthDate: Date | null;
  score: number;
  method: MatchMethod;
  blocked: boolean; // true if NOT_SAME decision exists
}

export interface ResolveResult {
  sourceId: string;
  politicianId: string | null;
  confidence: number;
  method: MatchMethod;
  decision: Judgement | "NEW";
  candidates: CandidateMatch[];
  blocked: boolean;
}

/** Thresholds for decision zones */
export const IDENTITY_THRESHOLDS = {
  AUTO_MATCH: 0.95,
  REVIEW: 0.7,
} as const;

/** Birthdate tolerance: 1 day in ms */
export const BIRTHDATE_TOLERANCE_MS = 86_400_000;

/** Input for the pure scoring function (no DB, no side effects) */
export interface ScoringInput {
  firstName: string;
  lastName: string;
  birthDate?: Date | null;
  department?: string;
  gender?: string | null;
}

/** Politician data needed for in-memory scoring */
export interface CachedPolitician {
  id: string;
  firstName: string;
  lastName: string;
  birthDate: Date | null;
  departments: string[];
  gender?: string | null;
}

export interface BatchResolveInput {
  inputs: ResolveInput[];
  sourceType: DataSource;
  onProgress?: (processed: number, total: number) => void;
}

export interface BatchResolveResult {
  results: ResolveResult[];
  stats: {
    total: number;
    matched: number;
    review: number;
    notFound: number;
    blocked: number;
  };
}
