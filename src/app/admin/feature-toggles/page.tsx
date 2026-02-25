"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Clock, ToggleLeft } from "lucide-react";
import { toast } from "sonner";
import { FlagCardSkeleton } from "./_components/FlagCardSkeleton";

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
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newFlagName, setNewFlagName] = useState("");
  const [newFlagLabel, setNewFlagLabel] = useState("");

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
    setFlags((prev) => prev.map((f) => (f.id === id ? { ...f, enabled } : f)));
    setToggling(id);
    try {
      const res = await fetch(`/api/admin/feature-flags/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      if (!res.ok) {
        setFlags((prev) => prev.map((f) => (f.id === id ? { ...f, enabled: !enabled } : f)));
        toast.error("Erreur, flag restauré");
      }
    } catch {
      setFlags((prev) => prev.map((f) => (f.id === id ? { ...f, enabled: !enabled } : f)));
      toast.error("Erreur réseau, flag restauré");
    } finally {
      setToggling(null);
    }
  }

  function deleteFlag(id: string, name: string) {
    setDeleteTarget({ id, name });
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    await fetch(`/api/admin/feature-flags/${deleteTarget.id}`, { method: "DELETE" });
    setFlags((prev) => prev.filter((f) => f.id !== deleteTarget.id));
    setDeleteTarget(null);
  }

  async function createFlag() {
    if (!newFlagName || !newFlagLabel) return;
    const res = await fetch("/api/admin/feature-flags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newFlagName, label: newFlagLabel }),
    });
    if (res.ok) {
      const flag = await res.json();
      setFlags((prev) => [...prev, flag]);
      setNewFlagName("");
      setNewFlagLabel("");
      setShowCreateForm(false);
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
        <Button onClick={() => setShowCreateForm(true)}>
          <Plus className="w-4 h-4 mr-2" aria-hidden="true" />
          Nouveau flag
        </Button>
      </div>

      {showCreateForm && (
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="flag-name">Nom (SNAKE_CASE)</Label>
                <Input
                  id="flag-name"
                  value={newFlagName}
                  onChange={(e) =>
                    setNewFlagName(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ""))
                  }
                  placeholder="MY_FEATURE"
                  className="w-48"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="flag-label">Label affiché</Label>
                <Input
                  id="flag-label"
                  value={newFlagLabel}
                  onChange={(e) => setNewFlagLabel(e.target.value)}
                  placeholder="Ma fonctionnalité"
                  className="w-64"
                />
              </div>
              <Button onClick={createFlag} disabled={!newFlagName || !newFlagLabel}>
                Créer
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setShowCreateForm(false);
                  setNewFlagName("");
                  setNewFlagLabel("");
                }}
              >
                Annuler
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <FlagCardSkeleton />
      ) : flags.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <ToggleLeft
              className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3"
              aria-hidden="true"
            />
            <p className="text-sm text-muted-foreground">Aucun feature flag configuré</p>
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

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        onConfirm={confirmDelete}
        title="Supprimer ce feature flag ?"
        description={`Le flag « ${deleteTarget?.name ?? ""} » sera supprimé définitivement.`}
        confirmLabel="Supprimer"
        variant="destructive"
      />
    </div>
  );
}
