"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, Trash2, Clock } from "lucide-react";

interface FeatureFlag {
  id: string;
  name: string;
  label: string;
  description: string | null;
  enabled: boolean;
  value: unknown;
  startDate: string | null;
  endDate: string | null;
  updatedAt: string;
  updatedBy: string | null;
}

function getStatus(flag: FeatureFlag): { label: string; className: string } {
  const now = new Date();
  if (flag.startDate && now < new Date(flag.startDate)) {
    return { label: "Programmé", className: "bg-blue-50 text-blue-700 border-blue-200" };
  }
  if (flag.endDate && now > new Date(flag.endDate)) {
    return { label: "Expiré", className: "bg-gray-50 text-gray-500 border-gray-200" };
  }
  if (flag.enabled) {
    return { label: "Actif", className: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  }
  return { label: "Inactif", className: "bg-gray-50 text-gray-500 border-gray-200" };
}

export default function FeatureTogglesPage() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  const fetchFlags = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/feature-flags");
      if (res.ok) setFlags(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFlags();
  }, [fetchFlags]);

  async function toggleFlag(id: string, enabled: boolean) {
    setToggling(id);
    try {
      await fetch(`/api/admin/feature-flags/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      setFlags((prev) => prev.map((f) => (f.id === id ? { ...f, enabled } : f)));
    } finally {
      setToggling(null);
    }
  }

  async function deleteFlag(id: string, name: string) {
    if (!confirm(`Supprimer le flag "${name}" ?`)) return;
    await fetch(`/api/admin/feature-flags/${id}`, { method: "DELETE" });
    setFlags((prev) => prev.filter((f) => f.id !== id));
  }

  async function createFlag() {
    const name = prompt("Nom du flag (SNAKE_CASE) :");
    if (!name) return;
    const label = prompt("Label affiché :");
    if (!label) return;

    const res = await fetch("/api/admin/feature-flags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, label }),
    });
    if (res.ok) {
      const flag = await res.json();
      setFlags((prev) => [...prev, flag]);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight">Feature Toggles</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Activation/désactivation des fonctionnalités avec scheduling
          </p>
        </div>
        <Button onClick={createFlag}>
          <Plus className="w-4 h-4 mr-2" aria-hidden="true" />
          Nouveau flag
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : flags.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Aucun feature flag configuré
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {flags.map((flag) => {
            const status = getStatus(flag);
            return (
              <Card key={flag.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    {/* Toggle */}
                    <button
                      onClick={() => toggleFlag(flag.id, !flag.enabled)}
                      disabled={toggling === flag.id}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-ring/50 focus:ring-offset-2 ${
                        flag.enabled ? "bg-emerald-500" : "bg-gray-300"
                      }`}
                      role="switch"
                      aria-checked={flag.enabled}
                      aria-label={`Activer ${flag.label}`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${
                          flag.enabled ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{flag.label}</span>
                        <code className="text-xs text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">
                          {flag.name}
                        </code>
                        <Badge variant="outline" className={status.className}>
                          {status.label}
                        </Badge>
                      </div>
                      {flag.description && (
                        <p className="text-xs text-muted-foreground mt-1">{flag.description}</p>
                      )}
                      {(flag.startDate || flag.endDate) && (
                        <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" aria-hidden="true" />
                          {flag.startDate && (
                            <span>Du {new Date(flag.startDate).toLocaleDateString("fr-FR")}</span>
                          )}
                          {flag.endDate && (
                            <span>au {new Date(flag.endDate).toLocaleDateString("fr-FR")}</span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Value preview */}
                    {flag.value != null && (
                      <code className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded max-w-[200px] truncate hidden sm:block">
                        {JSON.stringify(flag.value)}
                      </code>
                    )}

                    {/* Delete */}
                    <button
                      onClick={() => deleteFlag(flag.id, flag.name)}
                      className="p-2 text-muted-foreground hover:text-destructive transition-colors rounded-md hover:bg-destructive/10"
                      aria-label={`Supprimer ${flag.name}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
