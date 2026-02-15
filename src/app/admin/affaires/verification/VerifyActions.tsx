"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface VerifyActionsProps {
  affairId: string;
}

export function VerifyActions({ affairId }: VerifyActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<"verify" | "reject" | null>(null);

  async function handleVerify() {
    setLoading("verify");
    try {
      const res = await fetch(`/api/admin/affairs/${affairId}/verify`, { method: "POST" });
      if (res.ok) {
        router.refresh();
      }
    } finally {
      setLoading(null);
    }
  }

  async function handleReject() {
    if (!confirm("Supprimer cette affaire ? Cette action est irréversible.")) return;
    setLoading("reject");
    try {
      const res = await fetch(`/api/admin/affairs/${affairId}/reject`, { method: "POST" });
      if (res.ok) {
        router.refresh();
      }
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex gap-2 ml-4 shrink-0">
      <Button size="sm" onClick={handleVerify} disabled={loading !== null}>
        {loading === "verify" ? "..." : "Vérifier"}
      </Button>
      <Button size="sm" variant="destructive" onClick={handleReject} disabled={loading !== null}>
        {loading === "reject" ? "..." : "Rejeter"}
      </Button>
    </div>
  );
}
