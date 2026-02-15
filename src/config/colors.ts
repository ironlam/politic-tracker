// Centralized color configuration for the application
// All colors have light and dark mode variants

export interface ColorVariant {
  light: string;
  dark: string;
  tailwind?: string; // Optional Tailwind class for simple cases
}

export const COLORS = {
  // Vote colors
  vote: {
    pour: { light: "#22c55e", dark: "#4ade80", tailwind: "bg-green-500" },
    contre: { light: "#ef4444", dark: "#f87171", tailwind: "bg-red-500" },
    abstention: { light: "#eab308", dark: "#facc15", tailwind: "bg-yellow-500" },
    absent: { light: "#9ca3af", dark: "#6b7280", tailwind: "bg-gray-400" },
    nonVotant: { light: "#6b7280", dark: "#9ca3af", tailwind: "bg-gray-500" },
  },

  // Chamber colors
  chamber: {
    AN: { light: "#2563eb", dark: "#60a5fa", tailwind: "bg-blue-600" },
    SENAT: { light: "#be185d", dark: "#f472b6", tailwind: "bg-pink-700" },
    PE: { light: "#7c3aed", dark: "#a78bfa", tailwind: "bg-violet-600" },
    GOUVERNEMENT: { light: "#059669", dark: "#34d399", tailwind: "bg-emerald-600" },
  },

  // Affair status colors
  affairStatus: {
    ENQUETE_PRELIMINAIRE: { light: "#f59e0b", dark: "#fbbf24", tailwind: "bg-amber-500" },
    INSTRUCTION: { light: "#f97316", dark: "#fb923c", tailwind: "bg-orange-500" },
    MISE_EN_EXAMEN: { light: "#ef4444", dark: "#f87171", tailwind: "bg-red-500" },
    RENVOI_TRIBUNAL: { light: "#dc2626", dark: "#ef4444", tailwind: "bg-red-600" },
    PROCES_EN_COURS: { light: "#b91c1c", dark: "#dc2626", tailwind: "bg-red-700" },
    APPEL_EN_COURS: { light: "#d97706", dark: "#f59e0b", tailwind: "bg-amber-600" },
    CONDAMNATION_DEFINITIVE: { light: "#991b1b", dark: "#b91c1c", tailwind: "bg-red-800" },
    RELAXE: { light: "#22c55e", dark: "#4ade80", tailwind: "bg-green-500" },
    ACQUITTEMENT: { light: "#16a34a", dark: "#22c55e", tailwind: "bg-green-600" },
    NON_LIEU: { light: "#6b7280", dark: "#9ca3af", tailwind: "bg-gray-500" },
    PRESCRIPTION: { light: "#9ca3af", dark: "#6b7280", tailwind: "bg-gray-400" },
    CLASSEMENT_SANS_SUITE: { light: "#a3a3a3", dark: "#737373", tailwind: "bg-neutral-400" },
  },

  // Affair super-categories
  affairCategory: {
    PROBITE: { light: "#9333ea", dark: "#a855f7", tailwind: "bg-purple-600" },
    FINANCES: { light: "#2563eb", dark: "#60a5fa", tailwind: "bg-blue-600" },
    PERSONNES: { light: "#dc2626", dark: "#f87171", tailwind: "bg-red-600" },
    EXPRESSION: { light: "#d97706", dark: "#f59e0b", tailwind: "bg-amber-600" },
  },

  // Political positions (left-right spectrum)
  position: {
    EXTREME_GAUCHE: { light: "#991b1b", dark: "#dc2626", tailwind: "bg-red-800" },
    GAUCHE: { light: "#dc2626", dark: "#ef4444", tailwind: "bg-red-600" },
    CENTRE_GAUCHE: { light: "#f97316", dark: "#fb923c", tailwind: "bg-orange-500" },
    CENTRE: { light: "#eab308", dark: "#facc15", tailwind: "bg-yellow-500" },
    CENTRE_DROIT: { light: "#3b82f6", dark: "#60a5fa", tailwind: "bg-blue-500" },
    DROITE: { light: "#1d4ed8", dark: "#3b82f6", tailwind: "bg-blue-700" },
    EXTREME_DROITE: { light: "#1e3a8a", dark: "#1d4ed8", tailwind: "bg-blue-900" },
    ECOLOGISTE: { light: "#22c55e", dark: "#4ade80", tailwind: "bg-green-500" },
  },

  // Generic UI colors
  ui: {
    success: { light: "#22c55e", dark: "#4ade80", tailwind: "bg-green-500" },
    warning: { light: "#f59e0b", dark: "#fbbf24", tailwind: "bg-amber-500" },
    error: { light: "#ef4444", dark: "#f87171", tailwind: "bg-red-500" },
    info: { light: "#3b82f6", dark: "#60a5fa", tailwind: "bg-blue-500" },
    muted: { light: "#9ca3af", dark: "#6b7280", tailwind: "bg-gray-400" },
  },

  // Press sources
  press: {
    lemonde: { light: "#1a1a1a", dark: "#e5e5e5", tailwind: "bg-neutral-900" },
    politico: { light: "#b91c1c", dark: "#ef4444", tailwind: "bg-red-700" },
    mediapart: { light: "#f97316", dark: "#fb923c", tailwind: "bg-orange-500" },
  },

  // Chart colors (for data visualization)
  chart: {
    primary: { light: "#2d4a7c", dark: "#6b9fd4" },
    secondary: { light: "#9333ea", dark: "#a855f7" },
    tertiary: { light: "#059669", dark: "#34d399" },
    quaternary: { light: "#d97706", dark: "#f59e0b" },
    quinary: { light: "#dc2626", dark: "#f87171" },
  },
} as const;

