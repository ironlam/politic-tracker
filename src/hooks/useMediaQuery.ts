"use client";

import { useSyncExternalStore } from "react";

/**
 * Hook to detect if a media query matches.
 * Uses useSyncExternalStore for correct external state subscription
 * without setState-in-effect warnings.
 *
 * @param query - CSS media query string (e.g., "(max-width: 768px)")
 * @returns boolean indicating if the query matches
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onStoreChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onStoreChange);
      return () => mql.removeEventListener("change", onStoreChange);
    },
    () => window.matchMedia(query).matches,
    () => false // SSR snapshot
  );
}
