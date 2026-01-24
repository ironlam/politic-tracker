"use client";

import { useState, useEffect, useCallback } from "react";
import { RelationsGraph } from "@/components/relations/RelationsGraph";
import { RelationFilters } from "@/components/relations/RelationFilters";
import { RelationLegend } from "@/components/relations/RelationLegend";
import { RelationType, RelationsResponse } from "@/types/relations";
import { ALL_RELATION_TYPES } from "@/config/relations";

interface RelationsClientProps {
  slug: string;
  politicianName: string;
}

export function RelationsClient({ slug, politicianName }: RelationsClientProps) {
  const [selectedTypes, setSelectedTypes] = useState<RelationType[]>(ALL_RELATION_TYPES);
  const [data, setData] = useState<RelationsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRelations = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set("types", selectedTypes.join(","));
      params.set("limit", "15");

      const response = await fetch(`/api/politiques/${slug}/relations?${params}`);

      if (!response.ok) {
        throw new Error("Erreur lors du chargement des relations");
      }

      const result: RelationsResponse = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setIsLoading(false);
    }
  }, [slug, selectedTypes]);

  useEffect(() => {
    fetchRelations();
  }, [fetchRelations]);

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-muted/30 rounded-lg p-4">
        <RelationFilters selectedTypes={selectedTypes} onChange={setSelectedTypes} />
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center h-[400px] border rounded-lg bg-muted/20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-3"></div>
            <p className="text-sm text-muted-foreground">Chargement des relations...</p>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && !isLoading && (
        <div className="flex items-center justify-center h-[400px] border rounded-lg bg-destructive/5">
          <div className="text-center">
            <p className="text-destructive mb-2">{error}</p>
            <button
              onClick={fetchRelations}
              className="text-sm text-primary hover:underline"
            >
              Réessayer
            </button>
          </div>
        </div>
      )}

      {/* Graph */}
      {data && !isLoading && !error && (
        <>
          {data.nodes.length === 0 ? (
            <div className="flex items-center justify-center h-[400px] border rounded-lg bg-muted/20">
              <div className="text-center">
                <p className="text-muted-foreground mb-2">
                  Aucune relation trouvée pour les filtres sélectionnés
                </p>
                <p className="text-sm text-muted-foreground">
                  Essayez de sélectionner d&apos;autres types de relations
                </p>
              </div>
            </div>
          ) : (
            <>
              <RelationsGraph
                center={data.center}
                nodes={data.nodes}
                links={data.links}
                width={typeof window !== "undefined" ? Math.min(window.innerWidth - 64, 1200) : 800}
                height={500}
              />

              {/* Legend and stats */}
              <div className="flex flex-col sm:flex-row justify-between gap-4">
                <RelationLegend activeTypes={data.stats.byType} />
                <div className="text-sm text-muted-foreground">
                  {data.stats.totalConnections} connexion{data.stats.totalConnections > 1 ? "s" : ""} avec{" "}
                  {data.nodes.length} représentant{data.nodes.length > 1 ? "s" : ""}
                </div>
              </div>

              {/* Help text */}
              <p className="text-xs text-muted-foreground border-t pt-4">
                Cliquez sur un noeud pour accéder à la fiche du représentant. Utilisez la molette pour
                zoomer et glissez pour vous déplacer.
              </p>
            </>
          )}
        </>
      )}
    </div>
  );
}