// Tailwind text color classes (light + dark mode)
export const TEXT_COLORS = {
  vote: {
    pour: "text-green-600 dark:text-green-400",
    contre: "text-red-600 dark:text-red-400",
    abstention: "text-yellow-600 dark:text-yellow-400",
  },
  chamber: {
    AN: "text-blue-600 dark:text-blue-400",
    SENAT: "text-pink-700 dark:text-pink-400",
    PE: "text-violet-600 dark:text-violet-400",
    GOUVERNEMENT: "text-emerald-600 dark:text-emerald-400",
  },
  affairStatus: {
    CONDAMNATION_DEFINITIVE: "text-red-800 dark:text-red-400",
  },
  ui: {
    warning: "text-amber-600 dark:text-amber-400",
  },
} as const;

// Type helpers
export type ColorCategory = keyof typeof COLORS;
export type VoteColor = keyof typeof COLORS.vote;
export type ChamberColor = keyof typeof COLORS.chamber;
export type AffairStatusColor = keyof typeof COLORS.affairStatus;
export type AffairCategoryColor = keyof typeof COLORS.affairCategory;
export type PositionColor = keyof typeof COLORS.position;

/**
 * Get a color value by path
 * @param category - The color category (e.g., 'vote', 'chamber')
 * @param key - The specific color key (e.g., 'pour', 'AN')
 * @param theme - 'light' or 'dark'
 * @returns The hex color value
 */
export function getColor(
  category: ColorCategory,
  key: string,
  theme: "light" | "dark" = "light"
): string {
  const categoryColors = COLORS[category] as Record<string, ColorVariant>;
  const colorVariant = categoryColors?.[key];
  if (!colorVariant) {
    console.warn(`Color not found: ${category}.${key}`);
    return theme === "light" ? "#888888" : "#666666";
  }
  return colorVariant[theme];
}

/**
 * Get all colors for a category
 * @param category - The color category
 * @param theme - 'light' or 'dark'
 * @returns Object with all colors in the category
 */
export function getCategoryColors(
  category: ColorCategory,
  theme: "light" | "dark" = "light"
): Record<string, string> {
  const categoryColors = COLORS[category] as Record<string, ColorVariant>;
  return Object.entries(categoryColors).reduce(
    (acc, [key, variant]) => {
      acc[key] = variant[theme];
      return acc;
    },
    {} as Record<string, string>
  );
}

/**
 * Get Tailwind class for a color if available
 * @param category - The color category
 * @param key - The specific color key
 * @returns Tailwind class or undefined
 */
export function getTailwindClass(category: ColorCategory, key: string): string | undefined {
  const categoryColors = COLORS[category] as Record<string, ColorVariant>;
  return categoryColors?.[key]?.tailwind;
}
