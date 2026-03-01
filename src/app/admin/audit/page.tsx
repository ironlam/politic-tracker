"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  History,
  ChevronDown,
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  GitMerge,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { AuditPageSkeleton } from "./_components/AuditPageSkeleton";

// ─── Types ───────────────────────────────────────────────

interface AuditEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  changes: Record<string, unknown> | null;
  userId: string | null;
  userEmail: string | null;
  ipAddress: string | null;
  createdAt: string;
}

interface ApiResponse {
  data: AuditEntry[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ─── Constants ───────────────────────────────────────────

const ACTION_CONFIG: Record<
  string,
  { label: string; icon: typeof Plus; className: string; dotColor: string }
> = {
  CREATE: {
    label: "Création",
    icon: Plus,
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dotColor: "bg-emerald-500",
  },
  UPDATE: {
    label: "Modification",
    icon: Pencil,
    className: "bg-blue-50 text-blue-700 border-blue-200",
    dotColor: "bg-blue-500",
  },
  DELETE: {
    label: "Suppression",
    icon: Trash2,
    className: "bg-red-50 text-red-700 border-red-200",
    dotColor: "bg-red-500",
  },
  MERGE: {
    label: "Fusion",
    icon: GitMerge,
    className: "bg-amber-50 text-amber-700 border-amber-200",
    dotColor: "bg-amber-500",
  },
};

const ENTITY_TYPES = [
  { value: "Politician", label: "Politicien" },
  { value: "Affair", label: "Affaire" },
  { value: "Party", label: "Parti" },
  { value: "Mandate", label: "Mandat" },
  { value: "Vote", label: "Vote" },
];

const ENTITY_ROUTES: Record<string, string> = {
  Politician: "/admin/politiques",
  Affair: "/admin/affaires",
  Party: "/admin/partis",
  Mandate: "/admin/mandats",
  Vote: "/admin/votes",
};

const ENTITY_LABELS: Record<string, string> = {
  Politician: "Politicien",
  Affair: "Affaire",
  Party: "Parti",
  Mandate: "Mandat",
  Vote: "Vote",
  Dossier: "Dossier",
};

// ─── Helpers ─────────────────────────────────────────────

function relativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "À l'instant";
  if (diffMin < 60) return `Il y a ${diffMin} min`;
  if (diffHour < 24) return `Il y a ${diffHour}h`;
  if (diffDay < 7) return `Il y a ${diffDay}j`;
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Oui" : "Non";
  if (typeof value === "string") {
    if (value.length > 80) return value.slice(0, 80) + "…";
    return value;
  }
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) return `[${value.length} éléments]`;
  if (typeof value === "object") return JSON.stringify(value).slice(0, 80);
  return String(value);
}

function parseDiff(
  changes: Record<string, unknown> | null
): Array<{ field: string; oldVal: unknown; newVal: unknown }> {
  if (!changes) return [];
  const diffs: Array<{ field: string; oldVal: unknown; newVal: unknown }> = [];

  for (const [key, value] of Object.entries(changes)) {
    if (value && typeof value === "object" && "old" in value && "new" in value) {
      const obj = value as { old: unknown; new: unknown };
      diffs.push({ field: key, oldVal: obj.old, newVal: obj.new });
    } else {
      diffs.push({ field: key, oldVal: undefined, newVal: value });
    }
  }
  return diffs;
}

// ─── Component ───────────────────────────────────────────

