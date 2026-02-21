"use client";

import { useState, useEffect } from "react";

/**
 * Returns true after the component has mounted on the client.
 * Used to avoid hydration mismatches with next-themes or browser-only APIs.
 */
export function useIsMounted(): boolean {
  const [mounted, setMounted] = useState(false);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration guard
  useEffect(() => setMounted(true), []);

  return mounted;
}
