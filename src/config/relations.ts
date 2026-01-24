import { RelationType } from "@/types/relations";

export const RELATION_TYPE_LABELS: Record<RelationType, string> = {
  SAME_PARTY: "Même parti",
  SAME_GOVERNMENT: "Même gouvernement",
  SAME_LEGISLATURE: "Même législature",
  SAME_CONSTITUENCY: "Même département",
  SAME_EUROPEAN_GROUP: "Même groupe européen",
  PARTY_HISTORY: "Anciens collègues de parti",
};

export const RELATION_TYPE_COLORS: Record<RelationType, string> = {
  SAME_PARTY: "#3B82F6", // blue
  SAME_GOVERNMENT: "#8B5CF6", // purple
  SAME_LEGISLATURE: "#10B981", // green
  SAME_CONSTITUENCY: "#F59E0B", // amber
  SAME_EUROPEAN_GROUP: "#EC4899", // pink
  PARTY_HISTORY: "#6B7280", // gray
};

export const RELATION_TYPE_DESCRIPTIONS: Record<RelationType, string> = {
  SAME_PARTY: "Membres du même parti politique actuellement",
  SAME_GOVERNMENT: "Ont siégé ensemble au gouvernement",
  SAME_LEGISLATURE: "Ont été élus à la même législature",
  SAME_CONSTITUENCY: "Élus dans le même département",
  SAME_EUROPEAN_GROUP: "Membres du même groupe au Parlement européen",
  PARTY_HISTORY: "Ont été membres du même parti dans le passé",
};

export const ALL_RELATION_TYPES: RelationType[] = [
  "SAME_PARTY",
  "SAME_GOVERNMENT",
  "SAME_LEGISLATURE",
  "SAME_CONSTITUENCY",
  "SAME_EUROPEAN_GROUP",
  "PARTY_HISTORY",
];

// Strength of each relation type (affects link thickness in graph)
export const RELATION_TYPE_STRENGTH: Record<RelationType, number> = {
  SAME_PARTY: 8,
  SAME_GOVERNMENT: 10,
  SAME_LEGISLATURE: 4,
  SAME_CONSTITUENCY: 6,
  SAME_EUROPEAN_GROUP: 7,
  PARTY_HISTORY: 3,
};
