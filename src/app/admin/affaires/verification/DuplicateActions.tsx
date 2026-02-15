"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface DuplicateActionsProps {
  affairIdA: string;
  affairIdB: string;
}

export function DuplicateActions({ affairIdA, affairIdB }: DuplicateActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function handleMerge(keepId: string, removeId: string) {
    if (!confirm("Fusionner ces deux affaires ? L'affaire supprimée sera transférée vers l'autre."))
      return;
    setLoading(`merge-${removeId}`);
    try {
      const res = await fetch(`/api/admin/affairs/${removeId}/merge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mergeIntoId: keepId }),
      });
      if (res.ok) {
        router.refresh();
      }
    } finally {
      setLoading(null);
    }
  }

  async function handleDismiss() {
    setLoading("dismiss");
    try {
      const res = await fetch("/api/admin/affairs/duplicates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ affairIdA, affairIdB }),
      });
      if (res.ok) {
        router.refresh();
      }
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex gap-2 mt-3 justify-end">
      <Button
        size="sm"
        onClick={() => handleMerge(affairIdA, affairIdB)}
        disabled={loading !== null}
      >
        {loading === `merge-${affairIdB}` ? "..." : "Fusionner A\u2190B"}
      </Button>
      <Button
        size="sm"
        onClick={() => handleMerge(affairIdB, affairIdA)}
        disabled={loading !== null}
      >
        {loading === `merge-${affairIdA}` ? "..." : "Fusionner B\u2190A"}
      </Button>
      <Button size="sm" variant="outline" onClick={handleDismiss} disabled={loading !== null}>
        {loading === "dismiss" ? "..." : "Pas un doublon"}
      </Button>
    </div>
  );
}
