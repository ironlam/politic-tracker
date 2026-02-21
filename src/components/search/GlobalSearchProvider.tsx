"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { usePathname } from "next/navigation";

interface GlobalSearchContextValue {
  isOpen: boolean;
  openSearch: () => void;
  closeSearch: () => void;
}

const GlobalSearchContext = createContext<GlobalSearchContextValue | null>(null);

export function useGlobalSearch() {
  const ctx = useContext(GlobalSearchContext);
  if (!ctx) throw new Error("useGlobalSearch must be used within GlobalSearchProvider");
  return ctx;
}

export function GlobalSearchProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  const openSearch = useCallback(() => setIsOpen(true), []);
  const closeSearch = useCallback(() => setIsOpen(false), []);

  // Close public search when navigating to admin
  /* eslint-disable react-hooks/set-state-in-effect -- intentional sync with navigation */
  useEffect(() => {
    if (pathname?.startsWith("/admin")) setIsOpen(false);
  }, [pathname]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Don't activate public search in admin — admin has its own Cmd+K palette
      if (window.location.pathname.startsWith("/admin")) return;

      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <GlobalSearchContext.Provider value={{ isOpen, openSearch, closeSearch }}>
      {children}
    </GlobalSearchContext.Provider>
  );
}
