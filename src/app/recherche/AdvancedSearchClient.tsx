"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PoliticianAvatar } from "@/components/politicians/PoliticianAvatar";
import { MANDATE_TYPE_LABELS } from "@/config/labels";
import { ensureContrast } from "@/lib/contrast";
import { MandateType } from "@/generated/prisma";

interface SearchResult {
  id: string;
  slug: string;
  fullName: string;
  firstName: string;
  lastName: string;
  photoUrl: string | null;
  currentParty: {
    id: string;
    name: string;
    shortName: string;
    color: string | null;
  } | null;
  currentMandate: {
    type: MandateType;
    constituency: string | null;
  } | null;
  affairsCount: number;
}

interface SearchResponse {
  results: SearchResult[];
  total: number;
  page: number;
  totalPages: number;
  suggestions?: string[];
}

interface FilterOptions {
  parties: Array<{
    id: string;
    shortName: string;
    name: string;
    color: string | null;
    count: number;
  }>;
  departments: string[];
  mandateTypes: Array<{
    type: MandateType;
    count: number;
  }>;
}

export function AdvancedSearchClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Form state
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [partyId, setPartyId] = useState(searchParams.get("party") || "");
  const [mandateType, setMandateType] = useState(searchParams.get("mandate") || "");
  const [department, setDepartment] = useState(searchParams.get("department") || "");
  const [hasAffairs, setHasAffairs] = useState(searchParams.get("hasAffairs") || "");
  const [isActive, setIsActive] = useState(searchParams.get("isActive") || "");

  // Results state
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load filter options
  useEffect(() => {
    fetch("/api/search/filters")
      .then((res) => res.json())
      .then(setFilterOptions)
      .catch(() => {});
  }, []);

  // Search function
  const performSearch = useCallback(
    async (page: number = 1) => {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (query) params.set("q", query);
      if (partyId) params.set("party", partyId);
      if (mandateType) params.set("mandate", mandateType);
      if (department) params.set("department", department);
      if (hasAffairs) params.set("hasAffairs", hasAffairs);
      if (isActive) params.set("isActive", isActive);
      params.set("page", String(page));
      params.set("limit", "24");

      // Update URL
      router.push(`/recherche?${params.toString()}`, { scroll: false });

      try {
        const response = await fetch(`/api/search/advanced?${params.toString()}`);
        if (!response.ok) throw new Error("Erreur de recherche");
        const data = await response.json();
        setResults(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur inconnue");
      } finally {
        setIsLoading(false);
      }
    },
    [query, partyId, mandateType, department, hasAffairs, isActive, router]
  );

  // Initial search from URL params
  useEffect(() => {
    if (searchParams.toString()) {
      performSearch(parseInt(searchParams.get("page") || "1", 10));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle form submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(1);
  };

  // Reset filters
  const handleReset = () => {
    setQuery("");
    setPartyId("");
    setMandateType("");
    setDepartment("");
    setHasAffairs("");
    setIsActive("");
    setResults(null);
    router.push("/recherche");
  };

  // Count active filters
  const activeFiltersCount = [partyId, mandateType, department, hasAffairs, isActive].filter(
    Boolean
  ).length;

  return (
    <div className="space-y-6">
      {/* Search Form */}
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Main search input */}
            <div>
              <label htmlFor="search-query" className="block text-sm font-medium mb-1">
                Nom ou prénom
              </label>
              <input
                id="search-query"
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher un représentant..."
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* Filters grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Party filter */}
              <div>
                <label htmlFor="filter-party" className="block text-sm font-medium mb-1">
                  Parti politique
                </label>
                <select
                  id="filter-party"
                  value={partyId}
                  onChange={(e) => setPartyId(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                >
                  <option value="">Tous les partis</option>
                  {filterOptions?.parties.map((party) => (
                    <option key={party.id} value={party.id}>
                      {party.shortName} ({party.count})
                    </option>
                  ))}
                </select>
              </div>

              {/* Mandate type filter */}
              <div>
                <label htmlFor="filter-mandate" className="block text-sm font-medium mb-1">
                  Type de mandat
                </label>
                <select
                  id="filter-mandate"
                  value={mandateType}
                  onChange={(e) => setMandateType(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                >
                  <option value="">Tous les mandats</option>
                  {filterOptions?.mandateTypes.map((m) => (
                    <option key={m.type} value={m.type}>
                      {MANDATE_TYPE_LABELS[m.type] || m.type} ({m.count})
                    </option>
                  ))}
                </select>
              </div>

              {/* Department filter */}
              <div>
                <label htmlFor="filter-department" className="block text-sm font-medium mb-1">
                  Département
                </label>
                <select
                  id="filter-department"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                >
                  <option value="">Tous les départements</option>
                  {filterOptions?.departments.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>

              {/* Affairs filter */}
              <div>
                <label htmlFor="filter-affairs" className="block text-sm font-medium mb-1">
                  Affaires judiciaires
                </label>
                <select
                  id="filter-affairs"
                  value={hasAffairs}
                  onChange={(e) => setHasAffairs(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                >
                  <option value="">Tous</option>
                  <option value="true">Avec affaires</option>
                  <option value="false">Sans affaires</option>
                </select>
              </div>

              {/* Active status filter */}
              <div>
                <label htmlFor="filter-active" className="block text-sm font-medium mb-1">
                  Statut
                </label>
                <select
                  id="filter-active"
                  value={isActive}
                  onChange={(e) => setIsActive(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                >
                  <option value="">Tous</option>
                  <option value="true">Actifs (mandat en cours)</option>
                  <option value="false">Anciens</option>
                </select>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
              >
                {isLoading ? "Recherche..." : "Rechercher"}
              </button>
              {activeFiltersCount > 0 && (
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-4 py-2 border rounded-md hover:bg-muted text-muted-foreground"
                >
                  Réinitialiser ({activeFiltersCount} filtre{activeFiltersCount > 1 ? "s" : ""})
                </button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Error */}
      {error && <div className="p-4 bg-destructive/10 text-destructive rounded-lg">{error}</div>}

      {/* Results */}
      {results && (
        <div className="space-y-4">
          {/* Results header */}
          <div className="flex items-center justify-between">
            <p className="text-muted-foreground">
              {results.total} résultat{results.total > 1 ? "s" : ""}
              {query && ` pour "${query}"`}
            </p>
          </div>

          {/* Results grid */}
          {results.results.length > 0 ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {results.results.map((politician) => (
                  <Link
                    key={politician.id}
                    href={`/politiques/${politician.slug}`}
                    className="block"
                  >
                    <Card className="hover:shadow-md transition-shadow h-full">
                      <CardContent className="pt-4">
                        <div className="flex items-start gap-3">
                          <PoliticianAvatar
                            photoUrl={politician.photoUrl}
                            firstName={politician.firstName}
                            lastName={politician.lastName}
                            size="md"
                            politicianId={politician.id}
                          />
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold truncate">{politician.fullName}</h3>
                            {politician.currentParty && (
                              <Badge
                                variant="outline"
                                className="mt-1"
                                title={politician.currentParty.name}
                                style={{
                                  borderColor: politician.currentParty.color || undefined,
                                  color: politician.currentParty.color
                                    ? ensureContrast(politician.currentParty.color, "#ffffff")
                                    : undefined,
                                }}
                              >
                                {politician.currentParty.shortName}
                              </Badge>
                            )}
                            {politician.currentMandate && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {MANDATE_TYPE_LABELS[politician.currentMandate.type] ||
                                  politician.currentMandate.type}
                                {politician.currentMandate.constituency && (
                                  <span className="block truncate">
                                    {politician.currentMandate.constituency}
                                  </span>
                                )}
                              </p>
                            )}
                            {politician.affairsCount > 0 && (
                              <Badge variant="destructive" className="mt-1 text-xs">
                                {politician.affairsCount} affaire
                                {politician.affairsCount > 1 ? "s" : ""}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>

              {/* Pagination */}
              {results.totalPages > 1 && (
                <div className="flex justify-center items-center gap-2 pt-4">
                  <button
                    onClick={() => performSearch(results.page - 1)}
                    disabled={results.page <= 1 || isLoading}
                    className="px-4 py-2 border rounded-md hover:bg-muted disabled:opacity-50"
                  >
                    Précédent
                  </button>
                  <span className="px-4 py-2 text-sm text-muted-foreground">
                    Page {results.page} sur {results.totalPages}
                  </span>
                  <button
                    onClick={() => performSearch(results.page + 1)}
                    disabled={results.page >= results.totalPages || isLoading}
                    className="px-4 py-2 border rounded-md hover:bg-muted disabled:opacity-50"
                  >
                    Suivant
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-2">Aucun résultat trouvé</p>
              {results.suggestions && results.suggestions.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm text-muted-foreground mb-2">Suggestions :</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {results.suggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        onClick={() => {
                          setQuery(suggestion);
                          performSearch(1);
                        }}
                        className="px-3 py-1 text-sm bg-muted rounded-full hover:bg-muted/80"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Initial state */}
      {!results && !isLoading && !error && (
        <div className="text-center py-12 text-muted-foreground">
          <p>Utilisez les filtres ci-dessus pour rechercher des représentants</p>
        </div>
      )}
    </div>
  );
}
