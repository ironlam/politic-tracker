"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Search, Loader2, CheckCircle2 } from "lucide-react";

interface EnrichAffairsButtonProps {
  politicianId: string;
  affairCount: number;
}

export function EnrichAffairsButton({ politicianId, affairCount }: EnrichAffairsButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ enriched: number; candidates: number } | null>(null);

  if (affairCount === 0) return null;

  async function handleEnrich() {
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch(`/api/admin/politiques/${politicianId}/enrich-affairs`, {
        method: "POST",
      });

      if (!res.ok) {
        throw new Error("Erreur lors de l'enrichissement");
      }

      const data = await res.json();
      setResult({ enriched: data.enriched, candidates: data.candidates });
      router.refresh();
    } catch {
      setResult({ enriched: -1, candidates: 0 });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handleEnrich}
        disabled={loading}
        title="Rechercher des sources presse pour enrichir les affaires peu documentées"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin mr-1" />
        ) : (
          <Search className="h-4 w-4 mr-1" />
        )}
        {loading ? "Enrichissement…" : "Enrichir les affaires"}
      </Button>
      {result && result.enriched >= 0 && (
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3 text-green-500" />
          {result.enriched}/{result.candidates} enrichie(s)
        </span>
      )}
      {result && result.enriched === -1 && <span className="text-xs text-destructive">Erreur</span>}
    </div>
  );
}
