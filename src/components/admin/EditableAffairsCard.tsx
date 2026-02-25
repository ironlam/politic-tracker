"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AFFAIR_STATUS_LABELS, AFFAIR_CATEGORY_LABELS, INVOLVEMENT_LABELS } from "@/config/labels";
import type { AffairCategory } from "@/types";

interface AffairData {
  id: string;
  title: string;
  slug: string;
  status: string;
  category: string;
  involvement: string;
  verdictDate: Date | null;
  startDate: Date | null;
  factsDate: Date | null;
}

interface EditableAffairsCardProps {
  politicianId: string;
  affairs: AffairData[];
}

export function EditableAffairsCard({ politicianId, affairs }: EditableAffairsCardProps) {
  const router = useRouter();
  const [localAffairs, setLocalAffairs] = useState<AffairData[]>(affairs);
  const [loadingField, setLoadingField] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleQuickUpdate = useCallback(
    async (affairId: string, field: "involvement" | "status", value: string) => {
      const key = `${affairId}-${field}`;
      setLoadingField(key);
      setErrorMessage(null);

      // Save original value for rollback
      const original = localAffairs.find((a) => a.id === affairId);
      const originalValue = original?.[field];

      // Optimistic update
      setLocalAffairs((prev) =>
        prev.map((a) => (a.id === affairId ? { ...a, [field]: value } : a))
      );

      try {
        const response = await fetch(`/api/admin/affaires/${affairId}/quick-update`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [field]: value }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Erreur lors de la mise à jour");
        }

        // Refresh server data in background
        router.refresh();
      } catch {
        // Rollback on error
        setLocalAffairs((prev) =>
          prev.map((a) => (a.id === affairId ? { ...a, [field]: originalValue } : a))
        );
        setErrorMessage("Erreur lors de la mise à jour. Veuillez réessayer.");
        setTimeout(() => setErrorMessage(null), 4000);
      } finally {
        setLoadingField(null);
      }
    },
    [localAffairs, router]
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Affaires judiciaires ({localAffairs.length})</CardTitle>
        <Button asChild size="sm">
          <Link href={`/admin/affaires/nouveau?politicianId=${politicianId}`}>+ Ajouter</Link>
        </Button>
      </CardHeader>
      <CardContent>
        {errorMessage && (
          <div
            role="alert"
            aria-live="polite"
            className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300"
          >
            {errorMessage}
          </div>
        )}

        {localAffairs.length > 0 ? (
          <div className="space-y-3">
            {localAffairs.map((affair) => {
              const date = affair.verdictDate || affair.startDate || affair.factsDate;
              const year = date ? new Date(date).getFullYear() : null;

              return (
                <div
                  key={affair.id}
                  className="rounded-lg border p-3 transition-colors hover:bg-accent/50"
                >
                  {/* Row 1: Year, Title, Action buttons */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      {year && (
                        <Badge variant="outline" className="shrink-0 font-mono">
                          {year}
                        </Badge>
                      )}
                      <span className="truncate font-medium">{affair.title}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/admin/affaires/${affair.id}`}>Voir</Link>
                      </Button>
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/admin/affaires/${affair.id}/edit`}>Modifier</Link>
                      </Button>
                    </div>
                  </div>

                  {/* Row 2: Status select, Involvement select, Category label */}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {/* Status select */}
                    <div className="flex items-center gap-1">
                      <select
                        value={affair.status}
                        onChange={(e) => handleQuickUpdate(affair.id, "status", e.target.value)}
                        disabled={loadingField === `${affair.id}-status`}
                        className="h-7 rounded border bg-background px-1 text-xs focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                        aria-label={`Statut de l'affaire ${affair.title}`}
                      >
                        {Object.entries(AFFAIR_STATUS_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                      {loadingField === `${affair.id}-status` && (
                        <span
                          className="text-xs text-muted-foreground animate-pulse"
                          aria-live="polite"
                        >
                          ...
                        </span>
                      )}
                    </div>

                    {/* Involvement select */}
                    <div className="flex items-center gap-1">
                      <select
                        value={affair.involvement}
                        onChange={(e) =>
                          handleQuickUpdate(affair.id, "involvement", e.target.value)
                        }
                        disabled={loadingField === `${affair.id}-involvement`}
                        className="h-7 rounded border bg-background px-1 text-xs focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                        aria-label={`Implication dans l'affaire ${affair.title}`}
                      >
                        {Object.entries(INVOLVEMENT_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                      {loadingField === `${affair.id}-involvement` && (
                        <span
                          className="text-xs text-muted-foreground animate-pulse"
                          aria-live="polite"
                        >
                          ...
                        </span>
                      )}
                    </div>

                    {/* Category label */}
                    <span className="text-sm text-muted-foreground">
                      {AFFAIR_CATEGORY_LABELS[affair.category as AffairCategory] || affair.category}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="py-4 text-center text-muted-foreground">
            Aucune affaire documentée pour ce représentant politique.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
