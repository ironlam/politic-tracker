"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { POLITICAL_POSITION_LABELS } from "@/config/labels";
import { PoliticalPosition } from "@/generated/prisma";

interface PartyData {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  description: string | null;
  color: string | null;
  foundedDate: string | null;
  dissolvedDate: string | null;
  politicalPosition: PoliticalPosition | null;
  ideology: string | null;
  headquarters: string | null;
  website: string | null;
  predecessorId: string | null;
  predecessor: { id: string; name: string; shortName: string } | null;
}

interface PartyOption {
  id: string;
  name: string;
  shortName: string;
}

export default function EditPartyPage() {
  const params = useParams();
  const router = useRouter();
  const partyId = params.id as string;

  const [party, setParty] = useState<PartyData | null>(null);
  const [allParties, setAllParties] = useState<PartyOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [partyRes, partiesRes] = await Promise.all([
          fetch(`/api/admin/partis/${partyId}`),
          fetch("/api/admin/partis"),
        ]);

        if (!partyRes.ok) throw new Error("Parti non trouvé");

        const partyData = await partyRes.json();
        const partiesData = await partiesRes.json();

        setParty(partyData);
        setAllParties(partiesData.filter((p: PartyOption) => p.id !== partyId));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [partyId]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!party) return;

    setSaving(true);
    setError(null);

    try {
      const formData = new FormData(e.currentTarget);
      const data = {
        slug: formData.get("slug"),
        name: formData.get("name"),
        shortName: formData.get("shortName"),
        description: formData.get("description") || null,
        color: formData.get("color") || null,
        foundedDate: formData.get("foundedDate") || null,
        dissolvedDate: formData.get("dissolvedDate") || null,
        politicalPosition: formData.get("politicalPosition") || null,
        ideology: formData.get("ideology") || null,
        headquarters: formData.get("headquarters") || null,
        website: formData.get("website") || null,
        predecessorId: formData.get("predecessorId") || null,
      };

      const res = await fetch(`/api/admin/partis/${partyId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erreur lors de la sauvegarde");
      }

      router.push(`/admin/partis/${partyId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="p-8">Chargement...</div>;
  }

  if (!party) {
    return <div className="p-8">Parti non trouvé</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Modifier {party.name}</h1>
        <Link href={`/admin/partis/${partyId}`}>
          <Button variant="outline">Annuler</Button>
        </Link>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-600 rounded-lg">{error}</div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Basic info */}
          <Card>
            <CardHeader>
              <CardTitle>Informations de base</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nom complet *</Label>
                <Input
                  id="name"
                  name="name"
                  defaultValue={party.name}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="shortName">Abréviation *</Label>
                  <Input
                    id="shortName"
                    name="shortName"
                    defaultValue={party.shortName}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slug">Slug *</Label>
                  <Input
                    id="slug"
                    name="slug"
                    defaultValue={party.slug || ""}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  name="description"
                  defaultValue={party.description || ""}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="color">Couleur (hex)</Label>
                  <div className="flex gap-2">
                    <Input
                      id="color"
                      name="color"
                      defaultValue={party.color || ""}
                      placeholder="#FF0000"
                    />
                    {party.color && (
                      <div
                        className="w-10 h-10 rounded border"
                        style={{ backgroundColor: party.color }}
                      />
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="politicalPosition">Position politique</Label>
                  <Select
                    id="politicalPosition"
                    name="politicalPosition"
                    defaultValue={party.politicalPosition || ""}
                  >
                    <option value="">Non définie</option>
                    {Object.entries(POLITICAL_POSITION_LABELS).map(
                      ([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      )
                    )}
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Dates and details */}
          <Card>
            <CardHeader>
              <CardTitle>Détails</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="foundedDate">Date de fondation</Label>
                  <Input
                    id="foundedDate"
                    name="foundedDate"
                    type="date"
                    defaultValue={
                      party.foundedDate
                        ? new Date(party.foundedDate).toISOString().split("T")[0]
                        : ""
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dissolvedDate">Date de dissolution</Label>
                  <Input
                    id="dissolvedDate"
                    name="dissolvedDate"
                    type="date"
                    defaultValue={
                      party.dissolvedDate
                        ? new Date(party.dissolvedDate).toISOString().split("T")[0]
                        : ""
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ideology">Idéologie</Label>
                <Input
                  id="ideology"
                  name="ideology"
                  defaultValue={party.ideology || ""}
                  placeholder="Social-démocratie, Écologisme..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="headquarters">Siège</Label>
                <Input
                  id="headquarters"
                  name="headquarters"
                  defaultValue={party.headquarters || ""}
                  placeholder="Paris"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="website">Site web</Label>
                <Input
                  id="website"
                  name="website"
                  type="url"
                  defaultValue={party.website || ""}
                  placeholder="https://..."
                />
              </div>
            </CardContent>
          </Card>

          {/* Evolution */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Évolution du parti</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="predecessorId">Prédécesseur (succède à)</Label>
                <Select
                  id="predecessorId"
                  name="predecessorId"
                  defaultValue={party.predecessorId || ""}
                >
                  <option value="">Aucun</option>
                  {allParties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.shortName})
                    </option>
                  ))}
                </Select>
                <p className="text-xs text-muted-foreground">
                  Définissez le parti auquel ce parti succède (ex: RN succède à FN)
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end gap-4 mt-6">
          <Link href={`/admin/partis/${partyId}`}>
            <Button type="button" variant="outline">
              Annuler
            </Button>
          </Link>
          <Button type="submit" disabled={saving}>
            {saving ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </div>
      </form>
    </div>
  );
}
