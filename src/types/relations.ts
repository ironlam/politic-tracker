import { MandateType } from "@/generated/prisma";

export type RelationType =
  | "SAME_GOVERNMENT"
  | "SHARED_COMPANY"
  | "SAME_DEPARTMENT"
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
  label?: string;
}

export interface Cluster {
  type: RelationType;
  label: string;
  nodes: GraphNode[];
  links: GraphLink[];
}

export interface RelationsResponse {
  center: GraphNode;
  clusters: Cluster[];
  stats: {
    totalConnections: number;
    byType: Partial<Record<RelationType, number>>;
  };
}
