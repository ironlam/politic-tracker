"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ensureContrast } from "@/lib/contrast";
import { PARTY_ROLE_LABELS } from "@/config/labels";

interface Party {
  id: string;
  name: string;
  shortName: string;
  color: string | null;
}

interface PartyMembership {
  id: string;
  partyId: string;
  role: string;
  startDate: Date;
  endDate: Date | null;
  party: Party;
}

interface EditablePartyCardProps {
  politicianId: string;
  currentParty: Party | null;
  partyHistory: PartyMembership[];
  allParties: Party[];
}

function formatDateForInput(date: Date | null): string {
  if (!date) return "";
  return new Date(date).toISOString().split("T")[0];
}

function formatDateDisplay(date: Date | null): string {
  if (!date) return "En cours";
  return new Date(date).toLocaleDateString("fr-FR");
}

export function EditablePartyCard({
  politicianId,
  currentParty,
  partyHistory,
  allParties,
}: EditablePartyCardProps) {
  const router = useRouter();

  const [isChangingParty, setIsChangingParty] = useState(false);
  const [editingMembershipId, setEditingMembershipId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Confirm dialog state for "Retirer" action
  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false);
  // Confirm dialog state for membership delete (stores membership id)
  const [confirmDeleteMembershipId, setConfirmDeleteMembershipId] = useState<string | null>(null);

  // Form for party change
  const [partyForm, setPartyForm] = useState({
    partyId: "",
    startDate: new Date().toISOString().split("T")[0],
    role: "",
  });

  // Form for membership edit
  const [membershipForm, setMembershipForm] = useState({
    startDate: "",
    endDate: "",
    role: "",
  });

  function clearStatus() {
    setStatus(null);
  }

  function showStatus(type: "success" | "error", message: string) {
    setStatus({ type, message });
    if (type === "success") {
      setTimeout(clearStatus, 3000);
    }
  }

  // --- Section A: Change current party ---

  function handleCancelPartyChange() {
    setIsChangingParty(false);
    setPartyForm({
      partyId: "",
      startDate: new Date().toISOString().split("T")[0],
      role: "",
    });
  }

  async function handleSubmitPartyChange() {
    if (!partyForm.partyId) {
      showStatus("error", "Veuillez sélectionner un parti");
      return;
    }

    setLoading(true);
    clearStatus();

    try {
      const body: Record<string, string> = {
        partyId: partyForm.partyId,
        startDate: partyForm.startDate,
      };
      if (partyForm.role) {
        body.role = partyForm.role;
      }

      const response = await fetch(`/api/admin/politiques/${politicianId}/party`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Erreur lors du changement de parti");
      }

      showStatus("success", "Parti mis à jour");
      setIsChangingParty(false);
      setPartyForm({
        partyId: "",
        startDate: new Date().toISOString().split("T")[0],
        role: "",
      });
      router.refresh();
    } catch (err) {
      showStatus("error", err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  async function handleRemoveParty() {
    setLoading(true);
    clearStatus();

    try {
      const response = await fetch(`/api/admin/politiques/${politicianId}/party`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Erreur lors du retrait du parti");
      }

      showStatus("success", "Affiliation retirée");
      router.refresh();
    } catch (err) {
      showStatus("error", err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  // --- Section B: Membership history ---

  function startEditMembership(membership: PartyMembership) {
    setEditingMembershipId(membership.id);
    setMembershipForm({
      startDate: formatDateForInput(membership.startDate),
      endDate: formatDateForInput(membership.endDate),
      role: membership.role,
    });
  }

  function cancelEditMembership() {
    setEditingMembershipId(null);
    setMembershipForm({ startDate: "", endDate: "", role: "" });
  }

  async function handleSaveMembership(membershipId: string) {
    setLoading(true);
    clearStatus();

    try {
      const body: Record<string, string | null> = {};
      if (membershipForm.startDate) body.startDate = membershipForm.startDate;
      if (membershipForm.endDate) {
        body.endDate = membershipForm.endDate;
      } else {
        body.endDate = null;
      }
      if (membershipForm.role) body.role = membershipForm.role;

      const response = await fetch(
        `/api/admin/politiques/${politicianId}/party-membership/${membershipId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Erreur lors de la mise à jour");
      }

      showStatus("success", "Affiliation mise à jour");
      setEditingMembershipId(null);
      setMembershipForm({ startDate: "", endDate: "", role: "" });
      router.refresh();
    } catch (err) {
      showStatus("error", err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteMembership(membershipId: string) {
    setLoading(true);
    clearStatus();

    try {
      const response = await fetch(
        `/api/admin/politiques/${politicianId}/party-membership/${membershipId}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Erreur lors de la suppression");
      }

      showStatus("success", "Affiliation supprimée");
      router.refresh();
    } catch (err) {
      showStatus("error", err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
      setConfirmDeleteMembershipId(null);
    }
  }

  // --- Render helpers ---

  function renderPartyBadge(party: Party) {
    const color = party.color || "#6b7280";
    return (
      <Badge
        variant="outline"
        style={{
          backgroundColor: `${color}20`,
          color: ensureContrast(color, "#ffffff"),
          borderColor: `${color}30`,
        }}
      >
        {party.shortName || party.name}
      </Badge>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Parti et affiliations</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status messages */}
        {status && (
          <div
            role={status.type === "error" ? "alert" : "status"}
            aria-live="polite"
            className={
              status.type === "success"
                ? "rounded-md bg-green-50 p-3 text-sm text-green-700"
                : "rounded-md bg-red-50 p-3 text-sm text-red-700"
            }
          >
            {status.message}
          </div>
        )}

        {/* Section A: Parti actuel */}
        <div>
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Parti actuel
          </h2>

          {!isChangingParty ? (
            <div className="flex items-center gap-3">
              {currentParty ? (
                renderPartyBadge(currentParty)
              ) : (
                <span className="text-sm text-muted-foreground">Aucun parti</span>
              )}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsChangingParty(true);
                    clearStatus();
                  }}
                >
                  Changer
                </Button>
                {currentParty && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setConfirmRemoveOpen(true)}
                    disabled={loading}
                  >
                    Retirer
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3 rounded-lg border p-4">
              <div>
                <Label htmlFor="party-select">Parti</Label>
                <Select
                  id="party-select"
                  value={partyForm.partyId}
                  onChange={(e) => setPartyForm((prev) => ({ ...prev, partyId: e.target.value }))}
                >
                  <option value="">— Sélectionner un parti —</option>
                  {allParties.map((party) => (
                    <option key={party.id} value={party.id}>
                      {party.shortName} — {party.name}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="party-start-date">Date de début</Label>
                  <Input
                    id="party-start-date"
                    type="date"
                    value={partyForm.startDate}
                    onChange={(e) =>
                      setPartyForm((prev) => ({ ...prev, startDate: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="party-role">Rôle (optionnel)</Label>
                  <Select
                    id="party-role"
                    value={partyForm.role}
                    onChange={(e) => setPartyForm((prev) => ({ ...prev, role: e.target.value }))}
                  >
                    <option value="">— Aucun —</option>
                    {Object.entries(PARTY_ROLE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Button size="sm" onClick={handleSubmitPartyChange} disabled={loading}>
                  {loading ? "Enregistrement..." : "Confirmer"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancelPartyChange}
                  disabled={loading}
                >
                  Annuler
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Confirm dialog for removing current party */}
        <ConfirmDialog
          open={confirmRemoveOpen}
          onOpenChange={setConfirmRemoveOpen}
          title="Retirer le parti"
          description="Voulez-vous vraiment retirer l'affiliation actuelle ?"
          variant="destructive"
          onConfirm={() => {
            setConfirmRemoveOpen(false);
            handleRemoveParty();
          }}
        />

        {/* Section B: Historique des affiliations */}
        <div>
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Historique des affiliations
          </h2>

          {partyHistory.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Aucun historique d&apos;affiliation.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-3 font-medium">Parti</th>
                    <th className="pb-2 pr-3 font-medium">Rôle</th>
                    <th className="pb-2 pr-3 font-medium">Début</th>
                    <th className="pb-2 pr-3 font-medium">Fin</th>
                    <th className="pb-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {partyHistory.map((membership) => {
                    const isEditing = editingMembershipId === membership.id;
                    const roleLabel =
                      PARTY_ROLE_LABELS[membership.role as keyof typeof PARTY_ROLE_LABELS] ||
                      membership.role;

                    if (isEditing) {
                      return (
                        <tr key={membership.id} className="border-b">
                          <td className="py-2 pr-3">{renderPartyBadge(membership.party)}</td>
                          <td className="py-2 pr-3">
                            <Select
                              value={membershipForm.role}
                              onChange={(e) =>
                                setMembershipForm((prev) => ({ ...prev, role: e.target.value }))
                              }
                              aria-label={`Rôle dans ${membership.party.shortName || membership.party.name}`}
                              className="h-8 text-xs"
                            >
                              {Object.entries(PARTY_ROLE_LABELS).map(([value, label]) => (
                                <option key={value} value={value}>
                                  {label}
                                </option>
                              ))}
                            </Select>
                          </td>
                          <td className="py-2 pr-3">
                            <Input
                              type="date"
                              value={membershipForm.startDate}
                              onChange={(e) =>
                                setMembershipForm((prev) => ({
                                  ...prev,
                                  startDate: e.target.value,
                                }))
                              }
                              aria-label="Date de début"
                              className="h-8 text-xs"
                            />
                          </td>
                          <td className="py-2 pr-3">
                            <Input
                              type="date"
                              value={membershipForm.endDate}
                              onChange={(e) =>
                                setMembershipForm((prev) => ({
                                  ...prev,
                                  endDate: e.target.value,
                                }))
                              }
                              aria-label="Date de fin"
                              className="h-8 text-xs"
                            />
                          </td>
                          <td className="py-2">
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                onClick={() => handleSaveMembership(membership.id)}
                                disabled={loading}
                                className="h-7 text-xs"
                              >
                                {loading ? "..." : "Sauvegarder"}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={cancelEditMembership}
                                disabled={loading}
                                className="h-7 text-xs"
                              >
                                Annuler
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    }

                    return (
                      <tr key={membership.id} className="border-b">
                        <td className="py-2 pr-3">{renderPartyBadge(membership.party)}</td>
                        <td className="py-2 pr-3">
                          <Badge variant="outline">{roleLabel}</Badge>
                        </td>
                        <td className="py-2 pr-3">{formatDateDisplay(membership.startDate)}</td>
                        <td className="py-2 pr-3">{formatDateDisplay(membership.endDate)}</td>
                        <td className="py-2">
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => startEditMembership(membership)}
                              className="h-7 text-xs"
                            >
                              Éditer
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setConfirmDeleteMembershipId(membership.id)}
                              className="h-7 text-xs text-destructive hover:text-destructive"
                            >
                              Supprimer
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Confirm dialog for deleting a membership */}
        <ConfirmDialog
          open={confirmDeleteMembershipId !== null}
          onOpenChange={(open) => {
            if (!open) setConfirmDeleteMembershipId(null);
          }}
          title="Supprimer l'affiliation"
          description="Voulez-vous vraiment supprimer cette affiliation de l'historique ?"
          variant="destructive"
          onConfirm={() => {
            if (confirmDeleteMembershipId) {
              handleDeleteMembership(confirmDeleteMembershipId);
            }
          }}
        />
      </CardContent>
    </Card>
  );
}
