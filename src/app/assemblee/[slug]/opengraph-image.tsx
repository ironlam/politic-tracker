import { ImageResponse } from "next/og";
import { db } from "@/lib/db";
import type { DossierStatus } from "@/generated/prisma";

export const alt = "Dossier législatif sur Poligraph";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const STATUS_LABELS: Record<DossierStatus, string> = {
  DEPOSE: "Déposé",
  EN_COMMISSION: "En commission",
  EN_COURS: "En discussion",
  CONSEIL_CONSTITUTIONNEL: "Conseil constitutionnel",
  ADOPTE: "Adopté",
  REJETE: "Rejeté",
  RETIRE: "Retiré",
  CADUQUE: "Caduc",
};

const STATUS_COLORS: Partial<Record<DossierStatus, string>> = {
  ADOPTE: "#22c55e",
  REJETE: "#ef4444",
  RETIRE: "#6b7280",
  CADUQUE: "#6b7280",
  EN_COMMISSION: "#f59e0b",
  EN_COURS: "#3b82f6",
  CONSEIL_CONSTITUTIONNEL: "#a855f7",
};

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  // Try slug first, then id/externalId
  let dossier = await db.legislativeDossier.findUnique({
    where: { slug },
    select: { title: true, shortTitle: true, number: true, status: true, category: true },
  });
  if (!dossier) {
    dossier = await db.legislativeDossier.findUnique({
      where: { id: slug },
      select: { title: true, shortTitle: true, number: true, status: true, category: true },
    });
  }

  if (!dossier) {
    return new ImageResponse(
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          background: "linear-gradient(135deg, #1e3a5f 0%, #0f1f3a 100%)",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          fontSize: 32,
          fontFamily: "system-ui, sans-serif",
        }}
      >
        Dossier non trouvé
      </div>,
      { ...size }
    );
  }

  const statusLabel = STATUS_LABELS[dossier.status] || dossier.status;
  const statusColor = STATUS_COLORS[dossier.status] || "#94a3b8";
  const displayTitle = dossier.shortTitle || dossier.title;

  return new ImageResponse(
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        background: "linear-gradient(135deg, #1e3a5f 0%, #0f1f3a 100%)",
        padding: 60,
        fontFamily: "system-ui, sans-serif",
        justifyContent: "center",
      }}
    >
      {/* Icon + label */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <span style={{ fontSize: 32 }}>📜</span>
        <span
          style={{
            fontSize: 22,
            color: "#64748b",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: 2,
          }}
        >
          Dossier législatif
        </span>
      </div>

      {/* Number badge */}
      {dossier.number && (
        <div style={{ display: "flex", marginBottom: 20 }}>
          <div
            style={{
              display: "flex",
              padding: "6px 16px",
              borderRadius: 8,
              background: "#ffffff15",
              color: "#94a3b8",
              fontSize: 22,
              fontFamily: "monospace",
            }}
          >
            {dossier.number}
          </div>
        </div>
      )}

      {/* Title */}
      <div
        style={{
          fontSize: 40,
          fontWeight: 700,
          color: "white",
          marginBottom: 28,
          lineClamp: 3,
          overflow: "hidden",
          maxHeight: 170,
        }}
      >
        {displayTitle.length > 120 ? displayTitle.slice(0, 120) + "..." : displayTitle}
      </div>

      {/* Status badge */}
      <div style={{ display: "flex" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "10px 24px",
            borderRadius: 999,
            background: `${statusColor}22`,
            border: `2px solid ${statusColor}`,
            color: statusColor,
            fontSize: 24,
            fontWeight: 600,
          }}
        >
          {statusLabel}
        </div>
      </div>

      {/* Footer */}
      <div style={{ fontSize: 20, color: "#475569", marginTop: "auto" }}>poligraph.fr</div>
    </div>,
    { ...size }
  );
}
