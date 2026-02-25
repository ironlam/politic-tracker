import { ImageResponse } from "next/og";
import { db } from "@/lib/db";

export const alt = "Fiche du politicien sur Poligraph";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const politician = await db.politician.findUnique({
    where: { slug },
    select: {
      firstName: true,
      lastName: true,
      photoUrl: true,
      currentParty: {
        select: { name: true, shortName: true, color: true },
      },
      mandates: {
        where: { isCurrent: true },
        take: 1,
        select: { role: true, title: true },
      },
    },
  });

  if (!politician) {
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
        Politicien non trouvé
      </div>,
      { ...size }
    );
  }

  const role = politician.mandates[0]?.role || politician.mandates[0]?.title || "";
  const partyColor = politician.currentParty?.color || "#6366f1";
  const partyName = politician.currentParty?.name || "";
  const initials = `${politician.firstName[0] || ""}${politician.lastName[0] || ""}`;

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
      {/* Left: Photo or initials */}
      <div style={{ display: "flex", alignItems: "center", marginRight: 48 }}>
        {politician.photoUrl ? (
          <img
            src={politician.photoUrl}
            width={200}
            height={200}
            style={{
              borderRadius: "50%",
              objectFit: "cover",
              border: `4px solid ${partyColor}`,
            }}
          />
        ) : (
          <div
            style={{
              width: 200,
              height: 200,
              borderRadius: "50%",
              background: partyColor,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontSize: 64,
              fontWeight: 700,
            }}
          >
            {initials}
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
            fontSize: 48,
            fontWeight: 700,
            color: "white",
            marginBottom: 16,
          }}
        >
          {politician.firstName} {politician.lastName}
        </div>
        {role && <div style={{ fontSize: 28, color: "#94a3b8", marginBottom: 12 }}>{role}</div>}
        {partyName && (
          <div style={{ display: "flex", alignItems: "center" }}>
            <div
              style={{
                width: 16,
                height: 16,
                borderRadius: "50%",
                background: partyColor,
                marginRight: 8,
              }}
            />
            <div style={{ fontSize: 24, color: partyColor }}>{partyName}</div>
          </div>
        )}
        <div style={{ fontSize: 20, color: "#475569", marginTop: 32 }}>poligraph.fr</div>
      </div>
    </div>,
    { ...size }
  );
}
