"use client";

import { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PARTY_LEADERSHIP_TITLE_SUGGESTIONS } from "@/config/labels";

interface Politician {
  id: string;
  fullName: string;
  slug: string;
  photoUrl: string | null;
  party: string | null;
}

interface LeadershipMandate {
  id: string;
  title: string;
  startDate: string;
  endDate: string | null;
  isCurrent: boolean;
  source: string | null;
  politician: {
    id: string;
    fullName: string;
    slug: string;
    photoUrl: string | null;
  };
  party: {
    id: string;
    name: string;
    shortName: string;
  } | null;
}

interface PartyLeadershipEditorProps {
  partyId: string;
  partyShortName: string | null;
}

export function PartyLeadershipEditor({ partyId, partyShortName }: PartyLeadershipEditorProps) {
  const [mandates, setMandates] = useState<LeadershipMandate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [selectedPolitician, setSelectedPolitician] = useState<Politician | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Politician[]>([]);
  const [searching, setSearching] = useState(false);
  const [title, setTitle] = useState(
    (partyShortName && PARTY_LEADERSHIP_TITLE_SUGGESTIONS[partyShortName]) || "Président(e)"
  );
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const fetchMandates = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/mandates?partyId=${partyId}&type=PRESIDENT_PARTI`);
      if (res.ok) {
        const data = await res.json();
        setMandates(data);
      }
    } catch {
      // Fetch error — silently keep previous state
    } finally {
      setLoading(false);
    }
  }, [partyId]);

  useEffect(() => {
    fetchMandates();
  }, [fetchMandates]);

  // Debounced politician search
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/search/politicians?q=${encodeURIComponent(searchQuery)}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data);
        }
      } catch {
        // Search error — silently keep previous results
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  function resetForm() {
    setSelectedPolitician(null);
    setSearchQuery("");
    setSearchResults([]);
    setTitle(
      (partyShortName && PARTY_LEADERSHIP_TITLE_SUGGESTIONS[partyShortName]) || "Président(e)"
    );
    setStartDate("");
    setEndDate("");
    setSourceUrl("");
    setEditingId(null);
    setError("");
  }

  function startEdit(mandate: LeadershipMandate) {
    setEditingId(mandate.id);
    setSelectedPolitician({
      id: mandate.politician.id,
      fullName: mandate.politician.fullName,
      slug: mandate.politician.slug,
      photoUrl: mandate.politician.photoUrl,
      party: null,
    });
    setTitle(mandate.title);
    setStartDate(mandate.startDate.split("T")[0]);
    setEndDate(mandate.endDate ? mandate.endDate.split("T")[0] : "");
    setSourceUrl("");
    setShowForm(true);
  }

  async function handleSave() {
    if (!editingId && !selectedPolitician) {
      setError("Sélectionnez un politicien");
      return;
    }
    if (!startDate) {
      setError("La date de début est requise");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const url = editingId ? `/api/admin/mandates/${editingId}` : "/api/admin/mandates";
      const method = editingId ? "PUT" : "POST";

      const body: Record<string, unknown> = {
        title,
        startDate,
        endDate: endDate || null,
        sourceUrl: sourceUrl || null,
      };

      if (!editingId) {
        body.politicianId = selectedPolitician!.id;
        body.partyId = partyId;
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur");
      }

      resetForm();
      setShowForm(false);
      await fetchMandates();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Supprimer ce mandat de direction ?")) return;

    try {
      const res = await fetch(`/api/admin/mandates/${id}`, { method: "DELETE" });
      if (res.ok) {
        await fetchMandates();
      }
    } catch {
      // Delete error — silently keep current state
    }
  }

  const currentLeaders = mandates.filter((m) => m.isCurrent);
  const pastLeaders = mandates.filter((m) => !m.isCurrent);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Chargement...</p>;
  }

  return (
    <div className="space-y-4">
      {/* Current leaders */}
      {currentLeaders.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
            <span className="w-2 h-2 bg-green-500 rounded-full" />
            En fonction
          </p>
          <div className="space-y-2">
            {currentLeaders.map((m) => (
              <MandateRow
                key={m.id}
                mandate={m}
                onEdit={() => startEdit(m)}
                onDelete={() => handleDelete(m.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Past leaders */}
      {pastLeaders.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Anciens dirigeants</p>
          <div className="space-y-2">
            {pastLeaders.map((m) => (
              <MandateRow
                key={m.id}
                mandate={m}
                onEdit={() => startEdit(m)}
                onDelete={() => handleDelete(m.id)}
              />
            ))}
          </div>
        </div>
      )}

      {mandates.length === 0 && (
        <p className="text-sm text-muted-foreground">Aucun dirigeant enregistré</p>
      )}

      {/* Add/Edit form */}
      {showForm ? (
        <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
          <h4 className="font-medium text-sm">
            {editingId ? "Modifier le dirigeant" : "Ajouter un dirigeant"}
          </h4>

          {/* Politician search (only for new) */}
          {!editingId && (
            <div>
              <Label htmlFor="politician-search" className="text-xs">
                Politicien
              </Label>
              {selectedPolitician ? (
                <div className="flex items-center gap-2 p-2 bg-background rounded border">
                  <span className="font-medium text-sm">{selectedPolitician.fullName}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs ml-auto"
                    onClick={() => {
                      setSelectedPolitician(null);
                      setSearchQuery("");
                    }}
                  >
                    Changer
                  </Button>
                </div>
              ) : (
                <div className="relative">
                  <Input
                    id="politician-search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Rechercher un politicien..."
                    className="h-8 text-sm"
                  />
                  {searching && (
                    <span className="absolute right-2 top-1.5 text-xs text-muted-foreground">
                      ...
                    </span>
                  )}
                  {searchResults.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-background border rounded-lg shadow-lg max-h-48 overflow-auto">
                      {searchResults.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
                          onClick={() => {
                            setSelectedPolitician(p);
                            setSearchQuery("");
                            setSearchResults([]);
                          }}
                        >
                          <span className="font-medium">{p.fullName}</span>
                          {p.party && (
                            <span className="text-muted-foreground ml-2">({p.party})</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {editingId && selectedPolitician && (
            <div className="text-sm">
              <span className="text-muted-foreground">Politicien : </span>
              <span className="font-medium">{selectedPolitician.fullName}</span>
            </div>
          )}

          <div>
            <Label htmlFor="leadership-title" className="text-xs">
              Titre
            </Label>
            <Input
              id="leadership-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Président(e)"
              className="h-8 text-sm"
            />
            {partyShortName && PARTY_LEADERSHIP_TITLE_SUGGESTIONS[partyShortName] && (
              <p className="text-xs text-muted-foreground mt-1">
                Suggestion pour {partyShortName} :{" "}
                {PARTY_LEADERSHIP_TITLE_SUGGESTIONS[partyShortName]}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="leadership-start" className="text-xs">
                Date de debut
              </Label>
              <Input
                id="leadership-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label htmlFor="leadership-end" className="text-xs">
                Date de fin (vide = en cours)
              </Label>
              <Input
                id="leadership-end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="leadership-source" className="text-xs">
              URL source (optionnel)
            </Label>
            <Input
              id="leadership-source"
              type="url"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://..."
              className="h-8 text-sm"
            />
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? "..." : editingId ? "Mettre à jour" : "Ajouter"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                resetForm();
                setShowForm(false);
              }}
            >
              Annuler
            </Button>
          </div>
        </div>
      ) : (
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
        >
          + Ajouter un dirigeant
        </Button>
      )}
    </div>
  );
}

function MandateRow({
  mandate,
  onEdit,
  onDelete,
}: {
  mandate: LeadershipMandate;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const startYear = new Date(mandate.startDate).getFullYear();
  const endYear = mandate.endDate ? new Date(mandate.endDate).getFullYear() : null;

  return (
    <div className="flex items-center justify-between p-2 rounded-lg border bg-background">
      <div className="flex items-center gap-3 min-w-0">
        <div className="min-w-0">
          <p className="font-medium text-sm truncate">{mandate.politician.fullName}</p>
          <p className="text-xs text-muted-foreground">
            {mandate.title} &middot; {startYear}
            {endYear ? ` - ${endYear}` : ""}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {mandate.source && (
          <Badge variant="outline" className="text-[10px]">
            {mandate.source === "MANUAL" ? "Manuel" : mandate.source}
          </Badge>
        )}
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onEdit}>
          Modifier
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-red-600 hover:text-red-700"
          onClick={onDelete}
        >
          Supprimer
        </Button>
      </div>
    </div>
  );
}
