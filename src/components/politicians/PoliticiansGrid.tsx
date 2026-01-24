"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { PoliticianCard } from "./PoliticianCard";
import { FilterBar, type SortOption, type MandateFilter, type StatusFilter } from "./FilterBar";
import { Badge } from "@/components/ui/badge";
import { PartySelect } from "./PartySelect";
import type { PoliticianWithPartyAndCounts, Party } from "@/types";

interface PoliticiansGridProps {
  politicians: PoliticianWithPartyAndCounts[];
  total: number;
  page: number;
  totalPages: number;
  parties: (Party & { _count: { politicians: number } })[];
  counts: {
    withConviction: number;
    deputes: number;
    senateurs: number;
    gouvernement: number;
    active: number;
    former: number;
  };
  filters: {
    search: string;
    partyFilter: string;
    convictionFilter: boolean;
    mandateFilter: MandateFilter;
    statusFilter: StatusFilter;
    sortOption: SortOption;
  };
}

export function PoliticiansGrid({
  politicians,
  total,
  page,
  totalPages,
  parties,
  counts,
  filters,
}: PoliticiansGridProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const { search, partyFilter, convictionFilter, mandateFilter, statusFilter, sortOption } = filters;

  // Build URL with current filters
  function buildUrl(newParams: Record<string, string | undefined>) {
    const url = new URLSearchParams();
    const finalParams = {
      search: search || undefined,
      party: partyFilter || undefined,
      conviction: convictionFilter ? "true" : undefined,
      mandate: mandateFilter || undefined,
      status: statusFilter || undefined,
      sort: sortOption !== "alpha" ? sortOption : undefined,
      page: undefined,
      ...newParams,
    };

    Object.entries(finalParams).forEach(([key, value]) => {
      if (value) url.set(key, value);
    });

    const queryString = url.toString();
    return `/politiques${queryString ? `?${queryString}` : ""}`;
  }

  const navigateTo = (url: string) => {
    startTransition(() => {
      router.push(url);
    });
  };

  // Count active filters
  const activeFilterCount = [partyFilter, convictionFilter, mandateFilter, statusFilter].filter(
    Boolean
  ).length;

  return (
    <>
      {/* Filters and sort */}
      <div className="mb-6 space-y-4">
        {/* Sort and mandate/status filters */}
        <FilterBar
          currentSort={sortOption}
          currentMandate={mandateFilter}
          currentStatus={statusFilter}
          counts={{
            deputes: counts.deputes,
            senateurs: counts.senateurs,
            gouvernement: counts.gouvernement,
            active: counts.active,
            former: counts.former,
          }}
        />

        {/* Party filter */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Parti:</span>
            <div className="flex flex-wrap gap-1">
              <Badge
                variant={partyFilter === "" ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => navigateTo(buildUrl({ party: undefined }))}
              >
                Tous
              </Badge>
              {parties.slice(0, 8).map((party) => (
                <Badge
                  key={party.id}
                  variant={partyFilter === party.id ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => navigateTo(buildUrl({ party: party.id }))}
                  style={{
                    backgroundColor:
                      partyFilter === party.id ? party.color || undefined : undefined,
                    borderColor: party.color || undefined,
                  }}
                >
                  {party.shortName}
                </Badge>
              ))}
              {parties.length > 8 && (
                <PartySelect
                  parties={parties.slice(8)}
                  currentValue={partyFilter}
                />
              )}
            </div>
          </div>

          {/* Conviction filter */}
          <div className="flex items-center gap-2 border-l pl-4">
            <Badge
              variant={convictionFilter ? "destructive" : "outline"}
              className="cursor-pointer"
              onClick={() => navigateTo(buildUrl({ conviction: convictionFilter ? undefined : "true" }))}
            >
              Avec condamnation ({counts.withConviction})
            </Badge>
          </div>
        </div>

        {/* Active filters summary */}
        {activeFilterCount > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Filtres actifs:</span>
            <button
              onClick={() => navigateTo("/politiques")}
              className="text-sm text-primary hover:underline"
            >
              Tout effacer
            </button>
          </div>
        )}
      </div>

      {/* Results */}
      {politicians.length > 0 ? (
        <>
          <div
            className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 transition-opacity duration-200 ${
              isPending ? "opacity-50 pointer-events-none" : ""
            }`}
          >
            {isPending && (
              <div className="absolute inset-0 flex items-center justify-center z-10">
                <div className="bg-background/80 rounded-lg p-4 shadow-lg flex items-center gap-3">
                  <svg
                    className="animate-spin h-5 w-5 text-primary"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  <span className="text-sm font-medium">Chargement...</span>
                </div>
              </div>
            )}
            {politicians.map((politician) => (
              <PoliticianCard
                key={politician.id}
                politician={politician}
                showConvictionBadge
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-8 flex justify-center items-center gap-2">
              {page > 1 && (
                <button
                  onClick={() => navigateTo(buildUrl({ page: String(page - 1) }))}
                  className="px-4 py-2 border rounded-md hover:bg-muted disabled:opacity-50"
                  disabled={isPending}
                >
                  Précédent
                </button>
              )}
              <span className="px-4 py-2 text-muted-foreground">
                Page {page} sur {totalPages}
              </span>
              {page < totalPages && (
                <button
                  onClick={() => navigateTo(buildUrl({ page: String(page + 1) }))}
                  className="px-4 py-2 border rounded-md hover:bg-muted disabled:opacity-50"
                  disabled={isPending}
                >
                  Suivant
                </button>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Aucun résultat trouvé</p>
          <button
            onClick={() => navigateTo("/politiques")}
            className="text-primary hover:underline mt-2 inline-block"
          >
            Voir tous les représentants
          </button>
        </div>
      )}
    </>
  );
}
