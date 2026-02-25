"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { normalizeImageUrl } from "@/lib/utils";

const PHOTO_SOURCES = [
  { value: "assemblee-nationale", label: "Assemblée nationale" },
  { value: "senat", label: "Sénat" },
  { value: "gouvernement", label: "Gouvernement" },
  { value: "hatvp", label: "HATVP" },
  { value: "nosdeputes", label: "NosDéputés.fr" },
  { value: "wikidata", label: "Wikidata" },
  { value: "manual", label: "Manuelle" },
] as const;

interface EditablePhotoCardProps {
  politician: {
    id: string;
    slug: string;
    fullName: string;
    civility: string | null;
    firstName: string;
    lastName: string;
    birthDate: Date | null;
    deathDate: Date | null;
    birthPlace: string | null;
    biography: string | null;
    publicationStatus: string;
    photoUrl: string | null;
    photoSource: string | null;
    currentPartyId: string | null;
    externalIds: Array<{
      id: string;
      source: string;
      externalId: string;
      url: string | null;
    }>;
  };
}

interface FormState {
  photoUrl: string;
  photoSource: string;
}

export function EditablePhotoCard({ politician }: EditablePhotoCardProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [previewError, setPreviewError] = useState(false);

  const [form, setForm] = useState<FormState>({
    photoUrl: politician.photoUrl || "",
    photoSource: politician.photoSource || "",
  });

  function updateField(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (field === "photoUrl") {
      setPreviewError(false);
    }
  }

  function handleCancel() {
    setForm({
      photoUrl: politician.photoUrl || "",
      photoSource: politician.photoSource || "",
    });
    setIsEditing(false);
    setStatus("idle");
    setErrorMessage("");
    setPreviewError(false);
  }

  async function handleSave() {
    setLoading(true);
    setStatus("idle");
    setErrorMessage("");

    try {
      const response = await fetch(`/api/admin/politiques/${politician.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: politician.id,
          slug: politician.slug,
          civility: politician.civility,
          firstName: politician.firstName,
          lastName: politician.lastName,
          birthDate: politician.birthDate ? new Date(politician.birthDate).toISOString() : null,
          birthPlace: politician.birthPlace,
          deathDate: politician.deathDate ? new Date(politician.deathDate).toISOString() : null,
          biography: politician.biography,
          publicationStatus: politician.publicationStatus,
          photoUrl: form.photoUrl || null,
          photoSource: form.photoSource || null,
          currentPartyId: politician.currentPartyId,
          externalIds: politician.externalIds,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Erreur lors de la sauvegarde");
      }

      setStatus("saved");
      setIsEditing(false);
      router.refresh();
      setTimeout(() => setStatus("idle"), 3000);
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  const normalizedUrl = normalizeImageUrl(politician.photoUrl);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Photo</CardTitle>
        {!isEditing && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setIsEditing(true);
              setStatus("idle");
            }}
          >
            Éditer
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {status === "saved" && (
          <div
            role="status"
            aria-live="polite"
            className="mb-4 rounded-md bg-green-50 p-3 text-sm text-green-700"
          >
            Modifications enregistrées
          </div>
        )}
        {status === "error" && errorMessage && (
          <div
            role="alert"
            aria-live="polite"
            className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700"
          >
            {errorMessage}
          </div>
        )}

        {isEditing ? (
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-photoUrl">URL de la photo</Label>
              <Input
                id="edit-photoUrl"
                type="url"
                placeholder="https://..."
                value={form.photoUrl}
                onChange={(e) => updateField("photoUrl", e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="edit-photoSource">Source</Label>
              <Select
                id="edit-photoSource"
                value={form.photoSource}
                onChange={(e) => updateField("photoSource", e.target.value)}
              >
                <option value="">—</option>
                {PHOTO_SOURCES.map((src) => (
                  <option key={src.value} value={src.value}>
                    {src.label}
                  </option>
                ))}
              </Select>
            </div>

            {form.photoUrl && !previewError && (
              <div>
                <p className="mb-2 text-sm text-muted-foreground">Aperçu</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={form.photoUrl}
                  alt={`Aperçu photo de ${politician.fullName}`}
                  className="h-32 w-32 rounded-lg border object-cover"
                  onError={() => setPreviewError(true)}
                />
              </div>
            )}

            {form.photoUrl && previewError && (
              <p className="text-sm text-muted-foreground">Impossible de charger l&apos;aperçu</p>
            )}

            <div className="flex items-center gap-3">
              <Button onClick={handleSave} disabled={loading} size="sm">
                {loading ? "Enregistrement..." : "Sauvegarder"}
              </Button>
              <Button variant="outline" onClick={handleCancel} disabled={loading} size="sm">
                Annuler
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-muted-foreground">URL</span>
              <span className="break-all font-mono text-xs">{politician.photoUrl || "—"}</span>

              <span className="text-muted-foreground">Source</span>
              <span>
                {PHOTO_SOURCES.find((s) => s.value === politician.photoSource)?.label ||
                  politician.photoSource ||
                  "—"}
              </span>
            </div>

            {normalizedUrl ? (
              <div className="mt-4">
                <Image
                  src={normalizedUrl}
                  alt={politician.fullName}
                  width={128}
                  height={128}
                  className="h-32 w-32 rounded-lg border object-cover"
                />
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">Aucune photo</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
