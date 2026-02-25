"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "sonner";
import { LogOut, AlertTriangle, ToggleLeft, Trash2, Loader2, RefreshCw, Bell } from "lucide-react";
import type { CacheTag } from "@/lib/cache";

const TAG_LABELS: Record<CacheTag, string> = {
  politicians: "Politiques",
  parties: "Partis",
  votes: "Votes",
  stats: "Statistiques",
  dossiers: "Dossiers",
  factchecks: "Fact-checks",
};

const ALL_CACHE_TAGS = Object.keys(TAG_LABELS) as CacheTag[];

export default function SettingsPage() {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [resettingFlags, setResettingFlags] = useState(false);
  const [purgingAudit, setPurgingAudit] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmPurge, setConfirmPurge] = useState(false);
  const [invalidatingCache, setInvalidatingCache] = useState(false);
  const [confirmInvalidate, setConfirmInvalidate] = useState(false);
  const [invalidateMode, setInvalidateMode] = useState<"all" | "selective">("all");
  const [selectedTags, setSelectedTags] = useState<CacheTag[]>([]);
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [webhookStatus, setWebhookStatus] = useState<{
    configured: boolean;
    hint: string | null;
  } | null>(null);

  useEffect(() => {
    fetch("/api/admin/webhook/test")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setWebhookStatus(data);
      })
      .catch(() => {});
  }, []);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/admin/auth", { method: "DELETE" });
      router.push("/admin/login");
    } finally {
      setLoggingOut(false);
    }
  }

  async function handleResetFlags() {
    setResettingFlags(true);
    try {
      const res = await fetch("/api/admin/feature-flags", { method: "GET" });
      if (!res.ok) return;
      const flags: { id: string }[] = await res.json();
      for (const flag of flags) {
        await fetch(`/api/admin/feature-flags/${flag.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled: false }),
        });
      }
      toast.success(`${flags.length} feature flags désactivés.`);
    } finally {
      setResettingFlags(false);
    }
  }

  async function handlePurgeAudit() {
    setPurgingAudit(true);
    try {
      const res = await fetch("/api/admin/audit/purge", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        toast.success(`${data.deleted} entrées supprimées.`);
      } else {
        toast.error("Erreur lors de la purge.");
      }
    } finally {
      setPurgingAudit(false);
    }
  }

  function toggleTag(tag: CacheTag) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  async function handleTestWebhook() {
    setTestingWebhook(true);
    try {
      const res = await fetch("/api/admin/webhook/test", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        toast.success("Webhook envoyé avec succès.");
      } else {
        toast.error(`Échec du webhook : ${data.error}`);
      }
    } catch {
      toast.error("Erreur réseau lors du test.");
    } finally {
      setTestingWebhook(false);
    }
  }

  async function handleInvalidateCache() {
    setInvalidatingCache(true);
    try {
      const body = invalidateMode === "all" ? { all: true } : { tags: selectedTags };
      const res = await fetch("/api/admin/cache/revalidate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = await res.json();
        const label =
          data.revalidated === "all"
            ? "tout le cache"
            : (data.revalidated as string[])
                .map((t: string) => TAG_LABELS[t as CacheTag] ?? t)
                .join(", ");
        toast.success(`Cache invalidé : ${label}.`);
      } else {
        toast.error("Erreur lors de l'invalidation du cache.");
      }
    } finally {
      setInvalidatingCache(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-bold tracking-tight">Paramètres</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configuration système et gestion de session
        </p>
      </div>

      {/* System info */}
      <div>
        <h2 className="text-sm font-medium mb-3">Système</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Environnement</p>
              <Badge
                variant="outline"
                className="bg-emerald-50 text-emerald-700 border-emerald-200"
              >
                Production
              </Badge>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Framework</p>
              <span className="text-sm font-medium">Next.js 16 + Prisma 7</span>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Base de données</p>
              <span className="text-sm font-medium">PostgreSQL (Supabase)</span>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Session */}
      <div>
        <h2 className="text-sm font-medium mb-3">Session</h2>
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Authentification</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Le mot de passe est géré via la variable d&apos;environnement{" "}
                  <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono">
                    ADMIN_PASSWORD
                  </code>
                </p>
              </div>
              <Button variant="outline" onClick={handleLogout} disabled={loggingOut}>
                {loggingOut ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <LogOut className="w-4 h-4 mr-2" aria-hidden="true" />
                )}
                Se déconnecter
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cache */}
      <div>
        <h2 className="text-sm font-medium mb-3">Cache</h2>
        <Card>
          <CardContent className="p-4 space-y-4">
            <div>
              <p className="text-sm font-medium">Invalidation du cache</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Force le rafraîchissement des données mises en cache par Next.js.
              </p>
            </div>

            <fieldset className="space-y-2">
              <legend className="sr-only">Mode d&apos;invalidation</legend>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="invalidateMode"
                  value="all"
                  checked={invalidateMode === "all"}
                  onChange={() => setInvalidateMode("all")}
                  className="accent-primary"
                />
                Tout invalider
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="invalidateMode"
                  value="selective"
                  checked={invalidateMode === "selective"}
                  onChange={() => setInvalidateMode("selective")}
                  className="accent-primary"
                />
                Sélection par tag
              </label>
            </fieldset>

            {invalidateMode === "selective" && (
              <fieldset className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <legend className="sr-only">Tags à invalider</legend>
                {ALL_CACHE_TAGS.map((tag) => (
                  <label key={tag} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedTags.includes(tag)}
                      onChange={() => toggleTag(tag)}
                      className="accent-primary"
                    />
                    {TAG_LABELS[tag]}
                  </label>
                ))}
              </fieldset>
            )}

            <div className="flex justify-end">
              <Button
                variant="outline"
                onClick={() => setConfirmInvalidate(true)}
                disabled={
                  invalidatingCache || (invalidateMode === "selective" && selectedTags.length === 0)
                }
              >
                {invalidatingCache ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" aria-hidden="true" />
                )}
                Invalider le cache
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Webhook */}
      <div>
        <h2 className="text-sm font-medium mb-3">Notifications</h2>
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium">Webhook</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Notification envoyée sur échec des syncs critiques et détection de nouvelles
                  affaires.
                </p>
                {webhookStatus && (
                  <p className="text-xs mt-1">
                    {webhookStatus.configured ? (
                      <span className="text-emerald-600">
                        Configuré :{" "}
                        <code className="bg-muted px-1 py-0.5 rounded font-mono">
                          {webhookStatus.hint}
                        </code>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">
                        Non configuré — définir{" "}
                        <code className="bg-muted px-1 py-0.5 rounded font-mono">
                          ADMIN_WEBHOOK_URL
                        </code>
                      </span>
                    )}
                  </p>
                )}
              </div>
              <Button
                variant="outline"
                onClick={handleTestWebhook}
                disabled={testingWebhook || !webhookStatus?.configured}
              >
                {testingWebhook ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Bell className="w-4 h-4 mr-2" aria-hidden="true" />
                )}
                Tester
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Danger zone */}
      <div>
        <h2 className="text-sm font-medium mb-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-500" aria-hidden="true" />
          Zone dangereuse
        </h2>
        <Card className="border-red-200">
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium">Réinitialiser les feature flags</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Désactive tous les feature flags. Les fonctionnalités devront être réactivées
                  manuellement.
                </p>
              </div>
              <Button
                variant="outline"
                className="shrink-0 border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
                onClick={() => setConfirmReset(true)}
                disabled={resettingFlags}
              >
                {resettingFlags ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <ToggleLeft className="w-4 h-4 mr-2" aria-hidden="true" />
                )}
                Réinitialiser
              </Button>
            </div>

            <div className="border-t border-red-100" />

            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium">Purger l&apos;audit log</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Supprime les entrées de plus de 90 jours. Action irréversible.
                </p>
              </div>
              <Button
                variant="outline"
                className="shrink-0 border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
                onClick={() => setConfirmPurge(true)}
                disabled={purgingAudit}
              >
                {purgingAudit ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4 mr-2" aria-hidden="true" />
                )}
                Purger
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={confirmInvalidate}
        onOpenChange={setConfirmInvalidate}
        onConfirm={handleInvalidateCache}
        title="Invalider le cache ?"
        description={
          invalidateMode === "all"
            ? "Tout le cache Next.js sera invalidé. Les prochaines requêtes seront recalculées."
            : `Les tags suivants seront invalidés : ${selectedTags.map((t) => TAG_LABELS[t]).join(", ")}.`
        }
        confirmLabel="Invalider"
      />
      <ConfirmDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        onConfirm={handleResetFlags}
        title="Réinitialiser les feature flags ?"
        description="Toutes les fonctionnalités seront désactivées. Elles devront être réactivées manuellement."
        confirmLabel="Réinitialiser"
        variant="destructive"
      />
      <ConfirmDialog
        open={confirmPurge}
        onOpenChange={setConfirmPurge}
        onConfirm={handlePurgeAudit}
        title="Purger l'audit log ?"
        description="Les entrées de plus de 90 jours seront supprimées. Cette action est irréversible."
        confirmLabel="Purger"
        variant="destructive"
      />
    </div>
  );
}
