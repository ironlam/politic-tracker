import { MandateType } from "@/generated/prisma";

export type RelationType =
  | "SAME_PARTY"
  | "SAME_GOVERNMENT"
  | "SAME_LEGISLATURE"
  | "SAME_CONSTITUENCY"
  | "SAME_EUROPEAN_GROUP"
  | "PARTY_HISTORY";

export interface GraphNode {
  id: string;
  slug: string;
  fullName: string;
  photoUrl: string | null;
  party: {
    shortName: string;
    color: string | null;
  } | null;
  mandateType: MandateType | null;
}

export interface GraphLink {
  source: string;
  target: string;
  type: RelationType;
  strength: number; // 1-10, affects link thickness
  label?: string; // e.g., "Gouvernement Borne (2022-2024)"
}

export interface RelationsResponse {
  center: GraphNode;
  nodes: GraphNode[];
  links: GraphLink[];
  stats: {
    totalConnections: number;
    byType: Partial<Record<RelationType, number>>;
  };
}

export interface RelationsFilters {
  types?: RelationType[];
  limit?: number;
}
