"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { CATEGORY_MANDATE_TYPES } from "@/types/compare";

export interface PoliticianEntry {
  slug: string;
  fullName: string;
  photoUrl: string | null;
  partyShortName: string | null;
  partyColor: string | null;
  mandateType: string | null;
  parliamentaryGroupId: string | null;
}

export interface PartyEntry {
  slug: string;
  name: string;
  shortName: string | null;
  color: string | null;
  logoUrl: string | null;
  memberCount: number;
}

export interface GroupEntry {
  id: string;
  code: string;
  name: string;
  shortName: string | null;
  color: string | null;
  chamber: string;
  memberCount: number;
}

interface SearchIndex {
  politicians: PoliticianEntry[];
  parties: PartyEntry[];
  groups: GroupEntry[];
}

// Module-level cache — shared across all hook instances
let cachedIndex: SearchIndex | null = null;
let fetchPromise: Promise<SearchIndex | null> | null = null;

async function fetchIndex(): Promise<SearchIndex | null> {
  if (cachedIndex) return cachedIndex;
  if (fetchPromise) return fetchPromise;

  fetchPromise = fetch("/api/compare/search-index")
    .then((res) => {
      if (!res.ok) throw new Error("Failed to fetch search index");
      return res.json();
    })
    .then((data: SearchIndex) => {
      cachedIndex = data;
      return data;
    })
    .catch(() => {
      fetchPromise = null; // Allow retry on failure
      return null;
    });

  return fetchPromise;
}

function normalizeQuery(q: string): string {
  return q
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function matchesPolitician(p: PoliticianEntry, normalized: string): boolean {
  const name = normalizeQuery(p.fullName);
  return name.includes(normalized);
}

function matchesParty(p: PartyEntry, normalized: string): boolean {
  const name = normalizeQuery(p.name);
  const short = p.shortName ? normalizeQuery(p.shortName) : "";
  return name.includes(normalized) || short.includes(normalized);
}

function matchesGroup(g: GroupEntry, normalized: string): boolean {
  const name = normalizeQuery(g.name);
  const short = g.shortName ? normalizeQuery(g.shortName) : "";
  const code = normalizeQuery(g.code);
  return name.includes(normalized) || short.includes(normalized) || code.includes(normalized);
}

export function useSearchIndex() {
  const [isReady, setIsReady] = useState(cachedIndex !== null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    if (!cachedIndex) {
      fetchIndex().then(() => {
        if (mountedRef.current) setIsReady(true);
      });
    }
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const searchPoliticians = useCallback(
    (query: string, excludeSlug?: string): PoliticianEntry[] => {
      if (!cachedIndex || query.length < 2) return [];
      const normalized = normalizeQuery(query);
      return cachedIndex.politicians
        .filter((p) => p.slug !== excludeSlug && matchesPolitician(p, normalized))
        .slice(0, 8);
    },
    []
  );

  const searchParties = useCallback((query: string, excludeSlug?: string): PartyEntry[] => {
    if (!cachedIndex || query.length < 2) return [];
    const normalized = normalizeQuery(query);
    return cachedIndex.parties
      .filter((p) => p.slug !== excludeSlug && matchesParty(p, normalized))
      .slice(0, 8);
  }, []);

  const searchGroups = useCallback((query: string, excludeId?: string): GroupEntry[] => {
    if (!cachedIndex || query.length < 2) return [];
    const normalized = normalizeQuery(query);
    return cachedIndex.groups
      .filter((g) => g.id !== excludeId && matchesGroup(g, normalized))
      .slice(0, 8);
  }, []);

  const searchPoliticiansByCategory = useCallback(
    (
      query: string,
      category: "deputes" | "senateurs" | "ministres",
      excludeSlug?: string
    ): PoliticianEntry[] => {
      if (!cachedIndex || query.length < 2) return [];
      const normalized = normalizeQuery(query);
      const mandateTypes = CATEGORY_MANDATE_TYPES[category]!;
      return cachedIndex.politicians
        .filter(
          (p) =>
            p.slug !== excludeSlug &&
            matchesPolitician(p, normalized) &&
            p.mandateType !== null &&
            mandateTypes.includes(p.mandateType)
        )
        .slice(0, 8);
    },
    []
  );

  return {
    isReady,
    searchPoliticians,
    searchParties,
    searchGroups,
    searchPoliticiansByCategory,
  };
}
