"use client";

import { useSyncExternalStore } from "react";
import type { WatchlistItem, WatchlistItemType } from "@/types/watchlist";

const STORAGE_KEY = "poligraph:watchlist";
const MAX_ITEMS = 50;
const EMPTY: WatchlistItem[] = [];

// --- emitter (same-tab reactivity) ---
type Listener = () => void;
const listeners = new Set<Listener>();
function emitChange() {
  listeners.forEach((l) => l());
}

// --- stable snapshot cache ---
let cachedRaw: string | null = null;
let cachedValue: WatchlistItem[] = EMPTY;

function readItems(): WatchlistItem[] {
  if (typeof window === "undefined") return EMPTY;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === cachedRaw) return cachedValue;
  cachedRaw = raw;
  if (!raw) {
    cachedValue = EMPTY;
    return EMPTY;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      cachedValue = EMPTY;
      return EMPTY;
    }
    // V1 migration: string[] → WatchlistItem[]
    if (typeof parsed[0] === "string") {
      const migrated: WatchlistItem[] = (parsed as string[]).map((slug) => ({
        type: "politician" as const,
        slug,
      }));
      writeItems(migrated); // persist migrated format
      cachedValue = migrated;
      return migrated;
    }
    cachedValue = parsed as WatchlistItem[];
    return cachedValue;
  } catch {
    cachedValue = EMPTY;
    return EMPTY;
  }
}

function writeItems(items: WatchlistItem[]) {
  const json = JSON.stringify(items);
  localStorage.setItem(STORAGE_KEY, json);
  cachedRaw = json;
  cachedValue = items;
  emitChange();
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      cachedRaw = null; // invalidate cache
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot(): WatchlistItem[] {
  return readItems();
}

function getServerSnapshot(): WatchlistItem[] {
  return EMPTY;
}

export function useWatchlist() {
  const items = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return {
    items,
    count: items.length,

    add(slug: string, type: WatchlistItemType = "politician") {
      const current = readItems();
      if (current.length >= MAX_ITEMS) return;
      if (current.some((i) => i.slug === slug && i.type === type)) return;
      writeItems([...current, { type, slug }]);
    },

    remove(slug: string, type?: WatchlistItemType) {
      const current = readItems();
      writeItems(
        current.filter((i) => {
          if (type) return !(i.slug === slug && i.type === type);
          return i.slug !== slug;
        })
      );
    },

    toggle(slug: string, type: WatchlistItemType = "politician") {
      const current = readItems();
      const exists = current.some((i) => i.slug === slug && i.type === type);
      if (exists) {
        writeItems(current.filter((i) => !(i.slug === slug && i.type === type)));
      } else {
        if (current.length >= MAX_ITEMS) return;
        writeItems([...current, { type, slug }]);
      }
    },

    isFollowing(slug: string, type?: WatchlistItemType): boolean {
      if (type) return items.some((i) => i.slug === slug && i.type === type);
      return items.some((i) => i.slug === slug);
    },
  };
}
