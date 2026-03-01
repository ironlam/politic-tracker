import { DataSource, Judgement, MatchMethod, MandateType } from "@/generated/prisma";

export interface ResolveInput {
  firstName: string;
  lastName: string;
  birthDate?: Date | null;
  source: DataSource;
  sourceId: string;
  department?: string;
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
