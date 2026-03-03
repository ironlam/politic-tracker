"use client";

import { useSyncExternalStore, useCallback } from "react";

const STORAGE_KEY = "poligraph:watchlist";
const MAX_SLUGS = 50;

// Same-tab change emitter (storage event only fires cross-tab)
let listeners: Array<() => void> = [];
function emitChange() {
  for (const listener of listeners) listener();
}

// Cache parsed result to return stable references (useSyncExternalStore compares via Object.is)
let cachedRaw: string | null = null;
let cachedValue: string[] = [];
const EMPTY: string[] = [];

function getSnapshot(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw !== cachedRaw) {
      cachedRaw = raw;
      cachedValue = raw ? JSON.parse(raw) : EMPTY;
    }
    return cachedValue;
  } catch {
    return EMPTY;
  }
}

function getServerSnapshot(): string[] {
  return EMPTY;
}

function subscribe(onStoreChange: () => void): () => void {
  listeners.push(onStoreChange);
  const handler = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) onStoreChange();
  };
  window.addEventListener("storage", handler);
  return () => {
    listeners = listeners.filter((l) => l !== onStoreChange);
    window.removeEventListener("storage", handler);
  };
}

export function useWatchlist() {
  const slugs = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const add = useCallback((slug: string) => {
    const current = getSnapshot();
    if (current.includes(slug) || current.length >= MAX_SLUGS) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...current, slug]));
    emitChange();
  }, []);

  const remove = useCallback((slug: string) => {
    const current = getSnapshot();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current.filter((s) => s !== slug)));
    emitChange();
  }, []);

  const toggle = useCallback(
    (slug: string) => {
      if (getSnapshot().includes(slug)) remove(slug);
      else add(slug);
    },
    [add, remove]
  );

  const isFollowing = useCallback((slug: string) => slugs.includes(slug), [slugs]);

  return { slugs, add, remove, toggle, isFollowing, count: slugs.length };
}
