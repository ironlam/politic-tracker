import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt = "Transparence Politique - Observatoire citoyen des représentants politiques français";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #1e3a5f 0%, #0f1f3a 100%)",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {/* Logo */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 120,
            height: 120,
            borderRadius: 24,
            background: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
            marginBottom: 40,
            boxShadow: "0 20px 40px rgba(0,0,0,0.3)",
          }}
        >
          <span
            style={{
              fontSize: 56,
              fontWeight: 700,
              color: "white",
            }}
          >
            TP
          </span>
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: 72,
            fontWeight: 700,
            color: "white",
            marginBottom: 20,
            textAlign: "center",
          }}
        >
          Transparence Politique
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: 32,
            color: "#94a3b8",
            marginBottom: 40,
            textAlign: "center",
            maxWidth: 900,
          }}
        >
          Observatoire citoyen des représentants politiques français
        </div>

        {/* Features */}
        <div
          style={{
            display: "flex",
            gap: 40,
            fontSize: 24,
            color: "#64748b",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 28 }}>📜</span>
            <span>Mandats</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 28 }}>💰</span>
            <span>Patrimoine</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 28 }}>⚖️</span>
            <span>Affaires judiciaires</span>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            position: "absolute",
            bottom: 40,
            fontSize: 20,
            color: "#475569",
          }}
        >
          transparence-politique.fr
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
