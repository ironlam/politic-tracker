"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Search, Loader2, Users, Building2, FileText } from "lucide-react";

interface SearchResults {
  politicians: Array<{
    id: string;
    slug: string;
    fullName: string;
    photoUrl: string | null;
    party: string | null;
    partyColor: string | null;
  }>;
  parties: Array<{
    slug: string;
    name: string;
    shortName: string;
    color: string | null;
  }>;
  scrutins: Array<{
    slug: string | null;
    id: string;
    title: string;
  }>;
  dossiers: Array<{
    slug: string | null;
    id: string;
    title: string;
  }>;
}

interface NavigableItem {
  href: string;
  label: string;
  category: string;
  icon: React.ComponentType<{ className?: string }>;
}

function buildAdminItems(results: SearchResults): NavigableItem[] {
  const items: NavigableItem[] = [];

  for (const p of results.politicians) {
    items.push({
      href: `/admin/politiques/${p.id}`,
      label: p.fullName,
      category: "Politiques",
      icon: Users,
    });
  }
  for (const p of results.parties) {
    items.push({
      href: `/admin/partis/${p.slug}`,
      label: `${p.name} (${p.shortName})`,
      category: "Partis",
      icon: Building2,
    });
  }
  for (const d of results.dossiers) {
    items.push({
      href: `/admin/dossiers/${d.slug || d.id}`,
      label: d.title,
      category: "Dossiers",
      icon: FileText,
    });
  }

  return items;
}

export function AdminCommandPalette() {
  const router = useRouter();
  const pathname = usePathname();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxRef = useRef<HTMLUListElement>(null);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  // Cmd+K / Ctrl+K to open
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleClose = useCallback(() => {
    setOpen(false);
    setQuery("");
    setResults(null);
    setActiveIndex(-1);
  }, []);

  // Sync native dialog with open state

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      dialog.showModal();
      requestAnimationFrame(() => inputRef.current?.focus());
    } else {
      dialog.close();
    }
  }, [open]);

  // Close on route change
  // eslint-disable-next-line react-hooks/set-state-in-effect -- sync with navigation
  useEffect(() => handleClose(), [pathname, handleClose]);

  // Close on backdrop click
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    function onClick(e: MouseEvent) {
      if (e.target === dialog) handleClose();
    }
    function onCancel(e: Event) {
      e.preventDefault();
      handleClose();
    }
    dialog.addEventListener("click", onClick);
    dialog.addEventListener("cancel", onCancel);
    return () => {
      dialog.removeEventListener("click", onClick);
      dialog.removeEventListener("cancel", onCancel);
    };
  }, [handleClose]);

  // Debounced search
  /* eslint-disable react-hooks/set-state-in-effect -- data fetching effect */
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
    }, 200);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const items = results ? buildAdminItems(results) : [];

  const navigate = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router]
  );

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

  // Group items by category
  const grouped = items.reduce(
    (acc, item, index) => {
      if (!acc[item.category]) acc[item.category] = [];
      acc[item.category].push({ ...item, flatIndex: index });
      return acc;
    },
    {} as Record<string, Array<NavigableItem & { flatIndex: number }>>
  );

  const hasResults = items.length > 0;
  const noResults = results && items.length === 0 && query.length >= 2;

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 z-[100] bg-transparent backdrop:bg-black/50 p-0 m-0 max-w-none max-h-none w-full h-full overflow-visible"
      aria-label="Recherche administration"
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
              placeholder="Rechercher dans l'admin..."
              className="flex-1 py-3.5 bg-transparent text-foreground placeholder:text-muted-foreground outline-none text-base"
              role="combobox"
              aria-expanded={hasResults ? "true" : "false"}
              aria-controls="admin-search-results"
              aria-autocomplete="list"
              aria-activedescendant={
                activeIndex >= 0 ? `admin-search-item-${activeIndex}` : undefined
              }
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
                id="admin-search-results"
                role="listbox"
                aria-label="Résultats"
                className="py-2"
              >
                {Object.entries(grouped).map(([category, categoryItems]) => (
                  <li key={category} role="presentation">
                    <div className="flex items-center gap-2 px-4 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {category}
                    </div>
                    <ul role="group" aria-label={category}>
                      {categoryItems.map((item) => {
                        const Icon = item.icon;
                        return (
                          <li key={item.href} role="presentation">
                            <button
                              id={`admin-search-item-${item.flatIndex}`}
                              role="option"
                              aria-selected={activeIndex === item.flatIndex}
                              data-index={item.flatIndex}
                              className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors cursor-pointer ${
                                activeIndex === item.flatIndex ? "bg-accent" : "hover:bg-accent/50"
                              }`}
                              onClick={() => navigate(item.href)}
                              onMouseEnter={() => setActiveIndex(item.flatIndex)}
                            >
                              <Icon
                                className="w-4 h-4 text-muted-foreground shrink-0"
                                aria-hidden="true"
                              />
                              <span className="text-sm truncate">{item.label}</span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                ))}
              </ul>
            )}

            {noResults && (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                Aucun résultat pour &laquo;&nbsp;{query}&nbsp;&raquo;
              </div>
            )}

            {!results && query.length < 2 && (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                Tapez au moins 2 caractères pour rechercher
              </div>
            )}
          </div>

          {/* Footer */}
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
        {hasResults && `${items.length} résultats trouvés`}
        {noResults && `Aucun résultat pour ${query}`}
      </div>
    </dialog>
  );
}
