"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, type LucideIcon } from "lucide-react";

type Status = "idle" | "loading" | "success" | "error";

interface SyncButtonProps {
  action: string;
  body: Record<string, unknown>;
  label: string;
  icon: LucideIcon;
  formatStats?: (stats: Record<string, unknown>, durationMs: number) => string;
}

const AUTO_DISMISS_MS = 5_000;

export function SyncButton({ action, body, label, icon: Icon, formatStats }: SyncButtonProps) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  const reset = useCallback(() => {
    setStatus("idle");
    setMessage("");
  }, []);

  useEffect(() => {
    if (status !== "success") return;
    const timer = setTimeout(reset, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [status, reset]);

  async function handleSync() {
    setStatus("loading");
    setMessage("");

    try {
      const res = await fetch(action, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Erreur lors de la synchronisation");
      }

      const statsText = formatStats
        ? formatStats(data.stats, data.durationMs)
        : `Terminé en ${(data.durationMs / 1000).toFixed(1)}s`;

      setStatus("success");
      setMessage(statsText);
      router.refresh();
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Erreur inconnue");
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <Button
        variant="outline"
        size="sm"
        onClick={handleSync}
        disabled={status === "loading"}
        className="w-full justify-start"
      >
        {status === "loading" ? (
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
        ) : (
          <Icon className="h-4 w-4 mr-2" />
        )}
        {status === "loading" ? "Synchro…" : label}
      </Button>
      <div aria-live="polite" className="min-h-[1.25rem]">
        {status === "success" && (
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
            {message}
          </span>
        )}
        {status === "error" && <span className="text-xs text-destructive">{message}</span>}
      </div>
    </div>
  );
}
