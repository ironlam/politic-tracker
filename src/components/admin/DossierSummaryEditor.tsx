"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

interface DossierSummaryEditorProps {
  dossierId: string;
  currentSummary: string | null;
  summaryDate: Date | null;
  title: string;
  sourceUrl: string | null;
}

export function DossierSummaryEditor({
  dossierId,
  currentSummary,
  summaryDate,
  title: _title,
  sourceUrl,
}: DossierSummaryEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [summary, setSummary] = useState(currentSummary || "");
  const [previewSummary, setPreviewSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleGenerateAI = async () => {
    setIsGenerating(true);
    setError(null);
    setPreviewSummary(null);

    try {
      const response = await fetch(`/api/admin/dossiers/${dossierId}/generate`, {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Erreur lors de la génération");
      }

      const data = await response.json();
      setPreviewSummary(data.summary);
      setIsEditing(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApplyPreview = () => {
    if (previewSummary) {
      setSummary(previewSummary);
      setPreviewSummary(null);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/admin/dossiers/${dossierId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ summary }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Erreur lors de la sauvegarde");
      }

      setSuccess("Résumé sauvegardé avec succès");
      setIsEditing(false);
      setPreviewSummary(null);

      // Reload page to show updated data
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setSummary(currentSummary || "");
    setPreviewSummary(null);
    setIsEditing(false);
    setError(null);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            Résumé IA
            {currentSummary ? (
              <Badge className="bg-green-100 text-green-800">Généré</Badge>
            ) : (
              <Badge variant="outline" className="text-orange-600 border-orange-300">
                Non généré
              </Badge>
            )}
          </CardTitle>
          <div className="flex gap-2">
            {!isEditing && (
              <>
                <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                  Modifier
                </Button>
                <Button
                  size="sm"
                  onClick={handleGenerateAI}
                  disabled={isGenerating}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  {isGenerating ? (
                    <>
                      <span className="animate-spin mr-2">⏳</span>
                      Génération...
                    </>
                  ) : (
                    <>🤖 Generate with AI</>
                  )}
                </Button>
              </>
            )}
          </div>
        </div>
        {summaryDate && (
          <p className="text-sm text-muted-foreground">
            Dernière génération : {formatDate(summaryDate)}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Error/Success messages */}
        {error && <div className="bg-red-50 text-red-800 p-3 rounded-md text-sm">{error}</div>}
        {success && (
          <div className="bg-green-50 text-green-800 p-3 rounded-md text-sm">{success}</div>
        )}

        {/* Preview from AI generation */}
        {previewSummary && (
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-purple-900">Prévisualisation du résumé généré</h4>
              <Badge className="bg-purple-100 text-purple-800">IA</Badge>
            </div>
            <div className="text-sm whitespace-pre-wrap text-purple-900">{previewSummary}</div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleApplyPreview}>
                Appliquer ce résumé
              </Button>
              <Button size="sm" variant="outline" onClick={() => setPreviewSummary(null)}>
                Ignorer
              </Button>
            </div>
          </div>
        )}

        {/* Edit mode */}
        {isEditing ? (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Résumé (Markdown supporté)</label>
              <Textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                rows={10}
                placeholder="Entrez le résumé du dossier législatif...

Exemple de format :
Ce projet de loi vise à...

**Points clés :**
- Point 1
- Point 2
- Point 3"
                className="font-mono text-sm"
              />
            </div>

            <div className="bg-amber-50 text-amber-800 p-3 rounded-md text-sm">
              <strong>Rappel :</strong> Le résumé doit être basé uniquement sur les sources
              officielles (texte du dossier, exposé des motifs).
              {sourceUrl && (
                <>
                  {" "}
                  <a
                    href={sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    Voir le dossier sur assemblee-nationale.fr
                  </a>
                </>
              )}
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? "Sauvegarde..." : "Sauvegarder"}
              </Button>
              <Button variant="outline" onClick={handleCancel}>
                Annuler
              </Button>
            </div>
          </div>
        ) : (
          /* View mode */
          <div>
            {currentSummary ? (
              <div className="prose prose-sm max-w-none whitespace-pre-wrap">{currentSummary}</div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>Aucun résumé disponible pour ce dossier.</p>
                <p className="text-sm mt-2">
                  Cliquez sur &quot;Generate with AI&quot; pour générer automatiquement un résumé
                  basé sur le texte officiel.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Source reminder */}
        {sourceUrl && !isEditing && (
          <div className="pt-4 border-t">
            <p className="text-xs text-muted-foreground">
              Source officielle :{" "}
              <a
                href={sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                {sourceUrl}
              </a>
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
