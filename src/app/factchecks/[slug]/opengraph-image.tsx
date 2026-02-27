import { ImageResponse } from "next/og";
import { db } from "@/lib/db";
import type { FactCheckRating } from "@/generated/prisma";

export const alt = "Fact-check sur Poligraph";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const RATING_LABELS: Partial<Record<FactCheckRating, string>> = {
  TRUE: "Vrai",
  MOSTLY_TRUE: "Plutôt vrai",
  HALF_TRUE: "Partiellement vrai",
  MISLEADING: "Trompeur",
  OUT_OF_CONTEXT: "Hors contexte",
  MOSTLY_FALSE: "Plutôt faux",
  FALSE: "Faux",
  UNVERIFIABLE: "Invérifiable",
};

const RATING_COLORS: Partial<Record<FactCheckRating, string>> = {
  TRUE: "#22c55e",
  MOSTLY_TRUE: "#4ade80",
  HALF_TRUE: "#eab308",
  MISLEADING: "#f97316",
  OUT_OF_CONTEXT: "#f59e0b",
  MOSTLY_FALSE: "#f87171",
  FALSE: "#ef4444",
  UNVERIFIABLE: "#6b7280",
};

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const factCheck = await db.factCheck.findUnique({
    where: { slug },
    select: {
      title: true,
      claimText: true,
      verdictRating: true,
      source: true,
    },
  });

  if (!factCheck) {
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
        Fact-check non trouvé
      </div>,
      { ...size }
    );
  }

  const ratingLabel = RATING_LABELS[factCheck.verdictRating] || factCheck.verdictRating;
  const ratingColor = RATING_COLORS[factCheck.verdictRating] || "#94a3b8";

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
      {/* Label */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <span style={{ fontSize: 32 }}>🔍</span>
        <span
          style={{
            fontSize: 22,
            color: "#64748b",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: 2,
          }}
        >
          Fact-check
        </span>
      </div>

      {/* Claim */}
      {factCheck.claimText && (
        <div
          style={{
            fontSize: 28,
            color: "#94a3b8",
            marginBottom: 20,
            fontStyle: "italic",
            lineClamp: 2,
            overflow: "hidden",
            maxHeight: 80,
          }}
        >
          «{" "}
          {factCheck.claimText.length > 120
            ? factCheck.claimText.slice(0, 120) + "..."
            : factCheck.claimText}{" "}
          »
        </div>
      )}

      {/* Title */}
      <div
        style={{
          fontSize: 38,
          fontWeight: 700,
          color: "white",
          marginBottom: 28,
          lineClamp: 2,
          overflow: "hidden",
          maxHeight: 110,
        }}
      >
        {factCheck.title.length > 100 ? factCheck.title.slice(0, 100) + "..." : factCheck.title}
      </div>

      {/* Rating badge */}
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "10px 24px",
            borderRadius: 999,
            background: `${ratingColor}22`,
            border: `2px solid ${ratingColor}`,
            color: ratingColor,
            fontSize: 24,
            fontWeight: 700,
          }}
        >
          Verdict : {ratingLabel}
        </div>
        {factCheck.source && (
          <span style={{ fontSize: 20, color: "#64748b" }}>Source : {factCheck.source}</span>
        )}
      </div>

      {/* Footer */}
      <div style={{ fontSize: 20, color: "#475569", marginTop: "auto" }}>poligraph.fr</div>
    </div>,
    { ...size }
  );
}
