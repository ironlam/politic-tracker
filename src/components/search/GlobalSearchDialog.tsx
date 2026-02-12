"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import Image from "next/image";
import { Search, Loader2, Users, Building2, Vote, FileText } from "lucide-react";
import { useGlobalSearch } from "./GlobalSearchProvider";
import { MANDATE_TYPE_LABELS, DOSSIER_STATUS_LABELS, CHAMBER_SHORT_LABELS } from "@/config/labels";
import type { MandateType, DossierStatus, Chamber } from "@/generated/prisma";

interface PoliticianResult {
  slug: string;
  fullName: string;
  photoUrl: string | null;
  party: string | null;
  partyColor: string | null;
  mandate: MandateType | null;
}

interface PartyResult {
  slug: string;
  name: string;
  shortName: string;
  color: string | null;
  memberCount: number;
}

interface ScrutinResult {
  slug: string | null;
  id: string;
  title: string;
  votingDate: string;
  chamber: Chamber;
}

interface DossierResult {
  slug: string | null;
  id: string;
  title: string;
  status: DossierStatus;
}

interface SearchResults {
  politicians: PoliticianResult[];
  parties: PartyResult[];
  scrutins: ScrutinResult[];
  dossiers: DossierResult[];
}

interface NavigableItem {
  href: string;
  category: string;
}

function buildItems(results: SearchResults): NavigableItem[] {
  const items: NavigableItem[] = [];
  for (const p of results.politicians) {
    items.push({ href: `/politiques/${p.slug}`, category: "politicians" });
  }
  for (const p of results.parties) {
    items.push({ href: `/partis/${p.slug}`, category: "parties" });
  }
  for (const s of results.scrutins) {
    items.push({ href: `/votes/${s.slug || s.id}`, category: "scrutins" });
  }
  for (const d of results.dossiers) {
    items.push({ href: `/assemblee/dossiers/${d.slug || d.id}`, category: "dossiers" });
  }
  return items;
}

function totalCount(results: SearchResults): number {
  return (
    results.politicians.length +
    results.parties.length +
    results.scrutins.length +
    results.dossiers.length
  );
}

