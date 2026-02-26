"use client";

import { useState, useEffect, useCallback } from "react";
import { RelationsPreview } from "@/components/relations/RelationsPreview";
import { RelationsDialog } from "@/components/relations/RelationsDialog";
import { RelationsResponse } from "@/types/relations";

interface RelationsClientProps {
  slug: string;
  politicianName: string;
}

export function RelationsClient({ slug, politicianName: _politicianName }: RelationsClientProps) {
  const [data, setData] = useState<RelationsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const fetchRelations = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/politiques/${slug}/relations`);

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
  }, [slug]);

  useEffect(() => {
    fetchRelations();
  }, [fetchRelations]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[320px] border rounded-lg bg-muted/20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Chargement des relations...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[320px] border rounded-lg bg-destructive/5">
        <div className="text-center">
          <p className="text-destructive mb-2">{error}</p>
          <button onClick={fetchRelations} className="text-sm text-primary hover:underline">
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  if (!data || data.clusters.length === 0) {
    return (
      <div className="flex items-center justify-center h-[320px] border rounded-lg bg-muted/20">
        <div className="text-center">
          <p className="text-muted-foreground mb-2">Aucune relation trouvée</p>
          <p className="text-sm text-muted-foreground">
            Ce représentant n&apos;a pas de connexions identifiées pour le moment
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <RelationsPreview
        center={data.center}
        clusters={data.clusters}
        totalConnections={data.stats.totalConnections}
        onOpen={() => setIsDialogOpen(true)}
      />

      <RelationsDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        center={data.center}
        clusters={data.clusters}
        stats={data.stats}
      />
    </>
  );
}
