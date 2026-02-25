import { ImageResponse } from "next/og";
import { db } from "@/lib/db";
import type { AffairStatus } from "@/generated/prisma";

export const alt = "Affaire judiciaire sur Poligraph";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const STATUS_LABELS: Partial<Record<AffairStatus, string>> = {
  ENQUETE_PRELIMINAIRE: "Enquête préliminaire",
  INSTRUCTION: "Instruction",
  MISE_EN_EXAMEN: "Mise en examen",
  RENVOI_TRIBUNAL: "Renvoi tribunal",
  PROCES_EN_COURS: "Procès en cours",
  CONDAMNATION_PREMIERE_INSTANCE: "Condamnation (1re inst.)",
  APPEL_EN_COURS: "Appel en cours",
  CONDAMNATION_DEFINITIVE: "Condamnation définitive",
  RELAXE: "Relaxe",
  ACQUITTEMENT: "Acquittement",
  NON_LIEU: "Non-lieu",
  PRESCRIPTION: "Prescription",
  CLASSEMENT_SANS_SUITE: "Classement sans suite",
};

const STATUS_COLORS: Partial<Record<AffairStatus, string>> = {
  CONDAMNATION_DEFINITIVE: "#ef4444",
  CONDAMNATION_PREMIERE_INSTANCE: "#f97316",
  PROCES_EN_COURS: "#f59e0b",
  RELAXE: "#22c55e",
  ACQUITTEMENT: "#22c55e",
  NON_LIEU: "#22c55e",
  CLASSEMENT_SANS_SUITE: "#6b7280",
};

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const affair = await db.affair.findUnique({
    where: { slug },
    select: {
      title: true,
      status: true,
      politician: {
        select: { firstName: true, lastName: true },
      },
    },
  });

  if (!affair) {
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
        Affaire non trouvée
      </div>,
      { ...size }
    );
  }

  const statusLabel = STATUS_LABELS[affair.status] || affair.status;
  const statusColor = STATUS_COLORS[affair.status] || "#94a3b8";

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
      {/* Icon */}
      <div style={{ fontSize: 48, marginBottom: 24 }}>&#9878;&#65039;</div>

      {/* Title (truncated) */}
      <div
        style={{
          fontSize: 42,
          fontWeight: 700,
          color: "white",
          marginBottom: 20,
          lineClamp: 2,
          overflow: "hidden",
          maxHeight: 120,
        }}
      >
        {affair.title.length > 80 ? affair.title.slice(0, 80) + "..." : affair.title}
      </div>

      {/* Politician */}
      <div style={{ fontSize: 28, color: "#94a3b8", marginBottom: 20 }}>
        {affair.politician.firstName} {affair.politician.lastName}
      </div>

      {/* Status badge */}
      <div style={{ display: "flex" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "8px 20px",
            borderRadius: 999,
            background: `${statusColor}22`,
            border: `2px solid ${statusColor}`,
            color: statusColor,
            fontSize: 22,
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
