"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

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

  const openSearch = useCallback(() => setIsOpen(true), []);
  const closeSearch = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
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
