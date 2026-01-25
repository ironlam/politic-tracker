"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { DATA_SOURCE_LABELS } from "@/config/labels";
import type { DataSource } from "@/types";

interface ExternalIdData {
  id?: string;
  source: DataSource;
  externalId: string;
  url?: string;
}

interface PoliticianFormData {
  id: string;
  slug: string;
  civility: string | null;
  firstName: string;
  lastName: string;
  fullName: string;
  birthDate: string | null;
  birthPlace: string | null;
  photoUrl: string | null;
  photoSource: string | null;
  currentPartyId: string | null;
  externalIds: ExternalIdData[];
}

interface Party {
  id: string;
  name: string;
  shortName: string;
}

interface PoliticianFormProps {
  initialData: PoliticianFormData;
  parties: Party[];
}

const DATA_SOURCES: DataSource[] = [
  "ASSEMBLEE_NATIONALE",
  "SENAT",
  "WIKIDATA",
  "HATVP",
  "GOUVERNEMENT",
  "NOSDEPUTES",
  "WIKIPEDIA",
  "MANUAL",
];

const PHOTO_SOURCES = [
  { value: "nosdeputes", label: "NosDéputés.fr" },
  { value: "assemblee-nationale", label: "Assemblée nationale" },
  { value: "senat", label: "Sénat" },
  { value: "gouvernement", label: "Gouvernement" },
  { value: "hatvp", label: "HATVP" },
  { value: "wikidata", label: "Wikidata" },
  { value: "manual", label: "Manuel" },
];

export function PoliticianForm({ initialData, parties }: PoliticianFormProps) {
  const router = useRouter();

  const [formData, setFormData] = useState<PoliticianFormData>(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function updateField<K extends keyof PoliticianFormData>(
    field: K,
    value: PoliticianFormData[K]
  ) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  function updateExternalId(
    index: number,
    field: keyof ExternalIdData,
    value: string
  ) {
    const newIds = [...formData.externalIds];
    newIds[index] = { ...newIds[index], [field]: value };
    setFormData((prev) => ({ ...prev, externalIds: newIds }));
  }

  function addExternalId() {
    setFormData((prev) => ({
      ...prev,
      externalIds: [
        ...prev.externalIds,
        { source: "MANUAL" as DataSource, externalId: "", url: "" },
      ],
    }));
  }

  function removeExternalId(index: number) {
    setFormData((prev) => ({
      ...prev,
      externalIds: prev.externalIds.filter((_, i) => i !== index),
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      setError("Prénom et nom sont requis");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`/api/admin/politiques/${formData.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Erreur lors de la sauvegarde");
      }

      setSuccess("Modifications enregistrées");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div role="alert" aria-live="assertive" className="bg-red-50 text-red-700 p-4 rounded-md">{error}</div>
      )}
      {success && (
        <div role="status" aria-live="polite" className="bg-green-50 text-green-700 p-4 rounded-md">{success}</div>
      )}

      {/* Informations générales */}
      <Card>
        <CardHeader>
          <CardTitle>Informations générales</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="civility">Civilité</Label>
              <Select
                id="civility"
                value={formData.civility || ""}
                onChange={(e) => updateField("civility", e.target.value || null)}
              >
                <option value="">—</option>
                <option value="M.">M.</option>
                <option value="Mme">Mme</option>
              </Select>
            </div>

            <div>
              <Label htmlFor="currentPartyId">Parti actuel</Label>
              <Select
                id="currentPartyId"
                value={formData.currentPartyId || ""}
                onChange={(e) =>
                  updateField("currentPartyId", e.target.value || null)
                }
              >
                <option value="">Aucun / Indépendant</option>
                {parties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.shortName} - {p.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="firstName">Prénom *</Label>
              <Input
                id="firstName"
                value={formData.firstName}
                onChange={(e) => updateField("firstName", e.target.value)}
                required
              />
            </div>

            <div>
              <Label htmlFor="lastName">Nom *</Label>
              <Input
                id="lastName"
                value={formData.lastName}
                onChange={(e) => updateField("lastName", e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="birthDate">Date de naissance</Label>
              <Input
                id="birthDate"
                type="date"
                value={formData.birthDate || ""}
                onChange={(e) => updateField("birthDate", e.target.value || null)}
              />
            </div>

            <div>
              <Label htmlFor="birthPlace">Lieu de naissance</Label>
              <Input
                id="birthPlace"
                value={formData.birthPlace || ""}
                onChange={(e) =>
                  updateField("birthPlace", e.target.value || null)
                }
              />
            </div>
          </div>

          <div>
            <Label htmlFor="slug">Slug</Label>
            <Input
              id="slug"
              value={formData.slug}
              onChange={(e) => updateField("slug", e.target.value)}
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Utilisé dans l&apos;URL : /politiques/{formData.slug}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Photo */}
      <Card>
        <CardHeader>
          <CardTitle>Photo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="photoUrl">URL de la photo</Label>
              <Input
                id="photoUrl"
                type="url"
                value={formData.photoUrl || ""}
                onChange={(e) => updateField("photoUrl", e.target.value || null)}
                placeholder="https://..."
              />
            </div>

            <div>
              <Label htmlFor="photoSource">Source</Label>
              <Select
                id="photoSource"
                value={formData.photoSource || ""}
                onChange={(e) =>
                  updateField("photoSource", e.target.value || null)
                }
              >
                <option value="">—</option>
                {PHOTO_SOURCES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {formData.photoUrl && (
            <div className="flex items-center gap-4">
              <img
                src={formData.photoUrl}
                alt="Aperçu"
                className="w-24 h-24 object-cover rounded-lg border"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
              <p className="text-sm text-muted-foreground">
                Aperçu de la photo
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Identifiants externes */}
      <Card>
        <CardHeader>
          <CardTitle>
            Identifiants externes ({formData.externalIds.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {formData.externalIds.map((extId, index) => (
            <div
              key={extId.id || index}
              className="border p-4 rounded-lg space-y-3"
            >
              <div className="flex justify-between items-center">
                <Badge variant="outline">
                  {DATA_SOURCE_LABELS[extId.source] || extId.source}
                </Badge>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeExternalId(index)}
                  className="text-red-600 hover:text-red-700"
                >
                  Supprimer
                </Button>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Source</Label>
                  <Select
                    value={extId.source}
                    onChange={(e) =>
                      updateExternalId(index, "source", e.target.value)
                    }
                  >
                    {DATA_SOURCES.map((src) => (
                      <option key={src} value={src}>
                        {DATA_SOURCE_LABELS[src]}
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <Label>ID externe</Label>
                  <Input
                    value={extId.externalId}
                    onChange={(e) =>
                      updateExternalId(index, "externalId", e.target.value)
                    }
                    placeholder="PA722140, Q123456..."
                    className="font-mono"
                  />
                </div>

                <div>
                  <Label>URL</Label>
                  <Input
                    type="url"
                    value={extId.url || ""}
                    onChange={(e) =>
                      updateExternalId(index, "url", e.target.value)
                    }
                    placeholder="https://..."
                  />
                </div>
              </div>
            </div>
          ))}

          <Button type="button" variant="outline" onClick={addExternalId}>
            + Ajouter un identifiant externe
          </Button>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-4">
        <Button type="submit" disabled={loading}>
          {loading ? "Enregistrement..." : "Enregistrer les modifications"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(`/admin/politiques/${formData.id}`)}
        >
          Annuler
        </Button>
      </div>
    </form>
  );
}
