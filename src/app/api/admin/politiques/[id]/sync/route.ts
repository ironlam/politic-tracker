import { NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/api/with-admin-auth";
import { withValidation } from "@/lib/security/validate";
import { syncPoliticianSchema } from "@/lib/security/schemas";
import { db } from "@/lib/db";

export const maxDuration = 120;

export const POST = withAdminAuth(
  withValidation(syncPoliticianSchema, async (_request, context, { type }) => {
    const { id } = await context.params;

    const politician = await db.politician.findUnique({
      where: { id },
      select: { fullName: true, slug: true },
    });

    if (!politician) {
      return NextResponse.json({ error: "Politicien non trouvé" }, { status: 404 });
    }

    const start = Date.now();

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let stats: any;

      switch (type) {
        case "factchecks": {
          const { syncFactchecks } = await import("@/services/sync/factchecks");
          stats = await syncFactchecks({
            politician: politician.fullName,
            force: true,
          });
          break;
        }
        case "press": {
          const { syncPressAnalysis } = await import("@/services/sync/press-analysis");
          stats = await syncPressAnalysis({
            politicianSlug: politician.slug,
            force: true,
          });
          break;
        }
        case "judilibre": {
          const { syncJudilibre } = await import("@/services/sync/judilibre");
          stats = await syncJudilibre({
            politicianSlug: politician.slug,
            force: true,
          });
          break;
        }
      }

      const durationMs = Date.now() - start;

      await db.auditLog.create({
        data: {
          action: "SYNC",
          entityType: "Politician",
          entityId: id!,
          changes: { type, stats: JSON.parse(JSON.stringify(stats)), durationMs },
        },
      });

      return NextResponse.json({ type, stats, durationMs });
    } catch (error) {
      const durationMs = Date.now() - start;
      const message = error instanceof Error ? error.message : "Erreur inconnue";

      return NextResponse.json({ error: message, type, durationMs }, { status: 500 });
    }
  })
);
