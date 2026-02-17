"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AFFAIR_STATUS_LABELS,
  AFFAIR_STATUS_COLORS,
  AFFAIR_CATEGORY_LABELS,
} from "@/config/labels";
import {
  Plus,
  Search,
  CheckSquare,
  Square,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";
import type { PublicationStatus } from "@/generated/prisma";

interface AffairItem {
  id: string;
  title: string;
  status: string;
  category: string;
  publicationStatus: PublicationStatus;
  ecli: string | null;
  createdAt: string;
  politician: {
    id: string;
    fullName: string;
    slug: string;
    photoUrl: string | null;
  };
  sources: { id: string; sourceType: string }[];
}

interface ApiResponse {
  data: AffairItem[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  counts: { all: number; DRAFT: number; PUBLISHED: number; REJECTED: number };
}

const TABS: { key: string; label: string; status: PublicationStatus | null }[] = [
  { key: "all", label: "Toutes", status: null },
  { key: "DRAFT", label: "À modérer", status: "DRAFT" },
  { key: "PUBLISHED", label: "Publiées", status: "PUBLISHED" },
  { key: "REJECTED", label: "Rejetées", status: "REJECTED" },
];

const PUB_STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-amber-50 text-amber-700 border-amber-200",
  PUBLISHED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  REJECTED: "bg-red-50 text-red-700 border-red-200",
};

export default function AdminAffairsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  // Read state from URL
  const activeTab = searchParams.get("status") || "all";
  const searchQuery = searchParams.get("search") || "";
  const currentPage = parseInt(searchParams.get("page") || "1", 10);
  const categoryFilter = searchParams.get("category") || "";

  const updateParams = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value) params.set(key, value);
        else params.delete(key);
      }
      // Reset page when changing filters
      if (!("page" in updates)) params.set("page", "1");
      router.push(`/admin/affaires?${params.toString()}`);
    },
    [router, searchParams]
  );

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (activeTab !== "all") params.set("publicationStatus", activeTab);
    if (searchQuery) params.set("search", searchQuery);
    if (categoryFilter) params.set("category", categoryFilter);
    params.set("page", String(currentPage));
    params.set("limit", "50");

    try {
      const res = await fetch(`/api/admin/affaires?${params.toString()}`);
      if (res.ok) {
        const json: ApiResponse = await res.json();
        setData(json);
      }
    } finally {
      setLoading(false);
    }
  }, [activeTab, searchQuery, categoryFilter, currentPage]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Bulk actions
  async function handleBulk(action: "publish" | "reject") {
    if (selected.size === 0) return;

    let rejectionReason: string | undefined;
    if (action === "reject") {
      rejectionReason = prompt("Motif de rejet :") ?? undefined;
      if (!rejectionReason) return;
    }

    setBulkLoading(true);
    try {
      const res = await fetch("/api/admin/affaires/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [...selected], action, rejectionReason }),
      });
      if (res.ok) {
        setSelected(new Set());
        fetchData();
      }
    } finally {
      setBulkLoading(false);
    }
  }

  const affairs = data?.data || [];
  const pagination = data?.pagination;
  const counts = data?.counts || { all: 0, DRAFT: 0, PUBLISHED: 0, REJECTED: 0 };
  const allSelected = affairs.length > 0 && affairs.every((a) => selected.has(a.id));

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(affairs.map((a) => a.id)));
    }
  }

  function toggleOne(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-display font-bold tracking-tight">Affaires judiciaires</h1>
        <Button asChild>
          <Link href="/admin/affaires/nouveau">
            <Plus className="w-4 h-4 mr-2" aria-hidden="true" />
            Nouvelle affaire
          </Link>
        </Button>
      </div>

      {/* Tabs */}
      <div
        className="flex gap-1 border-b border-border"
        role="tablist"
        aria-label="Statut de publication"
      >
        {TABS.map((tab) => {
          const count =
            tab.key === "all" ? counts.all : counts[tab.key as keyof typeof counts] || 0;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              role="tab"
              aria-selected={isActive}
              onClick={() => updateParams({ status: tab.key === "all" ? "" : tab.key })}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                isActive
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              }`}
            >
              {tab.label}
              <span
                className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${
                  isActive ? "bg-foreground/10" : "bg-muted"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filters bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            type="search"
            placeholder="Rechercher par titre ou politicien..."
            defaultValue={searchQuery}
            aria-label="Rechercher par titre ou politicien"
            onChange={(e) => {
              const val = e.target.value;
              // Debounce via setTimeout
              clearTimeout(
                (window as unknown as Record<string, ReturnType<typeof setTimeout>>).__affairSearch
              );
              (window as unknown as Record<string, ReturnType<typeof setTimeout>>).__affairSearch =
                setTimeout(() => {
                  updateParams({ search: val });
                }, 300);
            }}
            className="w-full pl-9 pr-4 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring/50"
          />
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => updateParams({ category: e.target.value })}
          className="text-sm bg-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring/50"
          aria-label="Filtrer par catégorie"
        >
          <option value="">Toutes catégories</option>
          {Object.entries(AFFAIR_CATEGORY_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Bulk actions bar */}
      {selected.size > 0 && (
        <Card className="border-primary/30 bg-primary/5" role="status" aria-live="polite">
          <CardContent className="p-3 flex items-center gap-4">
            <span className="text-sm font-medium">
              {selected.size} sélectionnée{selected.size > 1 ? "s" : ""}
            </span>
            <Button size="sm" onClick={() => handleBulk("publish")} disabled={bulkLoading}>
              {bulkLoading && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
              Publier
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => handleBulk("reject")}
              disabled={bulkLoading}
            >
              Rejeter
            </Button>
            <button
              className="text-sm text-muted-foreground hover:text-foreground ml-auto"
              onClick={() => setSelected(new Set())}
            >
              Tout désélectionner
            </button>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : affairs.length === 0 ? (
            <div className="text-center py-16 text-sm text-muted-foreground">
              Aucune affaire trouvée
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="px-4 py-3 w-10">
                      <button
                        onClick={toggleAll}
                        aria-label="Tout sélectionner"
                        className="text-muted-foreground hover:text-foreground"
                      >
                        {allSelected ? (
                          <CheckSquare className="w-4 h-4" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </th>
                    <th className="px-4 py-3 font-medium text-muted-foreground">Politicien</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground">Titre</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground">Catégorie</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground">
                      Statut juridique
                    </th>
                    <th className="px-4 py-3 font-medium text-muted-foreground">Publication</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground">Sources</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {affairs.map((affair) => (
                    <tr
                      key={affair.id}
                      className={`hover:bg-muted/30 transition-colors ${selected.has(affair.id) ? "bg-primary/5" : ""}`}
                    >
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleOne(affair.id)}
                          aria-label={`Sélectionner ${affair.title}`}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          {selected.has(affair.id) ? (
                            <CheckSquare className="w-4 h-4" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/politiques/${affair.politician.slug}`}
                          className="flex items-center gap-2 hover:text-foreground"
                        >
                          {affair.politician.photoUrl ? (
                            <Image
                              src={affair.politician.photoUrl}
                              alt=""
                              width={24}
                              height={24}
                              className="rounded-full object-cover shrink-0"
                              style={{ width: 24, height: 24 }}
                            />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-muted shrink-0" />
                          )}
                          <span className="truncate max-w-[120px]">
                            {affair.politician.fullName}
                          </span>
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/affaires/${affair.id}`}
                          className="font-medium hover:underline truncate max-w-[250px] block"
                        >
                          {affair.title}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {
                          AFFAIR_CATEGORY_LABELS[
                            affair.category as keyof typeof AFFAIR_CATEGORY_LABELS
                          ]
                        }
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          className={
                            AFFAIR_STATUS_COLORS[affair.status as keyof typeof AFFAIR_STATUS_COLORS]
                          }
                        >
                          {AFFAIR_STATUS_LABELS[affair.status as keyof typeof AFFAIR_STATUS_LABELS]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant="outline"
                          className={PUB_STATUS_STYLES[affair.publicationStatus] || ""}
                        >
                          {affair.publicationStatus}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-center text-muted-foreground">
                        {affair.sources.length}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                        {new Date(affair.createdAt).toLocaleDateString("fr-FR")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {pagination.total} résultat{pagination.total > 1 ? "s" : ""}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => updateParams({ page: String(currentPage - 1) })}
              disabled={currentPage <= 1}
              className="p-2 rounded-md hover:bg-muted disabled:opacity-50 disabled:pointer-events-none"
              aria-label="Page précédente"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-muted-foreground">
              {currentPage} / {pagination.totalPages}
            </span>
            <button
              onClick={() => updateParams({ page: String(currentPage + 1) })}
              disabled={currentPage >= pagination.totalPages}
              className="p-2 rounded-md hover:bg-muted disabled:opacity-50 disabled:pointer-events-none"
              aria-label="Page suivante"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
