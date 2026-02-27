import { ImageResponse } from "next/og";
import { db } from "@/lib/db";

export const alt = "Parti politique sur Poligraph";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const party = await db.party.findUnique({
    where: { slug },
    select: {
      name: true,
      shortName: true,
      color: true,
      logoUrl: true,
      politicalPosition: true,
      _count: { select: { politicians: true } },
    },
  });

  if (!party) {
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
        Parti non trouvé
      </div>,
      { ...size }
    );
  }

  const color = party.color || "#6366f1";
  const memberCount = party._count.politicians;

  return new ImageResponse(
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        background: "linear-gradient(135deg, #1e3a5f 0%, #0f1f3a 100%)",
        padding: 60,
        fontFamily: "system-ui, sans-serif",
      }}
    >
      {/* Left: Logo or initials */}
      <div style={{ display: "flex", alignItems: "center", marginRight: 48 }}>
        {party.logoUrl ? (
          <img
            src={party.logoUrl}
            width={180}
            height={180}
            style={{ objectFit: "contain", borderRadius: 16 }}
          />
        ) : (
          <div
            style={{
              width: 180,
              height: 180,
              borderRadius: 16,
              background: color,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontSize: 64,
              fontWeight: 700,
            }}
          >
            {party.shortName.substring(0, 3)}
          </div>
        )}
      </div>

      {/* Right: Info */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          flex: 1,
        }}
      >
        <div
          style={{
            fontSize: 44,
            fontWeight: 700,
            color: "white",
            marginBottom: 12,
          }}
        >
          {party.name}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginBottom: 20,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              padding: "8px 20px",
              borderRadius: 999,
              background: `${color}33`,
              border: `2px solid ${color}`,
              color,
              fontSize: 24,
              fontWeight: 600,
            }}
          >
            {party.shortName}
          </div>
        </div>
        <div style={{ display: "flex", gap: 32, fontSize: 24, color: "#94a3b8" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 28 }}>👥</span>
            <span>
              {memberCount} membre{memberCount > 1 ? "s" : ""}
            </span>
          </div>
        </div>
        <div style={{ fontSize: 20, color: "#475569", marginTop: 32 }}>poligraph.fr</div>
      </div>
    </div>,
    { ...size }
  );
}
