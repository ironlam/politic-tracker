import { ImageResponse } from "next/og";
import { db } from "@/lib/db";
import type { ElectionType, ElectionStatus } from "@/generated/prisma";

export const alt = "Élection sur Poligraph";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const TYPE_LABELS: Record<ElectionType, string> = {
  PRESIDENTIELLE: "Présidentielle",
  LEGISLATIVES: "Législatives",
  SENATORIALES: "Sénatoriales",
  MUNICIPALES: "Municipales",
  DEPARTEMENTALES: "Départementales",
  REGIONALES: "Régionales",
  EUROPEENNES: "Européennes",
  REFERENDUM: "Référendum",
};

const STATUS_LABELS: Record<ElectionStatus, string> = {
  UPCOMING: "À venir",
  REGISTRATION: "Inscriptions",
  CANDIDACIES: "Candidatures",
  CAMPAIGN: "Campagne",
  ROUND_1: "1er tour",
  BETWEEN_ROUNDS: "Entre-deux-tours",
  ROUND_2: "2nd tour",
  COMPLETED: "Terminée",
};

const STATUS_COLORS: Partial<Record<ElectionStatus, string>> = {
  UPCOMING: "#3b82f6",
  CAMPAIGN: "#f59e0b",
  ROUND_1: "#f97316",
  ROUND_2: "#f97316",
  COMPLETED: "#22c55e",
};

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const election = await db.election.findUnique({
    where: { slug },
    select: {
      title: true,
      type: true,
      status: true,
      round1Date: true,
      round2Date: true,
      _count: { select: { candidacies: true } },
    },
  });

  if (!election) {
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
        Élection non trouvée
      </div>,
      { ...size }
    );
  }

  const typeLabel = TYPE_LABELS[election.type] || election.type;
  const statusLabel = STATUS_LABELS[election.status] || election.status;
  const statusColor = STATUS_COLORS[election.status] || "#94a3b8";
  const date = election.round1Date
    ? new Date(election.round1Date).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

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
      {/* Type badge */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <span style={{ fontSize: 36 }}>🗳️</span>
        <span
          style={{
            fontSize: 22,
            color: "#64748b",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: 2,
          }}
        >
          {typeLabel}
        </span>
      </div>

      {/* Title */}
      <div
        style={{
          fontSize: 46,
          fontWeight: 700,
          color: "white",
          marginBottom: 24,
        }}
      >
        {election.title.length > 80 ? election.title.slice(0, 80) + "..." : election.title}
      </div>

      {/* Date + Status */}
      <div style={{ display: "flex", alignItems: "center", gap: 24, marginBottom: 20 }}>
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
        {date && <span style={{ fontSize: 24, color: "#94a3b8" }}>{date}</span>}
      </div>

      {/* Candidacies count */}
      {election._count.candidacies > 0 && (
        <div style={{ display: "flex", gap: 8, fontSize: 22, color: "#94a3b8" }}>
          <span>👤</span>
          <span>
            {election._count.candidacies} candidat{election._count.candidacies > 1 ? "s" : ""}
          </span>
        </div>
      )}

      {/* Footer */}
      <div style={{ fontSize: 20, color: "#475569", marginTop: "auto" }}>poligraph.fr</div>
    </div>,
    { ...size }
  );
}