export function GlobalSearchDialog() {
  const { isOpen, closeSearch } = useGlobalSearch();
  const router = useRouter();
  const pathname = usePathname();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxRef = useRef<HTMLUListElement>(null);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  // Open/close the native dialog
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      dialog.showModal();
      // Small delay for the dialog to be visible before focusing
      requestAnimationFrame(() => inputRef.current?.focus());
    } else {
      dialog.close();
      setQuery("");
      setResults(null);
      setActiveIndex(-1);
    }
  }, [isOpen]);

  // Close on route change
  useEffect(() => {
    closeSearch();
  }, [pathname, closeSearch]);

  // Close on backdrop click (native dialog behavior)
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    function handleClick(e: MouseEvent) {
      if (e.target === dialog) closeSearch();
    }
    function handleCancel(e: Event) {
      e.preventDefault();
      closeSearch();
    }
    dialog.addEventListener("click", handleClick);
    dialog.addEventListener("cancel", handleCancel);
    return () => {
      dialog.removeEventListener("click", handleClick);
      dialog.removeEventListener("cancel", handleCancel);
    };
  }, [closeSearch]);

  // Debounced fetch
  useEffect(() => {
    if (query.length < 2) {
      setResults(null);
      setActiveIndex(-1);
      return;
    }

    setLoading(true);
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/search/global?q=${encodeURIComponent(query)}`, {
        signal: controller.signal,
      })
        .then((r) => r.json())
        .then((data: SearchResults) => {
          setResults(data);
          setActiveIndex(-1);
          setLoading(false);
        })
        .catch((err) => {
          if (err.name !== "AbortError") setLoading(false);
        });
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const items = results ? buildItems(results) : [];

  const navigate = useCallback(
    (href: string) => {
      closeSearch();
      router.push(href);
    },
    [closeSearch, router]
  );

  // Keyboard navigation
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => (prev < items.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : items.length - 1));
    } else if (e.key === "Enter" && activeIndex >= 0 && items[activeIndex]) {
      e.preventDefault();
      navigate(items[activeIndex].href);
    }
  }

  // Scroll active item into view
  useEffect(() => {
    if (activeIndex < 0 || !listboxRef.current) return;
    const active = listboxRef.current.querySelector(`[data-index="${activeIndex}"]`);
    active?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const hasResults = results && totalCount(results) > 0;
  const noResults = results && totalCount(results) === 0 && query.length >= 2;
  let flatIndex = -1;

  function nextIndex() {
    flatIndex++;
    return flatIndex;
  }

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 z-[100] bg-transparent backdrop:bg-black/50 p-0 m-0 max-w-none max-h-none w-full h-full overflow-visible"
      aria-label="Recherche globale"
    >
      <div className="flex items-start justify-center pt-[15vh] px-4 min-h-full">
        <div className="bg-background border border-border rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
          {/* Search input */}
          <div className="flex items-center gap-3 px-4 border-b border-border">
            {loading ? (
              <Loader2
                className="h-5 w-5 text-muted-foreground animate-spin shrink-0"
                aria-hidden="true"
              />
            ) : (
              <Search className="h-5 w-5 text-muted-foreground shrink-0" aria-hidden="true" />
            )}
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Rechercher un représentant, parti, vote..."
              className="flex-1 py-3.5 bg-transparent text-foreground placeholder:text-muted-foreground outline-none text-base"
              role="combobox"
              aria-expanded={hasResults ? "true" : "false"}
              aria-controls="global-search-results"
              aria-autocomplete="list"
              aria-activedescendant={activeIndex >= 0 ? `search-item-${activeIndex}` : undefined}
            />
            <kbd className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 text-xs text-muted-foreground bg-muted rounded border border-border font-mono">
              Esc
            </kbd>
          </div>

          {/* Results */}
          <div className="max-h-[60vh] overflow-y-auto overscroll-contain">
            {hasResults && (
              <ul
                ref={listboxRef}
                id="global-search-results"
                role="listbox"
                aria-label="Résultats de recherche"
                className="py-2"
              >
                {/* Politicians */}
                {results.politicians.length > 0 && (
                  <li role="presentation">
                    <div className="flex items-center gap-2 px-4 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      <Users className="h-3.5 w-3.5" aria-hidden="true" />
                      Représentants
                    </div>
                    <ul role="group" aria-label="Représentants">
                      {results.politicians.map((p) => {
                        const idx = nextIndex();
                        return (
                          <li key={p.slug} role="presentation">
                            <button
                              id={`search-item-${idx}`}
                              role="option"
                              aria-selected={activeIndex === idx}
                              data-index={idx}
                              className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors cursor-pointer ${
                                activeIndex === idx ? "bg-accent" : "hover:bg-accent/50"
                              }`}
                              onClick={() => navigate(`/politiques/${p.slug}`)}
                              onMouseEnter={() => setActiveIndex(idx)}
                            >
                              {p.photoUrl ? (
                                <Image
                                  src={p.photoUrl}
                                  alt=""
                                  width={28}
                                  height={28}
                                  className="rounded-full object-cover shrink-0"
                                  style={{ width: 28, height: 28 }}
                                />
                              ) : (
                                <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground shrink-0">
                                  {p.fullName
                                    .split(" ")
                                    .map((n) => n[0])
                                    .join("")
                                    .slice(0, 2)}
                                </div>
                              )}
                              <span className="font-medium text-sm truncate">{p.fullName}</span>
                              {p.party && (
                                <span
                                  className="ml-auto text-xs px-1.5 py-0.5 rounded-full shrink-0"
                                  style={{
                                    backgroundColor: p.partyColor ? `${p.partyColor}20` : undefined,
                                    color: p.partyColor || undefined,
                                  }}
                                >
                                  {p.party}
                                </span>
                              )}
                              {!p.party && p.mandate && (
                                <span className="ml-auto text-xs text-muted-foreground shrink-0">
                                  {MANDATE_TYPE_LABELS[p.mandate]}
                                </span>
                              )}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                )}

                {/* Parties */}
                {results.parties.length > 0 && (
                  <li role="presentation">
                    <div className="flex items-center gap-2 px-4 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider mt-1">
                      <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
                      Partis
                    </div>
                    <ul role="group" aria-label="Partis">
                      {results.parties.map((p) => {
                        const idx = nextIndex();
                        return (
                          <li key={p.slug} role="presentation">
                            <button
                              id={`search-item-${idx}`}
                              role="option"
                              aria-selected={activeIndex === idx}
                              data-index={idx}
                              className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors cursor-pointer ${
                                activeIndex === idx ? "bg-accent" : "hover:bg-accent/50"
                              }`}
                              onClick={() => navigate(`/partis/${p.slug}`)}
                              onMouseEnter={() => setActiveIndex(idx)}
                            >
                              <div
                                className="w-3 h-3 rounded-full shrink-0"
                                style={{ backgroundColor: p.color || "#888" }}
                              />
                              <span className="font-medium text-sm truncate">{p.name}</span>
                              <span className="text-xs text-muted-foreground shrink-0">
                                {p.shortName}
                              </span>
                              <span className="ml-auto text-xs text-muted-foreground shrink-0">
                                {p.memberCount} membres
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                )}

                {/* Scrutins */}
                {results.scrutins.length > 0 && (
                  <li role="presentation">
                    <div className="flex items-center gap-2 px-4 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider mt-1">
                      <Vote className="h-3.5 w-3.5" aria-hidden="true" />
                      Votes
                    </div>
                    <ul role="group" aria-label="Votes">
                      {results.scrutins.map((s) => {
                        const idx = nextIndex();
                        return (
                          <li key={s.id} role="presentation">
                            <button
                              id={`search-item-${idx}`}
                              role="option"
                              aria-selected={activeIndex === idx}
                              data-index={idx}
                              className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors cursor-pointer ${
                                activeIndex === idx ? "bg-accent" : "hover:bg-accent/50"
                              }`}
                              onClick={() => navigate(`/votes/${s.slug || s.id}`)}
                              onMouseEnter={() => setActiveIndex(idx)}
                            >
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                                {CHAMBER_SHORT_LABELS[s.chamber]}
                              </span>
                              <span className="font-medium text-sm truncate">{s.title}</span>
                              <span className="ml-auto text-xs text-muted-foreground shrink-0">
                                {new Date(s.votingDate).toLocaleDateString("fr-FR", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                })}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                )}

                {/* Dossiers */}
                {results.dossiers.length > 0 && (
                  <li role="presentation">
                    <div className="flex items-center gap-2 px-4 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider mt-1">
                      <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                      Dossiers
                    </div>
                    <ul role="group" aria-label="Dossiers législatifs">
                      {results.dossiers.map((d) => {
                        const idx = nextIndex();
                        return (
                          <li key={d.id} role="presentation">
                            <button
                              id={`search-item-${idx}`}
                              role="option"
                              aria-selected={activeIndex === idx}
                              data-index={idx}
                              className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors cursor-pointer ${
                                activeIndex === idx ? "bg-accent" : "hover:bg-accent/50"
                              }`}
                              onClick={() => navigate(`/assemblee/dossiers/${d.slug || d.id}`)}
                              onMouseEnter={() => setActiveIndex(idx)}
                            >
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                                {DOSSIER_STATUS_LABELS[d.status]}
                              </span>
                              <span className="font-medium text-sm truncate">{d.title}</span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                )}
              </ul>
            )}

            {noResults && (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                Aucun résultat pour &laquo;&nbsp;{query}&nbsp;&raquo;
              </div>
            )}

            {!results && query.length < 2 && (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                Tapez au moins 2 caractères pour lancer la recherche
              </div>
            )}
          </div>

          {/* Footer hint */}
          <div className="border-t border-border px-4 py-2 flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-muted rounded border border-border font-mono text-[10px]">
                &uarr;
              </kbd>
              <kbd className="px-1 py-0.5 bg-muted rounded border border-border font-mono text-[10px]">
                &darr;
              </kbd>
              naviguer
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-muted rounded border border-border font-mono text-[10px]">
                &crarr;
              </kbd>
              ouvrir
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-muted rounded border border-border font-mono text-[10px]">
                Esc
              </kbd>
              fermer
            </span>
          </div>
        </div>
      </div>

      {/* Live region for screen readers */}
      <div aria-live="polite" className="sr-only">
        {hasResults && `${totalCount(results)} résultats trouvés`}
        {noResults && `Aucun résultat pour ${query}`}
      </div>
    </dialog>
  );
}
