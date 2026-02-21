"use client";

import { useTheme } from "next-themes";
import { useIsMounted } from "./useIsMounted";
import { COLORS, getColor, getCategoryColors, ColorCategory } from "@/config/colors";

/**
 * Hook to get a color value that adapts to the current theme
 * @param category - The color category (e.g., 'vote', 'chamber')
 * @param key - The specific color key (e.g., 'pour', 'AN')
 * @returns The hex color value for the current theme
 */
export function useThemeColor(category: ColorCategory, key: string): string {
  const { resolvedTheme } = useTheme();
  const mounted = useIsMounted();

  if (!mounted) {
    return getColor(category, key, "light");
  }

  const mode = resolvedTheme === "dark" ? "dark" : "light";
  return getColor(category, key, mode);
}

/**
 * Hook to get all colors for a category, adapted to the current theme
 * @param category - The color category
 * @returns Object with all colors in the category
 */
export function useThemeCategoryColors(category: ColorCategory): Record<string, string> {
  const { resolvedTheme } = useTheme();
  const mounted = useIsMounted();

  if (!mounted) {
    return getCategoryColors(category, "light");
  }

  const mode = resolvedTheme === "dark" ? "dark" : "light";
  return getCategoryColors(category, mode);
}

/**
 * Hook to get the current theme mode
 * @returns 'light' or 'dark'
 */
export function useThemeMode(): "light" | "dark" {
  const { resolvedTheme } = useTheme();
  const mounted = useIsMounted();

  if (!mounted) {
    return "light";
  }

  return resolvedTheme === "dark" ? "dark" : "light";
}

// Re-export COLORS for convenience
export { COLORS };
