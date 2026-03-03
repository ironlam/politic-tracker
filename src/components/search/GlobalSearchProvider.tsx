"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";

/**
 * Global keyboard shortcut: Cmd/Ctrl+K → navigate to /recherche.
 * Skips admin routes (admin has its own command palette).
 */
export function GlobalSearchProvider({ children }: { children: ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (window.location.pathname.startsWith("/admin")) return;

      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        router.push("/recherche");
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [router]);

  return <>{children}</>;
}