export default function AuditLogPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Read filters from URL
  const entityType = searchParams.get("entityType") || "";
  const action = searchParams.get("action") || "";
  const startDate = searchParams.get("startDate") || "";
  const endDate = searchParams.get("endDate") || "";
  const currentPage = parseInt(searchParams.get("page") || "1", 10);

  function updateParams(updates: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    if (!updates.page) params.delete("page");
    router.push(`/admin/audit?${params.toString()}`);
  }

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (entityType) params.set("entityType", entityType);
      if (action) params.set("action", action);
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      params.set("page", String(currentPage));
      params.set("limit", "30");

      const res = await fetch(`/api/admin/audit?${params.toString()}`);
      if (res.ok) {
        setData(await res.json());
      }
    } finally {
      setLoading(false);
    }
  }, [entityType, action, startDate, endDate, currentPage]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const entries = data?.data || [];
  const pagination = data?.pagination;
  const hasFilters = !!(entityType || action || startDate || endDate);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-bold tracking-tight">Journal d&apos;audit</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Historique de toutes les modifications apportées aux données
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label
                htmlFor="audit-entity-type"
                className="text-xs font-medium text-muted-foreground"
              >
                Entité
              </label>
              <select
                id="audit-entity-type"
                value={entityType}
                onChange={(e) => updateParams({ entityType: e.target.value })}
                className="block text-sm bg-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring/50"
              >
                <option value="">Toutes</option>
                {ENTITY_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label htmlFor="audit-action" className="text-xs font-medium text-muted-foreground">
                Action
              </label>
              <select
                id="audit-action"
                value={action}
                onChange={(e) => updateParams({ action: e.target.value })}
                className="block text-sm bg-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring/50"
              >
                <option value="">Toutes</option>
                {Object.entries(ACTION_CONFIG).map(([key, cfg]) => (
                  <option key={key} value={key}>
                    {cfg.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label htmlFor="audit-start" className="text-xs font-medium text-muted-foreground">
                Du
              </label>
              <input
                id="audit-start"
                type="date"
                value={startDate}
                onChange={(e) => updateParams({ startDate: e.target.value })}
                className="block text-sm bg-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring/50"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="audit-end" className="text-xs font-medium text-muted-foreground">
                Au
              </label>
              <input
                id="audit-end"
                type="date"
                value={endDate}
                onChange={(e) => updateParams({ endDate: e.target.value })}
                className="block text-sm bg-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring/50"
              />
            </div>

            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push("/admin/audit")}
                className="text-muted-foreground"
              >
                Réinitialiser
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Content */}
      {loading ? (
        <AuditPageSkeleton />
      ) : entries.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <History
              className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3"
              aria-hidden="true"
            />
            <p className="text-sm text-muted-foreground">
              {hasFilters ? "Aucune entrée pour ces filtres" : "Aucune activité enregistrée"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Timeline */}
          <div className="relative" role="list" aria-label="Entrées du journal d'audit">
            {/* Vertical thread line */}
            <div
              className="absolute left-[19px] top-4 bottom-4 w-px bg-border"
              aria-hidden="true"
            />

            <div className="space-y-1">
              {entries.map((entry) => {
                const config = ACTION_CONFIG[entry.action] || ACTION_CONFIG.UPDATE;
                const Icon = config!.icon;
                const isOpen = expanded.has(entry.id);
                const diffs = parseDiff(entry.changes);
                const hasDiff = diffs.length > 0;
                const entityRoute = ENTITY_ROUTES[entry.entityType];
                const entityLabel = ENTITY_LABELS[entry.entityType] || entry.entityType;

                return (
                  <div key={entry.id} className="relative pl-12" role="listitem">
                    {/* Timeline dot */}
                    <div
                      className={`absolute left-3 top-4 w-3.5 h-3.5 rounded-full border-2 border-background ${config!.dotColor} ring-2 ring-background`}
                      aria-hidden="true"
                    />

                    <Card className="hover:shadow-sm transition-shadow">
                      <CardContent className="p-4">
                        {/* Entry header */}
                        <div className="flex items-start gap-3">
                          {/* Expand button or static icon */}
                          {hasDiff ? (
                            <button
                              onClick={() => toggleExpand(entry.id)}
                              className="mt-0.5 p-0.5 rounded text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                              aria-expanded={isOpen}
                              aria-controls={`diff-${entry.id}`}
                              aria-label={
                                isOpen ? "Masquer les changements" : "Afficher les changements"
                              }
                            >
                              {isOpen ? (
                                <ChevronDown className="w-4 h-4" />
                              ) : (
                                <ChevronRight className="w-4 h-4" />
                              )}
                            </button>
                          ) : (
                            <span className="mt-0.5 p-0.5">
                              <Icon
                                className="w-4 h-4 text-muted-foreground/50"
                                aria-hidden="true"
                              />
                            </span>
                          )}

                          {/* Main content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="outline" className={config!.className}>
                                {config!.label}
                              </Badge>
                              <span className="text-sm font-medium">{entityLabel}</span>
                              {entityRoute ? (
                                <Link
                                  href={`${entityRoute}/${entry.entityId}`}
                                  className="text-xs font-mono text-muted-foreground hover:text-foreground bg-muted px-1.5 py-0.5 rounded transition-colors truncate max-w-[160px]"
                                >
                                  {entry.entityId.slice(0, 12)}…
                                </Link>
                              ) : (
                                <code className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded truncate max-w-[160px]">
                                  {entry.entityId.slice(0, 12)}…
                                </code>
                              )}
                            </div>

                            {/* Meta line */}
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-muted-foreground">
                              <time
                                dateTime={entry.createdAt}
                                title={new Date(entry.createdAt).toLocaleString("fr-FR", {
                                  dateStyle: "full",
                                  timeStyle: "short",
                                })}
                              >
                                {relativeTime(entry.createdAt)}
                              </time>
                              {entry.userEmail && <span>{entry.userEmail}</span>}
                              {entry.ipAddress && (
                                <span className="hidden sm:inline">{entry.ipAddress}</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Expandable diff */}
                        {hasDiff && isOpen && (
                          <div
                            id={`diff-${entry.id}`}
                            className="mt-3 ml-7 border-t border-border pt-3"
                          >
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-muted-foreground">
                                  <th className="text-left font-medium pb-1.5 pr-4 w-1/4">Champ</th>
                                  <th className="text-left font-medium pb-1.5 pr-4 w-[37.5%]">
                                    Avant
                                  </th>
                                  <th className="text-left font-medium pb-1.5 w-[37.5%]">Après</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border/60">
                                {diffs.map((d) => (
                                  <tr key={d.field}>
                                    <td className="py-1.5 pr-4 font-mono text-muted-foreground align-top">
                                      {d.field}
                                    </td>
                                    <td className="py-1.5 pr-4 align-top">
                                      {d.oldVal !== undefined ? (
                                        <span className="bg-red-50 text-red-800 px-1 py-0.5 rounded">
                                          {formatValue(d.oldVal)}
                                        </span>
                                      ) : (
                                        <span className="text-muted-foreground">—</span>
                                      )}
                                    </td>
                                    <td className="py-1.5 align-top">
                                      <span className="bg-emerald-50 text-emerald-800 px-1 py-0.5 rounded">
                                        {formatValue(d.newVal)}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {pagination.total} entrée{pagination.total > 1 ? "s" : ""} — page {pagination.page}/
                {pagination.totalPages}
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => updateParams({ page: "1" })}
                  disabled={pagination.page <= 1}
                  aria-label="Première page"
                >
                  <ChevronsLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => updateParams({ page: String(pagination.page - 1) })}
                  disabled={pagination.page <= 1}
                  aria-label="Page précédente"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => updateParams({ page: String(pagination.page + 1) })}
                  disabled={pagination.page >= pagination.totalPages}
                  aria-label="Page suivante"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => updateParams({ page: String(pagination.totalPages) })}
                  disabled={pagination.page >= pagination.totalPages}
                  aria-label="Dernière page"
                >
                  <ChevronsRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
