"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Newspaper, Scale } from "lucide-react";
import { EnrichAffairsButton } from "@/components/admin/EnrichAffairsButton";
import { SyncButton } from "@/components/admin/SyncButton";

interface SyncPanelProps {
  politicianId: string;
  affairCount: number;
}

export function SyncPanel({ politicianId, affairCount }: SyncPanelProps) {
  const syncUrl = `/api/admin/politiques/${politicianId}/sync`;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Synchronisation</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Enrichir affaires */}
          <div>
            <p className="text-xs text-muted-foreground mb-1">Sources presse (Brave)</p>
            <EnrichAffairsButton politicianId={politicianId} affairCount={affairCount} />
          </div>

          {/* Fact-checks */}
          <div>
            <p className="text-xs text-muted-foreground mb-1">Fact-checks (Google)</p>
            <SyncButton
              action={syncUrl}
              body={{ type: "factchecks" }}
              label="Fact-checks"
              icon={Search}
              formatStats={(stats, durationMs) => {
                const found = (stats.claimsFound as number) ?? 0;
                const created = (stats.factChecksCreated as number) ?? 0;
                return `${found} trouvés, ${created} créés (${(durationMs / 1000).toFixed(1)}s)`;
              }}
            />
          </div>

          {/* Analyse presse IA */}
          <div>
            <p className="text-xs text-muted-foreground mb-1">Analyse presse (IA)</p>
            <SyncButton
              action={syncUrl}
              body={{ type: "press" }}
              label="Analyse presse"
              icon={Newspaper}
              formatStats={(stats, durationMs) => {
                const analyzed = (stats.articlesAnalyzed as number) ?? 0;
                const affairs =
                  ((stats.affairsEnriched as number) ?? 0) +
                  ((stats.affairsCreated as number) ?? 0);
                return `${analyzed} analysés, ${affairs} affaires (${(durationMs / 1000).toFixed(1)}s)`;
              }}
            />
          </div>

          {/* Judilibre */}
          <div>
            <p className="text-xs text-muted-foreground mb-1">Décisions judiciaires (Judilibre)</p>
            <SyncButton
              action={syncUrl}
              body={{ type: "judilibre" }}
              label="Judilibre"
              icon={Scale}
              formatStats={(stats, durationMs) => {
                const decisions = (stats.decisionsFound as number) ?? 0;
                const enriched = (stats.affairsEnriched as number) ?? 0;
                return `${decisions} décisions, ${enriched} enrichies (${(durationMs / 1000).toFixed(1)}s)`;
              }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
