"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface MandateUrlEditorProps {
  mandateId: string;
  officialUrl: string | null;
  sourceUrl: string | null;
}

export function MandateUrlEditor({ mandateId, officialUrl, sourceUrl }: MandateUrlEditorProps) {
  const [official, setOfficial] = useState(officialUrl || "");
  const [source, setSource] = useState(sourceUrl || "");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");

  const hasChanges = official !== (officialUrl || "") || source !== (sourceUrl || "");

  async function handleSave() {
    setLoading(true);
    setStatus("idle");

    try {
      const response = await fetch(`/api/admin/mandates/${mandateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          officialUrl: official || null,
          sourceUrl: source || null,
        }),
      });

      if (!response.ok) throw new Error();
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2000);
    } catch {
      setStatus("error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-2 space-y-2">
      <div>
        <Label className="text-xs text-muted-foreground">
          URL officielle (affichée aux utilisateurs)
        </Label>
        <Input
          type="url"
          value={official}
          onChange={(e) => setOfficial(e.target.value)}
          placeholder="https://www.assemblee-nationale.fr/..."
          className="h-8 text-xs"
        />
      </div>
      <div>
        <Label className="text-xs text-muted-foreground">URL source (traçabilité interne)</Label>
        <Input
          type="url"
          value={source}
          onChange={(e) => setSource(e.target.value)}
          placeholder="https://data.assemblee-nationale.fr/..."
          className="h-8 text-xs"
        />
      </div>
      {hasChanges && (
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={handleSave} disabled={loading} className="h-7 text-xs">
            {loading ? "..." : "Enregistrer"}
          </Button>
          {status === "saved" && <span className="text-xs text-green-600">Sauvegardé</span>}
          {status === "error" && <span className="text-xs text-red-600">Erreur</span>}
        </div>
      )}
    </div>
  );
}
