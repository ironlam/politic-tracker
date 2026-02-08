"use client";

import { useRouter } from "next/navigation";
import { SearchAutocomplete } from "./SearchAutocomplete";
import Link from "next/link";

interface SearchFormProps {
  defaultSearch: string;
  partyFilter: string;
  convictionFilter: boolean;
  mandateFilter: string;
  statusFilter: string;
  sortOption: string;
}

export function SearchForm({
  defaultSearch,
  partyFilter,
  convictionFilter,
  mandateFilter,
  statusFilter,
  sortOption,
}: SearchFormProps) {
  const router = useRouter();

  const handleSearch = (query: string) => {
    const params = new URLSearchParams();
    if (query) params.set("search", query);
    if (partyFilter) params.set("party", partyFilter);
    if (convictionFilter) params.set("conviction", "true");
    if (mandateFilter) params.set("mandate", mandateFilter);
    if (statusFilter) params.set("status", statusFilter);
    if (sortOption && sortOption !== "alpha") params.set("sort", sortOption);

    const queryString = params.toString();
    router.push(`/politiques${queryString ? `?${queryString}` : ""}`);
  };

  const hasFilters =
    defaultSearch || partyFilter || convictionFilter || mandateFilter || statusFilter;

  return (
    <div className="flex gap-4 flex-wrap items-center">
      <SearchAutocomplete
        defaultValue={defaultSearch}
        placeholder="Rechercher un représentant..."
        onSearch={handleSearch}
      />
      <button
        type="button"
        onClick={() => handleSearch(defaultSearch)}
        className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
      >
        Rechercher
      </button>
      {hasFilters && (
        <Link
          href="/politiques"
          className="px-4 py-2 border rounded-md hover:bg-muted text-muted-foreground"
        >
          Réinitialiser
        </Link>
      )}
    </div>
  );
}
