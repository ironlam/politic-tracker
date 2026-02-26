"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";
import type { Chamber } from "@/generated/prisma";

interface ParticipationControlsProps {
  chamber?: Chamber;
  page: number;
  sortDirection: "ASC" | "DESC";
  totalPages: number;
  paginationOnly?: boolean;
}

export function ParticipationControls({
  chamber,
  page,
  sortDirection,
  totalPages,
  paginationOnly,
}: ParticipationControlsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const updateParams = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value) {
          params.set(key, value);
        } else {
          params.delete(key);
        }
      }
      startTransition(() => {
        router.push(`/statistiques?${params.toString()}`, { scroll: false });
      });
    },
    [router, searchParams, startTransition]
  );

  const buttonClass =
    "px-3 py-1.5 text-xs font-medium rounded-md border transition-colors disabled:opacity-50";
  const activeClass = "bg-primary text-primary-foreground border-primary";
  const inactiveClass = "bg-background text-foreground border-input hover:bg-muted";

  if (paginationOnly) {
    return (
      <div
        className={`flex items-center justify-center gap-2 mt-6 ${isPending ? "opacity-60" : ""}`}
      >
        <button
          className={`${buttonClass} ${inactiveClass}`}
          disabled={page <= 1}
          onClick={() => updateParams({ pPage: String(page - 1) })}
        >
          ← Précédent
        </button>
        <span className="text-sm text-muted-foreground tabular-nums">
          Page {page}/{totalPages}
        </span>
        <button
          className={`${buttonClass} ${inactiveClass}`}
          disabled={page >= totalPages}
          onClick={() => updateParams({ pPage: String(page + 1) })}
        >
          Suivant →
        </button>
      </div>
    );
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 ${isPending ? "opacity-60" : ""}`}>
      {/* Chamber filter */}
      <div className="flex items-center gap-1">
        <button
          className={`${buttonClass} ${!chamber ? activeClass : inactiveClass}`}
          onClick={() => updateParams({ chamber: "", pPage: "" })}
        >
          Tous
        </button>
        <button
          className={`${buttonClass} ${chamber === "AN" ? activeClass : inactiveClass}`}
          onClick={() => updateParams({ chamber: "AN", pPage: "" })}
        >
          Assemblée
        </button>
        <button
          className={`${buttonClass} ${chamber === "SENAT" ? activeClass : inactiveClass}`}
          onClick={() => updateParams({ chamber: "SENAT", pPage: "" })}
        >
          Sénat
        </button>
      </div>

      {/* Sort toggle */}
      <button
        className={`${buttonClass} ${inactiveClass}`}
        onClick={() =>
          updateParams({
            pSort: sortDirection === "ASC" ? "desc" : "",
            pPage: "",
          })
        }
      >
        {sortDirection === "ASC" ? "↑ Moins présents" : "↓ Plus présents"}
      </button>
    </div>
  );
}
