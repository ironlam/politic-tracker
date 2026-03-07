"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Trash2, X } from "lucide-react";

interface AdminDeleteButtonProps {
  endpoint: string;
  label?: string;
  confirmMessage?: string;
  size?: "sm" | "icon";
}

export function AdminDeleteButton({
  endpoint,
  label = "Supprimer",
  confirmMessage = "Confirmer la suppression ?",
  size = "sm",
}: AdminDeleteButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!window.confirm(confirmMessage)) return;

    setLoading(true);
    try {
      const res = await fetch(endpoint, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        alert(data?.error || "Erreur lors de la suppression");
        return;
      }
      router.refresh();
    } catch {
      alert("Erreur réseau");
    } finally {
      setLoading(false);
    }
  }

  if (size === "icon") {
    return (
      <button
        onClick={handleDelete}
        disabled={loading}
        className="p-1.5 text-muted-foreground hover:text-red-600 dark:hover:text-red-400 rounded-md hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors disabled:opacity-50"
        title={label}
      >
        {loading ? (
          <span className="w-4 h-4 block animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : (
          <X className="w-4 h-4" />
        )}
      </button>
    );
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-md transition-colors disabled:opacity-50"
    >
      {loading ? (
        <span className="w-3.5 h-3.5 block animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : (
        <Trash2 className="w-3.5 h-3.5" />
      )}
      {label}
    </button>
  );
}
