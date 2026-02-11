"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Users, Building2 } from "lucide-react";

type Mode = "politicians" | "parties";

export function CompareMode() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mode: Mode = searchParams.get("mode") === "partis" ? "parties" : "politicians";

  const switchMode = (newMode: Mode) => {
    const params = new URLSearchParams();
    if (newMode === "parties") {
      params.set("mode", "partis");
    }
    router.push(`/comparer?${params.toString()}`);
  };

  return (
    <div className="inline-flex rounded-lg border p-1 bg-muted">
      <button
        onClick={() => switchMode("politicians")}
        className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
          mode === "politicians"
            ? "bg-background shadow-sm text-foreground"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <Users className="h-4 w-4" />
        Politiciens
      </button>
      <button
        onClick={() => switchMode("parties")}
        className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
          mode === "parties"
            ? "bg-background shadow-sm text-foreground"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <Building2 className="h-4 w-4" />
        Partis
      </button>
    </div>
  );
}
